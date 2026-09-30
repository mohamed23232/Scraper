import type { ScrapeRequest } from "../../api/schemas/scrape.schema.js";
import type { JobQueue, QueuedJob } from "./JobQueue.js";
import { JobStore } from "./JobStore.js";
import { executeScrape, buildScrapeResponseData, type ScrapeExecutorDeps } from "../scrapeExecutor.js";
import { ScraperError } from "../errors/ScraperError.js";

export class InMemoryJobQueue implements JobQueue {

    constructor(
        private readonly jobStore: JobStore,
        private readonly deps: ScrapeExecutorDeps
    ) {}

    async enqueue(body: ScrapeRequest): Promise<string> {

        const startedAt = Date.now();
        const job = this.jobStore.create();

        void (async () => {

            this.jobStore.markRunning(job.id);

            try {
                const execResult = await executeScrape(body, this.deps);
                this.jobStore.complete(job.id, buildScrapeResponseData(execResult, Date.now() - startedAt));
            } catch (error) {
                if (error instanceof ScraperError) {
                    this.jobStore.fail(job.id, { code: error.code, message: error.message });
                } else {
                    this.jobStore.fail(job.id, { code: "INTERNAL_ERROR", message: "An unexpected error occurred" });
                }
            }
        })();

        return job.id;
    }

    async getStatus(id: string): Promise<QueuedJob | undefined> {

        const job = this.jobStore.get(id);

        if (!job) {
            return undefined;
        }

        return { id: job.id, status: job.status, result: job.result, error: job.error };
    }

    async close(): Promise<void> {
        // nothing to release — the JobStore is a plain in-memory Map
    }
}
