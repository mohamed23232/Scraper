import net from "node:net";
import { Agent } from "undici";
import type { FetchedPage } from "./FetchedPage.js";
import { assertUrlAllowed } from "../security/UrlPolicy.js";
import { ScraperError } from "../errors/ScraperError.js";

const DEFAULT_TIMEOUT = 15000;
const MAX_REDIRECTS = 5;
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

function getMaxResponseBytes(): number {

    const raw = process.env["MAX_RESPONSE_BYTES"];
    const parsed = raw ? Number(raw) : NaN;

    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_RESPONSE_BYTES;
}

function pinnedDispatcher(resolvedIp: string): Agent {

    const family = net.isIPv6(resolvedIp) ? 6 : 4;

    return new Agent({
        connect: {
            lookup: (_hostname, _options, callback) => {
                callback(null, [{ address: resolvedIp, family }]);
            }
        }
    });
}

async function readBodyWithLimit(response: Response, maxBytes: number, currentUrl: string): Promise<string> {

    const contentLength = response.headers.get("content-length");

    if (contentLength && Number(contentLength) > maxBytes) {
        throw new ScraperError(
            "RESPONSE_TOO_LARGE",
            `Response too large: Content-Length ${contentLength} bytes exceeds limit of ${maxBytes} bytes (${currentUrl})`
        );
    }

    if (!response.body) {
        return response.text();
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    for (;;) {

        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        total += value.byteLength;

        if (total > maxBytes) {
            await reader.cancel();
            throw new ScraperError(
                "RESPONSE_TOO_LARGE",
                `Response exceeded ${maxBytes} bytes (${currentUrl})`
            );
        }

        chunks.push(value);
    }

    return Buffer.concat(chunks).toString("utf-8");
}

export class HttpClient {

    async get(url: string, timeoutMs: number = DEFAULT_TIMEOUT): Promise<FetchedPage> {

        const maxBytes = getMaxResponseBytes();
        let currentUrl = url;

        for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {

            const { resolvedIp } = await assertUrlAllowed(currentUrl);
            const dispatcher = resolvedIp ? pinnedDispatcher(resolvedIp) : undefined;

            try {

                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeoutMs);

                let response: Response;

                try {
                    response = await fetch(currentUrl, {
                        headers: { "User-Agent": "ScraperSystem/1.0" },
                        redirect: "manual",
                        signal: controller.signal,
                        ...(dispatcher ? { dispatcher } : {})
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

                const body = await readBodyWithLimit(response, maxBytes, currentUrl);

                return {
                    body,
                    finalUrl: currentUrl,
                    status: response.status,
                    contentType: response.headers.get("content-type") ?? ""
                };

            } finally {
                if (dispatcher) {
                    await dispatcher.close();
                }
            }
        }

        throw new ScraperError("REQUEST_FAILED", `Too many redirects (> ${MAX_REDIRECTS}) fetching ${url}`);
    }
}
