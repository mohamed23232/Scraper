import { icon } from "./icons.js";

const STORAGE_KEY = "admin_api_key";

export function getAdminApiKey() {
    try {
        return sessionStorage.getItem(STORAGE_KEY) || "";
    } catch {
        return "";
    }
}

export function setAdminApiKey(value) {
    try {
        if (value) {
            sessionStorage.setItem(STORAGE_KEY, value);
        } else {
            sessionStorage.removeItem(STORAGE_KEY);
        }
    } catch {
        // sessionStorage unavailable (private mode, etc.) — key just won't persist across reloads.
    }
}

export function mountAuthBar(container) {
    const hasKey = !!getAdminApiKey();

    container.innerHTML = `
        <label class="auth-bar" title="Only needed for Save and Delete — testing and browsing don't require it">
            <span class="key-status ${hasKey ? "set" : ""}" id="key-status"></span>
            Admin API Key
            <span class="key-field">
                <span class="icon">${icon("key", 14)}</span>
                <input type="password" id="admin-api-key-input" placeholder="only needed to save/delete" value="${escapeAttr(getAdminApiKey())}">
            </span>
        </label>
    `;

    const input = container.querySelector("#admin-api-key-input");
    const status = container.querySelector("#key-status");

    input.addEventListener("input", () => {
        status.classList.toggle("set", !!input.value.trim());
    });

    input.addEventListener("change", () => {
        setAdminApiKey(input.value.trim());
    });
}

function escapeAttr(value) {
    return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
