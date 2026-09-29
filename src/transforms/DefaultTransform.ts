import type { Transform } from "./Transform.js";

export class DefaultTransform implements Transform {

    constructor(private readonly fallback: unknown) {}

    apply(value: unknown): unknown {

        if (value === null || value === undefined || value === "") {
            return this.fallback;
        }

        return value;
    }
}
