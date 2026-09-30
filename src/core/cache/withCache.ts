import type { Cache } from "./Cache.js";
import { computeCacheKey } from "./cacheKey.js";

export interface CacheablePaginationSummary {
    pages: number;
    stopReason: string;
    truncated: boolean;
    warnings: string[];
}

export interface CacheableResult {
    data: unknown;
    pagination?: CacheablePaginationSummary;
}

export interface CacheOptions {
    enabled: boolean;
    ttl: number;
}

export async function withCache(
    cache: Cache,
    cacheOptions: CacheOptions | undefined,
    keyParts: unknown,
    compute: () => Promise<CacheableResult>
): Promise<CacheableResult & { cached: boolean }> {

    if (!cacheOptions?.enabled) {
        const result = await compute();
        return { ...result, cached: false };
    }

    const key = computeCacheKey(keyParts);
    const hit = cache.get<CacheableResult>(key);

    if (hit) {
        return { ...hit, cached: true };
    }

    const result = await compute();
    cache.set(key, result, cacheOptions.ttl);

    return { ...result, cached: false };
}
