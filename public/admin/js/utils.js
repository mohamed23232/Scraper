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

/** Copies text to the clipboard and briefly flips the triggering button's label to confirm it. */
export async function copyToClipboard(text, button) {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        // Clipboard API unavailable (very old browser, or no secure context) — fall back to a manual select.
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand("copy");
        } catch {
            // Nothing more we can do — the button just won't flip to "Copied".
        }
        document.body.removeChild(textarea);
    }

    if (button) {
        const original = button.textContent;
        button.textContent = "Copied!";
        button.disabled = true;
        setTimeout(() => {
            button.textContent = original;
            button.disabled = false;
        }, 1200);
    }
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
