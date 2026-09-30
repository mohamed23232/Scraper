import type { FastifyInstance } from "fastify";
import { scrapeRequestSchema } from "../schemas/scrape.schema.js";
import { ScraperEngine } from "../../core/scraper/ScraperEngine.js";
import { ExtractionEngine } from "../../extractors/ExtractionEngine.js";
import type { ConfigRepository } from "../../core/config/ConfigRepository.js";
import { PaginationEngine } from "../../core/pagination/PaginationEngine.js";
import { ScraperError } from "../../core/errors/ScraperError.js";
import type { Cache } from "../../core/cache/Cache.js";
import { executeScrape, type ScrapeExecutionResult } from "../../core/scrapeExecutor.js";
import { JobStore } from "../../core/jobs/JobStore.js";

function buildResponseBody(execResult: ScrapeExecutionResult, durationMs: number) {

    const { targetUrl, data, pagination, cached } = execResult;

    return {
        success: true,
        url: targetUrl,
        data,
        metadata: {
            durationMs,
            items: Array.isArray(data) ? data.length : undefined,
            cached,
            ...(pagination
                ? {
                    pages: pagination.pages,
                    stopReason: pagination.stopReason,
                    truncated: pagination.truncated,
                    warnings: pagination.warnings
                }
                : {})
        }
    };
}

export async function scrapeRoute(
    app: FastifyInstance,
    scraperEngine: ScraperEngine,
    extractionEngine: ExtractionEngine,
    configLoader: ConfigRepository,
    paginationEngine: PaginationEngine,
    cache: Cache,
    jobStore: JobStore
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

            const job = jobStore.create();

            void (async () => {

                jobStore.markRunning(job.id);

                try {
                    const execResult = await executeScrape(body, deps);
                    const response = buildResponseBody(execResult, Date.now() - startedAt);
                    jobStore.complete(job.id, { url: response.url, data: response.data, metadata: response.metadata });
                } catch (error) {
                    if (error instanceof ScraperError) {
                        jobStore.fail(job.id, { code: error.code, message: error.message });
                    } else {
                        app.log.error(error);
                        jobStore.fail(job.id, { code: "INTERNAL_ERROR", message: "An unexpected error occurred" });
                    }
                }
            })();

            return reply.status(202).send({ jobId: job.id, status: "queued" });
        }

        const execResult = await executeScrape(body, deps);

        return reply.status(200).send(buildResponseBody(execResult, Date.now() - startedAt));
    });
}
