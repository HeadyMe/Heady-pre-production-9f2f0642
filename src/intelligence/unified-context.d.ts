declare const _exports: UnifiedContextManager;
export = _exports;
/**
 * HeadyBrain Unified Context
 * Seamlessly syncs conversation state between HeadyBuddy (desktop)
 * and HeadyWeb (browser) via Redis PubSub and fast-path storage.
 */
declare class UnifiedContextManager {
    redis: any;
    generateSessionId(userId: any): string;
    saveContext(sessionId: any, contextPayload: any): Promise<void>;
    fetchContext(sessionId: any): Promise<any>;
}
//# sourceMappingURL=unified-context.d.ts.map