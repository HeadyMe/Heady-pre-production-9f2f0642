export function chat(message: any, opts?: {}): Promise<{
    error: string;
    message: string;
    retryAfter: number;
    response?: undefined;
    model?: undefined;
    provider?: undefined;
    plan?: undefined;
    engine?: undefined;
} | {
    response: any;
    model: any;
    provider: string;
    plan: string;
    engine: any;
    error?: undefined;
    message?: undefined;
    retryAfter?: undefined;
}>;
export function streamChat(message: any, opts?: {}): AsyncGenerator<{
    type: string;
    message: string;
    content?: undefined;
    model?: undefined;
} | {
    type: string;
    content: any;
    message?: undefined;
    model?: undefined;
} | {
    type: string;
    model: any;
    message?: undefined;
    content?: undefined;
}, void, unknown>;
export function embed(text: any, model?: string): Promise<{
    embedding: any;
    dimensions: any;
    model: any;
}>;
export function generateImage(prompt: any, opts?: {}): Promise<{
    url: any;
    revisedPrompt: any;
}>;
export namespace codex {
    function runCLI(task: any, opts?: {}): Promise<{
        success: boolean;
        output: string;
        source: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        source: string;
        output?: undefined;
    }>;
    function runCloud(task: any, opts?: {}): Promise<{
        success: boolean;
        output: any;
        source: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        source: string;
        output?: undefined;
    }>;
}
export namespace connectors {
    function list(): Promise<{
        available: string[];
        configured: string[];
        plan: string;
        seats: number;
    }>;
}
export function getStatus(): {
    provider: string;
    plan: string;
    configured: boolean;
    orgId: string;
    models: {
        tier: string;
        model: string;
        description: string;
    }[];
    usage: {
        totalRequests: number;
        totalTokens: {
            input: number;
            output: number;
        };
        byModel: {};
        errors: number;
        lastRequest: null;
    };
    throttle: {
        maxConcurrent: number;
        burstLimit: number;
        currentActive: number;
        recentBurst: number;
    };
    capabilities: {
        chat: boolean;
        streaming: boolean;
        embeddings: boolean;
        imageGeneration: boolean;
        codexCLI: boolean;
        codexCloud: boolean;
        connectors: boolean;
        codeInterpreter: boolean;
    };
};
export function getClient(): any;
export namespace MODELS {
    namespace fast {
        let id: string;
        let maxTokens: number;
        let description: string;
    }
    namespace standard {
        let id_1: string;
        export { id_1 as id };
        let maxTokens_1: number;
        export { maxTokens_1 as maxTokens };
        let description_1: string;
        export { description_1 as description };
    }
    namespace reasoning {
        let id_2: string;
        export { id_2 as id };
        let maxTokens_2: number;
        export { maxTokens_2 as maxTokens };
        let description_2: string;
        export { description_2 as description };
    }
    namespace deep {
        let id_3: string;
        export { id_3 as id };
        let maxTokens_3: number;
        export { maxTokens_3 as maxTokens };
        let description_3: string;
        export { description_3 as description };
    }
    namespace code {
        let id_4: string;
        export { id_4 as id };
        let maxTokens_4: number;
        export { maxTokens_4 as maxTokens };
        let description_4: string;
        export { description_4 as description };
    }
    namespace creative {
        let id_5: string;
        export { id_5 as id };
        let maxTokens_5: number;
        export { maxTokens_5 as maxTokens };
        let description_5: string;
        export { description_5 as description };
    }
}
export namespace usage {
    let totalRequests: number;
    namespace totalTokens {
        let input: number;
        let output: number;
    }
    let byModel: {};
    let errors: number;
    let lastRequest: null;
}
//# sourceMappingURL=openai-business.d.ts.map