import { z } from "zod";
import { configIdSchema } from "../../core/config/ScraperConfig.js";

export const websiteIdParamSchema = z.object({
    id: configIdSchema
});

export { scraperConfigSchema as websiteConfigBodySchema } from "../../core/config/ScraperConfig.js";
