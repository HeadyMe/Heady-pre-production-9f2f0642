export const domain: "vector-templates";
export const description: "3D vector storage \u2192 template instantiation \u2192 bee swarming engine";
export const priority: 0.95;
export function getWork(ctx?: {}): ((() => Promise<{
    bee: string;
    action: string;
    templates: any;
    error?: undefined;
} | {
    bee: string;
    action: string;
    error: any;
    templates?: undefined;
}>) | (() => Promise<{
    bee: string;
    action: string;
    totalTemplates: any;
    highPriority: any;
    readyToSwarm: any;
    status: string;
    error?: undefined;
} | {
    bee: string;
    action: string;
    error: any;
    totalTemplates?: undefined;
    highPriority?: undefined;
    readyToSwarm?: undefined;
    status?: undefined;
}>))[];
//# sourceMappingURL=vector-template-bee.d.ts.map