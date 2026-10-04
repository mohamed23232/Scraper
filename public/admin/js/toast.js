import { icon } from "./icons.js";
import { escapeHtml } from "./utils.js";

let container = null;

function ensureContainer() {
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }
    return container;
}

export function showToast(message, type = "success", duration = 3200) {
    const root = ensureContainer();

    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `
        <span class="icon">${icon(type === "error" ? "alertCircle" : "checkCircle", 18)}</span>
        <span>${escapeHtml(message)}</span>
    `;

    root.appendChild(el);

    setTimeout(() => {
        el.style.transition = "opacity 0.2s ease";
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 200);
    }, duration);
}
