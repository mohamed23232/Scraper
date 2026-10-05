import { escapeHtml } from "./utils.js";
import { emptyFieldRow } from "./state.js";
import { renderTransformPanel, applyTransformEvent } from "./transformEditor.js";
import { icon } from "./icons.js";

const EXTRACT_TYPES = ["text", "html", "attribute"];
const OUTPUT_TYPES = ["", "string", "number", "boolean", "url"];

/**
 * Mounts the dynamic fields table into `container` for the given field rows array
 * (a live reference — mutated in place). Delegated listeners are attached once to
 * `container`, which is never replaced itself, only its inner HTML — so repaint()
 * can be called as often as needed without ever re-attaching listeners.
 */
export function mountFieldsTable(container, fields) {

    container.innerHTML = `
        <div class="fields-table-wrap scroll-x">
            <table class="fields-table">
                <thead>
                    <tr>
                        <th>Name</th><th>Selector</th><th>Extract</th><th>Attribute</th>
                        <th title="Return every match as an array">Multi</th>
                        <th title="Fail if not found (off = use Default instead)">Req</th>
                        <th>Default</th><th>Type</th><th>Transforms</th><th></th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
        <button type="button" class="btn-small add-row-btn" data-action="add-field">${icon("plus", 14)} Add Field</button>
    `;

    const tbody = container.querySelector("tbody");

    function repaint() {
        tbody.innerHTML = fields.map(rowHtml).join("");
    }

    function findRow(rowId) {
        return fields.find((f) => f.rowId === rowId);
    }

    // Click: only button-triggered actions (adding/removing rows or transform steps, reordering, expanding).
    container.addEventListener("click", (event) => {
        const target = event.target.closest("[data-action]");
        if (!target) return;

        const action = target.dataset.action;

        if (action === "add-field") {
            fields.push(emptyFieldRow());
            repaint();
            return;
        }

        const rowId = Number(target.dataset.rowId);
        const row = findRow(rowId);
        if (!row) return;

        if (action === "remove-field") {
            const index = fields.findIndex((f) => f.rowId === rowId);
            fields.splice(index, 1);
            repaint();
            return;
        }

        if (action === "toggle-transforms") {
            row.expanded = !row.expanded;
            repaint();
            return;
        }

        if (action === "add-transform" || action === "remove-transform" || action === "move-transform-up" || action === "move-transform-down") {
            const structural = applyTransformEvent(row, action, target.dataset, target.value);
            if (structural) repaint();
        }
    });

    // Change/input: value edits from text inputs, checkboxes, and <select>s (both plain field cells and transform-step params/name).
    function handleValueChange(event) {
        const target = event.target;

        if (target.dataset.action === "transform-name" || target.dataset.action === "transform-param") {
            const row = findRow(Number(target.dataset.rowId));
            if (!row) return;
            const structural = applyTransformEvent(row, target.dataset.action, target.dataset, target.value);
            if (structural) repaint();
            return;
        }

        const field = target.dataset.field;
        if (!field) return;

        const row = findRow(Number(target.dataset.rowId));
        if (!row) return;

        row[field] = target.type === "checkbox" ? target.checked : target.value;

        if (field === "extract") {
            if (target.value !== "attribute") row.attribute = "";
            repaint();
        }
    }

    container.addEventListener("change", handleValueChange);
    container.addEventListener("input", handleValueChange);

    repaint();
}

function miniToggle(field, rowId, checked) {
    return `
        <label class="toggle">
            <input type="checkbox" data-field="${field}" data-row-id="${rowId}" ${checked ? "checked" : ""}>
            <span class="track"></span>
        </label>
    `;
}

function rowHtml(row) {
    const attributeCell = row.extract === "attribute"
        ? `<input type="text" data-field="attribute" data-row-id="${row.rowId}" value="${escapeHtml(row.attribute)}" placeholder="e.g. href">`
        : `<span class="faint">&mdash;</span>`;

    const transformRow = row.expanded
        ? `<tr class="transform-row"><td></td><td colspan="9">${renderTransformPanel(row)}</td></tr>`
        : "";

    return `
        <tr>
            <td><input type="text" data-field="name" data-row-id="${row.rowId}" value="${escapeHtml(row.name)}" placeholder="fieldName"></td>
            <td><input type="text" data-field="selector" data-row-id="${row.rowId}" value="${escapeHtml(row.selector)}" placeholder=".css-selector"></td>
            <td>
                <select data-field="extract" data-row-id="${row.rowId}">
                    ${EXTRACT_TYPES.map((t) => `<option value="${t}" ${t === row.extract ? "selected" : ""}>${t}</option>`).join("")}
                </select>
            </td>
            <td>${attributeCell}</td>
            <td class="center">${miniToggle("multiple", row.rowId, row.multiple)}</td>
            <td class="center">${miniToggle("required", row.rowId, row.required)}</td>
            <td><input type="text" data-field="default" data-row-id="${row.rowId}" value="${escapeHtml(row.default)}" placeholder="e.g. false"></td>
            <td>
                <select data-field="type" data-row-id="${row.rowId}">
                    ${OUTPUT_TYPES.map((t) => `<option value="${t}" ${t === row.type ? "selected" : ""}>${t || "(none)"}</option>`).join("")}
                </select>
            </td>
            <td><button type="button" class="btn-small" data-action="toggle-transforms" data-row-id="${row.rowId}">${icon("sliders", 13)} ${row.transform.length}</button></td>
            <td><button type="button" class="btn-ghost btn-icon" data-action="remove-field" data-row-id="${row.rowId}" title="Remove field">${icon("trash", 15)}</button></td>
        </tr>
        ${transformRow}
    `;
}
