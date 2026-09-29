import type { Transform } from "./Transform.js";

export class ReplaceTransform implements Transform {

    constructor(
        private readonly pattern: string,
        private readonly replacement: string,
        private readonly flags: string = "g"
    ) {}

    apply(value: unknown): string {

        if (typeof value !== "string") {
            throw new Error("replace transform expects a string value");
        }

        return value.replace(new RegExp(this.pattern, this.flags), this.replacement);
    }
}
