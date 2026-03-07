declare const _exports: Readonly<{
    NODE_ENV: any;
    IS_PRODUCTION: boolean;
    LOG_LEVEL: any;
    PORT: number;
    URLS: Readonly<{
        MANAGER: any;
        EDGE_PROXY: any;
        BRAIN: any;
        CLOUDRUN: any;
        QDRANT: any;
        REDIS: any;
    }>;
    DOMAINS: readonly string[];
    ALLOWED_ORIGINS: readonly string[];
    ALLOWED_ORIGIN_PATTERNS: readonly RegExp[];
    AUTH: Readonly<{
        HEADY_API_KEY: any;
        ADMIN_TOKEN: any;
        GOOGLE_CLIENT_ID: any;
        GOOGLE_CLIENT_SECRET: any;
        GOOGLE_REDIRECT_URI: any;
        CLOUDFLARE_API_TOKEN: any;
        CLOUDFLARE_ACCOUNT_ID: any;
    }>;
    PROVIDERS: Readonly<{
        OPENAI_API_KEY: any;
        OPENAI_ORG_ID: any;
        GOOGLE_API_KEY: any;
        HF_TOKEN: any;
        GROQ_API_KEY: any;
        PERPLEXITY_API_KEY: any;
        HEADY_COMPUTE_KEY: any;
        HEADY_PYTHIA_KEY: any;
        HEADY_NEXUS_KEY: any;
        HEADY_JULES_KEY: any;
    }>;
    INTEGRATIONS: Readonly<{
        NOTION_TOKEN: any;
        GITHUB_TOKEN: any;
        STRIPE_SECRET_KEY: any;
        STRIPE_WEBHOOK_SECRET: any;
        DATABASE_URL: any;
        WEB3_PRIVATE_KEY: any;
        WEB3_RPC_URL: any;
    }>;
    GCP: Readonly<{
        PROJECT: any;
        PROJECTS: ({
            id: string;
            number: string;
            note: string;
        } | {
            id: string;
            number: string;
            note?: undefined;
        })[];
    }>;
    LIMITS: Readonly<{
        DAILY_BUDGET: number;
        readonly RATE_LIMIT_MAX: number;
        RATE_LIMIT_WINDOW_MS: number;
        JSON_BODY_LIMIT: "50mb";
        CONTENT_FILTER: any;
    }>;
    validationErrors: string[];
    requireEnv: typeof requireEnv;
    optionalEnv: typeof optionalEnv;
}>;
export = _exports;
declare function requireEnv(key: any, fallback: any): any;
declare function optionalEnv(key: any, fallback: any): any;
//# sourceMappingURL=global.d.ts.map