declare const _exports: EdgeDiffusion;
export = _exports;
declare class EdgeDiffusion {
    modelEndpoint: string;
    generateImage(prompt: any, config?: {
        width: number;
        height: number;
        steps: number;
    }): Promise<{
        success: boolean;
        url: string;
        latency_ms: number;
        model: string;
    }>;
}
//# sourceMappingURL=edge-diffusion.d.ts.map