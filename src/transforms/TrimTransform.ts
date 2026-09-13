import type { Transform } from "./Transform.js";

export class TrimTransform implements Transform {

    apply(value: unknown): string {

        if (typeof value !== "string") {
            throw new Error("trim transform expects a string value");
        }

        return value.trim();
    }
}
