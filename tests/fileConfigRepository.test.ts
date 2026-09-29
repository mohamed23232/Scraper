import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { FileConfigRepository } from "../src/core/config/FileConfigRepository.js";
import { runConfigRepositoryContractTests } from "./helpers/configRepository.contract.js";

runConfigRepositoryContractTests("FileConfigRepository", async () => {

    const dir = await mkdtemp(path.join(tmpdir(), "scraper-repo-contract-"));
    const repo = new FileConfigRepository(dir);

    return {
        repo,
        cleanup: () => rm(dir, { recursive: true, force: true })
    };
});
