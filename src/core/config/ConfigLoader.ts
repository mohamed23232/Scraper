import { readFile } from "node:fs/promises";
import path from "node:path";

import { scraperConfigSchema, type ScraperConfig } from "./ScraperConfig.js";

const CONFIGS_DIR = path.resolve(process.cwd(), "configs", "websites");

const VALID_ID = /^[a-zA-Z0-9_-]+$/;

export class ConfigLoader {

    async load(id: string): Promise<ScraperConfig> {

        if (!VALID_ID.test(id)) {
            throw new Error(`Invalid configuration id: ${id}`);
        }

        const filePath = path.join(CONFIGS_DIR, `${id}.json`);

        let raw: string;

        try {
            raw = await readFile(filePath, "utf-8");
        } catch {
            throw new Error(`Configuration not found: ${id}`);
        }

        let json: unknown;

        try {
            json = JSON.parse(raw);
        } catch (error) {
            throw new Error(
                `Invalid JSON in configuration '${id}': ${(error as Error).message}`
            );
        }

        const result = scraperConfigSchema.safeParse(json);

        if (!result.success) {
            throw new Error(
                `Invalid configuration '${id}': ${result.error.issues
                    .map((issue) => `${issue.path.join(".")} - ${issue.message}`)
                    .join(", ")}`
            );
        }

        return result.data;
    }
}
