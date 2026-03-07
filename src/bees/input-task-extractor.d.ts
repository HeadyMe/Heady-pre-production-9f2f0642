export const inputTaskExtractor: Object;
export function extractFromStrategicReport(): {
    tasks: never[];
    note: string;
    source?: undefined;
} | {
    tasks: {
        text: string;
        priority: number;
        category: string;
    }[];
    source: string;
    note?: undefined;
};
export function extractEnterpriseTasksFromArchitecture(input?: string): {
    tasks: any;
    summary: {
        total: any;
        byTrack: any;
        byImpact: any;
    };
};
export function classifyPriority(text: any): 1 | 0.9 | 0.5 | 0.7;
export function classifyCategory(text: any): "creative" | "ops" | "security" | "research" | "dev" | "quality";
export function classifyEnterpriseTrack(text: any): "security-hardening" | "delivery-automation" | "observability" | "reliability-performance" | "experience-delivery" | "platform-foundation";
export function classifyImpact(text: any): "high" | "medium" | "low";
//# sourceMappingURL=input-task-extractor.d.ts.map