export class LiquidAllocator extends EventEmitter<[never]> {
    constructor();
    allocations: Map<any, any>;
    flowLog: any[];
    totalFlows: number;
    contextCache: Map<any, any>;
    _derivePresences(id: any, comp: any): string[];
    allocate(request?: {}): {
        id: string;
        context: {
            type: any;
            urgency: any;
            labels: any;
        };
        allocated: {
            component: string;
            affinity: number;
            presences: any;
            role: any;
        }[];
        ts: string;
    };
    getState(): {};
    getFlows(limit?: number): any[];
    persist(): void;
}
export function registerLiquidRoutes(app: any, allocator: any): void;
export function analyzeContext(request?: {}): {
    type: any;
    urgency: any;
    domain: any;
    userFacing: boolean;
    requiresCreativity: any;
    requiresSpeed: any;
    requiresDepth: any;
    requiresResilience: boolean;
    resourcePressure: any;
    tags: any;
};
export function calculateAffinity(componentId: any, context: any): number;
export const COMPONENT_REGISTRY: {
    brain: {
        capabilities: string[];
        contexts: string[];
        weight: number;
        minInstances: number;
        maxInstances: number;
        stateless: boolean;
        providers: {
            primary: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
            secondary: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
            tertiary: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
            quality: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
            fallback: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
        };
        providerPriority: string[];
    };
    soul: {
        capabilities: string[];
        contexts: string[];
        weight: number;
        minInstances: number;
        maxInstances: number;
        stateless: boolean;
        providers: {
            primary: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
            secondary: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
            fallback: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
        };
        providerPriority: string[];
    };
    conductor: {
        capabilities: string[];
        contexts: string[];
        weight: number;
        minInstances: number;
        maxInstances: number;
        stateless: boolean;
        providers: {
            primary: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
            edge: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
        };
        providerPriority: string[];
    };
    battle: {
        capabilities: string[];
        contexts: string[];
        weight: number;
        minInstances: number;
        maxInstances: number;
        stateless: boolean;
        providers: {
            racer_a: {
                service: string;
                model: string;
                cost: string;
            };
            racer_b: {
                service: string;
                model: string;
                cost: string;
            };
            racer_c: {
                service: string;
                model: string;
                cost: string;
            };
            judge: {
                service: string;
                model: string;
                cost: string;
            };
        };
        providerPriority: string[];
    };
    vinci: {
        capabilities: string[];
        contexts: string[];
        weight: number;
        minInstances: number;
        maxInstances: number;
        stateless: boolean;
        providers: {
            primary: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
            inference: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
            secondary: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
            fallback: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
        };
        providerPriority: string[];
    };
    patterns: {
        capabilities: string[];
        contexts: string[];
        weight: number;
        minInstances: number;
        maxInstances: number;
        stateless: boolean;
        alwaysPresent: boolean;
        providers: {
            primary: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
            secondary: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
        };
        providerPriority: string[];
    };
    lens: {
        capabilities: string[];
        contexts: string[];
        weight: number;
        minInstances: number;
        maxInstances: number;
        stateless: boolean;
        providers: {
            primary: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
            secondary: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
        };
        providerPriority: string[];
    };
    notion: {
        capabilities: string[];
        contexts: string[];
        weight: number;
        minInstances: number;
        maxInstances: number;
        stateless: boolean;
        providers: {
            primary: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
            inference: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
            research: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
            fallback: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
        };
        providerPriority: string[];
    };
    ops: {
        capabilities: string[];
        contexts: string[];
        weight: number;
        minInstances: number;
        maxInstances: number;
        stateless: boolean;
        providers: {
            primary: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
            ci: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
            edge: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
        };
        providerPriority: string[];
    };
    maintenance: {
        capabilities: string[];
        contexts: string[];
        weight: number;
        minInstances: number;
        maxInstances: number;
        stateless: boolean;
        providers: {
            primary: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
            secondary: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
            fallback: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
        };
        providerPriority: string[];
    };
    "auto-success": {
        capabilities: string[];
        contexts: string[];
        weight: number;
        minInstances: number;
        maxInstances: number;
        stateless: boolean;
        alwaysPresent: boolean;
        providers: {
            primary: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
            speed: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
            reasoning: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
        };
        providerPriority: string[];
    };
    stream: {
        capabilities: string[];
        contexts: string[];
        weight: number;
        minInstances: number;
        maxInstances: number;
        stateless: boolean;
        alwaysPresent: boolean;
        providers: {
            primary: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
            origin: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
        };
        providerPriority: string[];
    };
    buddy: {
        capabilities: string[];
        contexts: string[];
        weight: number;
        minInstances: number;
        maxInstances: number;
        stateless: boolean;
        providers: {
            primary: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
            inference: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
            research: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
            fallback: {
                service: string;
                model: string;
                cost: string;
                latency: string;
            };
        };
        providerPriority: string[];
    };
    cloud: {
        capabilities: string[];
        contexts: string[];
        weight: number;
        minInstances: number;
        maxInstances: number;
        stateless: boolean;
        alwaysPresent: boolean;
        providers: {
            edge: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
            origin: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
            storage: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
            ci: {
                service: string;
                platform: string;
                cost: string;
                latency: string;
            };
        };
        providerPriority: string[];
    };
};
export const STORAGE_TOPOLOGY: {
    models: {
        description: string;
        primary: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        replica: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        cache: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        priority: string[];
    };
    datasets: {
        description: string;
        primary: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        replica: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        cache: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        priority: string[];
    };
    code: {
        description: string;
        primary: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        replica: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        mirror: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        priority: string[];
    };
    "static-assets": {
        description: string;
        primary: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        replica: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        origin: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        priority: string[];
    };
    "edge-cache": {
        description: string;
        primary: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        replica: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        priority: string[];
    };
    "logs-telemetry": {
        description: string;
        primary: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        replica: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        priority: string[];
    };
    secrets: {
        description: string;
        primary: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        replica: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        priority: string[];
    };
    "user-content": {
        description: string;
        primary: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        replica: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        priority: string[];
    };
    "vector-memory": {
        description: string;
        primary: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        replica: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        cache: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        priority: string[];
    };
    notebooks: {
        description: string;
        primary: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        replica: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        backup: {
            service: string;
            platform: string;
            cost: string;
            latency: string;
        };
        priority: string[];
    };
};
export namespace HF_SPACES_TOPOLOGY {
    namespace main {
        let slug: string;
        let title: string;
        let role: string;
        namespace providers {
            namespace chat {
                let service: string;
                let model: string;
                let cost: string;
                let latency: string;
            }
            namespace code {
                let service_1: string;
                export { service_1 as service };
                let model_1: string;
                export { model_1 as model };
                let cost_1: string;
                export { cost_1 as cost };
                let latency_1: string;
                export { latency_1 as latency };
            }
            namespace speed {
                let service_2: string;
                export { service_2 as service };
                let model_2: string;
                export { model_2 as model };
                let cost_2: string;
                export { cost_2 as cost };
                let latency_2: string;
                export { latency_2 as latency };
            }
            namespace reasoning {
                let service_3: string;
                export { service_3 as service };
                let model_3: string;
                export { model_3 as model };
                let cost_3: string;
                export { cost_3 as cost };
                let latency_3: string;
                export { latency_3 as latency };
            }
            namespace quality {
                let service_4: string;
                export { service_4 as service };
                let model_4: string;
                export { model_4 as model };
                let cost_4: string;
                export { cost_4 as cost };
                let latency_4: string;
                export { latency_4 as latency };
            }
        }
        let providerPriority: string[];
        let storage: string[];
        let components: string[];
        let sharedAssets: string[];
    }
    namespace connection {
        let slug_1: string;
        export { slug_1 as slug };
        let title_1: string;
        export { title_1 as title };
        let role_1: string;
        export { role_1 as role };
        export namespace providers_1 {
            export namespace grants {
                let service_5: string;
                export { service_5 as service };
                let model_5: string;
                export { model_5 as model };
                let cost_5: string;
                export { cost_5 as cost };
                let latency_5: string;
                export { latency_5 as latency };
            }
            export namespace impact {
                let service_6: string;
                export { service_6 as service };
                let model_6: string;
                export { model_6 as model };
                let cost_6: string;
                export { cost_6 as cost };
                let latency_6: string;
                export { latency_6 as latency };
            }
            export namespace research {
                let service_7: string;
                export { service_7 as service };
                let model_7: string;
                export { model_7 as model };
                let cost_7: string;
                export { cost_7 as cost };
                let latency_7: string;
                export { latency_7 as latency };
            }
            export namespace speed_1 {
                let service_8: string;
                export { service_8 as service };
                let model_8: string;
                export { model_8 as model };
                let cost_8: string;
                export { cost_8 as cost };
                let latency_8: string;
                export { latency_8 as latency };
            }
            export { speed_1 as speed };
        }
        export { providers_1 as providers };
        let providerPriority_1: string[];
        export { providerPriority_1 as providerPriority };
        let storage_1: string[];
        export { storage_1 as storage };
        let components_1: string[];
        export { components_1 as components };
        let sharedAssets_1: string[];
        export { sharedAssets_1 as sharedAssets };
    }
    namespace systems {
        let slug_2: string;
        export { slug_2 as slug };
        let title_2: string;
        export { title_2 as title };
        let role_2: string;
        export { role_2 as role };
        export namespace providers_2 {
            namespace ops {
                let service_9: string;
                export { service_9 as service };
                let model_9: string;
                export { model_9 as model };
                let cost_9: string;
                export { cost_9 as cost };
                let latency_9: string;
                export { latency_9 as latency };
            }
            namespace monitor {
                let service_10: string;
                export { service_10 as service };
                let model_10: string;
                export { model_10 as model };
                let cost_10: string;
                export { cost_10 as cost };
                let latency_10: string;
                export { latency_10 as latency };
            }
            namespace analysis {
                let service_11: string;
                export { service_11 as service };
                let model_11: string;
                export { model_11 as model };
                let cost_11: string;
                export { cost_11 as cost };
                let latency_11: string;
                export { latency_11 as latency };
            }
            namespace deep {
                let service_12: string;
                export { service_12 as service };
                let model_12: string;
                export { model_12 as model };
                let cost_12: string;
                export { cost_12 as cost };
                let latency_12: string;
                export { latency_12 as latency };
            }
        }
        export { providers_2 as providers };
        let providerPriority_2: string[];
        export { providerPriority_2 as providerPriority };
        let storage_2: string[];
        export { storage_2 as storage };
        let components_2: string[];
        export { components_2 as components };
        let sharedAssets_2: string[];
        export { sharedAssets_2 as sharedAssets };
    }
}
import EventEmitter = require("events");
//# sourceMappingURL=hc_liquid.d.ts.map