export const domain: "documentation";
export const description: "Auto-generate and validate README, API docs, architecture diagrams, changelogs, and concept documentation";
export const priority: 0.5;
export function getWork(ctx?: {}): ((() => Promise<{
    bee: string;
    action: string;
    exists: boolean;
    ageDays: number;
    wordCount: number;
    hasTODOs: number;
    stale: boolean;
    needsUpdate: boolean;
    required?: undefined;
    needsCreation?: undefined;
} | {
    bee: string;
    action: string;
    exists: boolean;
    required: boolean;
    needsCreation: boolean;
    ageDays?: undefined;
    wordCount?: undefined;
    hasTODOs?: undefined;
    stale?: undefined;
    needsUpdate?: undefined;
}>) | (() => Promise<{
    bee: string;
    action: string;
    totalBees: number;
    undocumented: number;
    files: string[];
}>) | (() => Promise<{
    bee: string;
    action: string;
    implemented: number;
    planned: number;
    error?: undefined;
} | {
    bee: string;
    action: string;
    error: string;
    implemented?: undefined;
    planned?: undefined;
}>))[];
export const DOC_TARGETS: {
    name: string;
    file: string;
    required: boolean;
}[];
//# sourceMappingURL=documentation-bee.d.ts.map