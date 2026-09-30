import path from "node:path";
import type { ConfigRepository } from "./ConfigRepository.js";
import { FileConfigRepository } from "./FileConfigRepository.js";
import { SqliteConfigRepository } from "./SqliteConfigRepository.js";

export function buildConfigRepository(): ConfigRepository {

    if (process.env["CONFIG_STORAGE"] === "sqlite") {
        const dbPath = process.env["DATABASE_PATH"] ?? path.resolve(process.cwd(), "data", "configs.sqlite");
        return new SqliteConfigRepository(dbPath);
    }

    return new FileConfigRepository(process.env["CONFIGS_DIR"]);
}
