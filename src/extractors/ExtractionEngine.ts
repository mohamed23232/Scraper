import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

import { TextExtractor } from "./TextExtractor.js";
import { AttributeExtractor } from "./AttributeExtractor.js";
import { HtmlExtractor } from "./HtmlExtractor.js";

export type ExtractionType = "text" | "html" | "attribute";

export interface ExtractionOptions {
    selector: string;
    extract: ExtractionType;
    attribute?: string;
}

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

            const selectedElement = $(element);

            let value: string;

            switch (options.extract) {

                case "text":
                    value = new TextExtractor().extract(selectedElement);
                    break;

                case "html":
                    value = new HtmlExtractor().extract(selectedElement);
                    break;

                case "attribute":

                    if (!options.attribute) {
                        throw new Error(
                            "Attribute name is required for attribute extraction"
                        );
                    }

                    value = new AttributeExtractor(
                        options.attribute
                    ).extract(selectedElement);

                    break;

                default:
                    throw new Error(
                        `Unsupported extraction type: ${options.extract}`
                    );
            }

            values.push(value);
        });

        return values;
    }
}