export type ScraperErrorCode =
    | "INVALID_URL"
    | "URL_NOT_ALLOWED"
    | "INVALID_CONFIGURATION"
    | "REQUEST_FAILED"
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
