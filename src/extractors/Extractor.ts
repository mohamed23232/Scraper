import type { Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";

export interface Extractor {
    extract(element: Cheerio<AnyNode>): string;
}