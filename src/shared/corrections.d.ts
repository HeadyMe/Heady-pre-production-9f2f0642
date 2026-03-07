export function init(): void;
export function analyzeInput(text: any): {
    signals: {
        signal: string;
        matchCount: number;
        intensity: number;
    }[];
    dominant: string;
    intensity: number;
};
export function getCorrectionSuggestion(inputAnalysis: any): {
    approach: any;
    principles: any;
    dominant: any;
    intensity: any;
    signalCount: any;
};
export function recordInteraction(input: any, analysis: any, vectorMemory: any): void;
export function getModelState(): {
    interactionCount: number;
    dominantTone: string;
    recentSignals: never[];
    lastUpdated: null;
};
export function registerRoutes(app: any): void;
//# sourceMappingURL=corrections.d.ts.map