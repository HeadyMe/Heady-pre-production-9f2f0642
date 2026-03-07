export = PromptGuard;
declare class PromptGuard {
    constructor(opts?: {});
    patterns: any;
    maxLength: any;
    strictMode: any;
    auditLog: any;
    validateInput(input: any): {
        safe: boolean;
        reason: string;
        length?: undefined;
        ratio?: undefined;
        pattern?: undefined;
    } | {
        safe: boolean;
        reason: string;
        length: number;
        ratio?: undefined;
        pattern?: undefined;
    } | {
        safe: boolean;
        reason: string;
        ratio: number;
        length?: undefined;
        pattern?: undefined;
    } | {
        safe: boolean;
        reason: string;
        pattern: any;
        length?: undefined;
        ratio?: undefined;
    } | {
        safe: boolean;
        reason?: undefined;
        length?: undefined;
        ratio?: undefined;
        pattern?: undefined;
    };
    isolateMessages(messages: any): any;
    sanitize(text: any): any;
    ragTriad(output: any, context: any): {
        relevance: number;
        faithfulness: number;
        adherence: number;
        overall: number;
    };
    middleware(): (req: any, res: any, next: any) => any;
    _textSimilarity(a: any, b: any): number;
    _groundedness(output: any, sources: any): number;
    _constraintCheck(output: any, constraints: any): number;
}
//# sourceMappingURL=prompt-guard.d.ts.map