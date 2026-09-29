import { chromium, type Browser } from "playwright";
import type { ScrapeOptions, ScrapingStrategy } from "./ScrapingStrategy.js";
import type { FetchedPage } from "../core/http/FetchedPage.js";
import { assertUrlAllowed } from "../core/security/UrlPolicy.js";
import { ScraperError } from "../core/errors/ScraperError.js";

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const BLOCKED_RESOURCE_TYPES = new Set(["image", "font", "media"]);

function getMaxResponseBytes(): number {

    const raw = process.env["MAX_RESPONSE_BYTES"];
    const parsed = raw ? Number(raw) : NaN;

    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_RESPONSE_BYTES;
}

export class BrowserStrategy implements ScrapingStrategy {

    private browserPromise: Promise<Browser> | undefined;
    private activeCount = 0;
    private readonly queue: Array<() => void> = [];

    constructor(private readonly concurrency: number = DEFAULT_CONCURRENCY) {}

    async scrape(url: string, options?: ScrapeOptions): Promise<FetchedPage> {

        const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
        const blockResources = options?.blockResources ?? true;

        await assertUrlAllowed(url);
        await this.acquireSlot();

        let page;

        try {
            const browser = await this.getBrowser();
            page = await browser.newPage();

            let policyViolation: ScraperError | undefined;

            // Every request the page makes — navigation, images, scripts,
            // fetch()/XHR, iframes — is checked against the URL policy, not
            // just the top-level navigation. Image/font/media requests are
            // also dropped by default (blockResources) since they're never
            // needed for scraping and only cost bandwidth/time.
            await page.route("**/*", async (route) => {

                const request = route.request();

                try {
                    await assertUrlAllowed(request.url());
                } catch (error) {
                    if (request.isNavigationRequest()) {
                        policyViolation = error instanceof ScraperError ? error : undefined;
                    }
                    await route.abort();
                    return;
                }

                if (blockResources && BLOCKED_RESOURCE_TYPES.has(request.resourceType())) {
                    await route.abort();
                    return;
                }

                await route.continue();
            });

            let response;

            try {
                response = await page.goto(url, { timeout, waitUntil: "domcontentloaded" });
            } catch (error) {
                if (policyViolation) {
                    throw policyViolation;
                }
                throw new ScraperError(
                    "BROWSER_ERROR",
                    `Browser navigation failed for ${url}: ${(error as Error).message}`
                );
            }

            if (options?.waitFor) {
                await page.waitForSelector(options.waitFor, { timeout });
            }

            const body = await page.content();
            const maxBytes = getMaxResponseBytes();
            const bodyBytes = Buffer.byteLength(body, "utf-8");

            if (bodyBytes > maxBytes) {
                throw new ScraperError(
                    "RESPONSE_TOO_LARGE",
                    `Rendered page exceeded ${maxBytes} bytes (${bodyBytes} bytes, ${url})`
                );
            }

            return {
                body,
                finalUrl: page.url(),
                status: response?.status() ?? 200,
                contentType: response?.headers()["content-type"] ?? ""
            };

        } finally {
            if (page) {
                await page.close();
            }
            this.releaseSlot();
        }
    }

    async close(): Promise<void> {

        if (!this.browserPromise) {
            return;
        }

        const browser = await this.browserPromise;
        this.browserPromise = undefined;

        await browser.close();
    }

    private async getBrowser(): Promise<Browser> {

        if (!this.browserPromise) {
            this.browserPromise = chromium.launch();
        }

        return this.browserPromise;
    }

    private async acquireSlot(): Promise<void> {

        if (this.activeCount < this.concurrency) {
            this.activeCount++;
            return;
        }

        await new Promise<void>((resolve) => this.queue.push(resolve));
        this.activeCount++;
    }

    private releaseSlot(): void {

        this.activeCount--;

        const next = this.queue.shift();

        if (next) {
            next();
        }
    }
}
