import { timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { ScraperError } from "../errors/ScraperError.js";

function getAdminApiKey(): string | undefined {
    return process.env["ADMIN_API_KEY"];
}

function isProduction(): boolean {
    return process.env["NODE_ENV"] === "production";
}

function safeEqual(a: string, b: string): boolean {

    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    if (bufA.length !== bufB.length) {
        return false;
    }

    return timingSafeEqual(bufA, bufB);
}

export function adminAuthWarningIfAny(): string | undefined {

    if (!getAdminApiKey() && !isProduction()) {
        return "ADMIN_API_KEY is not set — website management endpoints (POST/PUT/DELETE /websites) are unauthenticated. Set ADMIN_API_KEY before exposing this server beyond your own machine.";
    }

    return undefined;
}

export async function requireAdminAuth(request: FastifyRequest): Promise<void> {

    const configuredKey = getAdminApiKey();

    if (!configuredKey) {

        if (isProduction()) {
            throw new ScraperError(
                "FORBIDDEN",
                "Website management endpoints are disabled: ADMIN_API_KEY is not set in production"
            );
        }

        return;
    }

    const header = request.headers["authorization"];
    const provided = typeof header === "string" && header.startsWith("Bearer ")
        ? header.slice("Bearer ".length)
        : undefined;

    if (!provided || !safeEqual(provided, configuredKey)) {
        throw new ScraperError("UNAUTHORIZED", "Missing or invalid admin API key");
    }
}
