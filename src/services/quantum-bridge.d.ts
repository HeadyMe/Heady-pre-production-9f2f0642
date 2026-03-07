export class QuantumBridge {
    constructor(server: any, opts?: {});
    wss: any;
    sessions: Map<any, any>;
    _handleConnection(ws: any, sessionId: any): void;
    _processPayload(sessionId: any, ws: any, payload: any, span: any): Promise<void>;
    _consultArchetype(archetype: any, context: any): Promise<{
        archetype: any;
        resonance: number;
        insight: string;
        geometry: string;
        timestamp: number;
    }>;
    _generateMultiModalVisuals(chaosFactor: any): {
        renderMode: string;
        topology: string;
        vertices: number;
        colorPalette: {
            primary: string;
            secondary: string;
        };
        oscillationHz: number;
        goldenRatioScale: number;
    };
    /**
     * Broadcast a 3D visual resonance shift to all active sessions.
     */
    broadcastShift(shiftData: any): void;
    startHeartbeat(): void;
    interval: NodeJS.Timeout | undefined;
    stopHeartbeat(): void;
}
//# sourceMappingURL=quantum-bridge.d.ts.map