export class HeadyServiceDispatcher extends EventEmitter<[never]> {
    constructor(opts?: {});
    catalog: {
        chat: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        analyze: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        embed: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        search: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        jules: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        compute: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        pythia: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        fast: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        coder: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        codex: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        copilot: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        soul: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        battle: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        patterns: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        risks: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        vinci: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        lens: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        memory: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        ops: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        maid: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        maintenance: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        notion: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        edge: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        buddy: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        research: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        huggingface: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        orchestrator: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        "auto-flow": {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        "deep-scan": {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        "auto-success": {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        health: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        liquid: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        scientist: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        qa: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        daw: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        midi: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
        spatial: {
            endpoint: string;
            method: string;
            caps: string[];
            component: string;
        };
    };
    dispatchLog: any[];
    totalDispatches: number;
    managerUrl: any;
    /**
     * Resolve which service to use based on intent or explicit name.
     * @param {string} intent - Natural language intent
     * @param {string} service - Explicit service name
     * @returns {{ serviceName: string, entry: object, confidence: number }}
     */
    resolve(intent: string, service: string): {
        serviceName: string;
        entry: object;
        confidence: number;
    };
    /**
     * Dispatch a request to the resolved service.
     * @param {{ intent?, service?, params? }} request
     * @returns {Promise<object>} result from the service
     */
    dispatch(request?: {
        intent?: any;
        service?: any;
        params?: any;
    }): Promise<object>;
    /** Get the full service catalog. */
    getCatalog(): {
        name: string;
        endpoint: string;
        method: string;
        capabilities: string[];
        component: string;
    }[];
    /** Get dispatch history. */
    getHistory(limit?: number): any[];
    /** Get dispatcher health. */
    getHealth(): {
        status: string;
        totalDispatches: number;
        totalServices: number;
        recentSuccessRate: number;
        avgLatencyMs: number;
        ts: string;
    };
}
export function registerServiceRoutes(app: any, dispatcher: any): void;
export const SERVICE_CATALOG: {
    chat: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    analyze: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    embed: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    search: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    jules: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    compute: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    pythia: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    fast: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    coder: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    codex: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    copilot: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    soul: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    battle: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    patterns: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    risks: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    vinci: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    lens: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    memory: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    ops: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    maid: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    maintenance: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    notion: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    edge: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    buddy: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    research: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    huggingface: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    orchestrator: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    "auto-flow": {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    "deep-scan": {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    "auto-success": {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    health: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    liquid: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    scientist: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    qa: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    daw: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    midi: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
    spatial: {
        endpoint: string;
        method: string;
        caps: string[];
        component: string;
    };
};
export const INTENT_KEYWORDS: {
    chat: string;
    talk: string;
    ask: string;
    converse: string;
    analyze: string;
    review: string;
    inspect: string;
    audit: string;
    embed: string;
    vector: string;
    embedding: string;
    search: string;
    find: string;
    lookup: string;
    query: string;
    code: string;
    "generate code": string;
    scaffold: string;
    build: string;
    refactor: string;
    improve: string;
    security: string;
    vulnerability: string;
    risk: string;
    scan: string;
    pattern: string;
    "design pattern": string;
    architecture: string;
    deploy: string;
    infrastructure: string;
    scale: string;
    clean: string;
    cleanup: string;
    housekeeping: string;
    backup: string;
    restore: string;
    update: string;
    vision: string;
    image: string;
    visual: string;
    detect: string;
    predict: string;
    learn: string;
    recognize: string;
    creative: string;
    think: string;
    reason: string;
    deep: string;
    complex: string;
    fast: string;
    quick: string;
    speed: string;
    instant: string;
    research: string;
    academic: string;
    "web search": string;
    notion: string;
    sync: string;
    knowledge: string;
    memory: string;
    recall: string;
    remember: string;
    battle: string;
    arena: string;
    compete: string;
    compare: string;
    soul: string;
    reflect: string;
    introspect: string;
    health: string;
    status: string;
    uptime: string;
    pipeline: string;
    "auto-flow": string;
    edge: string;
    cloudflare: string;
    "edge ai": string;
    buddy: string;
    assistant: string;
    help: string;
    model: string;
    huggingface: string;
    hub: string;
    orchestrate: string;
    coordinate: string;
    route: string;
    midi: string;
    daw: string;
    audio: string;
    osc: string;
    note: string;
    spatial: string;
    "3d": string;
    position: string;
    ump: string;
};
import EventEmitter = require("events");
//# sourceMappingURL=hc_service_dispatcher.d.ts.map