import * as cheerio from "cheerio";
import type { ScrapingStrategy } from "../../strategies/ScrapingStrategy.js";

export interface ScraperOptions {
    type?: "static" | "browser" | undefined;
    waitFor?: string | undefined;
    timeout?: number | undefined;
}

export class ScraperEngine {

    constructor(
        private readonly staticStrategy: ScrapingStrategy,
        private readonly browserStrategy: ScrapingStrategy
    ) {}

    async scrape(url: string, options?: ScraperOptions) {

        const strategy = options?.type === "browser"
            ? this.browserStrategy
            : this.staticStrategy;

        const html = await strategy.scrape(url, {
            waitFor: options?.waitFor,
            timeout: options?.timeout
        });

        return cheerio.load(html);
    }
}
