import { readFile } from "node:fs/promises";
import path from "node:path";

import { scraperConfigSchema, type ScraperConfig } from "./ScraperConfig.js";
import { ScraperError } from "../errors/ScraperError.js";

const DEFAULT_CONFIGS_DIR = path.resolve(process.cwd(), "configs", "websites");

const VALID_ID = /^[a-zA-Z0-9_-]+$/;

export class ConfigLoader {

    constructor(private readonly configsDir: string = DEFAULT_CONFIGS_DIR) {}

    async load(id: string): Promise<ScraperConfig> {

        if (!VALID_ID.test(id)) {
            throw new ScraperError("INVALID_CONFIGURATION", `Invalid configuration id: ${id}`);
        }

        const filePath = path.join(this.configsDir, `${id}.json`);

        let raw: string;

        try {
            raw = await readFile(filePath, "utf-8");
        } catch {
            throw new ScraperError("INVALID_CONFIGURATION", `Configuration not found: ${id}`);
        }

        let json: unknown;

        try {
            json = JSON.parse(raw);
        } catch (error) {
            throw new ScraperError(
                "INVALID_CONFIGURATION",
                `Invalid JSON in configuration '${id}': ${(error as Error).message}`
            );
        }

        const result = scraperConfigSchema.safeParse(json);

        if (!result.success) {
            throw new ScraperError(
                "INVALID_CONFIGURATION",
                `Invalid configuration '${id}': ${result.error.issues
                    .map((issue) => `${issue.path.join(".")} - ${issue.message}`)
                    .join(", ")}`,
                result.error.issues
            );
        }

        return result.data;
    }
}
