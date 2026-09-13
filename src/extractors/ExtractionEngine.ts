import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

import { TextExtractor } from "./TextExtractor.js";
import { AttributeExtractor } from "./AttributeExtractor.js";
import { HtmlExtractor } from "./HtmlExtractor.js";

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
}

export type ItemFields = Record<string, FieldExtractionOptions>;

export type ExtractedItem = Record<string, string | string[]>;

export class ExtractionEngine {

    extract(
        $: CheerioAPI,
        options: ExtractionOptions
    ): string[] {

        const elements = $(options.selector);

        if (elements.length === 0) {
            throw new Error(
                `Selector not found: ${options.selector}`
            );
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
        fields: ItemFields
    ): ExtractedItem[] {

        const items = $(itemSelector);

        if (items.length === 0) {
            throw new Error(
                `Selector not found: ${itemSelector}`
            );
        }

        const results: ExtractedItem[] = [];

        items.each((_, itemElement) => {

            const itemScope = $(itemElement);
            const item: ExtractedItem = {};

            for (const [fieldName, fieldOptions] of Object.entries(fields)) {
                item[fieldName] = this.extractField($, itemScope, fieldName, fieldOptions);
            }

            results.push(item);
        });

        return results;
    }

    private extractField(
        $: CheerioAPI,
        scope: Cheerio<AnyNode>,
        fieldName: string,
        options: FieldExtractionOptions
    ): string | string[] {

        const matches = scope.find(options.selector);

        if (matches.length === 0) {
            throw new Error(
                `Field selector not found: '${fieldName}' (${options.selector})`
            );
        }

        if (matches.length === 1) {
            return this.extractValue(matches, options.extract, options.attribute);
        }

        const values: string[] = [];

        matches.each((_, match) => {
            values.push(
                this.extractValue($(match), options.extract, options.attribute)
            );
        });

        return values;
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
                    throw new Error(
                        "Attribute name is required for attribute extraction"
                    );
                }

                return new AttributeExtractor(attribute).extract(element);

            default:
                throw new Error(
                    `Unsupported extraction type: ${extract as string}`
                );
        }
    }
}
