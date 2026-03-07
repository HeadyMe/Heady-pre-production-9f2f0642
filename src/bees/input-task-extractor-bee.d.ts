export const domain: "input-task-extractor";
export const description: "Extract actionable tasks from any text input \u2014 reports, messages, reviews, etc.";
export const priority: 1;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    status: string;
    ts: number;
}>)[];
//# sourceMappingURL=input-task-extractor-bee.d.ts.map