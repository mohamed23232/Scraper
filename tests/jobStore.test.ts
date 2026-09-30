import { describe, test, expect } from "vitest";
import { JobStore } from "../src/core/jobs/JobStore.js";

describe("JobStore", () => {

    test("create() returns a queued job", () => {
        const store = new JobStore();
        const job = store.create();

        expect(job.status).toBe("queued");
        expect(store.get(job.id)).toEqual(job);
    });

    test("get() returns undefined for an unknown id", () => {
        const store = new JobStore();
        expect(store.get("does-not-exist")).toBeUndefined();
    });

    test("markRunning() transitions status", () => {
        const store = new JobStore();
        const job = store.create();

        store.markRunning(job.id);

        expect(store.get(job.id)?.status).toBe("running");
    });

    test("complete() stores the result and transitions status", () => {
        const store = new JobStore();
        const job = store.create();

        store.complete(job.id, { url: "https://example.com", data: ["x"], metadata: { durationMs: 1 } });

        const updated = store.get(job.id);
        expect(updated?.status).toBe("completed");
        expect(updated?.result).toEqual({ url: "https://example.com", data: ["x"], metadata: { durationMs: 1 } });
    });

    test("fail() stores the error and transitions status", () => {
        const store = new JobStore();
        const job = store.create();

        store.fail(job.id, { code: "TIMEOUT", message: "took too long" });

        const updated = store.get(job.id);
        expect(updated?.status).toBe("failed");
        expect(updated?.error).toEqual({ code: "TIMEOUT", message: "took too long" });
    });

    test("evicts the oldest job once maxJobs is exceeded (FIFO)", () => {
        const store = new JobStore(2);

        const a = store.create();
        store.create();
        store.create(); // should evict `a`

        expect(store.get(a.id)).toBeUndefined();
        expect(store.size).toBe(2);
    });

    test("updating an unknown job id is a harmless no-op", () => {
        const store = new JobStore();
        expect(() => store.markRunning("nope")).not.toThrow();
        expect(() => store.complete("nope", { url: "x", data: null, metadata: {} })).not.toThrow();
        expect(() => store.fail("nope", { code: "X", message: "x" })).not.toThrow();
    });
});
