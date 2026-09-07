import * as cheerio from "cheerio";
import { HttpClient } from "../http/HttpClient.js";

export class ScraperEngine {

    constructor(
        private readonly httpClient: HttpClient
    ) {}

    async scrape(url: string) {

        // Fetch page
        const html = await this.httpClient.get(url);

        // Parse HTML
        const $ = cheerio.load(html);

        // Extract data
        const title = $("title").text().trim();

        return {
            url,
            title
        };
    }
}