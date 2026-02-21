"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAiRouter = getAiRouter;
exports.routeTask = routeTask;
exports.initializeAiRouter = initializeAiRouter;
/**
 * AI Router Package Entry Point
 * Heady Systems - Intelligent Resource Allocation
 */
__exportStar(require("./types"), exports);
__exportStar(require("./ai-router"), exports);
const ai_router_1 = require("./ai-router");
// Singleton instance for global use
let globalRouter = null;
/**
 * Get or create the global AI router instance
 */
function getAiRouter() {
    if (!globalRouter) {
        globalRouter = new ai_router_1.HCAiRouter();
        globalRouter.initialize();
    }
    return globalRouter;
}
/**
 * Convenience function for quick routing
 */
async function routeTask(kind, nodeId, prompt, options = {}) {
    const router = getAiRouter();
    const context = {
        kind: kind,
        nodeId,
        ors: 85, // Default ORS
        estTokens: 1000,
        latencySensitivity: 'medium',
        importance: 'user_facing',
        traceId: `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        ...options
    };
    return await router.runTask(context, prompt);
}
/**
 * Initialize the AI Router system
 */
async function initializeAiRouter(configPath) {
    const router = new ai_router_1.HCAiRouter(configPath);
    await router.initialize();
    globalRouter = router;
    return router;
}
//# sourceMappingURL=index.js.map