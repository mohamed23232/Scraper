import Fastify from "fastify";
import path from "node:path";

import { HttpClient } from "./core/http/HttpClient.js";
import { ScraperEngine } from "./core/scraper/ScraperEngine.js";
import { StaticStrategy } from "./strategies/StaticStrategy.js";
import { BrowserStrategy } from "./strategies/BrowserStrategy.js";
import { ExtractionEngine } from "./extractors/ExtractionEngine.js";
import type { ConfigRepository } from "./core/config/ConfigRepository.js";
import { FileConfigRepository } from "./core/config/FileConfigRepository.js";
import { SqliteConfigRepository } from "./core/config/SqliteConfigRepository.js";
import { PaginationEngine } from "./core/pagination/PaginationEngine.js";
import { registerErrorHandler } from "./core/errors/errorHandler.js";
import { adminAuthWarningIfAny } from "./core/auth/adminAuth.js";
import { scrapeRoute } from "./api/routes/scrape.js";
import { websitesRoute } from "./api/routes/websites.js";

function buildConfigRepository(): ConfigRepository {

    if (process.env["CONFIG_STORAGE"] === "sqlite") {
        const dbPath = process.env["DATABASE_PATH"] ?? path.resolve(process.cwd(), "data", "configs.sqlite");
        return new SqliteConfigRepository(dbPath);
    }

    return new FileConfigRepository(process.env["CONFIGS_DIR"]);
}

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

// Routes
app.register(async (app) => {
    await scrapeRoute(app, scraperEngine, extractionEngine, configLoader, paginationEngine);
    await websitesRoute(app, configLoader);
});

app.addHook("onClose", async () => {
    await browserStrategy.close();
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