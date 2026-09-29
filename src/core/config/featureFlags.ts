export function isInlineConfigsAllowed(): boolean {

    const raw = process.env["ALLOW_INLINE_CONFIGS"];

    if (raw !== undefined) {
        return raw === "true";
    }

    return process.env["NODE_ENV"] !== "production";
}
