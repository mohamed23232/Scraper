import Fastify from "fastify";

import { HttpClient } from "./core/http/HttpClient.js";
import { ScraperEngine } from "./core/scraper/ScraperEngine.js";
import { StaticStrategy } from "./strategies/StaticStrategy.js";
import { BrowserStrategy } from "./strategies/BrowserStrategy.js";
import { ExtractionEngine } from "./extractors/ExtractionEngine.js";
import { buildConfigRepository } from "./core/config/buildConfigRepository.js";
import { SqliteConfigRepository } from "./core/config/SqliteConfigRepository.js";
import { PaginationEngine } from "./core/pagination/PaginationEngine.js";
import { InMemoryCache } from "./core/cache/InMemoryCache.js";
import type { JobQueue } from "./core/jobs/JobQueue.js";
import { JobStore } from "./core/jobs/JobStore.js";
import { InMemoryJobQueue } from "./core/jobs/InMemoryJobQueue.js";
import { BullMqJobQueue } from "./core/jobs/BullMqJobQueue.js";
import { getQueueDriver, createRedisConnection } from "./core/jobs/queueConfig.js";
import { registerErrorHandler } from "./core/errors/errorHandler.js";
import { adminAuthWarningIfAny } from "./core/auth/adminAuth.js";
import { scrapeRoute } from "./api/routes/scrape.js";
import { websitesRoute } from "./api/routes/websites.js";
import { jobsRoute } from "./api/routes/jobs.js";

const app = Fastify({
    logger: true
});

registerErrorHandler(app);

const authWarning = adminAuthWarningIfAny();

if (authWarning) {
    app.log.warn(authWarning);
}

// Dependencies
const httpClient = new HttpClient();
const staticStrategy = new StaticStrategy(httpClient);
const browserStrategy = new BrowserStrategy();
const scraperEngine = new ScraperEngine(staticStrategy, browserStrategy);
const extractionEngine = new ExtractionEngine();
const configLoader = buildConfigRepository();
const paginationEngine = new PaginationEngine(scraperEngine, extractionEngine);
const cache = new InMemoryCache();

const scrapeDeps = { scraperEngine, extractionEngine, configLoader, paginationEngine, cache };

const jobQueue: JobQueue = getQueueDriver() === "bullmq"
    ? new BullMqJobQueue(createRedisConnection())
    : new InMemoryJobQueue(new JobStore(), scrapeDeps);

if (getQueueDriver() === "bullmq") {
    app.log.warn(
        "QUEUE_DRIVER=bullmq: this API process only enqueues jobs. Run 'npm run worker' " +
        "(pointed at the same REDIS_URL) in a separate process, or async jobs will queue forever."
    );
}

// Routes
app.register(async (app) => {
    await scrapeRoute(app, scraperEngine, extractionEngine, configLoader, paginationEngine, cache, jobQueue);
    await websitesRoute(app, configLoader);
    await jobsRoute(app, jobQueue);
});

app.addHook("onClose", async () => {
    await browserStrategy.close();
    await jobQueue.close();
    if (configLoader instanceof SqliteConfigRepository) {
        await configLoader.close();
    }
});

process.on("SIGINT", () => void app.close());
process.on("SIGTERM", () => void app.close());

const start = async () => {
    try {
        await app.listen({
            port: 3000,
            host: "0.0.0.0"
        });

        console.log("Server running on http://localhost:3000");
    } catch (error) {
        app.log.error(error);
        process.exit(1);
    }
};

start();
