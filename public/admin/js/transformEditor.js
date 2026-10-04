import { escapeHtml } from "./utils.js";
import { icon } from "./icons.js";

export const TRANSFORM_NAMES = ["trim", "removeCurrency", "parseNumber", "absoluteUrl", "regex", "replace", "default"];

const PARAM_FIELDS = {
    trim: [],
    removeCurrency: [],
    absoluteUrl: [],
    parseNumber: [{ key: "decimal", label: "Decimal separator", type: "select", options: ["", ".", ","] }],
    regex: [
        { key: "pattern", label: "Pattern", type: "text" },
        { key: "group", label: "Group #", type: "number" },
        { key: "flags", label: "Flags", type: "text" }
    ],
    replace: [
        { key: "pattern", label: "Pattern", type: "text" },
        { key: "replacement", label: "Replacement", type: "text" },
        { key: "flags", label: "Flags", type: "text" }
    ],
    default: [{ key: "value", label: "Value (e.g. false, 0, or text)", type: "text" }]
};

/** Renders the expandable transform-step list for one field row. */
export function renderTransformPanel(fieldRow) {
    const steps = fieldRow.transform
        .map((step, index) => renderStep(fieldRow.rowId, step, index, fieldRow.transform.length))
        .join("");

    return `
        <div class="transform-panel">
            <div class="transform-steps">${steps || '<p class="muted">No transforms — value is used as-is.</p>'}</div>
            <button type="button" class="btn-small" data-action="add-transform" data-row-id="${fieldRow.rowId}">${icon("plus", 13)} Add transform step</button>
        </div>
    `;
}

function renderStep(rowId, step, index, total) {
    const params = PARAM_FIELDS[step.name] || [];
    const paramInputs = params.map((p) => renderParamInput(rowId, index, step, p)).join("");

    return `
        <div class="transform-step">
            <select data-action="transform-name" data-row-id="${rowId}" data-step-index="${index}">
                ${TRANSFORM_NAMES.map((n) => `<option value="${n}" ${n === step.name ? "selected" : ""}>${n}</option>`).join("")}
            </select>
            ${paramInputs}
            <span class="step-actions">
                <button type="button" class="btn-ghost btn-icon" style="transform:rotate(-90deg)" title="Move up" data-action="move-transform-up" data-row-id="${rowId}" data-step-index="${index}" ${index === 0 ? "disabled" : ""}>${icon("chevron", 13)}</button>
                <button type="button" class="btn-ghost btn-icon" style="transform:rotate(90deg)" title="Move down" data-action="move-transform-down" data-row-id="${rowId}" data-step-index="${index}" ${index === total - 1 ? "disabled" : ""}>${icon("chevron", 13)}</button>
                <button type="button" class="btn-ghost btn-icon" title="Remove step" data-action="remove-transform" data-row-id="${rowId}" data-step-index="${index}">${icon("x", 13)}</button>
            </span>
        </div>
    `;
}

function renderParamInput(rowId, index, step, param) {
    const value = step[param.key] ?? "";

    if (param.type === "select") {
        const options = param.options
            .map((o) => `<option value="${o}" ${String(o) === String(value) ? "selected" : ""}>${o || "(none)"}</option>`)
            .join("");
        return `<select data-action="transform-param" data-row-id="${rowId}" data-step-index="${index}" data-param="${param.key}">${options}</select>`;
    }

    return `<input type="${param.type}" placeholder="${param.label}" title="${param.label}"
        data-action="transform-param" data-row-id="${rowId}" data-step-index="${index}" data-param="${param.key}"
        value="${escapeHtml(value)}">`;
}

/** Applies a transform-panel event (from the delegated listener in fieldsTable.js) to a field row's transform array. Returns true if the change was structural (needs a re-render). */
export function applyTransformEvent(fieldRow, action, dataset, eventValue) {
    const stepIndex = dataset.stepIndex !== undefined ? Number(dataset.stepIndex) : undefined;

    switch (action) {
        case "add-transform":
            fieldRow.transform.push({ name: "trim" });
            return true;

        case "remove-transform":
            fieldRow.transform.splice(stepIndex, 1);
            return true;

        case "move-transform-up":
            if (stepIndex > 0) {
                const [step] = fieldRow.transform.splice(stepIndex, 1);
                fieldRow.transform.splice(stepIndex - 1, 0, step);
            }
            return true;

        case "move-transform-down":
            if (stepIndex < fieldRow.transform.length - 1) {
                const [step] = fieldRow.transform.splice(stepIndex, 1);
                fieldRow.transform.splice(stepIndex + 1, 0, step);
            }
            return true;

        case "transform-name":
            fieldRow.transform[stepIndex] = { name: eventValue };
            return true;

        case "transform-param":
            fieldRow.transform[stepIndex][dataset.param] = eventValue;
            return false;

        default:
            return false;
    }
}
