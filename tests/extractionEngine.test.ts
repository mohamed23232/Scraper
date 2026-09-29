import { describe, test, expect } from "vitest";
import * as cheerio from "cheerio";
import { ExtractionEngine } from "../src/extractors/ExtractionEngine.js";
import { ScraperError } from "../src/core/errors/ScraperError.js";

const MULTI_HTML = `
    <div class="product">
        <span class="name">Gaming Laptop</span>
        <span class="tag">electronics</span>
        <span class="tag">computers</span>
    </div>
`;

const MISSING_FIELD_HTML = `
    <div class="product">
        <span class="name">Gaming Laptop</span>
        <span class="rating">5 stars</span>
    </div>
    <div class="product">
        <span class="name">Wireless Mouse</span>
    </div>
`;

describe("A4: field.multiple", () => {

    const engine = new ExtractionEngine();

    test("default (multiple unset) returns the first match, not an array, even with several matches", () => {
        const $ = cheerio.load(MULTI_HTML);

        const items = engine.extractItems($, ".product", {
            tag: { selector: ".tag", extract: "text" }
        });

        expect(items).toEqual([{ tag: "electronics" }]);
    });

    test("multiple: true always returns an array", () => {
        const $ = cheerio.load(MULTI_HTML);

        const items = engine.extractItems($, ".product", {
            tag: { selector: ".tag", extract: "text", multiple: true }
        });

        expect(items).toEqual([{ tag: ["electronics", "computers"] }]);
    });

    test("flat extract() is unaffected — still returns every match as an array", () => {
        const $ = cheerio.load(MULTI_HTML);

        const values = engine.extract($, { selector: ".tag", extract: "text" });

        expect(values).toEqual(["electronics", "computers"]);
    });
});

describe("A5: field.required / field.default / item.allowEmpty", () => {

    const engine = new ExtractionEngine();

    test("a missing field throws by default (required defaults to true)", () => {
        const $ = cheerio.load(MISSING_FIELD_HTML);

        expect(() =>
            engine.extractItems($, ".product", {
                rating: { selector: ".rating", extract: "text" }
            })
        ).toThrow(ScraperError);
    });

    test("the thrown error names the field and the item index", () => {
        const $ = cheerio.load(MISSING_FIELD_HTML);

        try {
            engine.extractItems($, ".product", {
                rating: { selector: ".rating", extract: "text" }
            });
            expect.unreachable("should have thrown");
        } catch (error) {
            expect((error as ScraperError).message).toContain("rating");
            expect((error as ScraperError).message).toContain("#1");
        }
    });

    test("required: false with no default returns null for a missing field", () => {
        const $ = cheerio.load(MISSING_FIELD_HTML);

        const items = engine.extractItems($, ".product", {
            name: { selector: ".name", extract: "text" },
            rating: { selector: ".rating", extract: "text", required: false }
        });

        expect(items).toEqual([
            { name: "Gaming Laptop", rating: "5 stars" },
            { name: "Wireless Mouse", rating: null }
        ]);
    });

    test("required: false with a default returns the default for a missing field", () => {
        const $ = cheerio.load(MISSING_FIELD_HTML);

        const items = engine.extractItems($, ".product", {
            name: { selector: ".name", extract: "text" },
            rating: { selector: ".rating", extract: "text", required: false, default: "no rating" }
        });

        expect(items).toEqual([
            { name: "Gaming Laptop", rating: "5 stars" },
            { name: "Wireless Mouse", rating: "no rating" }
        ]);
    });

    test("item selector matching nothing throws by default", () => {
        const $ = cheerio.load("<p>No results</p>");

        expect(() =>
            engine.extractItems($, ".product", { name: { selector: ".name", extract: "text" } })
        ).toThrow(ScraperError);
    });

    test("allowEmpty: true returns [] instead of throwing when nothing matches", () => {
        const $ = cheerio.load("<p>No results</p>");

        const items = engine.extractItems(
            $,
            ".product",
            { name: { selector: ".name", extract: "text" } },
            { allowEmpty: true }
        );

        expect(items).toEqual([]);
    });
});
