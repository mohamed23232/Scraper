import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

import { TextExtractor } from "./TextExtractor.js";
import { AttributeExtractor } from "./AttributeExtractor.js";
import { HtmlExtractor } from "./HtmlExtractor.js";
import { ScraperError } from "../core/errors/ScraperError.js";

export type ExtractionType = "text" | "html" | "attribute";

export interface ExtractionOptions {
    selector: string;
    extract: ExtractionType;
    attribute?: string | undefined;
}

export interface FieldExtractionOptions {
    selector: string;
    extract: ExtractionType;
    attribute?: string | undefined;
    multiple?: boolean | undefined;
    required?: boolean | undefined;
    default?: unknown;
}

export type ItemFields = Record<string, FieldExtractionOptions>;

export type ExtractedItem = Record<string, unknown>;

export interface ExtractItemsOptions {
    allowEmpty?: boolean | undefined;
}

export class ExtractionEngine {

    extract(
        $: CheerioAPI,
        options: ExtractionOptions
    ): string[] {

        const elements = $(options.selector);

        if (elements.length === 0) {
            throw new ScraperError("SELECTOR_NOT_FOUND", `Selector not found: ${options.selector}`);
        }

        const values: string[] = [];

        elements.each((_, element) => {
            values.push(
                this.extractValue($(element), options.extract, options.attribute)
            );
        });

        return values;
    }

    extractItems(
        $: CheerioAPI,
        itemSelector: string,
        fields: ItemFields,
        options?: ExtractItemsOptions
    ): ExtractedItem[] {

        const items = $(itemSelector);

        if (items.length === 0) {
            if (options?.allowEmpty) {
                return [];
            }
            throw new ScraperError("SELECTOR_NOT_FOUND", `Selector not found: ${itemSelector}`);
        }

        const results: ExtractedItem[] = [];

        items.each((index, itemElement) => {

            const itemScope = $(itemElement);
            const item: ExtractedItem = {};

            for (const [fieldName, fieldOptions] of Object.entries(fields)) {
                item[fieldName] = this.extractField($, itemScope, fieldName, index, fieldOptions);
            }

            results.push(item);
        });

        return results;
    }

    private extractField(
        $: CheerioAPI,
        scope: Cheerio<AnyNode>,
        fieldName: string,
        itemIndex: number,
        options: FieldExtractionOptions
    ): unknown {

        const matches = scope.find(options.selector);
        const required = options.required ?? true;
        const multiple = options.multiple ?? false;

        if (matches.length === 0) {

            if (!required) {
                return options.default ?? null;
            }

            throw new ScraperError(
                "SELECTOR_NOT_FOUND",
                `Field selector not found: '${fieldName}' (${options.selector}) in item #${itemIndex}`
            );
        }

        if (multiple) {

            const values: string[] = [];

            matches.each((_, match) => {
                values.push(
                    this.extractValue($(match), options.extract, options.attribute)
                );
            });

            return values;
        }

        return this.extractValue(matches.first(), options.extract, options.attribute);
    }

    private extractValue(
        element: Cheerio<AnyNode>,
        extract: ExtractionType,
        attribute?: string
    ): string {

        switch (extract) {

            case "text":
                return new TextExtractor().extract(element);

            case "html":
                return new HtmlExtractor().extract(element);

            case "attribute":

                if (!attribute) {
                    throw new ScraperError(
                        "INVALID_CONFIGURATION",
                        "Attribute name is required for attribute extraction"
                    );
                }

                return new AttributeExtractor(attribute).extract(element);

            default:
                throw new ScraperError(
                    "INVALID_CONFIGURATION",
                    `Unsupported extraction type: ${extract as string}`
                );
        }
    }
}
