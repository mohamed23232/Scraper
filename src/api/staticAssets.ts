import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import { fileURLToPath } from "node:url";
import path from "node:path";

export async function registerAdminStatic(app: FastifyInstance): Promise<void> {

    const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "admin");

    // "/admin/" (with trailing slash) is the prefix the static plugin owns below;
    // "/admin" alone doesn't match that prefix at all, so redirect it explicitly.
    app.get("/admin", (_request, reply) => {
        reply.redirect("/admin/");
    });

    await app.register(fastifyStatic, {
        root: publicDir,
        prefix: "/admin/",
        index: ["index.html"],
        redirect: true
    });
}
