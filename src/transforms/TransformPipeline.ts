import type { Transform, TransformContext } from "./Transform.js";
import { TrimTransform } from "./TrimTransform.js";
import { RemoveCurrencyTransform } from "./RemoveCurrencyTransform.js";
import { ParseNumberTransform } from "./ParseNumberTransform.js";
import { AbsoluteUrlTransform } from "./AbsoluteUrlTransform.js";

export const TRANSFORM_NAMES = [
    "trim",
    "removeCurrency",
    "parseNumber",
    "absoluteUrl"
] as const;

export type TransformName = typeof TRANSFORM_NAMES[number];

const REGISTRY: Record<TransformName, Transform> = {
    trim: new TrimTransform(),
    removeCurrency: new RemoveCurrencyTransform(),
    parseNumber: new ParseNumberTransform(),
    absoluteUrl: new AbsoluteUrlTransform()
};

export class TransformPipeline {

    static run(
        value: unknown,
        names: readonly TransformName[] | undefined,
        context: TransformContext
    ): unknown {

        if (!names || names.length === 0) {
            return value;
        }

        return names.reduce<unknown>(
            (acc, name) => REGISTRY[name].apply(acc, context),
            value
        );
    }

    static runOnExtracted(
        value: string | string[],
        names: readonly TransformName[] | undefined,
        context: TransformContext
    ): unknown {

        if (Array.isArray(value)) {
            return value.map((entry) => TransformPipeline.run(entry, names, context));
        }

        return TransformPipeline.run(value, names, context);
    }
}
