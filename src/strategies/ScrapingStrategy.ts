export interface ScrapeOptions {
    waitFor?: string | undefined;
    timeout?: number | undefined;
}

export interface ScrapingStrategy {
    scrape(url: string, options?: ScrapeOptions): Promise<string>;
}
