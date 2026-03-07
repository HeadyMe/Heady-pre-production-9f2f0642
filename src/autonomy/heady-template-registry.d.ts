export class HeadyTemplateRegistry {
    constructor({ vectorMemory, tracker }?: {
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
        generatedAt: null;
        templates: never[];
        validation: null;
        projection: null;
        outcomes: {};
    };
    loadScenarioMatrix(): {
        defaultTemplate: any;
        situations: any;
    };
    loadRegistry(): any[];
    _getOutcomeScore(templateId: any): number;
    rankTemplatesForSituation(situation?: string): Promise<{
        ok: boolean;
        situation: string;
        awarenessFactor: number;
        recommended: {
            ok: boolean;
            selected: any;
            confidence: number;
            situation: string;
            node: any;
            workflow: any;
            headyswarmTask: any;
            requiredSkills: any;
            generatedAt: string;
        };
        ranked: {
            id: any;
            source: any;
            confidence: any;
            outcomeScore: number;
            score: number;
        }[];
        generatedAt: string;
    }>;
    recordTemplateOutcome({ templateId, situation, status, latencyMs, metadata }?: {
        situation?: string | undefined;
        status?: string | undefined;
        latencyMs?: number | undefined;
        metadata?: {} | undefined;
    }): Promise<{
        ok: boolean;
        error: string;
        templateId?: undefined;
        stats?: undefined;
    } | {
        ok: boolean;
        templateId: string;
        stats: any;
        error?: undefined;
    }>;
    recommendTemplate(situation?: string): {
        ok: boolean;
        selected: any;
        confidence: number;
        situation: string;
        node: any;
        workflow: any;
        headyswarmTask: any;
        requiredSkills: any;
        generatedAt: string;
    };
    validateCoverage(): {
        ok: boolean;
        coverageRatio: number;
        totalTemplates: number;
        scenarioCoverage: any;
        generatedAt: string;
    };
    getProjectionStatus(): {
        ok: boolean;
        sourceOfTruth: string;
        hash: string;
        lastProjectionTime: null;
        projectionCount: number;
        targets: {
            github: {
                lastSync: null;
                hash: null;
                status: string;
            };
            hfSpaces: {
                lastSync: null;
                hash: null;
                status: string;
            };
            cloudflare: {
                lastSync: null;
                hash: null;
                status: string;
            };
        };
        generatedAt: string;
    } | {
        ok: boolean;
        error: any;
        generatedAt: string;
    };
    embedRegistrySnapshot(trigger?: string): Promise<{
        ok: boolean;
        error: string;
        budget: object;
        id?: undefined;
        snapshot?: undefined;
    } | {
        ok: boolean;
        error: string;
        budget?: undefined;
        id?: undefined;
        snapshot?: undefined;
    } | {
        ok: boolean;
        id: any;
        snapshot: {
            templates: any[];
            validation: {
                ok: boolean;
                coverageRatio: number;
                totalTemplates: number;
                scenarioCoverage: any;
                generatedAt: string;
            };
            projection: {
                ok: boolean;
                sourceOfTruth: string;
                hash: string;
                lastProjectionTime: null;
                projectionCount: number;
                targets: {
                    github: {
                        lastSync: null;
                        hash: null;
                        status: string;
                    };
                    hfSpaces: {
                        lastSync: null;
                        hash: null;
                        status: string;
                    };
                    cloudflare: {
                        lastSync: null;
                        hash: null;
                        status: string;
                    };
                };
                generatedAt: string;
            } | {
                ok: boolean;
                error: any;
                generatedAt: string;
            };
            trigger: string;
            generatedAt: string;
        };
        error?: undefined;
        budget?: undefined;
    }>;
    syncProjection({ apply }?: {
        apply?: boolean | undefined;
    }): {
        ok: boolean;
        error: any;
        dryRun?: undefined;
        projection?: undefined;
        injectResults?: undefined;
        github?: undefined;
    } | {
        ok: boolean;
        dryRun: boolean;
        projection: {
            ok: boolean;
            sourceOfTruth: string;
            hash: string;
            lastProjectionTime: null;
            projectionCount: number;
            targets: {
                github: {
                    lastSync: null;
                    hash: null;
                    status: string;
                };
                hfSpaces: {
                    lastSync: null;
                    hash: null;
                    status: string;
                };
                cloudflare: {
                    lastSync: null;
                    hash: null;
                    status: string;
                };
            };
            generatedAt: string;
        } | {
            ok: boolean;
            error: any;
            generatedAt: string;
        };
        error?: undefined;
        injectResults?: undefined;
        github?: undefined;
    } | {
        ok: boolean;
        dryRun: boolean;
        injectResults: ({
            space: string;
            injected: boolean;
            reason: string;
            domain?: undefined;
            bytes?: undefined;
            error?: undefined;
        } | {
            space: string;
            injected: boolean;
            domain: string;
            bytes: number;
            reason?: undefined;
            error?: undefined;
        } | {
            space: string;
            injected: boolean;
            error: any;
            reason?: undefined;
            domain?: undefined;
            bytes?: undefined;
        })[];
        github: {
            ok: boolean;
            files: any;
            error?: undefined;
        } | {
            ok: boolean;
            error: any;
            files?: undefined;
        };
        projection: {
            ok: boolean;
            sourceOfTruth: string;
            hash: string;
            lastProjectionTime: null;
            projectionCount: number;
            targets: {
                github: {
                    lastSync: null;
                    hash: null;
                    status: string;
                };
                hfSpaces: {
                    lastSync: null;
                    hash: null;
                    status: string;
                };
                cloudflare: {
                    lastSync: null;
                    hash: null;
                    status: string;
                };
            };
            generatedAt: string;
        } | {
            ok: boolean;
            error: any;
            generatedAt: string;
        };
        error?: undefined;
    };
    getOptimizationPlan(): {
        ok: boolean;
        totalTemplates: number;
        coverageRatio: number;
        uncoveredScenarios: any;
        weakTemplates: {
            id: string;
            total: any;
            successRate: number;
            avgLatencyMs: any;
        }[];
        recommendedActions: string[];
        matrixVersion: any;
        generatedAt: string;
    };
    health(): {
        ok: boolean;
        templates: number;
        coverageRatio: number;
        generatedAt: null;
        sourceOfTruth: string;
    };
}
export function registerTemplateRegistryRoutes(app: any, registry: any): any;
export const DEFAULT_SCENARIOS: {
    id: string;
    keywords: string[];
    preferredTemplate: string;
}[];
export function safeReadJson(filePath: any, fallback?: null): any;
export function safeReadYaml(filePath: any, fallback?: null): any;
//# sourceMappingURL=heady-template-registry.d.ts.map