import Fastify from "fastify";

import { HttpClient } from "./core/http/HttpClient.js";
import { ScraperEngine } from "./core/scraper/ScraperEngine.js";
import { ExtractionEngine } from "./extractors/ExtractionEngine.js";
import { scrapeRoute } from "./api/routes/scrape.js";

const app = Fastify({
    logger: true
});

// Dependencies
const httpClient = new HttpClient();
const scraperEngine = new ScraperEngine(httpClient);
const extractionEngine = new ExtractionEngine();

// Routes
app.register(async (app) => {
    await scrapeRoute(app, scraperEngine, extractionEngine);
});

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