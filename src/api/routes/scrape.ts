import type { FastifyInstance } from "fastify";
import { scrapeRequestSchema } from "../schemas/scrape.schema.js";
import { ScraperEngine } from "../../core/scraper/ScraperEngine.js";
import { ExtractionEngine, type ExtractedItem } from "../../extractors/ExtractionEngine.js";
import { ConfigLoader } from "../../core/config/ConfigLoader.js";

export async function scrapeRoute(
    app: FastifyInstance,
    scraperEngine: ScraperEngine,
    extractionEngine: ExtractionEngine,
    configLoader: ConfigLoader
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

            const $ = await scraperEngine.scrape(body.url);

            let data: string[] | ExtractedItem[];

            if ("config" in body) {
                data = extractionEngine.extractItems($, body.config.item.selector, body.config.fields);
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

                data = extractionEngine.extractItems($, config.item.selector, config.fields);
            } else {
                data = extractionEngine.extract($, {
                    selector: body.selector,
                    extract: body.extract,
                    attribute: body.attribute
                });
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
