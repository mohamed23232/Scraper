import { z } from "zod";

export const websiteIdParamSchema = z.object({
    id: z.string().regex(/^[a-zA-Z0-9_-]+$/, "id must contain only letters, digits, '-' and '_'")
});

export { scraperConfigSchema as websiteConfigBodySchema } from "../../core/config/ScraperConfig.js";
