import { z } from "zod";
import { TRANSFORM_NAMES } from "../../transforms/TransformPipeline.js";

export const fieldConfigSchema = z.object({
    selector: z.string().min(1),
    extract: z.enum(["text", "html", "attribute"]),
    attribute: z.string().optional(),
    transform: z.array(z.enum(TRANSFORM_NAMES)).optional()
}).refine(
    (field) => field.extract !== "attribute" || !!field.attribute,
    {
        message: "attribute is required when extract is 'attribute'",
        path: ["attribute"]
    }
);

export const scraperOptionsSchema = z.object({
    type: z.enum(["static", "browser"]),
    waitFor: z.string().min(1).optional(),
    timeout: z.number().int().positive().optional()
});

export const scraperConfigSchema = z.object({
    id: z.string().min(1),

    website: z.url(),

    scraper: scraperOptionsSchema,

    item: z.object({
        selector: z.string().min(1)
    }),

    fields: z.record(z.string(), fieldConfigSchema)
        .refine(
            (fields) => Object.keys(fields).length > 0,
            { message: "fields must contain at least one field" }
        )
});

export type FieldConfig = z.infer<typeof fieldConfigSchema>;
export type ScraperOptionsConfig = z.infer<typeof scraperOptionsSchema>;
export type ScraperConfig = z.infer<typeof scraperConfigSchema>;
