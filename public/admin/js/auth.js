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
    container.innerHTML = `
        <label class="auth-bar">
            Admin API Key
            <input type="password" id="admin-api-key-input" placeholder="only needed to save/delete" value="${escapeAttr(getAdminApiKey())}">
        </label>
    `;

    container.querySelector("#admin-api-key-input").addEventListener("change", (event) => {
        setAdminApiKey(event.target.value.trim());
    });
}

function escapeAttr(value) {
    return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
