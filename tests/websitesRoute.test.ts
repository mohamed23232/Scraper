import { describe, test, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { buildTestApp, type TestApp } from "./helpers/buildApp.js";
import { startFixtureServer, type TestServer } from "./helpers/testServer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures");

describe("Phase 8: /websites CRUD API", () => {

    let configsDir: string;
    let testApp: TestApp;

    beforeEach(async () => {
        configsDir = await mkdtemp(path.join(tmpdir(), "scraper-websites-"));
        testApp = await buildTestApp(configsDir);
    });

    afterEach(async () => {
        await testApp.app.close();
        await testApp.browserStrategy.close();
        await rm(configsDir, { recursive: true, force: true });
    });

    const validConfig = {
        id: "mysite",
        name: "My Site",
        startUrl: "https://example.com",
        scraper: { type: "static" },
        item: { selector: ".product" },
        fields: { name: { selector: ".name", extract: "text" } }
    };

    test("GET /websites returns [] when no configs exist", async () => {

        const response = await testApp.app.inject({ method: "GET", url: "/websites" });

        expect(response.statusCode).toBe(200);
        expect(response.json().data).toEqual([]);
    });

    test("POST /websites creates a config, GET /websites lists it, GET /websites/:id fetches it", async () => {

        const created = await testApp.app.inject({
            method: "POST",
            url: "/websites",
            payload: validConfig
        });

        expect(created.statusCode).toBe(201);
        expect(created.json().data.startUrl).toBe("https://example.com");

        const onDisk = JSON.parse(await readFile(path.join(configsDir, "mysite.json"), "utf-8"));
        expect(onDisk.id).toBe("mysite");

        const list = await testApp.app.inject({ method: "GET", url: "/websites" });
        expect(list.json().data).toEqual([{ id: "mysite", name: "My Site", startUrl: "https://example.com" }]);

        const fetched = await testApp.app.inject({ method: "GET", url: "/websites/mysite" });
        expect(fetched.statusCode).toBe(200);
        expect(fetched.json().data.id).toBe("mysite");
    });

    test("POST /websites rejects a duplicate id with 409 CONFLICT", async () => {

        await testApp.app.inject({ method: "POST", url: "/websites", payload: validConfig });

        const second = await testApp.app.inject({ method: "POST", url: "/websites", payload: validConfig });

        expect(second.statusCode).toBe(409);
        expect(second.json().error.code).toBe("CONFLICT");
    });

    test("POST /websites rejects an invalid config with 400", async () => {

        const response = await testApp.app.inject({
            method: "POST",
            url: "/websites",
            payload: { id: "bad", scraper: { type: "static" } } // missing item/fields/startUrl
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().error.code).toBe("INVALID_CONFIGURATION");
    });

    test("GET /websites/:id for an id that doesn't exist returns 404 CONFIG_NOT_FOUND", async () => {

        const response = await testApp.app.inject({ method: "GET", url: "/websites/does-not-exist" });

        expect(response.statusCode).toBe(404);
        expect(response.json().error.code).toBe("CONFIG_NOT_FOUND");
    });

    test("PUT /websites/:id updates an existing config", async () => {

        await testApp.app.inject({ method: "POST", url: "/websites", payload: validConfig });

        const updated = await testApp.app.inject({
            method: "PUT",
            url: "/websites/mysite",
            payload: { ...validConfig, name: "Renamed Site" }
        });

        expect(updated.statusCode).toBe(200);
        expect(updated.json().data.name).toBe("Renamed Site");

        const fetched = await testApp.app.inject({ method: "GET", url: "/websites/mysite" });
        expect(fetched.json().data.name).toBe("Renamed Site");
    });

    test("PUT /websites/:id also creates the config if it doesn't exist yet", async () => {

        const response = await testApp.app.inject({
            method: "PUT",
            url: "/websites/mysite",
            payload: validConfig
        });

        expect(response.statusCode).toBe(200);

        const fetched = await testApp.app.inject({ method: "GET", url: "/websites/mysite" });
        expect(fetched.statusCode).toBe(200);
    });

    test("PUT /websites/:id rejects a body id that conflicts with the URL id", async () => {

        const response = await testApp.app.inject({
            method: "PUT",
            url: "/websites/mysite",
            payload: { ...validConfig, id: "someone-else" }
        });

        expect(response.statusCode).toBe(400);
    });

    test("DELETE /websites/:id removes the config", async () => {

        await testApp.app.inject({ method: "POST", url: "/websites", payload: validConfig });

        const deleted = await testApp.app.inject({ method: "DELETE", url: "/websites/mysite" });
        expect(deleted.statusCode).toBe(204);

        const fetched = await testApp.app.inject({ method: "GET", url: "/websites/mysite" });
        expect(fetched.statusCode).toBe(404);
    });

    test("DELETE /websites/:id for an id that doesn't exist returns 404", async () => {

        const response = await testApp.app.inject({ method: "DELETE", url: "/websites/does-not-exist" });

        expect(response.statusCode).toBe(404);
        expect(response.json().error.code).toBe("CONFIG_NOT_FOUND");
    });

    test("regression: /scrape in website mode works against a config created via POST /websites", async () => {

        const server: TestServer = await startFixtureServer(path.join(FIXTURES, "simple"));

        try {
            await testApp.app.inject({
                method: "POST",
                url: "/websites",
                payload: {
                    id: "mysite",
                    startUrl: `${server.url}/index.html`,
                    scraper: { type: "static" },
                    item: { selector: ".product" },
                    fields: { name: { selector: ".name", extract: "text" } }
                }
            });

            const response = await testApp.app.inject({
                method: "POST",
                url: "/scrape",
                payload: { website: "mysite" }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().data).toEqual([{ name: "Gaming Laptop" }]);

        } finally {
            await server.close();
        }
    });
});
