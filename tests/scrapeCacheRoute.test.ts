import { describe, test, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { startFixtureServer, type TestServer } from "./helpers/testServer.js";
import { buildTestApp, type TestApp } from "./helpers/buildApp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures");

describe("Phase 10: caching", () => {

    let server: TestServer | undefined;
    let testApp: TestApp | undefined;
    let configsDir: string | undefined;
    let requestCount = 0;

    afterEach(async () => {
        await testApp?.app.close();
        await testApp?.browserStrategy.close();
        await server?.close();
        if (configsDir) {
            await rm(configsDir, { recursive: true, force: true });
        }
        server = undefined;
        testApp = undefined;
        configsDir = undefined;
        requestCount = 0;
    });

    async function setup() {
        server = await startFixtureServer(path.join(FIXTURES, "simple"), {
            "/index.html": (_req, res) => {
                requestCount++;
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(`<div class="product"><span class="name">Gaming Laptop</span></div>`);
            }
        });
        configsDir = await mkdtemp(path.join(tmpdir(), "scraper-cache-test-"));
        testApp = await buildTestApp(configsDir);
    }

    test("a second identical request with caching enabled does NOT hit the site again", async () => {

        await setup();

        const payload = {
            url: `${server!.url}/index.html`,
            selector: ".name",
            extract: "text",
            cache: { enabled: true, ttl: 60 }
        };

        const first = await testApp!.app.inject({ method: "POST", url: "/scrape", payload });
        const second = await testApp!.app.inject({ method: "POST", url: "/scrape", payload });

        expect(first.json().metadata.cached).toBe(false);
        expect(second.json().metadata.cached).toBe(true);
        expect(second.json().data).toEqual(first.json().data);
        expect(requestCount).toBe(1); // the site was only ever fetched once
    });

    test("without caching, every request hits the site again", async () => {

        await setup();

        const payload = {
            url: `${server!.url}/index.html`,
            selector: ".name",
            extract: "text"
        };

        await testApp!.app.inject({ method: "POST", url: "/scrape", payload });
        await testApp!.app.inject({ method: "POST", url: "/scrape", payload });

        expect(requestCount).toBe(2);
    });

    test("a different selector produces a different cache key (no false cache hit)", async () => {

        await setup();

        const base = { url: `${server!.url}/index.html`, extract: "text", cache: { enabled: true, ttl: 60 } };

        await testApp!.app.inject({ method: "POST", url: "/scrape", payload: { ...base, selector: ".name" } });
        const response = await testApp!.app.inject({ method: "POST", url: "/scrape", payload: { ...base, selector: ".product" } });

        expect(response.json().metadata.cached).toBe(false);
        expect(requestCount).toBe(2);
    });

    test("a cache entry expires after its ttl (1s — the schema's minimum) and re-fetches", async () => {

        await setup();

        const payload = {
            url: `${server!.url}/index.html`,
            selector: ".name",
            extract: "text",
            cache: { enabled: true, ttl: 1 } // zod requires a positive integer; smallest is 1 second
        };

        const first = await testApp!.app.inject({ method: "POST", url: "/scrape", payload });
        expect(first.json().metadata.cached).toBe(false);
        expect(requestCount).toBe(1);

        const stillCached = await testApp!.app.inject({ method: "POST", url: "/scrape", payload });
        expect(stillCached.json().metadata.cached).toBe(true);
        expect(requestCount).toBe(1);

        await new Promise((resolve) => setTimeout(resolve, 1100));

        const afterExpiry = await testApp!.app.inject({ method: "POST", url: "/scrape", payload });
        expect(afterExpiry.json().metadata.cached).toBe(false);
        expect(requestCount).toBe(2);
    });

    test("website mode honors the config's own cache setting", async () => {

        await setup();

        await testApp!.app.inject({
            method: "PUT",
            url: "/websites/cached-site",
            payload: {
                startUrl: `${server!.url}/index.html`,
                scraper: { type: "static" },
                item: { selector: ".product" },
                fields: { name: { selector: ".name", extract: "text" } },
                cache: { enabled: true, ttl: 60 }
            }
        });

        const first = await testApp!.app.inject({ method: "POST", url: "/scrape", payload: { website: "cached-site" } });
        const second = await testApp!.app.inject({ method: "POST", url: "/scrape", payload: { website: "cached-site" } });

        expect(first.json().metadata.cached).toBe(false);
        expect(second.json().metadata.cached).toBe(true);
        expect(requestCount).toBe(1);
    });
});
