import { readFile, writeFile, unlink, readdir, mkdir } from "node:fs/promises";
import path from "node:path";

import { scraperConfigSchema, type ScraperConfig } from "./ScraperConfig.js";
import { ScraperError } from "../errors/ScraperError.js";

const DEFAULT_CONFIGS_DIR = path.resolve(process.cwd(), "configs", "websites");

const VALID_ID = /^[a-zA-Z0-9_-]+$/;

export interface WebsiteSummary {
    id: string;
    name: string;
    startUrl: string;
}

export class ConfigLoader {

    constructor(private readonly configsDir: string = DEFAULT_CONFIGS_DIR) {}

    async list(): Promise<WebsiteSummary[]> {

        let entries: string[];

        try {
            entries = await readdir(this.configsDir);
        } catch {
            return [];
        }

        const summaries: WebsiteSummary[] = [];

        for (const entry of entries) {

            if (!entry.endsWith(".json")) {
                continue;
            }

            const id = entry.slice(0, -".json".length);

            try {
                const config = await this.load(id);
                summaries.push({ id: config.id, name: config.name ?? config.id, startUrl: config.startUrl });
            } catch (error) {
                console.warn(`[ConfigLoader] skipping '${entry}' while listing: ${(error as Error).message}`);
            }
        }

        return summaries;
    }

    async exists(id: string): Promise<boolean> {

        this.assertValidId(id);

        try {
            await readFile(this.pathFor(id), "utf-8");
            return true;
        } catch {
            return false;
        }
    }

    async load(id: string): Promise<ScraperConfig> {

        this.assertValidId(id);

        let raw: string;

        try {
            raw = await readFile(this.pathFor(id), "utf-8");
        } catch {
            throw new ScraperError("CONFIG_NOT_FOUND", `Configuration not found: ${id}`);
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

    async save(id: string, config: ScraperConfig): Promise<ScraperConfig> {

        this.assertValidId(id);

        await mkdir(this.configsDir, { recursive: true });
        await writeFile(this.pathFor(id), `${JSON.stringify(config, null, 4)}\n`, "utf-8");

        return config;
    }

    async remove(id: string): Promise<void> {

        this.assertValidId(id);

        try {
            await unlink(this.pathFor(id));
        } catch {
            throw new ScraperError("CONFIG_NOT_FOUND", `Configuration not found: ${id}`);
        }
    }

    private pathFor(id: string): string {
        return path.join(this.configsDir, `${id}.json`);
    }

    private assertValidId(id: string): void {
        if (!VALID_ID.test(id)) {
            throw new ScraperError("INVALID_CONFIGURATION", `Invalid configuration id: ${id}`);
        }
    }
}
