import type { ScrapeRequest } from "../../api/schemas/scrape.schema.js";

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface JobResult {
    url: string;
    data: unknown;
    metadata: Record<string, unknown>;
}

export interface JobError {
    code: string;
    message: string;
}

export interface QueuedJob {
    id: string;
    status: JobStatus;
    result?: JobResult | undefined;
    error?: JobError | undefined;
}

/**
 * Abstracts "run this scrape in the background, let me poll for its status"
 * so the route layer doesn't care whether jobs run in-process (Phase 11,
 * default) or on a real Redis-backed queue processed by separate worker(s)
 * (Phase 12, opt-in via QUEUE_DRIVER=bullmq) — the same pattern as
 * ConfigRepository (Phase 9) for file vs. database storage.
 */
export interface JobQueue {
    enqueue(body: ScrapeRequest): Promise<string>;
    getStatus(id: string): Promise<QueuedJob | undefined>;
    close(): Promise<void>;
}
