import { toNumberOrUndefined, parseLooseJSON } from "./utils.js";

let nextRowId = 1;

export function emptyFieldRow() {
    return {
        rowId: nextRowId++,
        name: "",
        selector: "",
        extract: "text",
        attribute: "",
        multiple: false,
        required: true,
        default: "",
        type: "",
        transform: [],
        expanded: false
    };
}

export function createEmptyConfigState() {
    return {
        mode: "structured", // "structured" (item + fields, savable) or "flat" (single value, test-only)
        id: "",
        name: "",
        startUrl: "",
        scraper: { type: "static", waitFor: "", timeout: "", blockResources: false },
        item: { selector: "", allowEmpty: false },
        fields: [emptyFieldRow()],
        flat: emptyFieldRow(), // reuses the field-row shape; only selector/extract/attribute/transform are used
        pagination: {
            enabled: false, nextSelector: "", maxPages: "", maxItems: "",
            maxDurationMs: "", delayMs: "", failOnPageError: false
        },
        cache: { enabled: false, ttl: "" }
    };
}

function transformStepToRow(step) {
    return typeof step === "string" ? { name: step } : { ...step };
}

export function rowsFromFieldsRecord(fields) {
    return Object.entries(fields || {}).map(([name, field]) => ({
        rowId: nextRowId++,
        name,
        selector: field.selector ?? "",
        extract: field.extract ?? "text",
        attribute: field.attribute ?? "",
        multiple: !!field.multiple,
        required: field.required !== false,
        default: field.default === undefined ? "" : JSON.stringify(field.default),
        type: field.type ?? "",
        transform: Array.isArray(field.transform) ? field.transform.map(transformStepToRow) : [],
        expanded: false
    }));
}

const PARAMLESS_TRANSFORMS = new Set(["trim", "removeCurrency", "absoluteUrl"]);

function transformRowToStep(row) {
    if (PARAMLESS_TRANSFORMS.has(row.name)) {
        return row.name;
    }

    const step = { name: row.name };

    for (const [key, value] of Object.entries(row)) {
        if (key === "name" || value === undefined || value === "" || value === null) {
            continue;
        }
        if (key === "group") {
            step.group = Number(value);
        } else if (key === "value") {
            step.value = parseLooseJSON(String(value));
        } else {
            step[key] = value;
        }
    }

    return step;
}

function fieldConfigFromRow(row) {
    const field = { selector: row.selector.trim(), extract: row.extract };

    if (row.extract === "attribute" && row.attribute.trim()) {
        field.attribute = row.attribute.trim();
    }
    if (row.multiple) {
        field.multiple = true;
    }
    if (!row.required) {
        field.required = false;
    }
    if (row.default !== "" && row.default !== undefined) {
        field.default = parseLooseJSON(row.default);
    }
    if (row.type) {
        field.type = row.type;
    }
    if (row.transform && row.transform.length > 0) {
        field.transform = row.transform.map(transformRowToStep);
    }

    return field;
}

export function fieldsRecordFromRows(rows) {
    const record = {};

    for (const row of rows) {
        const name = row.name.trim();
        if (!name) {
            continue;
        }
        record[name] = fieldConfigFromRow(row);
    }

    return record;
}

export function buildScraperOptions(scraper) {
    const out = { type: scraper.type };

    if (scraper.waitFor && scraper.waitFor.trim()) {
        out.waitFor = scraper.waitFor.trim();
    }
    const timeout = toNumberOrUndefined(scraper.timeout);
    if (timeout !== undefined) {
        out.timeout = timeout;
    }
    if (scraper.blockResources) {
        out.blockResources = true;
    }

    return out;
}

export function buildPaginationPayload(pagination) {
    const out = { enabled: true, nextSelector: pagination.nextSelector.trim() };

    const maxPages = toNumberOrUndefined(pagination.maxPages);
    if (maxPages !== undefined) out.maxPages = maxPages;

    const maxItems = toNumberOrUndefined(pagination.maxItems);
    if (maxItems !== undefined) out.maxItems = maxItems;

    const maxDurationMs = toNumberOrUndefined(pagination.maxDurationMs);
    if (maxDurationMs !== undefined) out.maxDurationMs = maxDurationMs;

    const delayMs = toNumberOrUndefined(pagination.delayMs);
    if (delayMs !== undefined) out.delayMs = delayMs;

    if (pagination.failOnPageError) out.failOnPageError = true;

    return out;
}

export function buildCachePayload(cache) {
    const ttl = toNumberOrUndefined(cache.ttl);
    return { enabled: true, ttl: ttl ?? 60 };
}

export function buildInlineScrapeRequest(state, testUrl) {
    const url = (testUrl && testUrl.trim()) || state.startUrl.trim();

    const config = {
        item: { selector: state.item.selector.trim() },
        fields: fieldsRecordFromRows(state.fields)
    };
    if (state.item.allowEmpty) config.item.allowEmpty = true;
    if (state.pagination.enabled) config.pagination = buildPaginationPayload(state.pagination);
    if (state.cache.enabled) config.cache = buildCachePayload(state.cache);

    return { url, scraper: buildScraperOptions(state.scraper), config };
}

/** The "flat" shape: {url, selector, extract, attribute?, transform?} — no item/fields wrapper, no pagination. Test-only; the backend has no way to save this as a reusable website config. */
export function buildFlatScrapeRequest(state, testUrl) {
    const url = (testUrl && testUrl.trim()) || state.startUrl.trim();
    const field = fieldConfigFromRow(state.flat);

    const body = {
        url,
        selector: field.selector,
        extract: field.extract,
        scraper: buildScraperOptions(state.scraper)
    };
    if (field.attribute) body.attribute = field.attribute;
    if (field.transform) body.transform = field.transform;
    if (state.cache.enabled) body.cache = buildCachePayload(state.cache);

    return body;
}

export function buildSavedConfigPayload(state) {
    const payload = {
        id: state.id.trim(),
        startUrl: state.startUrl.trim(),
        scraper: buildScraperOptions(state.scraper),
        item: { selector: state.item.selector.trim() },
        fields: fieldsRecordFromRows(state.fields)
    };

    if (state.name && state.name.trim()) payload.name = state.name.trim();
    if (state.item.allowEmpty) payload.item.allowEmpty = true;
    if (state.pagination.enabled) payload.pagination = buildPaginationPayload(state.pagination);
    if (state.cache.enabled) payload.cache = buildCachePayload(state.cache);

    return payload;
}

export function loadConfigIntoState(config) {
    return {
        mode: "structured", // saved website configs are always item+fields — flat requests can't be saved
        flat: emptyFieldRow(),
        id: config.id ?? "",
        name: config.name ?? "",
        startUrl: config.startUrl ?? "",
        scraper: {
            type: config.scraper?.type ?? "static",
            waitFor: config.scraper?.waitFor ?? "",
            timeout: config.scraper?.timeout ?? "",
            blockResources: !!config.scraper?.blockResources
        },
        item: {
            selector: config.item?.selector ?? "",
            allowEmpty: !!config.item?.allowEmpty
        },
        fields: (() => {
            const rows = rowsFromFieldsRecord(config.fields);
            return rows.length > 0 ? rows : [emptyFieldRow()];
        })(),
        pagination: {
            enabled: !!config.pagination?.enabled,
            nextSelector: config.pagination?.nextSelector ?? "",
            maxPages: config.pagination?.maxPages ?? "",
            maxItems: config.pagination?.maxItems ?? "",
            maxDurationMs: config.pagination?.maxDurationMs ?? "",
            delayMs: config.pagination?.delayMs ?? "",
            failOnPageError: !!config.pagination?.failOnPageError
        },
        cache: {
            enabled: !!config.cache?.enabled,
            ttl: config.cache?.ttl ?? ""
        }
    };
}

export function validateForTest(state) {
    const errors = [];

    if (!state.startUrl.trim()) errors.push("Start URL is required (used when no Test URL is given).");

    if (state.mode === "flat") {
        if (!state.flat.selector.trim()) errors.push("Selector is required.");
    } else {
        if (!state.item.selector.trim()) errors.push("Item selector is required.");
        if (state.fields.every((f) => !f.name.trim())) errors.push("At least one field with a name is required.");
    }

    return errors;
}

export function validateForSave(state) {
    if (state.mode === "flat") {
        return ["Flat requests can't be saved as a reusable website config — switch to \"Item + Fields\" mode to save."];
    }

    const errors = validateForTest(state);
    if (!/^[a-zA-Z0-9_-]+$/.test(state.id.trim())) {
        errors.push("Id must contain only letters, digits, '-' and '_'.");
    }
    return errors;
}
