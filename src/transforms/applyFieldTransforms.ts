import type { ExtractedItem } from "../extractors/ExtractionEngine.js";
import { TransformPipeline, type TransformName } from "./TransformPipeline.js";

export function applyFieldTransforms(
    items: ExtractedItem[],
    fields: Record<string, { transform?: readonly TransformName[] | undefined }>,
    baseUrl: string
): Record<string, unknown>[] {

    return items.map((item) => {

        const transformed: Record<string, unknown> = { ...item };

        for (const [fieldName, fieldConfig] of Object.entries(fields)) {

            if (!fieldConfig.transform || fieldConfig.transform.length === 0) {
                continue;
            }

            transformed[fieldName] = TransformPipeline.runOnExtracted(
                item[fieldName]!,
                fieldConfig.transform,
                { baseUrl }
            );
        }

        return transformed;
    });
}
