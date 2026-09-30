export function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function toNumberOrUndefined(value) {
    if (value === "" || value === undefined || value === null) {
        return undefined;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}

/** Tries to parse as JSON (so "false"/"0"/'"text"' round-trip to real types); falls back to the raw string. */
export function parseLooseJSON(text) {
    const trimmed = (text ?? "").trim();
    if (trimmed === "") {
        return undefined;
    }
    try {
        return JSON.parse(trimmed);
    } catch {
        return trimmed;
    }
}
