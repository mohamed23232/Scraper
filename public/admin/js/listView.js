import { escapeHtml } from "./utils.js";
import { listWebsites, deleteWebsite } from "./api.js";

export async function renderListView(container, { onSelect, onNew }) {
    container.innerHTML = `<p class="muted">Loading saved websites…</p>`;

    const response = await listWebsites();

    if (!response.success) {
        container.innerHTML = `
            <div class="error-banner">
                <span class="badge badge-error">${escapeHtml(response.error?.code ?? "ERROR")}</span>
                <span>${escapeHtml(response.error?.message ?? "Could not load saved websites.")}</span>
            </div>
        `;
        return;
    }

    const websites = response.data || [];

    container.innerHTML = `
        <div class="list-toolbar">
            <button type="button" class="btn-primary" data-action="new">+ New Website</button>
        </div>
        ${websites.length === 0
            ? `<p class="muted">No saved websites yet — click "New Website" to create one.</p>`
            : `<table class="config-list">
                <thead><tr><th>Id</th><th>Name</th><th>Start URL</th><th></th></tr></thead>
                <tbody>
                    ${websites.map((w) => `
                        <tr>
                            <td><a href="#" data-action="open" data-id="${escapeHtml(w.id)}">${escapeHtml(w.id)}</a></td>
                            <td>${escapeHtml(w.name ?? "")}</td>
                            <td class="truncate" title="${escapeHtml(w.startUrl ?? "")}">${escapeHtml(w.startUrl ?? "")}</td>
                            <td><button type="button" class="btn-danger btn-small" data-action="delete" data-id="${escapeHtml(w.id)}">Delete</button></td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>`}
    `;

    container.querySelector("[data-action='new']").addEventListener("click", () => onNew());

    container.querySelectorAll("[data-action='open']").forEach((el) => {
        el.addEventListener("click", (event) => {
            event.preventDefault();
            const config = websites.find((w) => w.id === el.dataset.id);
            if (config) onSelect(config);
        });
    });

    container.querySelectorAll("[data-action='delete']").forEach((el) => {
        el.addEventListener("click", async () => {
            const id = el.dataset.id;
            if (!window.confirm(`Delete website config '${id}'? This cannot be undone.`)) {
                return;
            }
            const result = await deleteWebsite(id);
            if (!result.success) {
                window.alert(`Could not delete '${id}': ${result.error?.message ?? "unknown error"}`);
                return;
            }
            renderListView(container, { onSelect, onNew });
        });
    });
}
