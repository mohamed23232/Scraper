import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { SqliteConfigRepository } from "../src/core/config/SqliteConfigRepository.js";
import { runConfigRepositoryContractTests } from "./helpers/configRepository.contract.js";

runConfigRepositoryContractTests("SqliteConfigRepository", async () => {

    const dir = await mkdtemp(path.join(tmpdir(), "scraper-sqlite-contract-"));
    const repo = new SqliteConfigRepository(path.join(dir, "test.sqlite"));

    return {
        repo,
        cleanup: async () => {
            await repo.close();
            await rm(dir, { recursive: true, force: true });
        }
    };
});
