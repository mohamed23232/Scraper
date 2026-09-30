import type { Cache } from "./Cache.js";

interface Entry {
    value: unknown;
    expiresAt: number;
}

const DEFAULT_MAX_ENTRIES = 500;

/**
 * A single-process, in-memory TTL cache. Deliberately not Redis/anything
 * external — that's reserved for Phase 12 once a real queue exists. A
 * simple FIFO cap prevents unbounded growth from callers hitting many
 * distinct cache keys.
 */
export class InMemoryCache implements Cache {

    private readonly store = new Map<string, Entry>();

    constructor(private readonly maxEntries: number = DEFAULT_MAX_ENTRIES) {}

    get<T>(key: string): T | undefined {

        const entry = this.store.get(key);

        if (!entry) {
            return undefined;
        }

        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }

        return entry.value as T;
    }

    set<T>(key: string, value: T, ttlSeconds: number): void {

        this.store.delete(key); // re-insert at the end for FIFO eviction ordering
        this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });

        if (this.store.size > this.maxEntries) {
            const oldestKey = this.store.keys().next().value;
            if (oldestKey !== undefined) {
                this.store.delete(oldestKey);
            }
        }
    }

    get size(): number {
        return this.store.size;
    }

    clear(): void {
        this.store.clear();
    }
}
