export class DigitalPresenceControlPlane {
    constructor({ templateRegistry, maintenanceOps, vectorMemory, tracker }?: {
        tracker?: {
            record: (event: {
                provider: string;
                account?: string | undefined;
                model: string;
                tokensIn?: number | undefined;
                tokensOut?: number | undefined;
                costUsd: number;
                latencyMs?: number | undefined;
                action?: string | undefined;
                success?: boolean | undefined;
                error?: string | undefined;
                metadata?: object | undefined;
            }) => object;
            getProviderSummary: (provider: string, period?: string) => object;
            getAccountSummary: (account: string) => object;
            getAllProvidersSummary: (period?: string) => object;
            checkProviderBudget: (provider: string) => object;
            getAllBudgetStatus: () => object[];
            getExceededProviders: () => string[];
            getTopProviders: (metric?: string, limit?: number) => object[];
            getAccountRegistry: () => object;
            calculatePercentiles: () => {
                p50: null;
                p95: null;
                p99: null;
                sampleSize?: undefined;
            } | {
                p50: any;
                p95: any;
                p99: any;
                sampleSize: number;
            };
            ACCOUNT_REGISTRY: {
                gcloud: {
                    id: string;
                    label: string;
                }[];
                "google-ai-studio": {
                    id: string;
                    label: string;
                }[];
                "google-ai-ultra": {
                    id: string;
                    label: string;
                }[];
                "github-enterprise": {
                    id: string;
                    label: string;
                }[];
                cloudflare: {
                    id: string;
                    label: string;
                }[];
                groq: {
                    id: string;
                    label: string;
                }[];
                anthropic: {
                    id: string;
                    label: string;
                }[];
                openai: {
                    id: string;
                    label: string;
                }[];
                perplexity: {
                    id: string;
                    label: string;
                }[];
                xai: {
                    id: string;
                    label: string;
                }[];
                "gcloud-cloudrun": {
                    id: string;
                    label: string;
                }[];
                gemini: {
                    id: string;
                    label: string;
                }[];
                huggingface: {
                    id: string;
                    label: string;
                }[];
            };
            USAGE_LOG: string;
            _aggregates: {
                byProvider: {};
                byAccount: {};
                byModel: {};
                daily: {};
                monthly: {};
                totalCostUsd: number;
                totalCalls: number;
                latencyBuckets: never[];
            };
            _emptyStats: () => {
                calls: number;
                tokensIn: number;
                tokensOut: number;
                costUsd: number;
                latencySum: number;
                latencyCount: number;
                errors: number;
                firstSeen: null;
                lastSeen: null;
            };
            _hydrateFromLog: () => void;
        } | undefined;
    });
    templateRegistry: any;
    maintenanceOps: any;
    vectorMemory: any;
    tracker: {
        record: (event: {
            provider: string;
            account?: string | undefined;
            model: string;
            tokensIn?: number | undefined;
            tokensOut?: number | undefined;
            costUsd: number;
            latencyMs?: number | undefined;
            action?: string | undefined;
            success?: boolean | undefined;
            error?: string | undefined;
            metadata?: object | undefined;
        }) => object;
        getProviderSummary: (provider: string, period?: string) => object;
        getAccountSummary: (account: string) => object;
        getAllProvidersSummary: (period?: string) => object;
        checkProviderBudget: (provider: string) => object;
        getAllBudgetStatus: () => object[];
        getExceededProviders: () => string[];
        getTopProviders: (metric?: string, limit?: number) => object[];
        getAccountRegistry: () => object;
        calculatePercentiles: () => {
            p50: null;
            p95: null;
            p99: null;
            sampleSize?: undefined;
        } | {
            p50: any;
            p95: any;
            p99: any;
            sampleSize: number;
        };
        ACCOUNT_REGISTRY: {
            gcloud: {
                id: string;
                label: string;
            }[];
            "google-ai-studio": {
                id: string;
                label: string;
            }[];
            "google-ai-ultra": {
                id: string;
                label: string;
            }[];
            "github-enterprise": {
                id: string;
                label: string;
            }[];
            cloudflare: {
                id: string;
                label: string;
            }[];
            groq: {
                id: string;
                label: string;
            }[];
            anthropic: {
                id: string;
                label: string;
            }[];
            openai: {
                id: string;
                label: string;
            }[];
            perplexity: {
                id: string;
                label: string;
            }[];
            xai: {
                id: string;
                label: string;
            }[];
            "gcloud-cloudrun": {
                id: string;
                label: string;
            }[];
            gemini: {
                id: string;
                label: string;
            }[];
            huggingface: {
                id: string;
                label: string;
            }[];
        };
        USAGE_LOG: string;
        _aggregates: {
            byProvider: {};
            byAccount: {};
            byModel: {};
            daily: {};
            monthly: {};
            totalCostUsd: number;
            totalCalls: number;
            latencyBuckets: never[];
        };
        _emptyStats: () => {
            calls: number;
            tokensIn: number;
            tokensOut: number;
            costUsd: number;
            latencySum: number;
            latencyCount: number;
            errors: number;
            firstSeen: null;
            lastSeen: null;
        };
        _hydrateFromLog: () => void;
    };
    state: {
        lastRunAt: null;
        lastScore: null;
        runs: number;
    };
    evaluate(): Promise<{
        ok: boolean;
        score: number;
        templateCoverage: any;
        optimizePlan: any;
        projection: any;
        maintenance: any;
        awareness: {
            confidence: number;
            recommendations: never[];
        };
        generatedAt: string;
    }>;
    _computeScore({ templateCoverage, optimizePlan, projection, maintenance, awareness }: {
        templateCoverage: any;
        optimizePlan: any;
        projection: any;
        maintenance: any;
        awareness: any;
    }): number;
    runOptimizationCycle({ applyProjectionSync, embedSnapshot }?: {
        applyProjectionSync?: boolean | undefined;
        embedSnapshot?: boolean | undefined;
    }): Promise<{
        ok: boolean;
        error: string;
        budget: object;
        evaluation?: undefined;
        projectionSync?: undefined;
        embedded?: undefined;
        latencyMs?: undefined;
        generatedAt?: undefined;
    } | {
        ok: boolean;
        evaluation: {
            ok: boolean;
            score: number;
            templateCoverage: any;
            optimizePlan: any;
            projection: any;
            maintenance: any;
            awareness: {
                confidence: number;
                recommendations: never[];
            };
            generatedAt: string;
        };
        projectionSync: any;
        embedded: {
            ok: boolean;
            id: any;
        } | null;
        latencyMs: number;
        budget: object;
        generatedAt: string;
        error?: undefined;
    }>;
    health(): {
        ok: boolean;
        runs: number;
        lastRunAt: null;
        lastScore: null;
        timestamp: string;
    };
}
export function registerDigitalPresenceRoutes(app: any, controlPlane: any): void;
//# sourceMappingURL=digital-presence-control-plane.d.ts.map