import type { FastifyInstance } from "fastify";
import { scrapeRequestSchema } from "../schemas/scrape.schema.js";
import { ScraperEngine } from "../../core/scraper/ScraperEngine.js";
import { ExtractionEngine } from "../../extractors/ExtractionEngine.js";
import { ConfigLoader } from "../../core/config/ConfigLoader.js";
import { PaginationEngine, type PaginationResult } from "../../core/pagination/PaginationEngine.js";
import { TransformPipeline } from "../../transforms/TransformPipeline.js";
import { ScraperError } from "../../core/errors/ScraperError.js";
import { isInlineConfigsAllowed } from "../../core/config/featureFlags.js";

export async function scrapeRoute(
    app: FastifyInstance,
    scraperEngine: ScraperEngine,
    extractionEngine: ExtractionEngine,
    configLoader: ConfigLoader,
    paginationEngine: PaginationEngine
) {
    app.post("/scrape", async (request, reply) => {

        const startedAt = Date.now();

        const result = scrapeRequestSchema.safeParse(request.body);

        if (!result.success) {
            throw new ScraperError("INVALID_CONFIGURATION", "Invalid request", result.error.issues);
        }

        const body = result.data;

        let data: unknown;
        let pagination: PaginationResult | undefined;
        let targetUrl: string;

        if ("config" in body) {

            if (!isInlineConfigsAllowed()) {
                throw new ScraperError(
                    "INVALID_CONFIGURATION",
                    "Inline 'config' requests are disabled on this server; use a saved website configuration (the 'website' field) instead."
                );
            }

            targetUrl = body.url;

            pagination = await paginationEngine.scrapeAllPages(
                targetUrl,
                body.config.item.selector,
                body.config.fields,
                body.scraper,
                body.config.pagination,
                { allowEmpty: body.config.item.allowEmpty }
            );

            data = pagination.items;

        } else if ("website" in body) {

            const config = await configLoader.load(body.website);

            if (body.url) {

                const requestHost = new URL(body.url).hostname;
                const configHost = new URL(config.startUrl).hostname;

                if (requestHost !== configHost) {
                    throw new ScraperError(
                        "INVALID_CONFIGURATION",
                        `Request url host '${requestHost}' does not match configuration '${body.website}' host '${configHost}'`
                    );
                }

                targetUrl = body.url;

            } else {
                targetUrl = config.startUrl;
            }

            pagination = await paginationEngine.scrapeAllPages(
                targetUrl,
                config.item.selector,
                config.fields,
                config.scraper,
                config.pagination,
                { allowEmpty: config.item.allowEmpty }
            );

            data = pagination.items;

        } else {

            if (!isInlineConfigsAllowed()) {
                throw new ScraperError(
                    "INVALID_CONFIGURATION",
                    "Flat scrape requests are disabled on this server; use a saved website configuration (the 'website' field) instead."
                );
            }

            targetUrl = body.url;

            const page = await scraperEngine.scrape(targetUrl, body.scraper);

            const values = extractionEngine.extract(page.$, {
                selector: body.selector,
                extract: body.extract,
                attribute: body.attribute
            });

            data = values.map(
                (value) => TransformPipeline.run(value, body.transform, { baseUrl: page.finalUrl })
            );
        }

        return reply.status(200).send({
            success: true,
            url: targetUrl,
            data,
            metadata: {
                durationMs: Date.now() - startedAt,
                items: Array.isArray(data) ? data.length : undefined,
                ...(pagination
                    ? {
                        pages: pagination.pages,
                        stopReason: pagination.stopReason,
                        truncated: pagination.truncated,
                        warnings: pagination.warnings
                    }
                    : {})
            }
        });
    });
}
