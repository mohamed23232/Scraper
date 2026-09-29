import { describe, test, expect, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startFixtureServer, type TestServer } from "./helpers/testServer.js";
import { BrowserStrategy } from "../src/strategies/BrowserStrategy.js";
import { ScraperError } from "../src/core/errors/ScraperError.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures");

describe("BrowserStrategy", () => {

    const strategy = new BrowserStrategy();

    afterAll(async () => {
        await strategy.close();
    });

    test("A1 regression: file:// URLs are blocked (previously allowed local file reads)", async () => {
        await expect(strategy.scrape("file:///etc/passwd")).rejects.toThrow(ScraperError);

        try {
            await strategy.scrape("file:///etc/passwd");
            expect.unreachable("should have thrown");
        } catch (error) {
            expect((error as ScraperError).code).toBe("URL_NOT_ALLOWED");
        }
    });

    test("A6: the shared browser survives and works across multiple scrape calls", async () => {

        const server: TestServer = await startFixtureServer(path.join(FIXTURES, "simple"));

        try {
            const first = await strategy.scrape(`${server.url}/index.html`);
            const second = await strategy.scrape(`${server.url}/index.html`);

            expect(first.body).toContain("Gaming Laptop");
            expect(second.body).toContain("Gaming Laptop");
        } finally {
            await server.close();
        }
    });
});
