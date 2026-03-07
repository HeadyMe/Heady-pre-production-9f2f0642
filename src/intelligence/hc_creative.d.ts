export class HeadyCreativeEngine extends EventEmitter<[never]> {
    constructor();
    sessions: Map<any, any>;
    totalJobs: number;
    totalSucceeded: number;
    jobHistory: any[];
    maxHistory: number;
    startedAt: number;
    generate(input: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        type: any;
        input: {
            type: any;
            prompt: any;
        };
        status: string;
        model: null;
        result: null;
        startedAt: number;
        durationMs: number;
        absorbed: boolean;
    }>;
    transform(input: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        type: any;
        input: {
            type: any;
            prompt: any;
        };
        status: string;
        model: null;
        result: null;
        startedAt: number;
        durationMs: number;
        absorbed: boolean;
    }>;
    compose(pipelineId: any, input: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        type: any;
        input: {
            type: any;
            prompt: any;
        };
        status: string;
        model: null;
        result: null;
        startedAt: number;
        durationMs: number;
        absorbed: boolean;
    }>;
    analyze(input: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        type: any;
        input: {
            type: any;
            prompt: any;
        };
        status: string;
        model: null;
        result: null;
        startedAt: number;
        durationMs: number;
        absorbed: boolean;
    }>;
    remix(inputs: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        type: any;
        input: {
            type: any;
            prompt: any;
        };
        status: string;
        model: null;
        result: null;
        startedAt: number;
        durationMs: number;
        absorbed: boolean;
    }>;
    createSession(opts?: {}): {
        id: `${string}-${string}-${string}-${string}-${string}`;
        createdAt: number;
        name: any;
        style: any;
        history: never[];
        outputs: never[];
        settings: {
            defaultOutputType: any;
            quality: any;
            constraints: any;
            preferredModels: any;
        };
    };
    getSession(id: any): any;
    sessionGenerate(sessionId: any, input: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        type: any;
        input: {
            type: any;
            prompt: any;
        };
        status: string;
        model: null;
        result: null;
        startedAt: number;
        durationMs: number;
        absorbed: boolean;
    }>;
    _routeToModel(inputType: any, outputType: any): {
        model: any;
        caps: any;
        liquidFlow: any;
    } | {
        model: any;
        caps: any;
        liquidFlow?: undefined;
    };
    _executeModel(route: any, input: any): Promise<{
        type: any;
        model: any;
        provider: any;
        quality: any;
        content: string;
        prompt: any;
        ts: string;
    }>;
    _generateTags(input: any): any[];
    _analyzeStyle(input: any): {
        complexity: string;
        mood: string;
        colorPalette: string;
        genre: string;
    };
    _generateSuggestions(input: any): string[];
    _recommendModels(input: any): {
        model: string;
        provider: string;
        quality: string;
    }[];
    _createJob(type: any, input: any): {
        id: `${string}-${string}-${string}-${string}-${string}`;
        type: any;
        input: {
            type: any;
            prompt: any;
        };
        status: string;
        model: null;
        result: null;
        startedAt: number;
        durationMs: number;
        absorbed: boolean;
    };
    _recordJob(job: any): void;
    getStatus(): {
        engine: string;
        status: string;
        totalJobs: number;
        totalSucceeded: number;
        successRate: string;
        activeSessions: number;
        models: number;
        pipelines: number;
        inputTypes: number;
        outputTypes: number;
        uptime: number;
        ts: string;
    };
}
export function registerCreativeRoutes(app: any, engine: any): void;
export const MODEL_CATALOG: {
    "imagen-3": {
        provider: string;
        caps: string[];
        quality: string;
        speed: string;
    };
    "dalle-3": {
        provider: string;
        caps: string[];
        quality: string;
        speed: string;
    };
    sdxl: {
        provider: string;
        caps: string[];
        quality: string;
        speed: string;
    };
    "flux-1": {
        provider: string;
        caps: string[];
        quality: string;
        speed: string;
    };
    whisk: {
        provider: string;
        caps: string[];
        quality: string;
        speed: string;
    };
    controlnet: {
        provider: string;
        caps: string[];
        quality: string;
        speed: string;
    };
    "veo-2": {
        provider: string;
        caps: string[];
        quality: string;
        speed: string;
    };
    musicgen: {
        provider: string;
        caps: string[];
        quality: string;
        speed: string;
    };
    "gpt-4o": {
        provider: string;
        caps: string[];
        quality: string;
        speed: string;
    };
    "headypythia-pro": {
        provider: string;
        caps: string[];
        quality: string;
        speed: string;
    };
    "headyjules-opus": {
        provider: string;
        caps: string[];
        quality: string;
        speed: string;
    };
    "heady-brain": {
        provider: string;
        caps: string[];
        quality: string;
        speed: string;
    };
    "heady-vinci": {
        provider: string;
        caps: string[];
        quality: string;
        speed: string;
    };
};
export const PIPELINES: {
    "text-to-brand": {
        name: string;
        desc: string;
        steps: {
            model: string;
            input: string;
            output: string;
            action: string;
        }[];
        inputType: string;
        outputType: string;
    };
    "image-to-video": {
        name: string;
        desc: string;
        steps: {
            model: string;
            input: string;
            output: string;
            action: string;
        }[];
        inputType: string;
        outputType: string;
    };
    "sketch-to-product": {
        name: string;
        desc: string;
        steps: {
            model: string;
            input: string;
            output: string;
            action: string;
        }[];
        inputType: string;
        outputType: string;
    };
    "text-to-music-video": {
        name: string;
        desc: string;
        steps: {
            model: string;
            input: string;
            output: string;
            action: string;
        }[];
        inputType: string;
        outputType: string;
    };
    "content-remix": {
        name: string;
        desc: string;
        steps: {
            model: string;
            input: string;
            output: string;
            action: string;
        }[];
        inputType: string;
        outputType: string;
    };
    "voice-to-visuals": {
        name: string;
        desc: string;
        steps: {
            model: string;
            input: string;
            output: string;
            action: string;
        }[];
        inputType: string;
        outputType: string;
    };
    "data-to-story": {
        name: string;
        desc: string;
        steps: {
            model: string;
            input: string;
            output: string;
            action: string;
        }[];
        inputType: string;
        outputType: string;
    };
    "style-universe": {
        name: string;
        desc: string;
        steps: {
            model: string;
            input: string;
            output: string;
            action: string;
        }[];
        inputType: string;
        outputType: string;
    };
};
export const INPUT_TYPES: {
    text: {
        mime: string[];
        maxSize: string;
        desc: string;
    };
    image: {
        mime: string[];
        maxSize: string;
        desc: string;
    };
    audio: {
        mime: string[];
        maxSize: string;
        desc: string;
    };
    video: {
        mime: string[];
        maxSize: string;
        desc: string;
    };
    url: {
        mime: string[];
        maxSize: string;
        desc: string;
    };
    file: {
        mime: string[];
        maxSize: string;
        desc: string;
    };
    structured: {
        mime: string[];
        maxSize: string;
        desc: string;
    };
    sketch: {
        mime: string[];
        maxSize: string;
        desc: string;
    };
    "3d": {
        mime: string[];
        maxSize: string;
        desc: string;
    };
};
export const OUTPUT_TYPES: {
    image: {
        formats: string[];
        desc: string;
    };
    video: {
        formats: string[];
        desc: string;
    };
    audio: {
        formats: string[];
        desc: string;
    };
    text: {
        formats: string[];
        desc: string;
    };
    code: {
        formats: string[];
        desc: string;
    };
    "3d": {
        formats: string[];
        desc: string;
    };
    mixed: {
        formats: string[];
        desc: string;
    };
    metadata: {
        formats: string[];
        desc: string;
    };
};
import { EventEmitter } from "events";
//# sourceMappingURL=hc_creative.d.ts.map