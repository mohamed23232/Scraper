import { escapeHtml } from "./utils.js";
import {
    createEmptyConfigState, loadConfigIntoState,
    buildInlineScrapeRequest, buildSavedConfigPayload,
    validateForTest, validateForSave
} from "./state.js";
import { mountFieldsTable } from "./fieldsTable.js";
import { renderResults, clearResults } from "./resultsView.js";
import { testScrape, saveWebsite } from "./api.js";

export function renderEditorView(container, existingConfig, { onBack, onSaved }) {

    const state = existingConfig ? loadConfigIntoState(existingConfig) : createEmptyConfigState();
    const isNew = !existingConfig;

    container.innerHTML = `
        <div class="editor-header">
            <button type="button" class="btn-small" data-action="back">&larr; Back to list</button>
            <h2>${isNew ? "New website config" : `Edit "${escapeHtml(state.id)}"`}</h2>
        </div>

        <div class="form-row">
            <label>Id <input type="text" id="f-id" value="${escapeHtml(state.id)}" placeholder="my-website" ${isNew ? "" : "disabled"}></label>
            <label>Name <input type="text" id="f-name" value="${escapeHtml(state.name)}" placeholder="(optional, display name)"></label>
            <label class="grow">Start URL <input type="text" id="f-startUrl" value="${escapeHtml(state.startUrl)}" placeholder="https://example.com"></label>
        </div>

        <details open>
            <summary>Item</summary>
            <div class="form-row">
                <label class="grow">Item selector <input type="text" id="f-item-selector" value="${escapeHtml(state.item.selector)}" placeholder=".product-card"></label>
                <label><input type="checkbox" id="f-item-allowEmpty" ${state.item.allowEmpty ? "checked" : ""}> Allow empty (don't error on 0 matches)</label>
            </div>
        </details>

        <details open>
            <summary>Fields</summary>
            <div id="fields-table-container"></div>
        </details>

        <details open>
            <summary>Scraper options</summary>
            <div class="form-row">
                <label>Type
                    <select id="f-scraper-type">
                        <option value="static" ${state.scraper.type === "static" ? "selected" : ""}>static</option>
                        <option value="browser" ${state.scraper.type === "browser" ? "selected" : ""}>browser</option>
                    </select>
                </label>
                <label>Timeout (ms) <input type="number" id="f-scraper-timeout" value="${escapeHtml(state.scraper.timeout)}" placeholder="15000"></label>
                <label class="grow">Wait for selector (browser only) <input type="text" id="f-scraper-waitFor" value="${escapeHtml(state.scraper.waitFor)}" placeholder=".loaded"></label>
                <label><input type="checkbox" id="f-scraper-blockResources" ${state.scraper.blockResources ? "checked" : ""}> Block images/fonts (browser only, default on)</label>
            </div>
        </details>

        <details ${state.pagination.enabled ? "open" : ""}>
            <summary>Pagination (optional)</summary>
            <div class="form-row">
                <label><input type="checkbox" id="f-pagination-enabled" ${state.pagination.enabled ? "checked" : ""}> Enabled</label>
                <label class="grow">Next-page selector <input type="text" id="f-pagination-nextSelector" value="${escapeHtml(state.pagination.nextSelector)}" placeholder="a.next"></label>
            </div>
            <div class="form-row">
                <label>Max pages <input type="number" id="f-pagination-maxPages" value="${escapeHtml(state.pagination.maxPages)}" placeholder="10"></label>
                <label>Max items <input type="number" id="f-pagination-maxItems" value="${escapeHtml(state.pagination.maxItems)}"></label>
                <label>Max duration (ms) <input type="number" id="f-pagination-maxDurationMs" value="${escapeHtml(state.pagination.maxDurationMs)}" placeholder="60000"></label>
                <label>Delay between pages (ms) <input type="number" id="f-pagination-delayMs" value="${escapeHtml(state.pagination.delayMs)}"></label>
                <label><input type="checkbox" id="f-pagination-failOnPageError" ${state.pagination.failOnPageError ? "checked" : ""}> Fail whole request on a page error</label>
            </div>
        </details>

        <details ${state.cache.enabled ? "open" : ""}>
            <summary>Cache (optional)</summary>
            <div class="form-row">
                <label><input type="checkbox" id="f-cache-enabled" ${state.cache.enabled ? "checked" : ""}> Enabled</label>
                <label>TTL (seconds) <input type="number" id="f-cache-ttl" value="${escapeHtml(state.cache.ttl)}" placeholder="300"></label>
            </div>
        </details>

        <div class="test-bar">
            <label class="grow">Test URL <input type="text" id="f-test-url" placeholder="(defaults to Start URL above)"></label>
            <button type="button" class="btn-small" data-action="test-scrape">Test Scrape</button>
            <button type="button" class="btn-primary" data-action="save">Save</button>
        </div>
        <div id="validation-errors" class="error-banner" style="display:none"></div>
        <div id="results-container"></div>
    `;

    mountFieldsTable(container.querySelector("#fields-table-container"), state.fields);
    clearResults(container.querySelector("#results-container"));

    bindSimpleFields(container, state);

    container.querySelector("[data-action='back']").addEventListener("click", () => onBack());

    container.querySelector("[data-action='test-scrape']").addEventListener("click", async () => {
        const errors = validateForTest(state);
        const errorBox = container.querySelector("#validation-errors");

        if (errors.length > 0) {
            showValidationErrors(errorBox, errors);
            return;
        }
        errorBox.style.display = "none";

        const testUrl = container.querySelector("#f-test-url").value;
        const body = buildInlineScrapeRequest(state, testUrl);
        const response = await testScrape(body);
        renderResults(container.querySelector("#results-container"), response);
    });

    container.querySelector("[data-action='save']").addEventListener("click", async () => {
        const errors = validateForSave(state);
        const errorBox = container.querySelector("#validation-errors");

        if (errors.length > 0) {
            showValidationErrors(errorBox, errors);
            return;
        }
        errorBox.style.display = "none";

        const payload = buildSavedConfigPayload(state);
        const response = await saveWebsite(payload.id, payload);

        if (!response.success) {
            showValidationErrors(errorBox, [`${response.error?.code ?? "ERROR"}: ${response.error?.message ?? "Save failed."}`]);
            return;
        }

        onSaved();
    });
}

function bindSimpleFields(container, state) {
    const bind = (id, getTarget, key, isCheckbox) => {
        const el = container.querySelector(id);
        el.addEventListener("input", () => {
            getTarget(state)[key] = isCheckbox ? el.checked : el.value;
        });
        el.addEventListener("change", () => {
            getTarget(state)[key] = isCheckbox ? el.checked : el.value;
        });
    };

    bind("#f-id", (s) => s, "id", false);
    bind("#f-name", (s) => s, "name", false);
    bind("#f-startUrl", (s) => s, "startUrl", false);

    bind("#f-item-selector", (s) => s.item, "selector", false);
    bind("#f-item-allowEmpty", (s) => s.item, "allowEmpty", true);

    bind("#f-scraper-type", (s) => s.scraper, "type", false);
    bind("#f-scraper-timeout", (s) => s.scraper, "timeout", false);
    bind("#f-scraper-waitFor", (s) => s.scraper, "waitFor", false);
    bind("#f-scraper-blockResources", (s) => s.scraper, "blockResources", true);

    bind("#f-pagination-enabled", (s) => s.pagination, "enabled", true);
    bind("#f-pagination-nextSelector", (s) => s.pagination, "nextSelector", false);
    bind("#f-pagination-maxPages", (s) => s.pagination, "maxPages", false);
    bind("#f-pagination-maxItems", (s) => s.pagination, "maxItems", false);
    bind("#f-pagination-maxDurationMs", (s) => s.pagination, "maxDurationMs", false);
    bind("#f-pagination-delayMs", (s) => s.pagination, "delayMs", false);
    bind("#f-pagination-failOnPageError", (s) => s.pagination, "failOnPageError", true);

    bind("#f-cache-enabled", (s) => s.cache, "enabled", true);
    bind("#f-cache-ttl", (s) => s.cache, "ttl", false);
}

function showValidationErrors(box, errors) {
    box.style.display = "block";
    box.innerHTML = errors.map((e) => `<div>${escapeHtml(e)}</div>`).join("");
}
