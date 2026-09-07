import { z } from "zod";

export const scrapeRequestSchema = z.object({
    url: z.url()
});

export type ScrapeRequest = z.infer<typeof scrapeRequestSchema>;