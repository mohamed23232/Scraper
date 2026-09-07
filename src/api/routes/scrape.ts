import type { FastifyInstance } from "fastify";
import { scrapeRequestSchema } from "../schemas/scrape.schema.js";
import { ScraperEngine } from "../../core/scraper/ScraperEngine.js";

export async function scrapeRoute(
    app: FastifyInstance,
    scraperEngine: ScraperEngine
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
            const data = await scraperEngine.scrape(result.data.url);

            return reply.status(200).send(data);

        } catch (error) {
            app.log.error(error);

            return reply.status(500).send({
                error: "Failed to scrape website"
            });
        }
    });
}