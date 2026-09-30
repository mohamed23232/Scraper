import { describe, test, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RedisMemoryServer } from "redis-memory-server";
import { Worker } from "bullmq";
import { Redis } from "ioredis";

import { startFixtureServer, type TestServer } from "./helpers/testServer.js";
import { buildTestApp, type TestApp } from "./helpers/buildApp.js";
import { BullMqJobQueue } from "../src/core/jobs/BullMqJobQueue.js";
import { createRedisConnection, QUEUE_NAME } from "../src/core/jobs/queueConfig.js";
import { executeScrape, buildScrapeResponseData, type ScrapeExecutorDeps } from "../src/core/scrapeExecutor.js";
import { ScraperError } from "../src/core/errors/ScraperError.js";
import { HttpClient } from "../src/core/http/HttpClient.js";
import { ScraperEngine } from "../src/core/scraper/ScraperEngine.js";
import { StaticStrategy } from "../src/strategies/StaticStrategy.js";
import { BrowserStrategy } from "../src/strategies/BrowserStrategy.js";
import { ExtractionEngine } from "../src/extractors/ExtractionEngine.js";
import { FileConfigRepository } from "../src/core/config/FileConfigRepository.js";
import { PaginationEngine } from "../src/core/pagination/PaginationEngine.js";
import { InMemoryCache } from "../src/core/cache/InMemoryCache.js";
import type { ScrapeRequest } from "../src/api/schemas/scrape.schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures");

async function waitForJob(app: TestApp["app"], jobId: string, timeoutMs = 10000) {

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

        await new Promise((resolve) => setTimeout(resolve, 50));
    }
}

describe("Phase 12: BullMQ-backed job queue (real Redis, embedded for this test)", () => {

    let redisServer: RedisMemoryServer;
    let redisUrl: string;
    let workerBrowserStrategy: BrowserStrategy;
    let worker: Worker;
    let workerConnection: Redis;
    let server: TestServer;

    beforeAll(async () => {

        redisServer = new RedisMemoryServer();
        const host = await redisServer.getHost();
        const port = await redisServer.getPort();
        redisUrl = `redis://${host}:${port}`;

        server = await startFixtureServer(path.join(FIXTURES, "simple"), {
            "/broken.html": (_req, res) => {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end("<div class=\"product\"></div>"); // no .name inside — a genuine SELECTOR_NOT_FOUND
            }
        });

        // A real worker, mirroring src/scripts/worker.ts's own logic exactly,
        // pointed at the same fixture server the test app's sync path uses.
        const httpClient = new HttpClient();
        const staticStrategy = new StaticStrategy(httpClient);
        workerBrowserStrategy = new BrowserStrategy();
        const scraperEngine = new ScraperEngine(staticStrategy, workerBrowserStrategy);
        const extractionEngine = new ExtractionEngine();
        const configLoader = new FileConfigRepository(); // unused by these tests, but required by the type
        const paginationEngine = new PaginationEngine(scraperEngine, extractionEngine);
        const cache = new InMemoryCache();
        const deps: ScrapeExecutorDeps = { scraperEngine, extractionEngine, configLoader, paginationEngine, cache };

        workerConnection = createRedisConnection(redisUrl);

        worker = new Worker(
            QUEUE_NAME,
            async (job) => {

                const { body, startedAt } = job.data as { body: ScrapeRequest; startedAt: number };

                try {
                    const execResult = await executeScrape(body, deps);
                    return buildScrapeResponseData(execResult, Date.now() - startedAt);
                } catch (error) {
                    if (error instanceof ScraperError) {
                        throw new Error(JSON.stringify({ code: error.code, message: error.message }));
                    }
                    throw new Error(JSON.stringify({ code: "INTERNAL_ERROR", message: (error as Error).message }));
                }
            },
            { connection: workerConnection }
        );

        await worker.waitUntilReady();
    }, 30000);

    afterAll(async () => {
        await worker.close();
        await workerConnection.quit();
        await workerBrowserStrategy.close();
        await server.close();
        await redisServer.stop();
    });

    test("a full round trip through the real HTTP routes: POST /scrape async:true -> BullMQ -> real worker -> GET /jobs/:id", async () => {

        const queueConnection = createRedisConnection(redisUrl);
        const jobQueue = new BullMqJobQueue(queueConnection);
        const testApp: TestApp = await buildTestApp(undefined, jobQueue);

        try {
            const created = await testApp.app.inject({
                method: "POST",
                url: "/scrape",
                payload: {
                    url: `${server.url}/index.html`,
                    selector: ".name",
                    extract: "text",
                    async: true
                }
            });

            expect(created.statusCode).toBe(202);
            const { jobId, status } = created.json();
            expect(status).toBe("queued");

            const finished = await waitForJob(testApp.app, jobId);

            expect(finished.status).toBe("completed");
            expect(finished.result.data).toEqual(["Gaming Laptop"]);

        } finally {
            await testApp.app.close();
            await testApp.browserStrategy.close();
            await jobQueue.close();
            await queueConnection.quit();
        }
    });

    test("a failing scrape becomes a 'failed' job with the real error code, via a real worker", async () => {

        const queueConnection = createRedisConnection(redisUrl);
        const jobQueue = new BullMqJobQueue(queueConnection);
        const testApp: TestApp = await buildTestApp(undefined, jobQueue);

        try {
            const created = await testApp.app.inject({
                method: "POST",
                url: "/scrape",
                payload: {
                    url: `${server.url}/broken.html`,
                    selector: ".name",
                    extract: "text",
                    async: true
                }
            });

            const finished = await waitForJob(testApp.app, created.json().jobId);

            expect(finished.status).toBe("failed");
            expect(finished.error.code).toBe("SELECTOR_NOT_FOUND");

        } finally {
            await testApp.app.close();
            await testApp.browserStrategy.close();
            await jobQueue.close();
            await queueConnection.quit();
        }
    });

    test("getStatus() returns undefined for an id BullMQ has never seen", async () => {

        const queueConnection = createRedisConnection(redisUrl);
        const jobQueue = new BullMqJobQueue(queueConnection);

        try {
            expect(await jobQueue.getStatus("00000000-0000-0000-0000-000000000000")).toBeUndefined();
        } finally {
            await jobQueue.close();
            await queueConnection.quit();
        }
    });
});
