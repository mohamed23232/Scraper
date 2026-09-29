import type { FastifyInstance } from "fastify";
import { ScraperError, type ScraperErrorCode } from "./ScraperError.js";

const STATUS_BY_CODE: Record<ScraperErrorCode, number> = {
    INVALID_URL: 400,
    INVALID_CONFIGURATION: 400,
    URL_NOT_ALLOWED: 403,
    CONFIG_NOT_FOUND: 404,
    SELECTOR_NOT_FOUND: 422,
    TRANSFORMATION_ERROR: 422,
    CONFLICT: 409,
    REQUEST_FAILED: 502,
    PAGE_NOT_FOUND: 502,
    BROWSER_ERROR: 502,
    PARSING_ERROR: 502,
    TIMEOUT: 504
};

export function registerErrorHandler(app: FastifyInstance): void {

    app.setErrorHandler((error, _request, reply) => {

        if (error instanceof ScraperError) {

            const status = STATUS_BY_CODE[error.code] ?? 500;

            return reply.status(status).send({
                success: false,
                error: {
                    code: error.code,
                    message: error.message,
                    ...(error.details !== undefined ? { details: error.details } : {})
                }
            });
        }

        app.log.error(error);

        return reply.status(500).send({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred"
            }
        });
    });
}
