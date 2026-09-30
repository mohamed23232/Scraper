import type { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { mkdir } from "node:fs/promises";

import { scraperConfigSchema, type ScraperConfig } from "./ScraperConfig.js";
import type { ConfigRepository, ConfigSummary } from "./ConfigRepository.js";
import { ScraperError } from "../errors/ScraperError.js";

interface ConfigRow {
    id: string;
    name: string;
    start_url: string;
    config_json: string;
}

/**
 * Backed by node:sqlite (built-in, still marked experimental by Node itself —
 * hence the dynamic import, so the experimental-feature warning only fires
 * for callers that actually opt into this storage backend).
 */
export class SqliteConfigRepository implements ConfigRepository {

    private db: DatabaseSync | undefined;
    private readonly ready: Promise<void>;

    constructor(private readonly dbPath: string) {
        this.ready = this.init();
    }

    private async init(): Promise<void> {

        const dir = path.dirname(this.dbPath);

        if (dir && dir !== ".") {
            await mkdir(dir, { recursive: true });
        }

        const { DatabaseSync } = await import("node:sqlite");
        this.db = new DatabaseSync(this.dbPath);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS website_configs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                start_url TEXT NOT NULL,
                config_json TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        `);
    }

    private async getDb(): Promise<DatabaseSync> {
        await this.ready;
        return this.db!;
    }

    async list(): Promise<ConfigSummary[]> {

        const db = await this.getDb();

        const rows = db
            .prepare("SELECT id, name, start_url, config_json FROM website_configs ORDER BY id")
            .all() as unknown as ConfigRow[];

        return rows.map((row) => ({ id: row.id, name: row.name, startUrl: row.start_url }));
    }

    async exists(id: string): Promise<boolean> {

        const db = await this.getDb();
        const row = db.prepare("SELECT 1 FROM website_configs WHERE id = ?").get(id);

        return row !== undefined;
    }

    async load(id: string): Promise<ScraperConfig> {

        const db = await this.getDb();
        const row = db
            .prepare("SELECT id, name, start_url, config_json FROM website_configs WHERE id = ?")
            .get(id) as unknown as ConfigRow | undefined;

        if (!row) {
            throw new ScraperError("CONFIG_NOT_FOUND", `Configuration not found: ${id}`);
        }

        const json = JSON.parse(row.config_json);
        const result = scraperConfigSchema.safeParse(json);

        if (!result.success) {
            throw new ScraperError(
                "INVALID_CONFIGURATION",
                `Invalid configuration '${id}' in database: ${result.error.issues
                    .map((issue) => `${issue.path.join(".")} - ${issue.message}`)
                    .join(", ")}`,
                result.error.issues
            );
        }

        return result.data;
    }

    async save(config: ScraperConfig): Promise<void> {

        const db = await this.getDb();
        const now = new Date().toISOString();

        const existing = db
            .prepare("SELECT version FROM website_configs WHERE id = ?")
            .get(config.id) as unknown as { version: number } | undefined;

        const nextVersion = existing ? existing.version + 1 : 1;

        db.prepare(`
            INSERT INTO website_configs (id, name, start_url, config_json, version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                start_url = excluded.start_url,
                config_json = excluded.config_json,
                version = excluded.version,
                updated_at = excluded.updated_at
        `).run(
            config.id,
            config.name ?? config.id,
            config.startUrl,
            JSON.stringify(config),
            nextVersion,
            now,
            now
        );
    }

    async remove(id: string): Promise<void> {

        const db = await this.getDb();
        const info = db.prepare("DELETE FROM website_configs WHERE id = ?").run(id);

        if (info.changes === 0) {
            throw new ScraperError("CONFIG_NOT_FOUND", `Configuration not found: ${id}`);
        }
    }

    async close(): Promise<void> {
        const db = await this.getDb();
        db.close();
    }
}
