import { chromium } from "playwright";
import type { ScrapeOptions, ScrapingStrategy } from "./ScrapingStrategy.js";

const DEFAULT_TIMEOUT = 10000;

export class BrowserStrategy implements ScrapingStrategy {

    async scrape(url: string, options?: ScrapeOptions): Promise<string> {

        const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

        const browser = await chromium.launch();

        try {
            const page = await browser.newPage();

            await page.goto(url, { timeout, waitUntil: "domcontentloaded" });

            if (options?.waitFor) {
                await page.waitForSelector(options.waitFor, { timeout });
            }

            return await page.content();

        } finally {
            await browser.close();
        }
    }
}
