export interface TransformContext {
    baseUrl: string;
}

export interface Transform {
    apply(value: unknown, context: TransformContext): unknown;
}
