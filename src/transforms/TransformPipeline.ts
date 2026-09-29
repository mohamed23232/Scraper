import type { Transform, TransformContext } from "./Transform.js";
import { TrimTransform } from "./TrimTransform.js";
import { RemoveCurrencyTransform } from "./RemoveCurrencyTransform.js";
import { ParseNumberTransform } from "./ParseNumberTransform.js";
import { AbsoluteUrlTransform } from "./AbsoluteUrlTransform.js";
import { RegexTransform } from "./RegexTransform.js";
import { ReplaceTransform } from "./ReplaceTransform.js";
import { DefaultTransform } from "./DefaultTransform.js";

export const TRANSFORM_NAMES = [
    "trim",
    "removeCurrency",
    "parseNumber",
    "absoluteUrl"
] as const;

export type TransformName = typeof TRANSFORM_NAMES[number];

export type TransformSpec =
    | TransformName
    | { name: "parseNumber"; decimal?: "." | "," | undefined }
    | { name: "regex"; pattern: string; group?: number | undefined; flags?: string | undefined }
    | { name: "replace"; pattern: string; replacement: string; flags?: string | undefined }
    | { name: "default"; value?: unknown };

const REGISTRY: Record<TransformName, Transform> = {
    trim: new TrimTransform(),
    removeCurrency: new RemoveCurrencyTransform(),
    parseNumber: new ParseNumberTransform(),
    absoluteUrl: new AbsoluteUrlTransform()
};

function resolveTransform(spec: TransformSpec): Transform {

    if (typeof spec === "string") {
        return REGISTRY[spec];
    }

    switch (spec.name) {

        case "parseNumber":
            return new ParseNumberTransform(spec.decimal);

        case "regex":
            return new RegexTransform(spec.pattern, spec.group, spec.flags);

        case "replace":
            return new ReplaceTransform(spec.pattern, spec.replacement, spec.flags);

        case "default":
            return new DefaultTransform(spec.value);
    }
}

export class TransformPipeline {

    static run(
        value: unknown,
        specs: readonly TransformSpec[] | undefined,
        context: TransformContext
    ): unknown {

        if (!specs || specs.length === 0) {
            return value;
        }

        return specs.reduce<unknown>(
            (acc, spec) => resolveTransform(spec).apply(acc, context),
            value
        );
    }

    static runOnExtracted(
        value: unknown,
        specs: readonly TransformSpec[] | undefined,
        context: TransformContext
    ): unknown {

        if (Array.isArray(value)) {
            return value.map((entry) => TransformPipeline.run(entry, specs, context));
        }

        return TransformPipeline.run(value, specs, context);
    }
}
