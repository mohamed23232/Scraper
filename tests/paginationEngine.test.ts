import { describe, test, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startFixtureServer, type TestServer } from "./helpers/testServer.js";
import { HttpClient } from "../src/core/http/HttpClient.js";
import { StaticStrategy } from "../src/strategies/StaticStrategy.js";
import { BrowserStrategy } from "../src/strategies/BrowserStrategy.js";
import { ScraperEngine } from "../src/core/scraper/ScraperEngine.js";
import { ExtractionEngine } from "../src/extractors/ExtractionEngine.js";
import { PaginationEngine } from "../src/core/pagination/PaginationEngine.js";
import { ScraperError } from "../src/core/errors/ScraperError.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures");

function makeEngine() {
    const httpClient = new HttpClient();
    const staticStrategy = new StaticStrategy(httpClient);
    const browserStrategy = new BrowserStrategy();
    const scraperEngine = new ScraperEngine(staticStrategy, browserStrategy);
    const extractionEngine = new ExtractionEngine();
    return new PaginationEngine(scraperEngine, extractionEngine);
}

describe("PaginationEngine", () => {

    let server: TestServer | undefined;

    afterEach(async () => {
        if (server) {
            await server.close();
            server = undefined;
        }
    });

    test("A3: absoluteUrl resolves each item against its OWN page's URL, not the start URL", async () => {

        server = await startFixtureServer(path.join(FIXTURES, "pagination-baseurl"));
        const engine = makeEngine();

        const result = await engine.scrapeAllPages(
            `${server.url}/index.html`,
            ".product",
            {
                name: { selector: ".name", extract: "text" },
                image: { selector: "img", extract: "attribute", attribute: "src", transform: ["absoluteUrl"] }
            },
            undefined,
            { enabled: true, nextSelector: "li.next a" }
        );

        expect(result.items).toEqual([
            { name: "Book A", image: `${server.url}/media/a.jpg` },
            { name: "Book B", image: `${server.url}/media/b.jpg` }
        ]);
        expect(result.stopReason).toBe("lastPage");
        expect(result.pages).toBe(2);
        expect(result.truncated).toBe(false);
    });

    test("A3: a <base href> tag takes priority over the page's own URL", async () => {

        server = await startFixtureServer(path.join(FIXTURES, "base-href"));
        const engine = makeEngine();

        const result = await engine.scrapeAllPages(
            `${server.url}/index.html`,
            ".product",
            {
                image: { selector: "img", extract: "attribute", attribute: "src", transform: ["absoluteUrl"] }
            },
            undefined,
            undefined
        );

        expect(result.items).toEqual([
            { image: "https://cdn.example.com/assets/laptop.jpg" }
        ]);
        expect(result.stopReason).toBe("lastPage");
        expect(result.pages).toBe(1);
    });

    test("B5: stopReason is 'duplicateUrl' when an A<->B link loop is detected", async () => {

        server = await startFixtureServer(path.join(FIXTURES, "loop"));
        const engine = makeEngine();

        const result = await engine.scrapeAllPages(
            `${server.url}/a.html`,
            ".item",
            { name: { selector: ".name", extract: "text" } },
            undefined,
            { enabled: true, nextSelector: ".next", maxPages: 50 }
        );

        expect(result.items).toEqual([{ name: "Item A" }, { name: "Item B" }]);
        expect(result.stopReason).toBe("duplicateUrl");
        expect(result.pages).toBe(2);
    });

    test("B4: content-duplicate detection stops when a page repeats the previous page's items verbatim", async () => {

        // A "next" link with a different URL each time (so URL-based dedup never
        // fires), but the server always returns the exact same content — this is
        // the "site clamps out-of-range pages back to the last one" case.
        server = await startFixtureServer(path.join(FIXTURES, "loop"), {
            "/stuck.html": (_req, res) => {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(`
                    <div class="item"><span class="name">Only Item</span></div>
                    <a class="next" href="/stuck.html?t=${Date.now()}">next</a>
                `);
            }
        });

        const engine = makeEngine();

        const result = await engine.scrapeAllPages(
            `${server.url}/stuck.html`,
            ".item",
            { name: { selector: ".name", extract: "text" } },
            undefined,
            { enabled: true, nextSelector: ".next", maxPages: 50 }
        );

        expect(result.items).toEqual([{ name: "Only Item" }]);
        expect(result.stopReason).toBe("duplicateContent");
    });

    test("B5: maxPages and maxItems report the matching stopReason and truncated: true", async () => {

        server = await startFixtureServer(path.join(FIXTURES, "pagination-baseurl"));
        const engine = makeEngine();

        const result = await engine.scrapeAllPages(
            `${server.url}/index.html`,
            ".product",
            { name: { selector: ".name", extract: "text" } },
            undefined,
            { enabled: true, nextSelector: "li.next a", maxPages: 1 }
        );

        expect(result.items).toEqual([{ name: "Book A" }]);
        expect(result.stopReason).toBe("maxPages");
        expect(result.truncated).toBe(true);
    });

    test("B5: a page-2+ failure returns partial results with stopReason 'error' by default", async () => {

        server = await startFixtureServer(path.join(FIXTURES, "loop"), {
            "/first.html": (_req, res) => {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(`
                    <div class="item"><span class="name">Item 1</span></div>
                    <a class="next" href="/broken.html">next</a>
                `);
            },
            "/broken.html": (_req, res) => {
                res.writeHead(500);
                res.end("boom");
            }
        });

        const engine = makeEngine();

        const result = await engine.scrapeAllPages(
            `${server.url}/first.html`,
            ".item",
            { name: { selector: ".name", extract: "text" } },
            undefined,
            { enabled: true, nextSelector: ".next", maxPages: 10 }
        );

        expect(result.items).toEqual([{ name: "Item 1" }]);
        expect(result.stopReason).toBe("error");
        expect(result.truncated).toBe(true);
        expect(result.warnings).toHaveLength(1);
    });

    test("B5: pagination.failOnPageError: true rethrows instead of returning partial results", async () => {

        server = await startFixtureServer(path.join(FIXTURES, "loop"), {
            "/first.html": (_req, res) => {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(`
                    <div class="item"><span class="name">Item 1</span></div>
                    <a class="next" href="/broken.html">next</a>
                `);
            },
            "/broken.html": (_req, res) => {
                res.writeHead(500);
                res.end("boom");
            }
        });

        const engine = makeEngine();

        await expect(
            engine.scrapeAllPages(
                `${server.url}/first.html`,
                ".item",
                { name: { selector: ".name", extract: "text" } },
                undefined,
                { enabled: true, nextSelector: ".next", maxPages: 10, failOnPageError: true }
            )
        ).rejects.toThrow();
    });

    test("A2: an overall duration budget cuts off a page whose fetch runs past it", async () => {

        // A2's own spec: before B5's graceful partial-results handling existed
        // this was allowed to surface as TIMEOUT; now that a mid-page failure
        // returns partial results (B5), the budget-exhaustion case does too.
        let requestCount = 0;

        server = await startFixtureServer(path.join(FIXTURES, "loop"), {
            "/slow.html": async (_req, res) => {
                requestCount++;
                // Page 1 responds immediately (fits the budget); page 2 is slow
                // enough that its clipped remaining-time timeout fires first.
                if (requestCount > 1) {
                    await new Promise((resolve) => setTimeout(resolve, 200));
                }
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(`
                    <div class="item"><span class="name">Item ${requestCount}</span></div>
                    <a class="next" href="/slow.html?${requestCount}">next</a>
                `);
            }
        });

        const engine = makeEngine();

        const result = await engine.scrapeAllPages(
            `${server.url}/slow.html`,
            ".item",
            { name: { selector: ".name", extract: "text" } },
            undefined,
            { enabled: true, nextSelector: ".next", maxPages: 100, maxDurationMs: 50 }
        );

        expect(result.items).toEqual([{ name: "Item 1" }]);
        expect(result.stopReason).toBe("error");
        expect(result.truncated).toBe(true);
        expect(result.warnings[0]).toContain("(TIMEOUT)");
    });

    test("A2: the loop stops cleanly (no error) once the budget is already spent before the next fetch starts", async () => {

        let requestCount = 0;

        server = await startFixtureServer(path.join(FIXTURES, "loop"), {
            "/fast.html": async (_req, res) => {
                requestCount++;
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(`
                    <div class="item"><span class="name">Item ${requestCount}</span></div>
                    <a class="next" href="/fast.html?${requestCount}">next</a>
                `);
            }
        });

        const engine = makeEngine();

        const result = await engine.scrapeAllPages(
            `${server.url}/fast.html`,
            ".item",
            { name: { selector: ".name", extract: "text" } },
            undefined,
            { enabled: true, nextSelector: ".next", maxPages: 100, maxDurationMs: 0 }
        );

        expect(result.items).toEqual([]);
        expect(result.stopReason).toBe("timeout");
        expect(result.truncated).toBe(true);
    });
});
