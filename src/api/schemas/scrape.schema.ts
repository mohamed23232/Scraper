import { z } from "zod";
import { fieldConfigSchema, scraperOptionsSchema, paginationConfigSchema } from "../../core/config/ScraperConfig.js";
import { TRANSFORM_NAMES } from "../../transforms/TransformPipeline.js";

const flatRequestSchema = z.object({
    url: z.url(),

    selector: z.string().min(1),

    extract: z.enum([
        "text",
        "html",
        "attribute"
    ]),

    attribute: z.string().optional(),

    transform: z.array(z.enum(TRANSFORM_NAMES)).optional(),

    scraper: scraperOptionsSchema.optional()
});

const inlineConfigRequestSchema = z.object({
    url: z.url(),

    scraper: scraperOptionsSchema.optional(),

    config: z.object({
        item: z.object({
            selector: z.string().min(1)
        }),

        fields: z.record(z.string(), fieldConfigSchema)
            .refine(
                (fields) => Object.keys(fields).length > 0,
                { message: "fields must contain at least one field" }
            ),

        pagination: paginationConfigSchema.optional()
    })
});

const websiteRequestSchema = z.object({
    url: z.url(),

    website: z.string().min(1)
});

export const scrapeRequestSchema = z.union([
    inlineConfigRequestSchema,
    websiteRequestSchema,
    flatRequestSchema
]);

export type ScrapeRequest = z.infer<typeof scrapeRequestSchema>;
