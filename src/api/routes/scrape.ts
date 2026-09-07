import type { FastifyInstance } from "fastify";
import { scrapeRequestSchema } from "../schemas/scrape.schema.js";
import { ScraperEngine } from "../../core/scraper/ScraperEngine.js";
import { ExtractionEngine } from "../../extractors/ExtractionEngine.js";

export async function scrapeRoute(
    app: FastifyInstance,
    scraperEngine: ScraperEngine,
    extractionEngine: ExtractionEngine
) {
    app.post("/scrape", async (request, reply) => {

        const result = scrapeRequestSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                error: "Invalid request",
                details: result.error.issues
            });
        }

        try {

            const $ = await scraperEngine.scrape(
                result.data.url
            );

            const data = extractionEngine.extract($, {
                selector: result.data.selector,
                extract: result.data.extract,
                ...(result.data.attribute === undefined
                    ? {}
                    : { attribute: result.data.attribute })
            });

            return reply.status(200).send({
                success: true,
                url: result.data.url,
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