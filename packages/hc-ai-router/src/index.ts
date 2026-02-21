// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: index.ts                                   ║
// ║  UPDATED: 20260219-154500                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * AI Router Package Entry Point
 * Heady Systems - Intelligent Resource Allocation
 */

export * from './types';
export * from './ai-router';

import { HCAiRouter } from './ai-router';
import { AiTaskContext, ProviderChoice, AiRoutingResult } from './types';

// Singleton instance for global use
let globalRouter: HCAiRouter | null = null;

/**
 * Get or create the global AI router instance
 */
export function getAiRouter(): HCAiRouter {
  if (!globalRouter) {
    globalRouter = new HCAiRouter();
    globalRouter.initialize();
  }
  return globalRouter;
}

/**
 * Convenience function for quick routing
 */
export async function routeTask<TOutput = any>(
  kind: string,
  nodeId: string,
  prompt: string | object,
  options: Partial<AiTaskContext> = {}
): Promise<AiRoutingResult<TOutput>> {
  const router = getAiRouter();
  
  const context: AiTaskContext = {
    kind: kind as any,
    nodeId,
    ors: 85, // Default ORS
    estTokens: 1000,
    latencySensitivity: 'medium',
    importance: 'user_facing',
    traceId: `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...options
  };

  return await router.runTask<TOutput>(context, prompt);
}

/**
 * Initialize the AI Router system
 */
export async function initializeAiRouter(configPath?: string): Promise<HCAiRouter> {
  const router = new HCAiRouter(configPath);
  await router.initialize();
  globalRouter = router;
  return router;
}
