import type { ScrapeOptions, ScrapingStrategy } from "./ScrapingStrategy.js";
import type { FetchedPage } from "../core/http/FetchedPage.js";
import { HttpClient } from "../core/http/HttpClient.js";

export class StaticStrategy implements ScrapingStrategy {

    constructor(private readonly httpClient: HttpClient) {}

    async scrape(url: string, options?: ScrapeOptions): Promise<FetchedPage> {
        return options?.timeout
            ? this.httpClient.get(url, options.timeout)
            : this.httpClient.get(url);
    }
}
