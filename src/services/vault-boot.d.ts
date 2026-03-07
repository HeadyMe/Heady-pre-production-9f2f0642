/**
 * Boot the vault: unlock, retrieve all credentials, project into process.env.
 * Call this EARLY in the app bootstrap (before any service needs API keys).
 */
export function bootVault(): Promise<{
    ok: boolean;
    projected: number;
    keys: string[];
    reason?: undefined;
} | {
    ok: boolean;
    projected: number;
    reason: any;
    keys?: undefined;
}>;
/**
 * Register vault projection routes on Express app.
 * Lets the user view credentials on demand.
 */
export function registerVaultProjectionRoutes(app: any): void;
export const CREDENTIAL_ENV_MAP: {
    'github-pat-primary': string;
    'github-pat-secondary': string;
    'claude-api-key': string;
    'claude-code-oauth': string;
    'claude-admin-key': string;
    'claude-dev-admin': string;
    'claude-org-id': string;
    'openai-api-key': string;
    'hf-token': string;
    'groq-api-key': string;
    'cf-api-token-primary': string;
    'cf-api-token-secondary': string;
    'cf-api-token-tertiary': string;
    'sentry-org-token': string;
    'sentry-personal-token': string;
    'sentry-dsn': string;
    'neon-api-key': string;
    'neon-database-url': string;
    'upstash-db-id': string;
    'pinecone-api-key': string;
    'stripe-secret-key': string;
    'onepassword-service-account': string;
    'gai-headyme-colab': string;
    'gai-heady-project': string;
    'gai-gcloud-default': string;
    'gai-firebase': string;
    'perplexity-api-key': string;
    'heady-url-main': string;
    'heady-url-api': string;
    'heady-url-brain': string;
    'heady-url-edge': string;
    'heady-url-mcp': string;
    'heady-url-bot': string;
    'heady-url-os': string;
    'heady-url-buddy': string;
    'heady-url-systems': string;
    'heady-url-connection': string;
    'heady-url-cloudrun': string;
};
//# sourceMappingURL=vault-boot.d.ts.map