import type { Transform } from "./Transform.js";

export class ParseNumberTransform implements Transform {

    apply(value: unknown): number {

        if (typeof value !== "string") {
            throw new Error("parseNumber transform expects a string value");
        }

        const parsed = Number(value.replace(/,/g, ""));

        if (Number.isNaN(parsed)) {
            throw new Error(`Failed to parse number from value: "${value}"`);
        }

        return parsed;
    }
}
