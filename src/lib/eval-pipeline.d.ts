export = EvalPipeline;
declare class EvalPipeline {
    static relevanceJudge(output: any, ctx: any): number;
    static faithfulnessJudge(output: any, ctx: any): number;
    static safetyJudge(output: any): 1 | 0;
    static trajectoryJudge(output: any, ctx: any): number;
    static createDefault(): EvalPipeline;
    constructor(opts?: {});
    judges: any[];
    threshold: any;
    ciMode: any;
    addJudge(name: any, judgeFn: any): this;
    evaluate(agentOutput: any, context?: {}): Promise<{
        overall: number;
        pass: boolean;
        results: ({
            judge: any;
            score: number;
            pass: boolean;
            error?: undefined;
        } | {
            judge: any;
            score: number;
            pass: boolean;
            error: any;
        })[];
        timestamp: string;
    }>;
}
//# sourceMappingURL=eval-pipeline.d.ts.map