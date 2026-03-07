export function chatViaClaude(message: any, system: any, temperature: any, max_tokens: any): Promise<{
    response: string;
    model: any;
    complexity: string;
    thinking_used: boolean;
    thinking_summary: string | null;
    cost: number;
    org: string;
    usage: any;
}>;
export function getClaudeClient(): {
    client: any;
    org: {
        name: string;
        apiKey: string | undefined;
        account: string;
        adminKey: string | undefined;
        orgId: string | undefined;
        credit: number;
    } | {
        name: string;
        apiKey: string | undefined;
        account: string;
        credit: number;
        adminKey?: undefined;
        orgId?: undefined;
    };
};
export function analyzeComplexity(message: any, system: any): "high" | "medium" | "low" | "critical";
export function selectModel(complexity: any): {
    model: string;
    thinking: boolean;
    budget: number;
};
export function trackClaudeUsage(model: any, inputTokens: any, outputTokens: any, orgName: any, thinkingTokens?: number): number;
export namespace claudeUsage {
    let totalCost: number;
    let requests: number;
    let byModel: {};
    let byOrg: {};
    let history: never[];
}
export const CLAUDE_ORGS: ({
    name: string;
    apiKey: string | undefined;
    account: string;
    adminKey: string | undefined;
    orgId: string | undefined;
    credit: number;
} | {
    name: string;
    apiKey: string | undefined;
    account: string;
    credit: number;
    adminKey?: undefined;
    orgId?: undefined;
})[];
//# sourceMappingURL=claude-sdk.d.ts.map