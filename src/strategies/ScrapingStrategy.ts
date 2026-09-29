import type { FetchedPage } from "../core/http/FetchedPage.js";

export interface ScrapeOptions {
    waitFor?: string | undefined;
    timeout?: number | undefined;
    blockResources?: boolean | undefined;
}

export interface ScrapingStrategy {
    scrape(url: string, options?: ScrapeOptions): Promise<FetchedPage>;
}
