import type { ExtractedItem } from "../extractors/ExtractionEngine.js";
import { TransformPipeline, type TransformSpec } from "./TransformPipeline.js";
import { ScraperError } from "../core/errors/ScraperError.js";
import type { FieldOutputType } from "../core/config/ScraperConfig.js";

function matchesType(value: unknown, type: FieldOutputType): boolean {

    switch (type) {

        case "string":
            return typeof value === "string";

        case "number":
            return typeof value === "number" && !Number.isNaN(value);

        case "boolean":
            return typeof value === "boolean";

        case "url":
            if (typeof value !== "string") {
                return false;
            }
            try {
                new URL(value);
                return true;
            } catch {
                return false;
            }
    }
}

export function applyFieldTransforms(
    items: ExtractedItem[],
    fields: Record<string, {
        transform?: readonly TransformSpec[] | undefined;
        type?: FieldOutputType | undefined;
    }>,
    baseUrl: string
): Record<string, unknown>[] {

    return items.map((item, itemIndex) => {

        const transformed: Record<string, unknown> = { ...item };

        for (const [fieldName, fieldConfig] of Object.entries(fields)) {

            const rawValue = item[fieldName];

            let value: unknown = rawValue;

            if (fieldConfig.transform && fieldConfig.transform.length > 0 && rawValue !== null && rawValue !== undefined) {

                try {
                    value = TransformPipeline.runOnExtracted(rawValue, fieldConfig.transform, { baseUrl });
                } catch (error) {
                    throw new ScraperError(
                        "TRANSFORMATION_ERROR",
                        `Transform failed for field '${fieldName}' in item #${itemIndex}: ${(error as Error).message}`
                    );
                }
            }

            if (fieldConfig.type && value !== null && value !== undefined) {

                const valuesToCheck = Array.isArray(value) ? value : [value];

                for (const entry of valuesToCheck) {
                    if (!matchesType(entry, fieldConfig.type)) {
                        throw new ScraperError(
                            "TRANSFORMATION_ERROR",
                            `Field '${fieldName}' in item #${itemIndex} does not match declared type '${fieldConfig.type}': ${JSON.stringify(entry)}`
                        );
                    }
                }
            }

            transformed[fieldName] = value;
        }

        return transformed;
    });
}
