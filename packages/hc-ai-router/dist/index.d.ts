/**
 * AI Router Package Entry Point
 * Heady Systems - Intelligent Resource Allocation
 */
export * from './types';
export * from './ai-router';
import { HCAiRouter } from './ai-router';
import { AiTaskContext, AiRoutingResult } from './types';
/**
 * Get or create the global AI router instance
 */
export declare function getAiRouter(): HCAiRouter;
/**
 * Convenience function for quick routing
 */
export declare function routeTask<TOutput = any>(kind: string, nodeId: string, prompt: string | object, options?: Partial<AiTaskContext>): Promise<AiRoutingResult<TOutput>>;
/**
 * Initialize the AI Router system
 */
export declare function initializeAiRouter(configPath?: string): Promise<HCAiRouter>;
//# sourceMappingURL=index.d.ts.map