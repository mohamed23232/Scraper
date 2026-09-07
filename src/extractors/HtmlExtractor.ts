import type { Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import type { Extractor } from "./Extractor.js";

export class HtmlExtractor implements Extractor {

    extract(element: Cheerio<AnyNode>): string {
        return element.html() ?? "";
    }

}