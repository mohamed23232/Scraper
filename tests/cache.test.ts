import { describe, test, expect } from "vitest";
import { InMemoryCache } from "../src/core/cache/InMemoryCache.js";
import { computeCacheKey } from "../src/core/cache/cacheKey.js";

describe("InMemoryCache", () => {

    test("set() then get() round-trips a value", () => {
        const cache = new InMemoryCache();
        cache.set("k", { hello: "world" }, 60);
        expect(cache.get("k")).toEqual({ hello: "world" });
    });

    test("get() returns undefined for a missing key", () => {
        const cache = new InMemoryCache();
        expect(cache.get("missing")).toBeUndefined();
    });

    test("an entry expires after its TTL", async () => {
        const cache = new InMemoryCache();
        cache.set("k", "value", 0.05); // 50ms

        expect(cache.get("k")).toBe("value");

        await new Promise((resolve) => setTimeout(resolve, 120));

        expect(cache.get("k")).toBeUndefined();
    });

    test("evicts the oldest entry once maxEntries is exceeded (FIFO)", () => {
        const cache = new InMemoryCache(2);

        cache.set("a", 1, 60);
        cache.set("b", 2, 60);
        cache.set("c", 3, 60); // should evict "a"

        expect(cache.get("a")).toBeUndefined();
        expect(cache.get("b")).toBe(2);
        expect(cache.get("c")).toBe(3);
        expect(cache.size).toBe(2);
    });
});

describe("computeCacheKey", () => {

    test("identical objects (regardless of key order) produce the same key", () => {
        const a = computeCacheKey({ url: "https://x.test", selector: ".p", extract: "text" });
        const b = computeCacheKey({ extract: "text", selector: ".p", url: "https://x.test" });
        expect(a).toBe(b);
    });

    test("different values produce different keys", () => {
        const a = computeCacheKey({ selector: ".a" });
        const b = computeCacheKey({ selector: ".b" });
        expect(a).not.toBe(b);
    });

    test("nested objects and arrays are also normalized consistently", () => {
        const a = computeCacheKey({ fields: { b: 2, a: 1 }, list: [1, 2, 3] });
        const b = computeCacheKey({ list: [1, 2, 3], fields: { a: 1, b: 2 } });
        expect(a).toBe(b);
    });
});
