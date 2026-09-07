import type { Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import type { Extractor } from "./Extractor.js";

export class AttributeExtractor implements Extractor {

    constructor(private readonly attribute: string) {}

    extract(element: Cheerio<AnyNode>): string {
        return element.attr(this.attribute) ?? "";
    }

}