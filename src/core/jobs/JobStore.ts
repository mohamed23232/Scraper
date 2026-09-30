import { randomUUID } from "node:crypto";

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

export interface Job {
    id: string;
    status: JobStatus;
    createdAt: string;
    updatedAt: string;
    result?: JobResult;
    error?: JobError;
}

const DEFAULT_MAX_JOBS = 500;

/**
 * A single-process, in-memory job store. Like the cache (Phase 10), this is
 * deliberately not backed by a real queue — that's Phase 12, once BullMQ/Redis
 * is actually justified by needing to distribute work across processes.
 */
export class JobStore {

    private readonly jobs = new Map<string, Job>();

    constructor(private readonly maxJobs: number = DEFAULT_MAX_JOBS) {}

    create(): Job {

        const now = new Date().toISOString();

        const job: Job = {
            id: randomUUID(),
            status: "queued",
            createdAt: now,
            updatedAt: now
        };

        this.jobs.set(job.id, job);
        this.evictIfNeeded();

        return job;
    }

    get(id: string): Job | undefined {
        return this.jobs.get(id);
    }

    markRunning(id: string): void {
        this.update(id, (job) => {
            job.status = "running";
        });
    }

    complete(id: string, result: JobResult): void {
        this.update(id, (job) => {
            job.status = "completed";
            job.result = result;
        });
    }

    fail(id: string, error: JobError): void {
        this.update(id, (job) => {
            job.status = "failed";
            job.error = error;
        });
    }

    get size(): number {
        return this.jobs.size;
    }

    private update(id: string, mutate: (job: Job) => void): void {

        const job = this.jobs.get(id);

        if (!job) {
            return;
        }

        mutate(job);
        job.updatedAt = new Date().toISOString();
    }

    private evictIfNeeded(): void {

        if (this.jobs.size <= this.maxJobs) {
            return;
        }

        const oldestKey = this.jobs.keys().next().value;

        if (oldestKey !== undefined) {
            this.jobs.delete(oldestKey);
        }
    }
}
