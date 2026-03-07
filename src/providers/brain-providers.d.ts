export function chatViaOpenAI(message: any, system: any, temperature: any, max_tokens: any): Promise<any>;
export function chatViaOllama(message: any, system: any, temperature: any, max_tokens: any): Promise<any>;
export function chatViaHuggingFace(message: any, system: any, temperature: any, max_tokens: any): Promise<{
    response: any;
    model: any;
}>;
export function chatViaGemini(message: any, system: any, temperature: any, max_tokens: any): Promise<{
    response: any;
    model: string;
}>;
export function filterResponse(text: any, options?: {}): any;
export function generateContextualResponse(message: any): string;
//# sourceMappingURL=brain-providers.d.ts.map