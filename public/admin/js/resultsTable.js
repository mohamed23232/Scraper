import { escapeHtml } from "./utils.js";

export function buildColumnUnion(items) {
    const seen = new Set();
    const columns = [];

    for (const item of items) {
        if (item && typeof item === "object") {
            for (const key of Object.keys(item)) {
                if (!seen.has(key)) {
                    seen.add(key);
                    columns.push(key);
                }
            }
        }
    }

    return columns;
}

function formatCellValue(value) {
    if (value === undefined) {
        return { display: "&mdash;", title: "", className: "muted" };
    }
    if (value === null) {
        return { display: "<em>null</em>", title: "", className: "muted" };
    }
    if (Array.isArray(value)) {
        const joined = value.map((v) => String(v)).join(", ");
        return { display: escapeHtml(joined), title: joined, className: "" };
    }
    if (typeof value === "object") {
        const json = JSON.stringify(value);
        return { display: escapeHtml(json), title: json, className: "" };
    }

    const text = String(value);
    return { display: escapeHtml(text), title: text, className: "" };
}

export function renderResultsTable(items) {
    if (items.length === 0) {
        return `<p class="muted">No items returned.</p>`;
    }

    const columns = buildColumnUnion(items);

    const head = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");

    const rows = items.map((item) => {
        const cells = columns.map((col) => {
            const { display, title, className } = formatCellValue(item[col]);
            return `<td class="${className}" title="${escapeHtml(title)}">${display}</td>`;
        }).join("");
        return `<tr>${cells}</tr>`;
    }).join("");

    return `
        <table class="results-table">
            <thead><tr>${head}</tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}
