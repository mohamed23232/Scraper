import { createHash } from "node:crypto";
import type { CheerioAPI } from "cheerio";
import { ScraperEngine, type ScraperOptions } from "../scraper/ScraperEngine.js";
import { ExtractionEngine, type ExtractItemsOptions } from "../../extractors/ExtractionEngine.js";
import type { FieldConfig, PaginationConfig } from "../config/ScraperConfig.js";
import { applyFieldTransforms } from "../../transforms/applyFieldTransforms.js";
import { ScraperError } from "../errors/ScraperError.js";

const DEFAULT_MAX_PAGES = 10;
const DEFAULT_OVERALL_TIMEOUT_MS = 60000;

export type PaginationStopReason =
    | "maxPages"
    | "maxItems"
    | "lastPage"
    | "duplicateUrl"
    | "duplicateContent"
    | "emptyPage"
    | "timeout"
    | "error";

export interface PaginationResult {
    items: Record<string, unknown>[];
    stopReason: PaginationStopReason;
    truncated: boolean;
    pages: number;
    warnings: string[];
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeUrlForDedup(rawUrl: string): string {

    const url = new URL(rawUrl);

    url.hash = "";

    const sortedParams = new URLSearchParams(
        [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b))
    );
    url.search = sortedParams.toString();

    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
        url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
}

function hashItems(items: Record<string, unknown>[]): string {
    return createHash("sha256").update(JSON.stringify(items)).digest("hex");
}

export class PaginationEngine {

    constructor(
        private readonly scraperEngine: ScraperEngine,
        private readonly extractionEngine: ExtractionEngine
    ) {}

    async scrapeAllPages(
        startUrl: string,
        itemSelector: string,
        fields: Record<string, FieldConfig>,
        scraperOptions: ScraperOptions | undefined,
        pagination: PaginationConfig | undefined,
        itemOptions?: ExtractItemsOptions
    ): Promise<PaginationResult> {

        if (!pagination || !pagination.enabled) {

            const page = await this.scraperEngine.scrape(startUrl, scraperOptions);
            const items = this.extractionEngine.extractItems(page.$, itemSelector, fields, itemOptions);
            const transformed = applyFieldTransforms(items, fields, this.effectiveBaseUrl(page.$, page.finalUrl));

            return { items: transformed, stopReason: "lastPage", truncated: false, pages: 1, warnings: [] };
        }

        const maxPages = pagination.maxPages ?? DEFAULT_MAX_PAGES;
        const deadline = Date.now() + (pagination.maxDurationMs ?? DEFAULT_OVERALL_TIMEOUT_MS);
        const failOnPageError = pagination.failOnPageError ?? false;

        const results: Record<string, unknown>[] = [];
        const warnings: string[] = [];
        const visitedUrls = new Set<string>();

        let currentUrl: string | undefined = startUrl;
        let pageCount = 0;
        let previousPageHash: string | undefined;
        let stopReason: PaginationStopReason = "lastPage";
        let truncated = false;

        while (currentUrl) {

            const dedupKey = normalizeUrlForDedup(currentUrl);

            if (visitedUrls.has(dedupKey)) {
                stopReason = "duplicateUrl";
                break;
            }

            visitedUrls.add(dedupKey);

            const remaining = deadline - Date.now();

            if (remaining <= 0) {
                stopReason = "timeout";
                truncated = true;
                break;
            }

            if (pageCount > 0 && pagination.delayMs) {
                await sleep(pagination.delayMs);
            }

            const perPageTimeout = scraperOptions?.timeout
                ? Math.min(scraperOptions.timeout, remaining)
                : remaining;

            let page;
            let pageItems;

            try {
                page = await this.scraperEngine.scrape(currentUrl, {
                    ...scraperOptions,
                    timeout: perPageTimeout
                });

                if (pageCount > 0 && page.$(itemSelector).length === 0) {
                    stopReason = "emptyPage";
                    break;
                }

                pageItems = this.extractionEngine.extractItems(page.$, itemSelector, fields, itemOptions);

            } catch (error) {

                if (pageCount === 0 || failOnPageError) {
                    throw error;
                }

                const code = error instanceof ScraperError ? error.code : "UNKNOWN";

                warnings.push(
                    `Stopped at page ${pageCount + 1} (${code}): ${(error as Error).message}`
                );
                stopReason = "error";
                truncated = true;
                break;
            }

            const contentHash = hashItems(pageItems);

            if (pageCount > 0 && contentHash === previousPageHash) {
                stopReason = "duplicateContent";
                break;
            }

            previousPageHash = contentHash;

            const baseUrl = this.effectiveBaseUrl(page.$, page.finalUrl);
            results.push(...applyFieldTransforms(pageItems, fields, baseUrl));
            pageCount++;

            if (pagination.maxItems && results.length >= pagination.maxItems) {
                results.length = pagination.maxItems;
                stopReason = "maxItems";
                truncated = true;
                break;
            }

            if (pageCount >= maxPages) {
                stopReason = "maxPages";
                truncated = true;
                break;
            }

            const nextUrl = this.findNextUrl(page.$, pagination.nextSelector, currentUrl);

            if (!nextUrl) {
                stopReason = "lastPage";
                break;
            }

            currentUrl = nextUrl;
        }

        return { items: results, stopReason, truncated, pages: pageCount, warnings };
    }

    private effectiveBaseUrl($: CheerioAPI, finalUrl: string): string {

        const baseHref = $("base").first().attr("href");

        return baseHref ? new URL(baseHref, finalUrl).toString() : finalUrl;
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
