import { readFile, writeFile, unlink, rename, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { scraperConfigSchema, type ScraperConfig } from "./ScraperConfig.js";
import type { ConfigRepository, ConfigSummary } from "./ConfigRepository.js";
import { ScraperError } from "../errors/ScraperError.js";

const DEFAULT_CONFIGS_DIR = path.resolve(process.cwd(), "configs", "websites");

const VALID_ID = /^[a-zA-Z0-9_-]+$/;

export class FileConfigRepository implements ConfigRepository {

    constructor(private readonly configsDir: string = DEFAULT_CONFIGS_DIR) {}

    async list(): Promise<ConfigSummary[]> {

        let entries: string[];

        try {
            entries = await readdir(this.configsDir);
        } catch {
            return [];
        }

        const summaries: ConfigSummary[] = [];

        for (const entry of entries) {

            if (!entry.endsWith(".json")) {
                continue;
            }

            const id = entry.slice(0, -".json".length);

            try {
                const config = await this.load(id);
                summaries.push({ id: config.id, name: config.name ?? config.id, startUrl: config.startUrl });
            } catch (error) {
                console.warn(`[FileConfigRepository] skipping '${entry}' while listing: ${(error as Error).message}`);
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

    async save(config: ScraperConfig): Promise<void> {

        this.assertValidId(config.id);

        await mkdir(this.configsDir, { recursive: true });

        const finalPath = this.pathFor(config.id);
        const tempPath = path.join(this.configsDir, `.${config.id}.${randomUUID()}.tmp`);

        await writeFile(tempPath, `${JSON.stringify(config, null, 4)}\n`, "utf-8");

        try {
            await rename(tempPath, finalPath);
        } catch (error) {
            await unlink(tempPath).catch(() => {});
            throw error;
        }
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

        const resolvedDir = path.resolve(this.configsDir) + path.sep;
        const resolvedPath = path.resolve(this.configsDir, `${id}.json`);

        if (!resolvedPath.startsWith(resolvedDir)) {
            throw new ScraperError("INVALID_CONFIGURATION", `Invalid configuration id: ${id}`);
        }

        return resolvedPath;
    }

    private assertValidId(id: string): void {
        if (!VALID_ID.test(id)) {
            throw new ScraperError("INVALID_CONFIGURATION", `Invalid configuration id: ${id}`);
        }
    }
}
