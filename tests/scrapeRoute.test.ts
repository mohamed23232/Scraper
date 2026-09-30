import { describe, test, expect, beforeAll, afterAll, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { startFixtureServer, type TestServer } from "./helpers/testServer.js";
import { buildTestApp, type TestApp } from "./helpers/buildApp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures");

describe("B6: request modes", () => {

    let server: TestServer;
    let configsDir: string;
    let testApp: TestApp;

    beforeAll(async () => {
        server = await startFixtureServer(path.join(FIXTURES, "simple"));
        configsDir = await mkdtemp(path.join(tmpdir(), "scraper-configs-"));

        await writeFile(
            path.join(configsDir, "testsite.json"),
            JSON.stringify({
                id: "testsite",
                startUrl: `${server.url}/index.html`,
                scraper: { type: "static" },
                item: { selector: ".product" },
                fields: { name: { selector: ".name", extract: "text" } }
            })
        );

        await writeFile(
            path.join(configsDir, "legacy.json"),
            JSON.stringify({
                id: "legacy",
                website: `${server.url}/index.html`,
                scraper: { type: "static" },
                item: { selector: ".product" },
                fields: { name: { selector: ".name", extract: "text" } }
            })
        );

        testApp = await buildTestApp(configsDir);
    });

    afterAll(async () => {
        await testApp.app.close();
        await testApp.browserStrategy.close();
        await server.close();
        await rm(configsDir, { recursive: true, force: true });
    });

    test("website mode: url can be omitted, defaults to the config's startUrl", async () => {

        const response = await testApp.app.inject({
            method: "POST",
            url: "/scrape",
            payload: { website: "testsite" }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.url).toBe(`${server.url}/index.html`);
        expect(body.data).toEqual([{ name: "Gaming Laptop" }]);
    });

    test("website mode: still works with the deprecated 'website' config field", async () => {

        const response = await testApp.app.inject({
            method: "POST",
            url: "/scrape",
            payload: { website: "legacy" }
        });

        expect(response.statusCode).toBe(200);
    });

    test("website mode: a url on the same host as startUrl is accepted", async () => {

        const response = await testApp.app.inject({
            method: "POST",
            url: "/scrape",
            payload: { website: "testsite", url: `${server.url}/index.html` }
        });

        expect(response.statusCode).toBe(200);
    });

    test("website mode: a url on a DIFFERENT host than startUrl is rejected", async () => {

        const response = await testApp.app.inject({
            method: "POST",
            url: "/scrape",
            payload: { website: "testsite", url: "https://totally-different-site.example/" }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().error.code).toBe("INVALID_CONFIGURATION");
    });

    test("ambiguous body (both config and website) is rejected, not silently matched", async () => {

        const response = await testApp.app.inject({
            method: "POST",
            url: "/scrape",
            payload: {
                url: `${server.url}/index.html`,
                website: "testsite",
                config: {
                    item: { selector: ".product" },
                    fields: { name: { selector: ".name", extract: "text" } }
                }
            }
        });

        expect(response.statusCode).toBe(400);
    });

    test("an unknown extra field on a flat request is rejected (strict mode)", async () => {

        const response = await testApp.app.inject({
            method: "POST",
            url: "/scrape",
            payload: {
                url: `${server.url}/index.html`,
                selector: ".name",
                extract: "text",
                bogusField: true
            }
        });

        expect(response.statusCode).toBe(400);
    });
});

describe("B6: ALLOW_INLINE_CONFIGS gating", () => {

    let server: TestServer;
    let configsDir: string;
    let testApp: TestApp;

    beforeAll(async () => {
        server = await startFixtureServer(path.join(FIXTURES, "simple"));
        configsDir = await mkdtemp(path.join(tmpdir(), "scraper-configs-gating-"));
        testApp = await buildTestApp(configsDir);
    });

    afterAll(async () => {
        await testApp.app.close();
        await testApp.browserStrategy.close();
        await server.close();
        await rm(configsDir, { recursive: true, force: true });
        delete process.env["ALLOW_INLINE_CONFIGS"];
    });

    afterEach(() => {
        delete process.env["ALLOW_INLINE_CONFIGS"];
    });

    test("flat mode is rejected when ALLOW_INLINE_CONFIGS=false", async () => {

        process.env["ALLOW_INLINE_CONFIGS"] = "false";

        const response = await testApp.app.inject({
            method: "POST",
            url: "/scrape",
            payload: { url: `${server.url}/index.html`, selector: ".name", extract: "text" }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().error.code).toBe("INVALID_CONFIGURATION");
    });

    test("flat mode succeeds when ALLOW_INLINE_CONFIGS=true", async () => {

        process.env["ALLOW_INLINE_CONFIGS"] = "true";

        const response = await testApp.app.inject({
            method: "POST",
            url: "/scrape",
            payload: { url: `${server.url}/index.html`, selector: ".name", extract: "text" }
        });

        expect(response.statusCode).toBe(200);
    });
});
