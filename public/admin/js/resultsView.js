import { escapeHtml } from "./utils.js";
import { renderResultsTable } from "./resultsTable.js";
import { icon } from "./icons.js";

let lastResponse = null;
let rawVisible = false;

export function renderResults(container, response) {
    lastResponse = response;
    rawVisible = false;
    paint(container);
}

function paint(container) {
    if (!lastResponse) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = lastResponse.success
        ? renderSuccess(lastResponse)
        : renderFailure(lastResponse);

    const toggleBtn = container.querySelector("[data-action='toggle-raw']");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            rawVisible = !rawVisible;
            paint(container);
        });
    }
}

function renderSuccess(response) {
    const meta = response.metadata || {};
    const items = Array.isArray(response.data) ? response.data : [];

    const paginationBadges = meta.pages !== undefined
        ? `
            <span class="badge">Pages: ${meta.pages}</span>
            <span class="badge">Stop reason: ${escapeHtml(meta.stopReason ?? "?")}</span>
            ${meta.truncated ? `<span class="badge badge-warn">Truncated</span>` : ""}
            ${Array.isArray(meta.warnings) && meta.warnings.length > 0
                ? `<span class="badge badge-warn">${meta.warnings.length} warning(s)</span>`
                : ""}
        `
        : "";

    return `
        <div class="results-meta">
            <span class="badge">Duration: ${meta.durationMs ?? "?"} ms</span>
            <span class="badge">Items: ${items.length}</span>
            <span class="badge ${meta.cached ? "badge-ok" : ""}">Cached: ${meta.cached ? "yes" : "no"}</span>
            ${paginationBadges}
        </div>
        ${Array.isArray(meta.warnings) && meta.warnings.length > 0 ? renderWarnings(meta.warnings) : ""}
        <div class="card scroll-x results-table-wrap">${renderResultsTable(items)}</div>
        ${renderRawToggle()}
    `;
}

function renderWarnings(warnings) {
    return `
        <details class="warnings">
            <summary>${warnings.length} warning(s)</summary>
            <ul>${warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>
        </details>
    `;
}

function renderFailure(response) {
    const error = response.error || { code: "UNKNOWN", message: "The server returned no error details." };

    return `
        <div class="error-banner">
            <span class="icon">${icon("alertTriangle")}</span>
            <div class="content">
                <div class="msg-row">
                    <span class="badge badge-error">${escapeHtml(error.code)}</span>
                    <span>${escapeHtml(error.message)}</span>
                </div>
                ${error.details !== undefined
                    ? `<details><summary>Details</summary><pre class="raw-json">${escapeHtml(JSON.stringify(error.details, null, 2))}</pre></details>`
                    : ""}
            </div>
        </div>
        ${renderRawToggle()}
    `;
}

function renderRawToggle() {
    return `
        <button type="button" class="btn-small" data-action="toggle-raw">${rawVisible ? "Hide" : "View"} raw JSON</button>
        ${rawVisible ? `<pre class="raw-json">${escapeHtml(JSON.stringify(lastResponse, null, 2))}</pre>` : ""}
    `;
}

export function clearResults(container) {
    lastResponse = null;
    container.innerHTML = "";
}
