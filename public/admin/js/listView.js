import { escapeHtml } from "./utils.js";
import { listWebsites, getWebsite, deleteWebsite } from "./api.js";
import { icon } from "./icons.js";
import { showToast } from "./toast.js";
import { confirmDialog } from "./confirmDialog.js";

export async function renderListView(container, { onSelect, onNew }) {
    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>Website Configs</h2>
                <p>Loading…</p>
            </div>
        </div>
    `;

    const response = await listWebsites();

    if (!response.success) {
        container.innerHTML = `
            <div class="error-banner">
                <span class="icon">${icon("alertTriangle")}</span>
                <div class="content">
                    <div class="msg-row">
                        <span class="badge badge-error">${escapeHtml(response.error?.code ?? "ERROR")}</span>
                        <span>${escapeHtml(response.error?.message ?? "Could not load saved websites.")}</span>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    const websites = response.data || [];

    container.innerHTML = `
        <div class="page-header">
            <div>
                <h2>Website Configs</h2>
                <p>${websites.length} saved config${websites.length === 1 ? "" : "s"}</p>
            </div>
            <button type="button" class="btn-primary" data-action="new">${icon("plus", 15)} New Website</button>
        </div>
        <div class="card" id="list-body"></div>
    `;

    const listBody = container.querySelector("#list-body");

    listBody.innerHTML = websites.length === 0
        ? `
            <div class="empty-state">
                <div class="icon">${icon("inbox", 30)}</div>
                <h3>No websites yet</h3>
                <p>Create your first config to start scraping a site.</p>
                <button type="button" class="btn-primary" data-action="new-empty">${icon("plus", 15)} New Website</button>
            </div>
        `
        : websites.map((w) => `
            <div class="config-list-row">
                <span class="avatar">${icon("globe", 18)}</span>
                <div class="info">
                    <button type="button" class="name" data-action="open" data-id="${escapeHtml(w.id)}">${escapeHtml(w.name || w.id)}</button>
                    <div class="meta">
                        <span class="faint">${escapeHtml(w.id)}</span>
                        <span>&middot;</span>
                        <span class="truncate" title="${escapeHtml(w.startUrl ?? "")}">${escapeHtml(w.startUrl ?? "")}</span>
                    </div>
                </div>
                <button type="button" class="btn-ghost btn-icon" data-action="edit" data-id="${escapeHtml(w.id)}" title="Edit">${icon("pencil", 16)}</button>
                <button type="button" class="btn-danger btn-icon" data-action="delete" data-id="${escapeHtml(w.id)}" title="Delete">${icon("trash", 16)}</button>
            </div>
        `).join("");

    container.querySelector("[data-action='new']")?.addEventListener("click", () => onNew());
    container.querySelector("[data-action='new-empty']")?.addEventListener("click", () => onNew());

    container.querySelectorAll("[data-action='open'], [data-action='edit']").forEach((el) => {
        el.addEventListener("click", () => openConfig(el.dataset.id));
    });

    async function openConfig(id) {
        const icons = container.querySelectorAll(`[data-id="${CSS.escape(id)}"]`);
        icons.forEach((el) => (el.disabled = true));

        // GET /websites only returns lightweight summaries (id/name/startUrl) — the full
        // config (item/fields/scraper/pagination/cache) has to be fetched per-id.
        const result = await getWebsite(id);

        if (!result.success) {
            showToast(`Could not load '${id}': ${result.error?.message ?? "unknown error"}`, "error");
            icons.forEach((el) => (el.disabled = false));
            return;
        }

        onSelect(result.data);
    }

    container.querySelectorAll("[data-action='delete']").forEach((el) => {
        el.addEventListener("click", async () => {
            const id = el.dataset.id;

            const confirmed = await confirmDialog({
                title: `Delete '${id}'?`,
                message: "This permanently removes the saved config. This cannot be undone.",
                confirmLabel: "Delete"
            });
            if (!confirmed) return;

            const result = await deleteWebsite(id);
            if (!result.success) {
                showToast(`Could not delete '${id}': ${result.error?.message ?? "unknown error"}`, "error");
                return;
            }

            showToast(`Deleted '${id}'.`, "success");
            renderListView(container, { onSelect, onNew });
        });
    });
}
