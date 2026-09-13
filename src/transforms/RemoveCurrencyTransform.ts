import type { Transform } from "./Transform.js";

export class RemoveCurrencyTransform implements Transform {

    apply(value: unknown): string {

        if (typeof value !== "string") {
            throw new Error("removeCurrency transform expects a string value");
        }

        // Keeps commas (thousands separators) — parseNumber strips those next.
        return value.replace(/[^0-9.,-]/g, "");
    }
}
