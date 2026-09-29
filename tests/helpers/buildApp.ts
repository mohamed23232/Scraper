import Fastify, { type FastifyInstance } from "fastify";
import { HttpClient } from "../../src/core/http/HttpClient.js";
import { ScraperEngine } from "../../src/core/scraper/ScraperEngine.js";
import { StaticStrategy } from "../../src/strategies/StaticStrategy.js";
import { BrowserStrategy } from "../../src/strategies/BrowserStrategy.js";
import { ExtractionEngine } from "../../src/extractors/ExtractionEngine.js";
import { FileConfigRepository } from "../../src/core/config/FileConfigRepository.js";
import type { ConfigRepository } from "../../src/core/config/ConfigRepository.js";
import { PaginationEngine } from "../../src/core/pagination/PaginationEngine.js";
import { registerErrorHandler } from "../../src/core/errors/errorHandler.js";
import { scrapeRoute } from "../../src/api/routes/scrape.js";
import { websitesRoute } from "../../src/api/routes/websites.js";

export interface TestApp {
    app: FastifyInstance;
    browserStrategy: BrowserStrategy;
    configLoader: ConfigRepository;
}

export async function buildTestApp(configsDir?: string): Promise<TestApp> {

    const app = Fastify({ logger: false });
    registerErrorHandler(app);

    const httpClient = new HttpClient();
    const staticStrategy = new StaticStrategy(httpClient);
    const browserStrategy = new BrowserStrategy();
    const scraperEngine = new ScraperEngine(staticStrategy, browserStrategy);
    const extractionEngine = new ExtractionEngine();
    const configLoader = new FileConfigRepository(configsDir);
    const paginationEngine = new PaginationEngine(scraperEngine, extractionEngine);

    await app.register(async (instance) => {
        await scrapeRoute(instance, scraperEngine, extractionEngine, configLoader, paginationEngine);
        await websitesRoute(instance, configLoader);
    });

    await app.ready();

    return { app, browserStrategy, configLoader };
}
