import dns from "node:dns/promises";
import net from "node:net";
import { ScraperError } from "../errors/ScraperError.js";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function isPrivateIPv4(ip: string): boolean {

    const parts = ip.split(".").map(Number);

    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
        return false;
    }

    const [a, b] = parts as [number, number, number, number];

    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;

    return false;
}

function isPrivateIPv6(ip: string): boolean {

    const normalized = ip.toLowerCase();

    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fe80")) return true;

    if (normalized.startsWith("::ffff:")) {
        return isPrivateIPv4(normalized.slice("::ffff:".length));
    }

    return false;
}

function isPrivateIp(ip: string): boolean {

    if (net.isIPv4(ip)) {
        return isPrivateIPv4(ip);
    }

    if (net.isIPv6(ip)) {
        return isPrivateIPv6(ip);
    }

    return true;
}

function allowPrivateNetworksFromEnv(): boolean {
    return process.env["ALLOW_PRIVATE_NETWORKS"] === "true";
}

export interface UrlPolicyOptions {
    allowPrivateNetworks?: boolean;
}

export async function assertUrlAllowed(rawUrl: string, options: UrlPolicyOptions = {}): Promise<void> {

    let url: URL;

    try {
        url = new URL(rawUrl);
    } catch {
        throw new ScraperError("INVALID_URL", `Malformed URL: ${rawUrl}`);
    }

    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
        throw new ScraperError(
            "URL_NOT_ALLOWED",
            `Protocol not allowed: '${url.protocol}' (only http/https are permitted)`
        );
    }

    const allowPrivate = options.allowPrivateNetworks ?? allowPrivateNetworksFromEnv();

    if (allowPrivate) {
        return;
    }

    const hostname = url.hostname;

    if (net.isIP(hostname)) {
        if (isPrivateIp(hostname)) {
            throw new ScraperError(
                "URL_NOT_ALLOWED",
                `URL resolves to a disallowed private/internal address: ${hostname}`
            );
        }
        return;
    }

    let addresses: string[];

    try {
        const records = await dns.lookup(hostname, { all: true });
        addresses = records.map((record) => record.address);
    } catch {
        throw new ScraperError("URL_NOT_ALLOWED", `Could not resolve hostname: ${hostname}`);
    }

    if (addresses.length === 0) {
        throw new ScraperError("URL_NOT_ALLOWED", `Could not resolve hostname: ${hostname}`);
    }

    for (const address of addresses) {
        if (isPrivateIp(address)) {
            throw new ScraperError(
                "URL_NOT_ALLOWED",
                `URL host '${hostname}' resolves to a disallowed private/internal address: ${address}`
            );
        }
    }
}
