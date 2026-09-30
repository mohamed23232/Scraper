export type ScraperErrorCode =
    | "INVALID_URL"
    | "URL_NOT_ALLOWED"
    | "INVALID_CONFIGURATION"
    | "CONFIG_NOT_FOUND"
    | "JOB_NOT_FOUND"
    | "CONFLICT"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "REQUEST_FAILED"
    | "RESPONSE_TOO_LARGE"
    | "TIMEOUT"
    | "PAGE_NOT_FOUND"
    | "SELECTOR_NOT_FOUND"
    | "BROWSER_ERROR"
    | "PARSING_ERROR"
    | "TRANSFORMATION_ERROR";

export class ScraperError extends Error {

    constructor(
        public readonly code: ScraperErrorCode,
        message: string,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = "ScraperError";
    }
}
