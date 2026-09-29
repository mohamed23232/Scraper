import { describe, test, expect } from "vitest";
import { assertUrlAllowed } from "../src/core/security/UrlPolicy.js";
import { ScraperError } from "../src/core/errors/ScraperError.js";

describe("A1: URL policy / SSRF protection", () => {

    test("rejects non-http(s) protocols", async () => {
        await expect(assertUrlAllowed("file:///etc/passwd")).rejects.toThrow(ScraperError);
        await expect(assertUrlAllowed("javascript:alert(1)")).rejects.toThrow(ScraperError);
        await expect(assertUrlAllowed("data:text/html,hi")).rejects.toThrow(ScraperError);
        await expect(assertUrlAllowed("ftp://example.com/x")).rejects.toThrow(ScraperError);
    });

    test("rejects loopback and private IPv4 ranges when private networks are disallowed", async () => {
        const opts = { allowPrivateNetworks: false };
        await expect(assertUrlAllowed("http://127.0.0.1/", opts)).rejects.toThrow(ScraperError);
        await expect(assertUrlAllowed("http://10.0.0.5/", opts)).rejects.toThrow(ScraperError);
        await expect(assertUrlAllowed("http://172.16.0.1/", opts)).rejects.toThrow(ScraperError);
        await expect(assertUrlAllowed("http://192.168.1.1/", opts)).rejects.toThrow(ScraperError);
    });

    test("rejects the cloud metadata address", async () => {
        await expect(
            assertUrlAllowed("http://169.254.169.254/latest/meta-data/", { allowPrivateNetworks: false })
        ).rejects.toThrow(ScraperError);
    });

    test("rejects IPv6 loopback", async () => {
        await expect(
            assertUrlAllowed("http://[::1]/", { allowPrivateNetworks: false })
        ).rejects.toThrow(ScraperError);
    });

    test("allows a normal public https URL", async () => {
        await expect(
            assertUrlAllowed("https://example.com/", { allowPrivateNetworks: false })
        ).resolves.toBeUndefined();
    });

    test("allowPrivateNetworks: true permits a private address (explicit opt-in)", async () => {
        await expect(
            assertUrlAllowed("http://127.0.0.1:8080/", { allowPrivateNetworks: true })
        ).resolves.toBeUndefined();
    });

    test("throws with the URL_NOT_ALLOWED code for a blocked protocol", async () => {
        try {
            await assertUrlAllowed("file:///etc/passwd");
            expect.unreachable("should have thrown");
        } catch (error) {
            expect(error).toBeInstanceOf(ScraperError);
            expect((error as ScraperError).code).toBe("URL_NOT_ALLOWED");
        }
    });
});
