export class InferenceGateway extends EventEmitter<[never]> {
    constructor();
    stats: {
        total: number;
        byProvider: {};
        errors: number;
        raceModeWins: {};
    };
    circuitBreakers: {};
    CIRCUIT_THRESHOLD: number;
    CIRCUIT_RESET_MS: number;
    getAvailable(): string[];
    selectProvider(opts?: {}): any;
    complete(messages: any, opts?: {}): any;
    race(messages: any, opts?: {}): Promise<any>;
    battle(messages: any, opts?: {}): Promise<any[]>;
    _recordSuccess(provider: any): void;
    _recordFailure(provider: any, err: any): void;
    getStatus(): {
        totalRequests: number;
        errors: number;
        raceModeWins: {};
        providers: {};
    };
}
export function registerGatewayRoutes(app: any, gateway: any): void;
export namespace PROVIDERS {
    namespace groq {
        let name: string;
        let tier: string;
        let costPerMTok: number;
        let latencyMs: number;
        let maxContext: number;
        let envKey: string;
        namespace models {
            export let fast: string;
            export let small: string;
            let _default: string;
            export { _default as default };
        }
        function complete(messages: any, opts?: {}): Promise<{
            content: any;
            model: any;
            provider: string;
            usage: any;
            latencyMs: number | null;
        }>;
    }
    namespace gemini {
        let name_1: string;
        export { name_1 as name };
        let tier_1: string;
        export { tier_1 as tier };
        let costPerMTok_1: number;
        export { costPerMTok_1 as costPerMTok };
        let latencyMs_1: number;
        export { latencyMs_1 as latencyMs };
        let maxContext_1: number;
        export { maxContext_1 as maxContext };
        let envKey_1: string;
        export { envKey_1 as envKey };
        export namespace models_1 {
            let fast_1: string;
            export { fast_1 as fast };
            export let quality: string;
            let _default_1: string;
            export { _default_1 as default };
        }
        export { models_1 as models };
        export function complete(messages: any, opts?: {}): Promise<{
            content: any;
            model: any;
            provider: string;
            usage: any;
        }>;
    }
    namespace claude {
        let name_2: string;
        export { name_2 as name };
        let tier_2: string;
        export { tier_2 as tier };
        let costPerMTok_2: number;
        export { costPerMTok_2 as costPerMTok };
        let latencyMs_2: number;
        export { latencyMs_2 as latencyMs };
        let maxContext_2: number;
        export { maxContext_2 as maxContext };
        let envKey_2: string;
        export { envKey_2 as envKey };
        export namespace models_2 {
            let fast_2: string;
            export { fast_2 as fast };
            let quality_1: string;
            export { quality_1 as quality };
            let _default_2: string;
            export { _default_2 as default };
        }
        export { models_2 as models };
        export function complete(messages: any, opts?: {}): Promise<{
            content: any;
            model: any;
            provider: string;
            usage: any;
        }>;
    }
    namespace openai {
        let name_3: string;
        export { name_3 as name };
        let tier_3: string;
        export { tier_3 as tier };
        let costPerMTok_3: number;
        export { costPerMTok_3 as costPerMTok };
        let latencyMs_3: number;
        export { latencyMs_3 as latencyMs };
        let maxContext_3: number;
        export { maxContext_3 as maxContext };
        let envKey_3: string;
        export { envKey_3 as envKey };
        export namespace models_3 {
            let fast_3: string;
            export { fast_3 as fast };
            let quality_2: string;
            export { quality_2 as quality };
            let _default_3: string;
            export { _default_3 as default };
        }
        export { models_3 as models };
        export function complete(messages: any, opts?: {}): Promise<{
            content: any;
            model: any;
            provider: string;
            usage: any;
        }>;
    }
    namespace huggingface {
        let name_4: string;
        export { name_4 as name };
        let tier_4: string;
        export { tier_4 as tier };
        let costPerMTok_4: number;
        export { costPerMTok_4 as costPerMTok };
        let latencyMs_4: number;
        export { latencyMs_4 as latencyMs };
        let maxContext_4: number;
        export { maxContext_4 as maxContext };
        let envKey_4: string;
        export { envKey_4 as envKey };
        export namespace models_4 {
            let fast_4: string;
            export { fast_4 as fast };
            let quality_3: string;
            export { quality_3 as quality };
            let _default_4: string;
            export { _default_4 as default };
        }
        export { models_4 as models };
        export function complete(messages: any, opts?: {}): Promise<{
            content: any;
            model: any;
            provider: string;
            usage: any;
        }>;
    }
}
import EventEmitter = require("events");
//# sourceMappingURL=inference-gateway.d.ts.map