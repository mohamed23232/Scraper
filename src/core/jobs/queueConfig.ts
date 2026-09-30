import { Redis } from "ioredis";

export const QUEUE_NAME = "scrape-jobs";

export function getQueueDriver(): "memory" | "bullmq" {
    return process.env["QUEUE_DRIVER"] === "bullmq" ? "bullmq" : "memory";
}

/**
 * BullMQ's Worker requires maxRetriesPerRequest: null on the underlying
 * ioredis connection (its own documented requirement, otherwise blocking
 * commands like BRPOPLPUSH fail under retry limits).
 */
export function createRedisConnection(url?: string): Redis {
    return new Redis(url ?? process.env["REDIS_URL"] ?? "redis://127.0.0.1:6379", { maxRetriesPerRequest: null });
}
