import type { FastifyInstance } from "fastify";
import { scrapeRequestSchema } from "../schemas/scrape.schema.js";
import { ScraperEngine } from "../../core/scraper/ScraperEngine.js";
import { ExtractionEngine } from "../../extractors/ExtractionEngine.js";
import { ConfigLoader } from "../../core/config/ConfigLoader.js";
import { PaginationEngine } from "../../core/pagination/PaginationEngine.js";
import { TransformPipeline } from "../../transforms/TransformPipeline.js";
import { applyFieldTransforms } from "../../transforms/applyFieldTransforms.js";

export async function scrapeRoute(
    app: FastifyInstance,
    scraperEngine: ScraperEngine,
    extractionEngine: ExtractionEngine,
    configLoader: ConfigLoader,
    paginationEngine: PaginationEngine
) {
    app.post("/scrape", async (request, reply) => {

        const result = scrapeRequestSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: "Invalid request",
                details: result.error.issues
            });
        }

        const body = result.data;

        try {

            let data: unknown;

            if ("config" in body) {

                const items = await paginationEngine.scrapeAllPages(
                    body.url,
                    body.config.item.selector,
                    body.config.fields,
                    body.scraper,
                    body.config.pagination
                );

                data = applyFieldTransforms(items, body.config.fields, body.url);

            } else if ("website" in body) {

                let config;

                try {
                    config = await configLoader.load(body.website);
                } catch (error) {
                    return reply.status(400).send({
                        success: false,
                        error: (error as Error).message
                    });
                }

                const items = await paginationEngine.scrapeAllPages(
                    body.url,
                    config.item.selector,
                    config.fields,
                    config.scraper,
                    config.pagination
                );

                data = applyFieldTransforms(items, config.fields, body.url);

            } else {

                const $ = await scraperEngine.scrape(body.url, body.scraper);

                const values = extractionEngine.extract($, {
                    selector: body.selector,
                    extract: body.extract,
                    attribute: body.attribute
                });

                data = values.map(
                    (value) => TransformPipeline.run(value, body.transform, { baseUrl: body.url })
                );
            }

            return reply.status(200).send({
                success: true,
                url: body.url,
                data
            });

        } catch (error) {

            app.log.error(error);

            return reply.status(500).send({
                success: false,
                error: "Failed to scrape website"
            });
        }
    });
}
