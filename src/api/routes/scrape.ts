import type { FastifyInstance } from "fastify";
import { scrapeRequestSchema } from "../schemas/scrape.schema.js";
import { ScraperEngine } from "../../core/scraper/ScraperEngine.js";
import { ExtractionEngine } from "../../extractors/ExtractionEngine.js";
import type { ConfigRepository } from "../../core/config/ConfigRepository.js";
import { PaginationEngine } from "../../core/pagination/PaginationEngine.js";
import { ScraperError } from "../../core/errors/ScraperError.js";
import type { Cache } from "../../core/cache/Cache.js";
import { executeScrape, buildScrapeResponseData } from "../../core/scrapeExecutor.js";
import type { JobQueue } from "../../core/jobs/JobQueue.js";

export async function scrapeRoute(
    app: FastifyInstance,
    scraperEngine: ScraperEngine,
    extractionEngine: ExtractionEngine,
    configLoader: ConfigRepository,
    paginationEngine: PaginationEngine,
    cache: Cache,
    jobQueue: JobQueue
) {
    const deps = { scraperEngine, extractionEngine, configLoader, paginationEngine, cache };

    app.post("/scrape", async (request, reply) => {

        const startedAt = Date.now();

        const result = scrapeRequestSchema.safeParse(request.body);

        if (!result.success) {
            throw new ScraperError("INVALID_CONFIGURATION", "Invalid request", result.error.issues);
        }

        const body = result.data;

        if (body.async) {
            const jobId = await jobQueue.enqueue(body);
            return reply.status(202).send({ jobId, status: "queued" });
        }

        const execResult = await executeScrape(body, deps);

        return reply.status(200).send({
            success: true,
            ...buildScrapeResponseData(execResult, Date.now() - startedAt)
        });
    });
}
