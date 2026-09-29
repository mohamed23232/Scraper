import type { CheerioAPI } from "cheerio";
import { ScraperEngine, type ScraperOptions } from "../scraper/ScraperEngine.js";
import { ExtractionEngine, type ExtractedItem, type ItemFields } from "../../extractors/ExtractionEngine.js";
import type { PaginationConfig } from "../config/ScraperConfig.js";

const DEFAULT_MAX_PAGES = 10;

export class PaginationEngine {

    constructor(
        private readonly scraperEngine: ScraperEngine,
        private readonly extractionEngine: ExtractionEngine
    ) {}

    async scrapeAllPages(
        startUrl: string,
        itemSelector: string,
        fields: ItemFields,
        scraperOptions: ScraperOptions | undefined,
        pagination: PaginationConfig | undefined
    ): Promise<ExtractedItem[]> {

        if (!pagination || !pagination.enabled) {
            const $ = await this.scraperEngine.scrape(startUrl, scraperOptions);
            return this.extractionEngine.extractItems($, itemSelector, fields);
        }

        const maxPages = pagination.maxPages ?? DEFAULT_MAX_PAGES;

        const items: ExtractedItem[] = [];
        const visitedUrls = new Set<string>();

        let currentUrl: string | undefined = startUrl;
        let pageCount = 0;

        while (currentUrl && pageCount < maxPages) {

            if (visitedUrls.has(currentUrl)) {
                break;
            }

            visitedUrls.add(currentUrl);

            const $ = await this.scraperEngine.scrape(currentUrl, scraperOptions);

            if (pageCount > 0 && $(itemSelector).length === 0) {
                break;
            }

            items.push(...this.extractionEngine.extractItems($, itemSelector, fields));
            pageCount++;

            if (pagination.maxItems && items.length >= pagination.maxItems) {
                items.length = pagination.maxItems;
                break;
            }

            currentUrl = this.findNextUrl($, pagination.nextSelector, currentUrl);
        }

        return items;
    }

    private findNextUrl($: CheerioAPI, nextSelector: string, currentUrl: string): string | undefined {

        const nextElement = $(nextSelector).first();
        const href = nextElement.attr("href");

        if (!href) {
            return undefined;
        }

        return new URL(href, currentUrl).toString();
    }
}
