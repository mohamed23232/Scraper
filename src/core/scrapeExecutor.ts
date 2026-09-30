import type { ScrapeRequest } from "../api/schemas/scrape.schema.js";
import { ScraperEngine } from "./scraper/ScraperEngine.js";
import { ExtractionEngine } from "../extractors/ExtractionEngine.js";
import type { ConfigRepository } from "./config/ConfigRepository.js";
import { PaginationEngine } from "./pagination/PaginationEngine.js";
import { TransformPipeline } from "../transforms/TransformPipeline.js";
import { ScraperError } from "./errors/ScraperError.js";
import { isInlineConfigsAllowed } from "./config/featureFlags.js";
import type { Cache } from "./cache/Cache.js";
import { withCache, type CacheableResult } from "./cache/withCache.js";

export interface ScrapeExecutorDeps {
    scraperEngine: ScraperEngine;
    extractionEngine: ExtractionEngine;
    configLoader: ConfigRepository;
    paginationEngine: PaginationEngine;
    cache: Cache;
}

export interface ScrapeExecutionResult extends CacheableResult {
    targetUrl: string;
    cached: boolean;
}

export function buildScrapeResponseData(execResult: ScrapeExecutionResult, durationMs: number) {

    const { targetUrl, data, pagination, cached } = execResult;

    return {
        url: targetUrl,
        data,
        metadata: {
            durationMs,
            items: Array.isArray(data) ? data.length : undefined,
            cached,
            ...(pagination
                ? {
                    pages: pagination.pages,
                    stopReason: pagination.stopReason,
                    truncated: pagination.truncated,
                    warnings: pagination.warnings
                }
                : {})
        }
    };
}

export async function executeScrape(
    body: ScrapeRequest,
    deps: ScrapeExecutorDeps
): Promise<ScrapeExecutionResult> {

    const { scraperEngine, extractionEngine, configLoader, paginationEngine, cache } = deps;

    if ("config" in body) {

        if (!isInlineConfigsAllowed()) {
            throw new ScraperError(
                "INVALID_CONFIGURATION",
                "Inline 'config' requests are disabled on this server; use a saved website configuration (the 'website' field) instead."
            );
        }

        const targetUrl = body.url;

        const outcome = await withCache(
            cache,
            body.config.cache,
            { mode: "config", url: targetUrl, scraper: body.scraper, config: body.config },
            async () => {

                const pagination = await paginationEngine.scrapeAllPages(
                    targetUrl,
                    body.config.item.selector,
                    body.config.fields,
                    body.scraper,
                    body.config.pagination,
                    { allowEmpty: body.config.item.allowEmpty }
                );

                return { data: pagination.items, pagination };
            }
        );

        return { targetUrl, ...outcome };
    }

    if ("website" in body) {

        const config = await configLoader.load(body.website);

        let targetUrl: string;

        if (body.url) {

            const requestHost = new URL(body.url).hostname;
            const configHost = new URL(config.startUrl).hostname;

            if (requestHost !== configHost) {
                throw new ScraperError(
                    "INVALID_CONFIGURATION",
                    `Request url host '${requestHost}' does not match configuration '${body.website}' host '${configHost}'`
                );
            }

            targetUrl = body.url;

        } else {
            targetUrl = config.startUrl;
        }

        const outcome = await withCache(
            cache,
            config.cache,
            { mode: "website", website: body.website, url: targetUrl },
            async () => {

                const pagination = await paginationEngine.scrapeAllPages(
                    targetUrl,
                    config.item.selector,
                    config.fields,
                    config.scraper,
                    config.pagination,
                    { allowEmpty: config.item.allowEmpty }
                );

                return { data: pagination.items, pagination };
            }
        );

        return { targetUrl, ...outcome };
    }

    if (!isInlineConfigsAllowed()) {
        throw new ScraperError(
            "INVALID_CONFIGURATION",
            "Flat scrape requests are disabled on this server; use a saved website configuration (the 'website' field) instead."
        );
    }

    const targetUrl = body.url;

    const outcome = await withCache(
        cache,
        body.cache,
        {
            mode: "flat",
            url: targetUrl,
            selector: body.selector,
            extract: body.extract,
            attribute: body.attribute,
            transform: body.transform,
            scraper: body.scraper
        },
        async () => {

            const page = await scraperEngine.scrape(targetUrl, body.scraper);

            const values = extractionEngine.extract(page.$, {
                selector: body.selector,
                extract: body.extract,
                attribute: body.attribute
            });

            const data = values.map(
                (value) => TransformPipeline.run(value, body.transform, { baseUrl: page.finalUrl })
            );

            return { data };
        }
    );

    return { targetUrl, ...outcome };
}
