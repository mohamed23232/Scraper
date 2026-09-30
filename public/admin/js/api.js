import { getAdminApiKey } from "./auth.js";

function authHeaders() {
    const key = getAdminApiKey();
    return key ? { Authorization: `Bearer ${key}` } : {};
}

async function request(url, options) {
    try {
        const response = await fetch(url, options);

        if (response.status === 204) {
            return { success: true, data: null };
        }

        const body = await response.json();
        return body;
    } catch (err) {
        return {
            success: false,
            error: { code: "NETWORK_ERROR", message: `Could not reach the server: ${err.message}` }
        };
    }
}

export function listWebsites() {
    return request("/websites", { method: "GET" });
}

export function getWebsite(id) {
    return request(`/websites/${encodeURIComponent(id)}`, { method: "GET" });
}

export function saveWebsite(id, payload) {
    return request(`/websites/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload)
    });
}

export function deleteWebsite(id) {
    return request(`/websites/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { ...authHeaders() }
    });
}

export function testScrape(body) {
    return request("/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
}
