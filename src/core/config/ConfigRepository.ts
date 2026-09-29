import type { ScraperConfig } from "./ScraperConfig.js";

export interface ConfigSummary {
    id: string;
    name: string;
    startUrl: string;
}

export interface ConfigRepository {
    /** Throws CONFIG_NOT_FOUND if the id doesn't exist. */
    load(id: string): Promise<ScraperConfig>;
    list(): Promise<ConfigSummary[]>;
    exists(id: string): Promise<boolean>;
    save(config: ScraperConfig): Promise<void>;
    /** Throws CONFIG_NOT_FOUND if the id doesn't exist. */
    remove(id: string): Promise<void>;
}
