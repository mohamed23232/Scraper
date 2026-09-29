import { describe, test, expect } from "vitest";
import type { ConfigRepository } from "../../src/core/config/ConfigRepository.js";
import type { ScraperConfig } from "../../src/core/config/ScraperConfig.js";

export interface RepositoryHandle {
    repo: ConfigRepository;
    cleanup(): Promise<void>;
}

const SAMPLE: ScraperConfig = {
    id: "sample-site",
    name: "Sample Site",
    startUrl: "https://example.com",
    scraper: { type: "static" },
    item: { selector: ".product" },
    fields: { name: { selector: ".name", extract: "text" } }
} as ScraperConfig;

/**
 * Shared CRUD contract for any ConfigRepository implementation — run once
 * against FileConfigRepository here, and again against a future database
 * repository in Phase 9 with no changes to the assertions themselves.
 */
export function runConfigRepositoryContractTests(
    name: string,
    makeRepository: () => Promise<RepositoryHandle>
): void {

    describe(`ConfigRepository contract: ${name}`, () => {

        test("list() is empty for a fresh repository", async () => {
            const { repo, cleanup } = await makeRepository();
            try {
                expect(await repo.list()).toEqual([]);
            } finally {
                await cleanup();
            }
        });

        test("save() then load() round-trips the config", async () => {
            const { repo, cleanup } = await makeRepository();
            try {
                await repo.save(SAMPLE);
                const loaded = await repo.load(SAMPLE.id);
                expect(loaded.id).toBe(SAMPLE.id);
                expect(loaded.startUrl).toBe(SAMPLE.startUrl);
            } finally {
                await cleanup();
            }
        });

        test("exists() reflects save()/remove()", async () => {
            const { repo, cleanup } = await makeRepository();
            try {
                expect(await repo.exists(SAMPLE.id)).toBe(false);
                await repo.save(SAMPLE);
                expect(await repo.exists(SAMPLE.id)).toBe(true);
                await repo.remove(SAMPLE.id);
                expect(await repo.exists(SAMPLE.id)).toBe(false);
            } finally {
                await cleanup();
            }
        });

        test("list() reflects a saved config", async () => {
            const { repo, cleanup } = await makeRepository();
            try {
                await repo.save(SAMPLE);
                expect(await repo.list()).toEqual([
                    { id: SAMPLE.id, name: SAMPLE.name, startUrl: SAMPLE.startUrl }
                ]);
            } finally {
                await cleanup();
            }
        });

        test("save() twice overwrites (idempotent replace, not append)", async () => {
            const { repo, cleanup } = await makeRepository();
            try {
                await repo.save(SAMPLE);
                await repo.save({ ...SAMPLE, name: "Renamed" });
                const loaded = await repo.load(SAMPLE.id);
                expect(loaded.name).toBe("Renamed");
                expect(await repo.list()).toHaveLength(1);
            } finally {
                await cleanup();
            }
        });

        test("load() on an unknown id throws CONFIG_NOT_FOUND", async () => {
            const { repo, cleanup } = await makeRepository();
            try {
                await expect(repo.load("does-not-exist")).rejects.toMatchObject({ code: "CONFIG_NOT_FOUND" });
            } finally {
                await cleanup();
            }
        });

        test("remove() on an unknown id throws CONFIG_NOT_FOUND", async () => {
            const { repo, cleanup } = await makeRepository();
            try {
                await expect(repo.remove("does-not-exist")).rejects.toMatchObject({ code: "CONFIG_NOT_FOUND" });
            } finally {
                await cleanup();
            }
        });
    });
}
