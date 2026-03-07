export class AIDVRService {
    constructor(opts?: {});
    recorder: SessionRecorder;
    /**
     * Register HTTP routes.
     */
    registerRoutes(app: any): void;
}
export class SessionRecorder {
    constructor(maxSessions?: number);
    _sessions: Map<any, any>;
    _maxSessions: number;
    /**
     * Start recording a new session.
     */
    startSession(userId: any, metadata?: {}): string;
    /**
     * Record a frame (event) in a session.
     */
    recordFrame(sessionId: any, frame: any): boolean;
    /**
     * End a session.
     */
    endSession(sessionId: any): any;
    /**
     * Replay a session from a specific frame index.
     * Returns the dual-pane view: UI state + agent waterfall.
     */
    replay(sessionId: any, fromFrame?: number, toFrame?: null): {
        sessionId: any;
        userId: any;
        totalFrames: any;
        replayRange: {
            from: number;
            to: any;
        };
        duration: number;
        leftPane: {
            label: string;
            payloads: any;
        };
        rightPane: {
            label: string;
            waterfall: any;
        };
    } | null;
    /**
     * Search sessions by userId or metadata.
     */
    search(query: any): {
        sessionId: any;
        userId: any;
        startedAt: any;
        endedAt: any;
        frameCount: any;
        a2uiCount: any;
        mcpCount: any;
    }[];
    /**
     * Get session summary.
     */
    getSummary(sessionId: any): {
        sessionId: any;
        userId: any;
        startedAt: any;
        endedAt: any;
        totalFrames: any;
        breakdown: {
            a2ui: any;
            mcp: any;
            ternary: any;
            agentActions: any;
            other: number;
        };
        agents: any[];
    } | null;
    getStats(): {
        totalSessions: number;
        activeSessions: number;
        totalFrames: any;
    };
}
//# sourceMappingURL=ai-dvr.d.ts.map