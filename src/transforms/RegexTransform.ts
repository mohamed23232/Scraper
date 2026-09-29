import type { Transform } from "./Transform.js";

export class RegexTransform implements Transform {

    constructor(
        private readonly pattern: string,
        private readonly group: number = 0,
        private readonly flags: string = ""
    ) {}

    apply(value: unknown): string {

        if (typeof value !== "string") {
            throw new Error("regex transform expects a string value");
        }

        const match = value.match(new RegExp(this.pattern, this.flags));

        if (!match) {
            throw new Error(`regex transform: pattern did not match value: "${value}"`);
        }

        const result = match[this.group];

        if (result === undefined) {
            throw new Error(`regex transform: capture group ${this.group} not found`);
        }

        return result;
    }
}
