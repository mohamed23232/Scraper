import type { ScrapingStrategy } from "./ScrapingStrategy.js";
import { HttpClient } from "../core/http/HttpClient.js";

export class StaticStrategy implements ScrapingStrategy {

    constructor(private readonly httpClient: HttpClient) {}

    async scrape(url: string): Promise<string> {
        return this.httpClient.get(url);
    }
}
