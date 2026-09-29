import type { FastifyInstance } from "fastify";
import { ConfigLoader } from "../../core/config/ConfigLoader.js";
import { websiteIdParamSchema, websiteConfigBodySchema } from "../schemas/website.schema.js";
import { ScraperError } from "../../core/errors/ScraperError.js";

export async function websitesRoute(app: FastifyInstance, configLoader: ConfigLoader) {

    app.get("/websites", async (_request, reply) => {

        const websites = await configLoader.list();

        return reply.status(200).send({ success: true, data: websites });
    });

    app.get("/websites/:id", async (request, reply) => {

        const params = websiteIdParamSchema.safeParse(request.params);

        if (!params.success) {
            throw new ScraperError("INVALID_CONFIGURATION", "Invalid website id", params.error.issues);
        }

        const config = await configLoader.load(params.data.id);

        return reply.status(200).send({ success: true, data: config });
    });

    app.post("/websites", async (request, reply) => {

        const result = websiteConfigBodySchema.safeParse(request.body);

        if (!result.success) {
            throw new ScraperError("INVALID_CONFIGURATION", "Invalid website configuration", result.error.issues);
        }

        const config = result.data;

        if (await configLoader.exists(config.id)) {
            throw new ScraperError("CONFLICT", `Website configuration '${config.id}' already exists`);
        }

        const saved = await configLoader.save(config.id, config);

        return reply.status(201).send({ success: true, data: saved });
    });

    app.put("/websites/:id", async (request, reply) => {

        const params = websiteIdParamSchema.safeParse(request.params);

        if (!params.success) {
            throw new ScraperError("INVALID_CONFIGURATION", "Invalid website id", params.error.issues);
        }

        const { id } = params.data;
        const body = (typeof request.body === "object" && request.body !== null ? request.body : {}) as Record<string, unknown>;

        if (body["id"] !== undefined && body["id"] !== id) {
            throw new ScraperError(
                "INVALID_CONFIGURATION",
                `Body id '${String(body["id"])}' does not match URL id '${id}'`
            );
        }

        const result = websiteConfigBodySchema.safeParse({ ...body, id });

        if (!result.success) {
            throw new ScraperError("INVALID_CONFIGURATION", "Invalid website configuration", result.error.issues);
        }

        const saved = await configLoader.save(id, result.data);

        return reply.status(200).send({ success: true, data: saved });
    });

    app.delete("/websites/:id", async (request, reply) => {

        const params = websiteIdParamSchema.safeParse(request.params);

        if (!params.success) {
            throw new ScraperError("INVALID_CONFIGURATION", "Invalid website id", params.error.issues);
        }

        await configLoader.remove(params.data.id);

        return reply.status(204).send();
    });
}
