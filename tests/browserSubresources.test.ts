import { describe, test, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startFixtureServer, type TestServer } from "./helpers/testServer.js";
import { BrowserStrategy } from "../src/strategies/BrowserStrategy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures");

describe("A4: browser subresource requests are policy-checked, not just navigation", () => {

    let server: TestServer | undefined;
    let strategy: BrowserStrategy | undefined;

    afterEach(async () => {
        await strategy?.close();
        await server?.close();
        server = undefined;
        strategy = undefined;
    });

    test("a blocked file:// subresource (img + fetch) is aborted, and the scrape still succeeds", async () => {

        const markers: string[] = [];
        let trackingGifHits = 0;

        server = await startFixtureServer(path.join(FIXTURES, "browser-subresources"), {
            "/tracking.gif": (_req, res) => {
                trackingGifHits++;
                res.writeHead(200, { "Content-Type": "image/gif" });
                res.end();
            },
            "/marker": (req, res) => {
                const url = new URL(req.url ?? "", "http://localhost");
                markers.push(url.searchParams.get("type") ?? "");
                res.writeHead(200);
                res.end();
            }
        });

        strategy = new BrowserStrategy();

        const page = await strategy.scrape(`${server.url}/index.html`, {
            waitFor: ".product",
            timeout: 8000,
            blockResources: false // don't block images here — we want tracking.gif's normal request to go through
        });

        expect(page.body).toContain("Item");

        // give the page's fire-and-forget onerror/catch handlers a moment to reach our marker route
        await new Promise((resolve) => setTimeout(resolve, 300));

        expect(markers).toContain("img-blocked-error");
        expect(markers).toContain("fetch-blocked-error");
        expect(trackingGifHits).toBeGreaterThan(0);
    });

    test("scraper.blockResources (default true) drops image requests before they reach the server", async () => {

        let trackingGifHits = 0;

        server = await startFixtureServer(path.join(FIXTURES, "browser-subresources"), {
            "/tracking.gif": (_req, res) => {
                trackingGifHits++;
                res.writeHead(200, { "Content-Type": "image/gif" });
                res.end();
            },
            "/marker": (_req, res) => {
                res.writeHead(200);
                res.end();
            }
        });

        strategy = new BrowserStrategy();

        await strategy.scrape(`${server.url}/index.html`, { waitFor: ".product", timeout: 8000 });

        await new Promise((resolve) => setTimeout(resolve, 200));

        expect(trackingGifHits).toBe(0);
    });
});
