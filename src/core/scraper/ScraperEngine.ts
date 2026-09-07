import * as cheerio from "cheerio";
import { HttpClient } from "../http/HttpClient.js";

export class ScraperEngine {

    constructor(
        private readonly httpClient: HttpClient
    ) {}

    async scrape(url: string) {
        const html = await this.httpClient.get(url);

        const $ = cheerio.load(html);

        return $;
    }
}