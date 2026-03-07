export class ProviderConnector {
    constructor(config?: {});
    config: {};
    adapters: {
        anthropic: AnthropicAdapter;
        openai: OpenAIAdapter;
        google: GoogleAdapter;
        groq: GroqAdapter;
        perplexity: PerplexityAdapter;
        cloudflare: CloudflareAdapter;
        local: LocalAdapter;
    };
    generate(provider: any, prompt: any, opts?: {}): Promise<any>;
    embed(provider: any, text: any, opts?: {}): Promise<any>;
    streamGenerate(provider: any, prompt: any, opts?: {}): Promise<any>;
    healthAll(): Promise<{}>;
    registerAdapter(name: any, adapter: any): void;
}
export class BaseAdapter {
    constructor(name: any, config?: {});
    name: any;
    config: {};
    baseUrl: any;
    apiKey: any;
    _healthy: boolean;
    _lastHealthCheck: number | null;
    _fetch(url: any, options?: {}): Promise<Response>;
    _authHeaders(): {};
    health(): Promise<{
        provider: any;
        healthy: boolean;
        ts: string;
    }>;
    generate(): Promise<void>;
    embed(): Promise<void>;
    streamGenerate(): Promise<void>;
}
export class AnthropicAdapter extends BaseAdapter {
    constructor(config?: {});
    defaultModel: any;
    _authHeaders(): {
        'x-api-key': any;
        'anthropic-version': string;
    };
    generate(prompt: any, opts?: {}): Promise<{
        text: any;
        inputTokens: any;
        outputTokens: any;
        model: any;
        stopReason: any;
        raw: unknown;
    }>;
    streamGenerate(prompt: any, opts?: {}): Promise<import("stream/web").ReadableStream<any> | null>;
    health(): Promise<{
        provider: string;
        healthy: boolean;
        ts: string;
    }>;
}
export class OpenAIAdapter extends BaseAdapter {
    constructor(config?: {});
    defaultModel: any;
    defaultEmbedModel: any;
    _authHeaders(): {
        Authorization: string;
    };
    generate(prompt: any, opts?: {}): Promise<{
        text: any;
        inputTokens: any;
        outputTokens: any;
        model: any;
        stopReason: any;
        raw: unknown;
    }>;
    embed(text: any, opts?: {}): Promise<{
        embeddings: any;
        model: any;
        totalTokens: any;
        raw: unknown;
    }>;
    streamGenerate(prompt: any, opts?: {}): Promise<import("stream/web").ReadableStream<any> | null>;
    health(): Promise<{
        provider: string;
        healthy: boolean;
        ts: string;
    }>;
}
export class GoogleAdapter extends BaseAdapter {
    constructor(config?: {});
    defaultModel: any;
    _urlWithKey(path: any): string;
    generate(prompt: any, opts?: {}): Promise<{
        text: any;
        inputTokens: any;
        outputTokens: any;
        model: any;
        stopReason: any;
        raw: unknown;
    }>;
    embed(text: any, opts?: {}): Promise<{
        embeddings: any[];
        model: any;
        raw: unknown;
    }>;
    streamGenerate(prompt: any, opts?: {}): Promise<import("stream/web").ReadableStream<any> | null>;
    health(): Promise<{
        provider: string;
        healthy: boolean;
        ts: string;
    }>;
}
export class GroqAdapter extends BaseAdapter {
    constructor(config?: {});
    defaultModel: any;
    _authHeaders(): {
        Authorization: string;
    };
    generate(prompt: any, opts?: {}): Promise<{
        text: any;
        inputTokens: any;
        outputTokens: any;
        model: any;
        stopReason: any;
        raw: unknown;
    }>;
    streamGenerate(prompt: any, opts?: {}): Promise<import("stream/web").ReadableStream<any> | null>;
    health(): Promise<{
        provider: string;
        healthy: boolean;
        ts: string;
    }>;
}
export class PerplexityAdapter extends BaseAdapter {
    constructor(config?: {});
    defaultModel: any;
    _authHeaders(): {
        Authorization: string;
    };
    generate(prompt: any, opts?: {}): Promise<{
        text: any;
        citations: any;
        inputTokens: any;
        outputTokens: any;
        model: any;
        raw: unknown;
    }>;
    streamGenerate(prompt: any, opts?: {}): Promise<import("stream/web").ReadableStream<any> | null>;
    health(): Promise<{
        provider: string;
        healthy: boolean;
        ts: string;
    }>;
}
export class CloudflareAdapter extends BaseAdapter {
    constructor(config?: {});
    defaultModel: any;
    defaultEmbedModel: any;
    accountId: any;
    _authHeaders(): {
        Authorization: string;
    };
    generate(prompt: any, opts?: {}): Promise<{
        text: any;
        model: any;
        raw: unknown;
    }>;
    embed(text: any, opts?: {}): Promise<{
        embeddings: any;
        model: any;
        raw: unknown;
    }>;
    streamGenerate(prompt: any, opts?: {}): Promise<import("stream/web").ReadableStream<any> | null>;
    health(): Promise<{
        provider: string;
        healthy: boolean;
        ts: string;
    }>;
}
export class LocalAdapter extends BaseAdapter {
    constructor(config?: {});
    defaultModel: any;
    defaultEmbedModel: any;
    generate(prompt: any, opts?: {}): Promise<{
        text: any;
        model: any;
        evalCount: any;
        raw: unknown;
    }>;
    embed(text: any, opts?: {}): Promise<{
        embeddings: any[];
        model: any;
        raw: unknown;
    }>;
    streamGenerate(prompt: any, opts?: {}): Promise<import("stream/web").ReadableStream<any> | null>;
    health(): Promise<{
        provider: string;
        healthy: boolean;
        ts: string;
    }>;
}
//# sourceMappingURL=provider-connector.d.ts.map