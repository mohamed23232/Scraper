import { z } from "zod";

export const scrapeRequestSchema = z.object({
    url: z.url(),

    selector: z.string().min(1),

    extract: z.enum([
        "text",
        "html",
        "attribute"
    ]),

    attribute: z.string().optional()
});

export type ScrapeRequest = z.infer<typeof scrapeRequestSchema>;