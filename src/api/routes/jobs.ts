import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { JobStore } from "../../core/jobs/JobStore.js";
import { ScraperError } from "../../core/errors/ScraperError.js";

const jobIdParamSchema = z.object({
    id: z.string().min(1)
});

export async function jobsRoute(app: FastifyInstance, jobStore: JobStore) {

    app.get("/jobs/:id", async (request, reply) => {

        const params = jobIdParamSchema.safeParse(request.params);

        if (!params.success) {
            throw new ScraperError("INVALID_CONFIGURATION", "Invalid job id", params.error.issues);
        }

        const job = jobStore.get(params.data.id);

        if (!job) {
            throw new ScraperError("JOB_NOT_FOUND", `Job not found: ${params.data.id}`);
        }

        if (job.status === "completed") {
            return reply.status(200).send({ jobId: job.id, status: job.status, result: job.result });
        }

        if (job.status === "failed") {
            return reply.status(200).send({ jobId: job.id, status: job.status, error: job.error });
        }

        return reply.status(200).send({ jobId: job.id, status: job.status });
    });
}
