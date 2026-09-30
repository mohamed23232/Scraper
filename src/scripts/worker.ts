import { Worker } from "bullmq";

import { HttpClient } from "../core/http/HttpClient.js";
import { ScraperEngine } from "../core/scraper/ScraperEngine.js";
import { StaticStrategy } from "../strategies/StaticStrategy.js";
import { BrowserStrategy } from "../strategies/BrowserStrategy.js";
import { ExtractionEngine } from "../extractors/ExtractionEngine.js";
import { buildConfigRepository } from "../core/config/buildConfigRepository.js";
import { PaginationEngine } from "../core/pagination/PaginationEngine.js";
import { InMemoryCache } from "../core/cache/InMemoryCache.js";
import { executeScrape, buildScrapeResponseData, type ScrapeExecutorDeps } from "../core/scrapeExecutor.js";
import { ScraperError } from "../core/errors/ScraperError.js";
import { QUEUE_NAME, createRedisConnection } from "../core/jobs/queueConfig.js";
import type { ScrapeRequest } from "../api/schemas/scrape.schema.js";

const httpClient = new HttpClient();
const staticStrategy = new StaticStrategy(httpClient);
const browserStrategy = new BrowserStrategy();
const scraperEngine = new ScraperEngine(staticStrategy, browserStrategy);
const extractionEngine = new ExtractionEngine();
const configLoader = buildConfigRepository();
const paginationEngine = new PaginationEngine(scraperEngine, extractionEngine);
const cache = new InMemoryCache();

const deps: ScrapeExecutorDeps = { scraperEngine, extractionEngine, configLoader, paginationEngine, cache };

const connection = createRedisConnection();

const worker = new Worker(
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
    { connection }
);

worker.on("ready", () => {
    console.log(`Worker connected — waiting for jobs on queue '${QUEUE_NAME}'`);
});

worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
    console.error(`Job ${job?.id} failed: ${error.message}`);
});

async function shutdown(): Promise<void> {
    await worker.close();
    await browserStrategy.close();
    await connection.quit();
    process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
