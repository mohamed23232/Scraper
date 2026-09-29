import { z } from "zod";
import {
    fieldConfigSchema,
    scraperOptionsSchema,
    paginationConfigSchema,
    transformSpecSchema
} from "../../core/config/ScraperConfig.js";

const flatRequestSchema = z.object({
    url: z.url(),

    selector: z.string().min(1),

    extract: z.enum([
        "text",
        "html",
        "attribute"
    ]),

    attribute: z.string().optional(),

    transform: z.array(transformSpecSchema).optional(),

    scraper: scraperOptionsSchema.optional()
}).strict();

const inlineConfigRequestSchema = z.object({
    url: z.url(),

    scraper: scraperOptionsSchema.optional(),

    config: z.object({
        item: z.object({
            selector: z.string().min(1),
            allowEmpty: z.boolean().optional()
        }),

        fields: z.record(z.string(), fieldConfigSchema)
            .refine(
                (fields) => Object.keys(fields).length > 0,
                { message: "fields must contain at least one field" }
            ),

        pagination: paginationConfigSchema.optional()
    }).strict()
}).strict();

const websiteRequestSchema = z.object({
    url: z.url().optional(),

    website: z.string().min(1)
}).strict();

export const scrapeRequestSchema = z.union([
    inlineConfigRequestSchema,
    websiteRequestSchema,
    flatRequestSchema
]);

export type ScrapeRequest = z.infer<typeof scrapeRequestSchema>;
