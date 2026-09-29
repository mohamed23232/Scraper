import type { FetchedPage } from "./FetchedPage.js";
import { assertUrlAllowed } from "../security/UrlPolicy.js";
import { ScraperError } from "../errors/ScraperError.js";

const DEFAULT_TIMEOUT = 15000;
const MAX_REDIRECTS = 5;

export class HttpClient {

    async get(url: string, timeoutMs: number = DEFAULT_TIMEOUT): Promise<FetchedPage> {

        let currentUrl = url;

        for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {

            await assertUrlAllowed(currentUrl);

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);

            let response: Response;

            try {
                response = await fetch(currentUrl, {
                    headers: { "User-Agent": "ScraperSystem/1.0" },
                    redirect: "manual",
                    signal: controller.signal
                });
            } catch (error) {
                if ((error as Error).name === "AbortError") {
                    throw new ScraperError("TIMEOUT", `Request timed out after ${timeoutMs}ms: ${currentUrl}`);
                }
                throw new ScraperError("REQUEST_FAILED", `Failed to fetch ${currentUrl}: ${(error as Error).message}`);
            } finally {
                clearTimeout(timer);
            }

            const isRedirect = response.status >= 300 && response.status < 400;
            const location = response.headers.get("location");

            if (isRedirect && location) {
                currentUrl = new URL(location, currentUrl).toString();
                continue;
            }

            if (response.status === 404) {
                throw new ScraperError("PAGE_NOT_FOUND", `Page not found (404): ${currentUrl}`);
            }

            if (!response.ok) {
                throw new ScraperError("REQUEST_FAILED", `HTTP ${response.status}: Failed to fetch ${currentUrl}`);
            }

            const body = await response.text();

            return {
                body,
                finalUrl: currentUrl,
                status: response.status,
                contentType: response.headers.get("content-type") ?? ""
            };
        }

        throw new ScraperError("REQUEST_FAILED", `Too many redirects (> ${MAX_REDIRECTS}) fetching ${url}`);
    }
}
