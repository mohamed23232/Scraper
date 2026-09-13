import type { Transform, TransformContext } from "./Transform.js";

export class AbsoluteUrlTransform implements Transform {

    apply(value: unknown, context: TransformContext): string {

        if (typeof value !== "string") {
            throw new Error("absoluteUrl transform expects a string value");
        }

        return new URL(value, context.baseUrl).toString();
    }
}
