import type { Transform } from "./Transform.js";

export class ParseNumberTransform implements Transform {

    constructor(private readonly decimal: "." | "," = ".") {}

    apply(value: unknown): number {

        if (typeof value !== "string") {
            throw new Error("parseNumber transform expects a string value");
        }

        const normalized = this.decimal === ","
            ? value.replace(/\./g, "").replace(",", ".")
            : value.replace(/,/g, "");

        const parsed = Number(normalized);

        if (Number.isNaN(parsed)) {
            throw new Error(`Failed to parse number from value: "${value}"`);
        }

        return parsed;
    }
}
