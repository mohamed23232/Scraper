import { describe, test, expect } from "vitest";
import { ParseNumberTransform } from "../src/transforms/ParseNumberTransform.js";
import { RegexTransform } from "../src/transforms/RegexTransform.js";
import { ReplaceTransform } from "../src/transforms/ReplaceTransform.js";
import { DefaultTransform } from "../src/transforms/DefaultTransform.js";
import { TransformPipeline } from "../src/transforms/TransformPipeline.js";
import { applyFieldTransforms } from "../src/transforms/applyFieldTransforms.js";
import { ScraperError } from "../src/core/errors/ScraperError.js";

describe("A7: parseNumber failure handling", () => {

    test("still throws (does not silently return NaN) on unparseable input", () => {
        const transform = new ParseNumberTransform();
        expect(() => transform.apply("not a number")).toThrow();
    });

    test("applyFieldTransforms enriches the error with the field name and item index", () => {
        const items = [
            { name: "Gaming Laptop", price: "not a number" }
        ];

        try {
            applyFieldTransforms(
                items,
                { price: { transform: ["parseNumber"] } },
                "https://example.com"
            );
            expect.unreachable("should have thrown");
        } catch (error) {
            expect(error).toBeInstanceOf(ScraperError);
            const message = (error as ScraperError).message;
            expect(message).toContain("price");
            expect(message).toContain("#0");
            expect(message).toContain("not a number");
        }
    });

    test("a null value (missing optional field) skips its transform pipeline instead of throwing", () => {
        const items = [{ name: "Gaming Laptop", rating: null }];

        const result = applyFieldTransforms(
            items,
            { rating: { transform: ["parseNumber"] } },
            "https://example.com"
        );

        expect(result).toEqual([{ name: "Gaming Laptop", rating: null }]);
    });
});

describe("B3: parameterized transforms", () => {

    test("parseNumber still works as a bare string name (backward compatible)", () => {
        const result = TransformPipeline.run("1,299.99", ["parseNumber"], { baseUrl: "https://example.com" });
        expect(result).toBe(1299.99);
    });

    test("parseNumber with decimal: ',' parses European-style numbers", () => {
        const transform = new ParseNumberTransform(",");
        expect(transform.apply("1.299,99")).toBe(1299.99);
    });

    test("parseNumber object form with decimal param, via the pipeline", () => {
        const result = TransformPipeline.run(
            "1.299,99",
            [{ name: "parseNumber", decimal: "," }],
            { baseUrl: "https://example.com" }
        );
        expect(result).toBe(1299.99);
    });

    test("regex extracts a capture group", () => {
        const transform = new RegexTransform("(\\d+) reviews", 1);
        expect(transform.apply("42 reviews")).toBe("42");
    });

    test("regex throws when the pattern does not match", () => {
        const transform = new RegexTransform("(\\d+) reviews", 1);
        expect(() => transform.apply("no numbers here")).toThrow();
    });

    test("replace substitutes matched text", () => {
        const transform = new ReplaceTransform("\\s+", " ");
        expect(transform.apply("too    many   spaces")).toBe("too many spaces");
    });

    test("default substitutes a fallback only for empty/null/undefined values", () => {
        const transform = new DefaultTransform("N/A");
        expect(transform.apply("")).toBe("N/A");
        expect(transform.apply(null)).toBe("N/A");
        expect(transform.apply("real value")).toBe("real value");
    });

    test("B7: a field's output is checked against its declared type after transforms run", () => {
        const items = [{ price: "1,299.99" }];

        const result = applyFieldTransforms(
            items,
            { price: { transform: ["parseNumber"], type: "number" } },
            "https://example.com"
        );

        expect(result).toEqual([{ price: 1299.99 }]);
    });

    test("B7: a type mismatch throws TRANSFORMATION_ERROR naming the field", () => {
        const items = [{ name: "not a number" }];

        try {
            applyFieldTransforms(
                items,
                { name: { type: "number" } },
                "https://example.com"
            );
            expect.unreachable("should have thrown");
        } catch (error) {
            expect(error).toBeInstanceOf(ScraperError);
            expect((error as ScraperError).code).toBe("TRANSFORMATION_ERROR");
            expect((error as ScraperError).message).toContain("name");
        }
    });

    test("B7: type: 'url' validates each element when multiple/array-valued", () => {
        const items = [{ links: ["https://example.com/a", "not-a-url"] }];

        expect(() =>
            applyFieldTransforms(items, { links: { type: "url" } }, "https://example.com")
        ).toThrow(ScraperError);
    });

    test("a full parameterized pipeline via applyFieldTransforms", () => {
        const items = [{ price: "€1.299,99" }];

        const result = applyFieldTransforms(
            items,
            {
                price: {
                    transform: [
                        "removeCurrency",
                        { name: "parseNumber", decimal: "," }
                    ]
                }
            },
            "https://example.com"
        );

        expect(result).toEqual([{ price: 1299.99 }]);
    });
});
