import { describe, test, expect, afterEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { startFixtureServer, type TestServer } from "./helpers/testServer.js";
import { buildTestApp, type TestApp } from "./helpers/buildApp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures");

async function waitForJob(app: TestApp["app"], jobId: string, timeoutMs = 5000) {

    const deadline = Date.now() + timeoutMs;

    for (;;) {

        const response = await app.inject({ method: "GET", url: `/jobs/${jobId}` });
        const body = response.json();

        if (body.status === "completed" || body.status === "failed") {
            return body;
        }

        if (Date.now() > deadline) {
            throw new Error(`Timed out waiting for job ${jobId}, last status: ${body.status}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 20));
    }
}

describe("Phase 11: async scraping jobs", () => {

    let server: TestServer | undefined;
    let testApp: TestApp | undefined;
    let configsDir: string | undefined;

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
    });

    async function setup() {
        server = await startFixtureServer(path.join(FIXTURES, "simple"));
        configsDir = await mkdtemp(path.join(tmpdir(), "scraper-jobs-test-"));
        testApp = await buildTestApp(configsDir);
    }

    test("async: true returns 202 with a queued job, then completes", async () => {

        await setup();

        const created = await testApp!.app.inject({
            method: "POST",
            url: "/scrape",
            payload: {
                url: `${server!.url}/index.html`,
                selector: ".name",
                extract: "text",
                async: true
            }
        });

        expect(created.statusCode).toBe(202);
        const { jobId, status } = created.json();
        expect(status).toBe("queued");
        expect(typeof jobId).toBe("string");

        const finished = await waitForJob(testApp!.app, jobId);

        expect(finished.status).toBe("completed");
        expect(finished.result.data).toEqual(["Gaming Laptop"]);
        expect(finished.result.url).toBe(`${server!.url}/index.html`);
        expect(finished.result.metadata.items).toBe(1);
    });

    test("without async, behavior is unchanged — a normal 200 with data, not a job", async () => {

        await setup();

        const response = await testApp!.app.inject({
            method: "POST",
            url: "/scrape",
            payload: {
                url: `${server!.url}/index.html`,
                selector: ".name",
                extract: "text"
            }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().data).toEqual(["Gaming Laptop"]);
        expect(response.json().jobId).toBeUndefined();
    });

    test("a failing async scrape produces a 'failed' job with error details, not a crash", async () => {

        await setup();

        const created = await testApp!.app.inject({
            method: "POST",
            url: "/scrape",
            payload: {
                url: `${server!.url}/index.html`,
                selector: ".this-does-not-exist",
                extract: "text",
                async: true
            }
        });

        expect(created.statusCode).toBe(202);

        const finished = await waitForJob(testApp!.app, created.json().jobId);

        expect(finished.status).toBe("failed");
        expect(finished.error.code).toBe("SELECTOR_NOT_FOUND");
    });

    test("GET /jobs/:id for an unknown id returns 404 JOB_NOT_FOUND", async () => {

        await setup();

        const response = await testApp!.app.inject({ method: "GET", url: "/jobs/does-not-exist" });

        expect(response.statusCode).toBe(404);
        expect(response.json().error.code).toBe("JOB_NOT_FOUND");
    });

    test("an invalid request body is rejected synchronously (400), even with async: true — no job is created", async () => {

        await setup();

        const response = await testApp!.app.inject({
            method: "POST",
            url: "/scrape",
            payload: { url: "not-a-url", selector: ".x", extract: "text", async: true }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().jobId).toBeUndefined();
    });

    test("async jobs go through the same cache as sync requests", async () => {

        await setup();

        const payload = {
            url: `${server!.url}/index.html`,
            selector: ".name",
            extract: "text",
            cache: { enabled: true, ttl: 60 },
            async: true
        };

        const first = await testApp!.app.inject({ method: "POST", url: "/scrape", payload });
        const firstResult = await waitForJob(testApp!.app, first.json().jobId);
        expect(firstResult.result.metadata.cached).toBe(false);

        const second = await testApp!.app.inject({ method: "POST", url: "/scrape", payload });
        const secondResult = await waitForJob(testApp!.app, second.json().jobId);
        expect(secondResult.result.metadata.cached).toBe(true);
    });
});
