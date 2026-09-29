import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { ScrapingStrategy } from "../../strategies/ScrapingStrategy.js";
import { ScraperError } from "../errors/ScraperError.js";

export interface ScraperOptions {
    type?: "static" | "browser" | undefined;
    waitFor?: string | undefined;
    timeout?: number | undefined;
    blockResources?: boolean | undefined;
}

export interface ScrapedPage {
    $: CheerioAPI;
    finalUrl: string;
    status: number;
    contentType: string;
}

export class ScraperEngine {

    constructor(
        private readonly staticStrategy: ScrapingStrategy,
        private readonly browserStrategy: ScrapingStrategy
    ) {}

    async scrape(url: string, options?: ScraperOptions): Promise<ScrapedPage> {

        const strategy = options?.type === "browser"
            ? this.browserStrategy
            : this.staticStrategy;

        const page = await strategy.scrape(url, {
            waitFor: options?.waitFor,
            timeout: options?.timeout,
            blockResources: options?.blockResources
        });

        let $: CheerioAPI;

        try {
            $ = cheerio.load(page.body);
        } catch (error) {
            throw new ScraperError("PARSING_ERROR", `Failed to parse HTML from ${page.finalUrl}: ${(error as Error).message}`);
        }

        return {
            $,
            finalUrl: page.finalUrl,
            status: page.status,
            contentType: page.contentType
        };
    }
}
