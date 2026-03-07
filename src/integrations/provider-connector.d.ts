export class ProviderConnector extends EventEmitter<[never]> {
    constructor(opts?: {});
    keys: Map<any, any>;
    health: KeyHealth;
    timeout: any;
    maxTokens: any;
    /**
     * Register API keys for a provider.
     * @param {string} provider - Provider name (openai, anthropic, gemini, perplexity, huggingface)
     * @param {Array<{key: string, label: string, account?: string}>} keys - API keys
     */
    addKeys(provider: string, keys: Array<{
        key: string;
        label: string;
        account?: string;
    }>): this;
    /**
     * Load keys from environment variables.
     */
    loadFromEnv(): this;
    /**
     * Call a single provider with failover across its keys.
     */
    callProvider(provider: any, message: any, system?: null, opts?: {}): Promise<{
        provider: any;
        ok: boolean;
        error: string;
        key?: undefined;
        account?: undefined;
        model?: undefined;
        response?: undefined;
        latency?: undefined;
    } | {
        provider: any;
        key: any;
        account: any;
        model: any;
        response: any;
        latency: number;
        ok: boolean;
        error?: undefined;
    }>;
    /**
     * Fan-out: Query ALL providers simultaneously, collect ALL responses.
     * This is the deep research mode — no race, no drops.
     */
    fanOut(message: any, system?: null, opts?: {}): Promise<{
        responses: any;
        allResponses: any;
        meta: {
            totalProviders: any;
            succeeded: any;
            totalMs: number;
            timestamp: string;
        };
    }>;
    /**
     * Fan-out across ALL keys (not just providers) — maximum coverage.
     * Every key gets its own call for maximum determinism data.
     */
    fanOutAllKeys(message: any, system?: null, opts?: {}): Promise<{
        responses: ({
            provider: any;
            key: any;
            account: any;
            model: any;
            response: any;
            latency: number;
            ok: boolean;
        } | {
            provider: any;
            key: any;
            account: any;
            ok: boolean;
            error: any;
        })[];
        allResponses: ({
            provider: any;
            key: any;
            account: any;
            model: any;
            response: any;
            latency: number;
            ok: boolean;
        } | {
            provider: any;
            key: any;
            account: any;
            ok: boolean;
            error: any;
        })[];
        meta: {
            totalKeys: number;
            succeeded: number;
            totalMs: number;
            timestamp: string;
        };
    }>;
    /**
     * Get connector status — all providers, keys, and health.
     */
    status(): {
        providers: {};
        totalKeys: any;
    };
}
export namespace PROVIDER_CONFIGS {
    namespace openai {
        let name: string;
        let baseUrl: string;
        let models: string[];
        let defaultModel: string;
        let authHeader: string;
        let authPrefix: string;
        let maxTokensField: string;
        function formatRequest(model: any, system: any, message: any, maxTokens: any): {
            model: any;
            messages: {
                role: string;
                content: any;
            }[];
            max_tokens: any;
        };
        function extractResponse(data: any): any;
        function extractError(data: any): any;
    }
    namespace anthropic {
        let name_1: string;
        export { name_1 as name };
        let baseUrl_1: string;
        export { baseUrl_1 as baseUrl };
        let models_1: string[];
        export { models_1 as models };
        let defaultModel_1: string;
        export { defaultModel_1 as defaultModel };
        let authHeader_1: string;
        export { authHeader_1 as authHeader };
        let authPrefix_1: string;
        export { authPrefix_1 as authPrefix };
        export let extraHeaders: {
            "anthropic-version": string;
        };
        export function formatRequest_1(model: any, system: any, message: any, maxTokens: any): {
            messages: {
                role: string;
                content: any;
            }[];
            system?: any;
            model: any;
            max_tokens: any;
        };
        export { formatRequest_1 as formatRequest };
        export function extractResponse_1(data: any): any;
        export { extractResponse_1 as extractResponse };
        export function extractError_1(data: any): any;
        export { extractError_1 as extractError };
    }
    namespace gemini {
        let name_2: string;
        export { name_2 as name };
        let baseUrl_2: string;
        export { baseUrl_2 as baseUrl };
        let models_2: string[];
        export { models_2 as models };
        let defaultModel_2: string;
        export { defaultModel_2 as defaultModel };
        export let authType: string;
        export function formatRequest_2(model: any, system: any, message: any, maxTokens: any): {
            contents: {
                parts: {
                    text: string;
                }[];
            }[];
            generationConfig: {
                maxOutputTokens: any;
            };
        };
        export { formatRequest_2 as formatRequest };
        export function extractResponse_2(data: any): any;
        export { extractResponse_2 as extractResponse };
        export function extractError_2(data: any): any;
        export { extractError_2 as extractError };
    }
    namespace perplexity {
        let name_3: string;
        export { name_3 as name };
        let baseUrl_3: string;
        export { baseUrl_3 as baseUrl };
        let models_3: string[];
        export { models_3 as models };
        let defaultModel_3: string;
        export { defaultModel_3 as defaultModel };
        let authHeader_2: string;
        export { authHeader_2 as authHeader };
        let authPrefix_2: string;
        export { authPrefix_2 as authPrefix };
        export function formatRequest_3(model: any, system: any, message: any, maxTokens: any): {
            model: any;
            messages: {
                role: string;
                content: any;
            }[];
            max_tokens: any;
        };
        export { formatRequest_3 as formatRequest };
        export function extractResponse_3(data: any): any;
        export { extractResponse_3 as extractResponse };
        export function extractError_3(data: any): any;
        export { extractError_3 as extractError };
    }
    namespace huggingface {
        let name_4: string;
        export { name_4 as name };
        let baseUrl_4: string;
        export { baseUrl_4 as baseUrl };
        let models_4: string[];
        export { models_4 as models };
        let defaultModel_4: string;
        export { defaultModel_4 as defaultModel };
        let authHeader_3: string;
        export { authHeader_3 as authHeader };
        let authPrefix_3: string;
        export { authPrefix_3 as authPrefix };
        export function formatRequest_4(model: any, system: any, message: any, maxTokens: any): {
            model: any;
            messages: {
                role: string;
                content: any;
            }[];
            max_tokens: any;
            stream: boolean;
        };
        export { formatRequest_4 as formatRequest };
        export function extractResponse_4(data: any): any;
        export { extractResponse_4 as extractResponse };
        export function extractError_4(data: any): any;
        export { extractError_4 as extractError };
    }
    namespace groq {
        let name_5: string;
        export { name_5 as name };
        let baseUrl_5: string;
        export { baseUrl_5 as baseUrl };
        let models_5: string[];
        export { models_5 as models };
        let defaultModel_5: string;
        export { defaultModel_5 as defaultModel };
        let authHeader_4: string;
        export { authHeader_4 as authHeader };
        let authPrefix_4: string;
        export { authPrefix_4 as authPrefix };
        export function formatRequest_5(model: any, system: any, message: any, maxTokens: any): {
            model: any;
            messages: {
                role: string;
                content: any;
            }[];
            max_tokens: any;
        };
        export { formatRequest_5 as formatRequest };
        export function extractResponse_5(data: any): any;
        export { extractResponse_5 as extractResponse };
        export function extractError_5(data: any): any;
        export { extractError_5 as extractError };
    }
}
export class KeyHealth {
    stats: Map<any, any>;
    record(keyId: any, success: any, latencyMs: any, error?: null): void;
    isHealthy(keyId: any): boolean;
    getStats(): {};
}
import EventEmitter = require("events");
//# sourceMappingURL=provider-connector.d.ts.map