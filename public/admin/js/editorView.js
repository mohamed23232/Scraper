import { escapeHtml } from "./utils.js";
import {
    createEmptyConfigState, loadConfigIntoState,
    buildInlineScrapeRequest, buildFlatScrapeRequest, buildSavedConfigPayload,
    validateForTest, validateForSave
} from "./state.js";
import { mountFieldsTable } from "./fieldsTable.js";
import { renderTransformPanel, applyTransformEvent } from "./transformEditor.js";
import { renderResults, clearResults } from "./resultsView.js";
import { testScrape, saveWebsite } from "./api.js";
import { icon } from "./icons.js";
import { showToast } from "./toast.js";

const EXTRACT_TYPES = ["text", "html", "attribute"];

function toggle(id, checked, label) {
    return `
        <label class="toggle-field" for="${id}">
            <span class="toggle">
                <input type="checkbox" id="${id}" ${checked ? "checked" : ""}>
                <span class="track"></span>
            </span>
            ${label}
        </label>
    `;
}

export function renderEditorView(container, existingConfig, { onBack, onSaved }) {
    const state = existingConfig ? loadConfigIntoState(existingConfig) : createEmptyConfigState();
    paint(container, state, existingConfig, { onBack, onSaved });
}

function paint(container, state, existingConfig, callbacks) {
    const isNew = !existingConfig;

    container.innerHTML = `
        <div class="editor-header">
            <button type="button" class="btn-ghost" data-action="back">${icon("arrowLeft", 16)} Back</button>
            <h2>${isNew ? "New website config" : "Edit config"}</h2>
            ${!isNew ? `<span class="id-badge">${escapeHtml(state.id)}</span>` : ""}
        </div>

        <div class="mode-toggle">
            <button type="button" class="${state.mode === "structured" ? "active" : ""}" data-action="mode-structured">Item + Fields</button>
            <button type="button" class="${state.mode === "flat" ? "active" : ""}" data-action="mode-flat">Single value (flat)</button>
        </div>
        <p class="section-hint mode-hint">
            ${state.mode === "structured"
                ? "Extracts a repeating list of items, each with one or more named fields. Can be saved as a reusable website config."
                : "Extracts one value (or every match of one selector) with no item/field wrapper &mdash; use this for “just give me the whole page HTML” or any single-value scrape. Test-only: this shape can't be saved as a website config."}
        </p>

        <div class="card form-section">
            <div class="form-row">
                <div class="field"><span>Id</span><input type="text" id="f-id" value="${escapeHtml(state.id)}" placeholder="my-website" ${isNew ? "" : "disabled"}></div>
                <div class="field"><span>Name</span><input type="text" id="f-name" value="${escapeHtml(state.name)}" placeholder="(optional, display name)"></div>
                <div class="field grow"><span>Start URL</span><input type="text" id="f-startUrl" value="${escapeHtml(state.startUrl)}" placeholder="https://example.com"></div>
            </div>
        </div>

        ${state.mode === "structured" ? renderStructuredSections(state) : renderFlatSection(state)}

        <details class="card form-section" open>
            <summary>
                <span class="section-title"><span class="icon">${icon("sliders", 16)}</span> Scraper options</span>
                <span class="chevron">${icon("chevron", 14)}</span>
            </summary>
            <div class="section-body">
                <div class="form-row">
                    <div class="field"><span>Type</span>
                        <select id="f-scraper-type">
                            <option value="static" ${state.scraper.type === "static" ? "selected" : ""}>static</option>
                            <option value="browser" ${state.scraper.type === "browser" ? "selected" : ""}>browser</option>
                        </select>
                    </div>
                    <div class="field"><span>Timeout (ms)</span><input type="number" id="f-scraper-timeout" value="${escapeHtml(state.scraper.timeout)}" placeholder="15000"></div>
                    <div class="field grow"><span>Wait for selector (browser only)</span><input type="text" id="f-scraper-waitFor" value="${escapeHtml(state.scraper.waitFor)}" placeholder=".loaded"></div>
                    ${toggle("f-scraper-blockResources", state.scraper.blockResources, "Block images/fonts (browser only)")}
                </div>
            </div>
        </details>

        ${state.mode === "structured" ? `
        <details class="card form-section" ${state.pagination.enabled ? "open" : ""}>
            <summary>
                <span class="section-title"><span class="icon">${icon("sliders", 16)}</span> Pagination</span>
                <span class="badge badge-toggle-state ${state.pagination.enabled ? "badge-ok" : ""}">${state.pagination.enabled ? "On" : "Off"}</span>
                <span class="chevron">${icon("chevron", 14)}</span>
            </summary>
            <div class="section-body">
                <div class="form-row">
                    ${toggle("f-pagination-enabled", state.pagination.enabled, "Enabled")}
                    <div class="field grow"><span>Next-page selector</span><input type="text" id="f-pagination-nextSelector" value="${escapeHtml(state.pagination.nextSelector)}" placeholder="a.next"></div>
                </div>
                <div class="form-row">
                    <div class="field"><span>Max pages</span><input type="number" id="f-pagination-maxPages" value="${escapeHtml(state.pagination.maxPages)}" placeholder="10"></div>
                    <div class="field"><span>Max items</span><input type="number" id="f-pagination-maxItems" value="${escapeHtml(state.pagination.maxItems)}"></div>
                    <div class="field"><span>Max duration (ms)</span><input type="number" id="f-pagination-maxDurationMs" value="${escapeHtml(state.pagination.maxDurationMs)}" placeholder="60000"></div>
                    <div class="field"><span>Delay between pages (ms)</span><input type="number" id="f-pagination-delayMs" value="${escapeHtml(state.pagination.delayMs)}"></div>
                    ${toggle("f-pagination-failOnPageError", state.pagination.failOnPageError, "Fail whole request on a page error")}
                </div>
            </div>
        </details>` : ""}

        <details class="card form-section" ${state.cache.enabled ? "open" : ""}>
            <summary>
                <span class="section-title"><span class="icon">${icon("sliders", 16)}</span> Cache</span>
                <span class="badge badge-toggle-state ${state.cache.enabled ? "badge-ok" : ""}">${state.cache.enabled ? "On" : "Off"}</span>
                <span class="chevron">${icon("chevron", 14)}</span>
            </summary>
            <div class="section-body">
                <div class="form-row">
                    ${toggle("f-cache-enabled", state.cache.enabled, "Enabled")}
                    <div class="field"><span>TTL (seconds)</span><input type="number" id="f-cache-ttl" value="${escapeHtml(state.cache.ttl)}" placeholder="300"></div>
                </div>
            </div>
        </details>

        <div class="test-bar">
            <div class="field grow"><span>Test URL</span><input type="text" id="f-test-url" placeholder="(defaults to Start URL above)"></div>
            <div class="spacer"></div>
            <button type="button" data-action="test-scrape">${icon("play", 15)} Test Scrape</button>
            <button type="button" class="btn-primary" data-action="save" ${state.mode === "flat" ? "disabled title=\"Switch to Item + Fields to save\"" : ""}>${icon("save", 15)} Save</button>
        </div>
        <div id="validation-errors" class="validation-errors" style="display:none"></div>
        <div id="results-container"></div>
    `;

    const repaint = () => paint(container, state, existingConfig, callbacks);

    container.querySelector("[data-action='mode-structured']").addEventListener("click", () => {
        if (state.mode !== "structured") { state.mode = "structured"; repaint(); }
    });
    container.querySelector("[data-action='mode-flat']").addEventListener("click", () => {
        if (state.mode !== "flat") { state.mode = "flat"; repaint(); }
    });

    if (state.mode === "structured") {
        syncSectionBadge(container, "#f-pagination-enabled");
        mountFieldsTable(container.querySelector("#fields-table-container"), state.fields);
    } else {
        mountFlatEditor(container, state, repaint);
    }
    syncSectionBadge(container, "#f-cache-enabled");

    clearResults(container.querySelector("#results-container"));
    bindSimpleFields(container, state);

    container.querySelector("[data-action='back']").addEventListener("click", () => callbacks.onBack());

    const testBtn = container.querySelector("[data-action='test-scrape']");
    const saveBtn = container.querySelector("[data-action='save']");

    testBtn.addEventListener("click", async () => {
        const errors = validateForTest(state);
        const errorBox = container.querySelector("#validation-errors");

        if (errors.length > 0) {
            showValidationErrors(errorBox, errors);
            return;
        }
        errorBox.style.display = "none";

        const testUrl = container.querySelector("#f-test-url").value;
        const body = state.mode === "flat"
            ? buildFlatScrapeRequest(state, testUrl)
            : buildInlineScrapeRequest(state, testUrl);

        setLoading(testBtn, true);
        const response = await testScrape(body);
        setLoading(testBtn, false);

        renderResults(container.querySelector("#results-container"), response);
    });

    saveBtn.addEventListener("click", async () => {
        const errors = validateForSave(state);
        const errorBox = container.querySelector("#validation-errors");

        if (errors.length > 0) {
            showValidationErrors(errorBox, errors);
            return;
        }
        errorBox.style.display = "none";

        const payload = buildSavedConfigPayload(state);

        setLoading(saveBtn, true);
        const response = await saveWebsite(payload.id, payload);
        setLoading(saveBtn, false);

        if (!response.success) {
            showValidationErrors(errorBox, [`${response.error?.code ?? "ERROR"}: ${response.error?.message ?? "Save failed."}`]);
            return;
        }

        showToast(`Saved '${payload.id}'.`, "success");
        callbacks.onSaved();
    });
}

function renderStructuredSections(state) {
    return `
        <details class="card form-section" open>
            <summary>
                <span class="section-title"><span class="icon">${icon("sliders", 16)}</span> Item</span>
                <span class="chevron">${icon("chevron", 14)}</span>
            </summary>
            <div class="section-body">
                <div class="form-row">
                    <div class="field grow"><span>Item selector</span><input type="text" id="f-item-selector" value="${escapeHtml(state.item.selector)}" placeholder=".product-card"></div>
                    ${toggle("f-item-allowEmpty", state.item.allowEmpty, "Allow empty (don't error on 0 matches)")}
                </div>
            </div>
        </details>

        <div class="card form-section">
            <div class="section-title"><span class="icon">${icon("sliders", 16)}</span> Fields</div>
            <p class="section-hint">One row per piece of data to extract from each item.</p>
            <div id="fields-table-container"></div>
        </div>
    `;
}

function renderFlatSection(state) {
    const row = state.flat;
    const attributeField = row.extract === "attribute"
        ? `<div class="field"><span>Attribute</span><input type="text" id="f-flat-attribute" value="${escapeHtml(row.attribute)}" placeholder="e.g. href"></div>`
        : "";

    return `
        <details class="card form-section" open>
            <summary>
                <span class="section-title"><span class="icon">${icon("sliders", 16)}</span> Value</span>
                <span class="chevron">${icon("chevron", 14)}</span>
            </summary>
            <div class="section-body">
                <div class="form-row">
                    <div class="field grow"><span>Selector</span><input type="text" id="f-flat-selector" value="${escapeHtml(row.selector)}" placeholder="html, title, a.link, …"></div>
                    <div class="field"><span>Extract</span>
                        <select id="f-flat-extract">
                            ${EXTRACT_TYPES.map((t) => `<option value="${t}" ${t === row.extract ? "selected" : ""}>${t}</option>`).join("")}
                        </select>
                    </div>
                    ${attributeField}
                </div>
                <p class="section-hint">Matches every element on the page, not just one item &mdash; the result is a list of values. Use <code>html</code> as the selector with extract <code>html</code> to get the whole page's HTML.</p>
                <div id="flat-transform-container"></div>
            </div>
        </details>
    `;
}

function mountFlatEditor(container, state, repaint) {
    const row = state.flat;

    container.querySelector("#f-flat-selector").addEventListener("input", (e) => { row.selector = e.target.value; });

    container.querySelector("#f-flat-extract").addEventListener("change", (e) => {
        row.extract = e.target.value;
        if (row.extract !== "attribute") row.attribute = "";
        repaint();
    });

    const attrInput = container.querySelector("#f-flat-attribute");
    if (attrInput) {
        attrInput.addEventListener("input", (e) => { row.attribute = e.target.value; });
    }

    const transformContainer = container.querySelector("#flat-transform-container");

    function repaintTransforms() {
        transformContainer.innerHTML = renderTransformPanel(row);
    }

    transformContainer.addEventListener("click", (event) => {
        const target = event.target.closest("[data-action]");
        if (!target) return;
        const structural = applyTransformEvent(row, target.dataset.action, target.dataset, target.value);
        if (structural) repaintTransforms();
    });

    function handleTransformValueChange(event) {
        const target = event.target;
        if (target.dataset.action !== "transform-name" && target.dataset.action !== "transform-param") return;
        const structural = applyTransformEvent(row, target.dataset.action, target.dataset, target.value);
        if (structural) repaintTransforms();
    }

    transformContainer.addEventListener("change", handleTransformValueChange);
    transformContainer.addEventListener("input", handleTransformValueChange);

    repaintTransforms();
}

function setLoading(button, isLoading) {
    button.classList.toggle("is-loading", isLoading);
    button.disabled = isLoading;
}

function syncSectionBadge(container, inputSelector) {
    const input = container.querySelector(inputSelector);
    const badge = input?.closest("details")?.querySelector(".badge-toggle-state");
    if (!input || !badge) return;
    input.addEventListener("change", () => {
        badge.textContent = input.checked ? "On" : "Off";
        badge.classList.toggle("badge-ok", input.checked);
    });
}

function bindSimpleFields(container, state) {
    const bind = (id, getTarget, key, isCheckbox) => {
        const el = container.querySelector(id);
        if (!el) return;
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
    box.style.display = "flex";
    box.innerHTML = `
        <span class="icon">${icon("alertTriangle")}</span>
        <ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>
    `;
    box.scrollIntoView({ behavior: "smooth", block: "center" });
}
