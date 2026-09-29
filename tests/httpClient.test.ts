import { describe, test, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startFixtureServer, type TestServer } from "./helpers/testServer.js";
import { HttpClient } from "../src/core/http/HttpClient.js";
import { ScraperError } from "../src/core/errors/ScraperError.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures");

describe("HttpClient (A1 redirects + A2 timeouts + B1 FetchedPage)", () => {

    let server: TestServer;

    beforeAll(async () => {
        server = await startFixtureServer(path.join(FIXTURES, "simple"), {
            "/redirect-once": (_req, res) => {
                res.writeHead(302, { Location: "/index.html" });
                res.end();
            },
            "/redirect-loop": (_req, res) => {
                res.writeHead(302, { Location: "/redirect-loop" });
                res.end();
            },
            "/hang": () => {
                // never responds
            }
        });
    });

    afterAll(async () => {
        await server.close();
    });

    test("returns body, finalUrl, status, and contentType for a plain page", async () => {
        const client = new HttpClient();
        const page = await client.get(`${server.url}/index.html`);

        expect(page.status).toBe(200);
        expect(page.finalUrl).toBe(`${server.url}/index.html`);
        expect(page.contentType).toContain("text/html");
        expect(page.body).toContain("Gaming Laptop");
    });

    test("follows a redirect and reports the final URL, not the original", async () => {
        const client = new HttpClient();
        const page = await client.get(`${server.url}/redirect-once`);

        expect(page.finalUrl).toBe(`${server.url}/index.html`);
        expect(page.body).toContain("Gaming Laptop");
    });

    test("gives up after too many redirects", async () => {
        const client = new HttpClient();
        await expect(client.get(`${server.url}/redirect-loop`)).rejects.toThrow(ScraperError);
    });

    test("404 is reported as PAGE_NOT_FOUND", async () => {
        const client = new HttpClient();

        try {
            await client.get(`${server.url}/does-not-exist.html`);
            expect.unreachable("should have thrown");
        } catch (error) {
            expect(error).toBeInstanceOf(ScraperError);
            expect((error as ScraperError).code).toBe("PAGE_NOT_FOUND");
        }
    });

    test("a hanging request is aborted by the timeout", async () => {
        const client = new HttpClient();

        try {
            await client.get(`${server.url}/hang`, 200);
            expect.unreachable("should have thrown");
        } catch (error) {
            expect(error).toBeInstanceOf(ScraperError);
            expect((error as ScraperError).code).toBe("TIMEOUT");
        }
    });
});
