export class LLMRouter extends EventEmitter<[never]> {
    constructor(options?: {});
    options: {
        enableRacing: boolean;
        raceTimeoutMs: number;
        maxRetries: number;
        budget: {
            daily: {
                anthropic: number;
                openai: number;
                groq: number;
                perplexity: number;
                google: number;
                cloudflare: number;
                local: number;
            };
            monthly: number;
        };
    };
    _providerHealth: {};
    _circuitBreakers: {};
    _dailySpend: {
        [k: string]: number;
    };
    _monthlySpend: number;
    _lastDayReset: string;
    _connector: import("./provider-connector").ProviderConnector | null;
    _reqCounter: number;
    _getConnector(): import("./provider-connector").ProviderConnector;
    _dayKey(): string;
    _checkAndResetDaily(): void;
    _trackSpend(provider: any, costUSD: any): void;
    _isOverBudget(provider: any): boolean;
    _cbCheck(provider: any): boolean;
    _cbSuccess(provider: any): void;
    _cbFailure(provider: any): void;
    _isRateLimited(provider: any): boolean;
    _setRateLimit(provider: any, retryAfterMs: any): void;
    _getChain(taskType: any): any[];
    _isProviderAvailable(provider: any): boolean;
    _selectProvider(taskType: any): any;
    _raceProviders(prompt: any, taskType: any, opts: any): Promise<any>;
    generate(prompt: any, options?: {}): Promise<any>;
    stream(prompt: any, options?: {}): Promise<any>;
    getProviderHealth(): {};
    getBudgetStatus(): {
        daily: {
            [k: string]: number;
        };
        dailyCaps: {
            anthropic: number;
            openai: number;
            groq: number;
            perplexity: number;
            google: number;
            cloudflare: number;
            local: number;
        };
        monthly: number;
        monthlyCap: number;
        lastDayReset: string;
    };
    getRoutingMatrix(): {
        code: {
            primary: {
                provider: string;
                model: string;
            };
            fallback1: {
                provider: string;
                model: string;
            };
            fallback2: {
                provider: string;
                model: string;
            };
        };
        review: {
            primary: {
                provider: string;
                model: string;
            };
            fallback1: {
                provider: string;
                model: string;
            };
            fallback2: {
                provider: string;
                model: string;
            };
        };
        architecture: {
            primary: {
                provider: string;
                model: string;
            };
            fallback1: {
                provider: string;
                model: string;
            };
            fallback2: {
                provider: string;
                model: string;
            };
        };
        research: {
            primary: {
                provider: string;
                model: string;
            };
            fallback1: {
                provider: string;
                model: string;
            };
            fallback2: {
                provider: string;
                model: string;
            };
        };
        quick: {
            primary: {
                provider: string;
                model: string;
            };
            fallback1: {
                provider: string;
                model: string;
            };
            fallback2: {
                provider: string;
                model: string;
            };
        };
        creative: {
            primary: {
                provider: string;
                model: string;
            };
            fallback1: {
                provider: string;
                model: string;
            };
            fallback2: {
                provider: string;
                model: string;
            };
        };
        security: {
            primary: {
                provider: string;
                model: string;
            };
            fallback1: {
                provider: string;
                model: string;
            };
            fallback2: {
                provider: string;
                model: string;
            };
        };
        docs: {
            primary: {
                provider: string;
                model: string;
            };
            fallback1: {
                provider: string;
                model: string;
            };
            fallback2: {
                provider: string;
                model: string;
            };
        };
        embeddings: {
            primary: {
                provider: string;
                model: string;
            };
            fallback1: {
                provider: string;
                model: string;
            };
            fallback2: {
                provider: string;
                model: string;
            };
        };
        chat: {
            primary: {
                provider: string;
                model: string;
            };
            fallback1: {
                provider: string;
                model: string;
            };
            fallback2: {
                provider: string;
                model: string;
            };
        };
        analyze: {
            primary: {
                provider: string;
                model: string;
            };
            fallback1: {
                provider: string;
                model: string;
            };
            fallback2: {
                provider: string;
                model: string;
            };
        };
        vision: {
            primary: {
                provider: string;
                model: string;
            };
            fallback1: {
                provider: string;
                model: string;
            };
            fallback2: {
                provider: string;
                model: string;
            };
        };
    };
}
export namespace ROUTING_MATRIX {
    namespace code {
        namespace primary {
            let provider: string;
            let model: string;
        }
        namespace fallback1 {
            let provider_1: string;
            export { provider_1 as provider };
            let model_1: string;
            export { model_1 as model };
        }
        namespace fallback2 {
            let provider_2: string;
            export { provider_2 as provider };
            let model_2: string;
            export { model_2 as model };
        }
    }
    namespace review {
        export namespace primary_1 {
            let provider_3: string;
            export { provider_3 as provider };
            let model_3: string;
            export { model_3 as model };
        }
        export { primary_1 as primary };
        export namespace fallback1_1 {
            let provider_4: string;
            export { provider_4 as provider };
            let model_4: string;
            export { model_4 as model };
        }
        export { fallback1_1 as fallback1 };
        export namespace fallback2_1 {
            let provider_5: string;
            export { provider_5 as provider };
            let model_5: string;
            export { model_5 as model };
        }
        export { fallback2_1 as fallback2 };
    }
    namespace architecture {
        export namespace primary_2 {
            let provider_6: string;
            export { provider_6 as provider };
            let model_6: string;
            export { model_6 as model };
        }
        export { primary_2 as primary };
        export namespace fallback1_2 {
            let provider_7: string;
            export { provider_7 as provider };
            let model_7: string;
            export { model_7 as model };
        }
        export { fallback1_2 as fallback1 };
        export namespace fallback2_2 {
            let provider_8: string;
            export { provider_8 as provider };
            let model_8: string;
            export { model_8 as model };
        }
        export { fallback2_2 as fallback2 };
    }
    namespace research {
        export namespace primary_3 {
            let provider_9: string;
            export { provider_9 as provider };
            let model_9: string;
            export { model_9 as model };
        }
        export { primary_3 as primary };
        export namespace fallback1_3 {
            let provider_10: string;
            export { provider_10 as provider };
            let model_10: string;
            export { model_10 as model };
        }
        export { fallback1_3 as fallback1 };
        export namespace fallback2_3 {
            let provider_11: string;
            export { provider_11 as provider };
            let model_11: string;
            export { model_11 as model };
        }
        export { fallback2_3 as fallback2 };
    }
    namespace quick {
        export namespace primary_4 {
            let provider_12: string;
            export { provider_12 as provider };
            let model_12: string;
            export { model_12 as model };
        }
        export { primary_4 as primary };
        export namespace fallback1_4 {
            let provider_13: string;
            export { provider_13 as provider };
            let model_13: string;
            export { model_13 as model };
        }
        export { fallback1_4 as fallback1 };
        export namespace fallback2_4 {
            let provider_14: string;
            export { provider_14 as provider };
            let model_14: string;
            export { model_14 as model };
        }
        export { fallback2_4 as fallback2 };
    }
    namespace creative {
        export namespace primary_5 {
            let provider_15: string;
            export { provider_15 as provider };
            let model_15: string;
            export { model_15 as model };
        }
        export { primary_5 as primary };
        export namespace fallback1_5 {
            let provider_16: string;
            export { provider_16 as provider };
            let model_16: string;
            export { model_16 as model };
        }
        export { fallback1_5 as fallback1 };
        export namespace fallback2_5 {
            let provider_17: string;
            export { provider_17 as provider };
            let model_17: string;
            export { model_17 as model };
        }
        export { fallback2_5 as fallback2 };
    }
    namespace security {
        export namespace primary_6 {
            let provider_18: string;
            export { provider_18 as provider };
            let model_18: string;
            export { model_18 as model };
        }
        export { primary_6 as primary };
        export namespace fallback1_6 {
            let provider_19: string;
            export { provider_19 as provider };
            let model_19: string;
            export { model_19 as model };
        }
        export { fallback1_6 as fallback1 };
        export namespace fallback2_6 {
            let provider_20: string;
            export { provider_20 as provider };
            let model_20: string;
            export { model_20 as model };
        }
        export { fallback2_6 as fallback2 };
    }
    namespace docs {
        export namespace primary_7 {
            let provider_21: string;
            export { provider_21 as provider };
            let model_21: string;
            export { model_21 as model };
        }
        export { primary_7 as primary };
        export namespace fallback1_7 {
            let provider_22: string;
            export { provider_22 as provider };
            let model_22: string;
            export { model_22 as model };
        }
        export { fallback1_7 as fallback1 };
        export namespace fallback2_7 {
            let provider_23: string;
            export { provider_23 as provider };
            let model_23: string;
            export { model_23 as model };
        }
        export { fallback2_7 as fallback2 };
    }
    namespace embeddings {
        export namespace primary_8 {
            let provider_24: string;
            export { provider_24 as provider };
            let model_24: string;
            export { model_24 as model };
        }
        export { primary_8 as primary };
        export namespace fallback1_8 {
            let provider_25: string;
            export { provider_25 as provider };
            let model_25: string;
            export { model_25 as model };
        }
        export { fallback1_8 as fallback1 };
        export namespace fallback2_8 {
            let provider_26: string;
            export { provider_26 as provider };
            let model_26: string;
            export { model_26 as model };
        }
        export { fallback2_8 as fallback2 };
    }
    namespace chat {
        export namespace primary_9 {
            let provider_27: string;
            export { provider_27 as provider };
            let model_27: string;
            export { model_27 as model };
        }
        export { primary_9 as primary };
        export namespace fallback1_9 {
            let provider_28: string;
            export { provider_28 as provider };
            let model_28: string;
            export { model_28 as model };
        }
        export { fallback1_9 as fallback1 };
        export namespace fallback2_9 {
            let provider_29: string;
            export { provider_29 as provider };
            let model_29: string;
            export { model_29 as model };
        }
        export { fallback2_9 as fallback2 };
    }
    namespace analyze {
        export namespace primary_10 {
            let provider_30: string;
            export { provider_30 as provider };
            let model_30: string;
            export { model_30 as model };
        }
        export { primary_10 as primary };
        export namespace fallback1_10 {
            let provider_31: string;
            export { provider_31 as provider };
            let model_31: string;
            export { model_31 as model };
        }
        export { fallback1_10 as fallback1 };
        export namespace fallback2_10 {
            let provider_32: string;
            export { provider_32 as provider };
            let model_32: string;
            export { model_32 as model };
        }
        export { fallback2_10 as fallback2 };
    }
    namespace vision {
        export namespace primary_11 {
            let provider_33: string;
            export { provider_33 as provider };
            let model_33: string;
            export { model_33 as model };
        }
        export { primary_11 as primary };
        export namespace fallback1_11 {
            let provider_34: string;
            export { provider_34 as provider };
            let model_34: string;
            export { model_34 as model };
        }
        export { fallback1_11 as fallback1 };
        export namespace fallback2_11 {
            let provider_35: string;
            export { provider_35 as provider };
            let model_35: string;
            export { model_35 as model };
        }
        export { fallback2_11 as fallback2 };
    }
}
export namespace DEFAULT_BUDGET {
    namespace daily {
        let anthropic: number;
        let openai: number;
        let groq: number;
        let perplexity: number;
        let google: number;
        let cloudflare: number;
        let local: number;
    }
    let monthly: number;
}
import { EventEmitter } from "events";
//# sourceMappingURL=llm-router.d.ts.map