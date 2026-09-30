import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { ScrapeRequest } from "../../api/schemas/scrape.schema.js";
import type { JobQueue, JobStatus, QueuedJob, JobError } from "./JobQueue.js";
import { QUEUE_NAME } from "./queueConfig.js";

function mapState(state: string): JobStatus {
    switch (state) {
        case "completed":
            return "completed";
        case "failed":
            return "failed";
        case "active":
            return "running";
        default:
            return "queued"; // waiting, delayed, waiting-children, prioritized, ...
    }
}

function parseFailureReason(reason: string | undefined): JobError {

    if (!reason) {
        return { code: "INTERNAL_ERROR", message: "Unknown failure" };
    }

    try {
        return JSON.parse(reason);
    } catch {
        return { code: "INTERNAL_ERROR", message: reason };
    }
}

/**
 * Enqueues scrape jobs onto a real Redis-backed queue. Deliberately does NOT
 * run a Worker itself — that's src/scripts/worker.ts, a separate process (or
 * several, per the Phase 12 diagram: API enqueues, workers process).
 */
export class BullMqJobQueue implements JobQueue {

    private readonly queue: Queue;

    constructor(connection: Redis) {
        this.queue = new Queue(QUEUE_NAME, { connection });
    }

    async enqueue(body: ScrapeRequest): Promise<string> {

        const job = await this.queue.add("scrape", { body, startedAt: Date.now() });

        if (!job.id) {
            throw new Error("BullMQ did not assign a job id");
        }

        return job.id;
    }

    async getStatus(id: string): Promise<QueuedJob | undefined> {

        const job = await this.queue.getJob(id);

        if (!job) {
            return undefined;
        }

        const status = mapState(await job.getState());

        if (status === "completed") {
            return { id, status, result: job.returnvalue };
        }

        if (status === "failed") {
            return { id, status, error: parseFailureReason(job.failedReason) };
        }

        return { id, status };
    }

    async close(): Promise<void> {
        await this.queue.close();
    }
}
