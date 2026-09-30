import { z } from "zod";
import { TRANSFORM_NAMES } from "../../transforms/TransformPipeline.js";

const transformObjectSchema = z.discriminatedUnion("name", [
    z.object({ name: z.literal("parseNumber"), decimal: z.enum([".", ","]).optional() }),
    z.object({
        name: z.literal("regex"),
        pattern: z.string().min(1),
        group: z.number().int().nonnegative().optional(),
        flags: z.string().optional()
    }),
    z.object({
        name: z.literal("replace"),
        pattern: z.string().min(1),
        replacement: z.string(),
        flags: z.string().optional()
    }),
    z.object({ name: z.literal("default"), value: z.unknown().optional() })
]);

export const transformSpecSchema = z.union([z.enum(TRANSFORM_NAMES), transformObjectSchema]);

export const fieldOutputTypeSchema = z.enum(["string", "number", "boolean", "url"]);

export const fieldConfigSchema = z.object({
    selector: z.string().min(1),
    extract: z.enum(["text", "html", "attribute"]),
    attribute: z.string().optional(),
    transform: z.array(transformSpecSchema).optional(),
    multiple: z.boolean().optional(),
    required: z.boolean().optional(),
    default: z.unknown().optional(),
    type: fieldOutputTypeSchema.optional()
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
    timeout: z.number().int().positive().optional(),
    blockResources: z.boolean().optional()
});

export const cacheConfigSchema = z.object({
    enabled: z.boolean(),
    ttl: z.number().int().positive()
});

export const paginationConfigSchema = z.object({
    enabled: z.boolean(),
    nextSelector: z.string().min(1),
    maxPages: z.number().int().positive().optional(),
    maxItems: z.number().int().positive().optional(),
    maxDurationMs: z.number().int().positive().optional(),
    delayMs: z.number().int().nonnegative().optional(),
    failOnPageError: z.boolean().optional()
});

export const configIdSchema = z.string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, "id must contain only letters, digits, '-' and '_'");

const rawScraperConfigSchema = z.object({
    id: configIdSchema,

    name: z.string().min(1).optional(),

    schemaVersion: z.literal(1).optional(),

    startUrl: z.url().optional(),

    /** @deprecated renamed to `startUrl` — still accepted for backward compatibility */
    website: z.url().optional(),

    scraper: scraperOptionsSchema,

    item: z.object({
        selector: z.string().min(1),
        allowEmpty: z.boolean().optional()
    }),

    fields: z.record(z.string(), fieldConfigSchema)
        .refine(
            (fields) => Object.keys(fields).length > 0,
            { message: "fields must contain at least one field" }
        ),

    pagination: paginationConfigSchema.optional(),

    cache: cacheConfigSchema.optional()
}).refine(
    (config) => !!(config.startUrl ?? config.website),
    { message: "startUrl is required (the 'website' field name is deprecated but still accepted)", path: ["startUrl"] }
);

export const scraperConfigSchema = rawScraperConfigSchema.transform((config) => {

    const { website, startUrl, ...rest } = config;
    const resolvedStartUrl = startUrl ?? website!;

    if (!startUrl && website) {
        // eslint-disable-next-line no-console
        console.warn(
            `[deprecation] configuration '${config.id}' uses the 'website' field — rename it to 'startUrl'.`
        );
    }

    return { ...rest, startUrl: resolvedStartUrl };
});

export type FieldOutputType = z.infer<typeof fieldOutputTypeSchema>;
export type FieldConfig = z.infer<typeof fieldConfigSchema>;
export type ScraperOptionsConfig = z.infer<typeof scraperOptionsSchema>;
export type PaginationConfig = z.infer<typeof paginationConfigSchema>;
export type CacheConfig = z.infer<typeof cacheConfigSchema>;
export type ScraperConfig = z.infer<typeof scraperConfigSchema>;
