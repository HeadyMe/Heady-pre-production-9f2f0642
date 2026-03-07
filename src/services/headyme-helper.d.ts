export class HeadyMeHelper {
    conversations: Map<any, any>;
    ticketCount: number;
    resolvedCount: number;
    escalatedCount: number;
    /**
     * Ask the helper a question. Returns answer + sources.
     */
    ask(question: any, sessionId?: null): Promise<{
        sessionId: null;
        response: string;
        confidence: any;
        sources: any;
        escalated: boolean;
        ticket?: undefined;
    } | {
        sessionId: null;
        response: string;
        confidence: any;
        sources: any;
        escalated: boolean;
        ticket: string;
    }>;
    _synthesizeAnswer(question: any, context: any): string;
    submitFeedback(sessionId: any, helpful: any, correction?: null): Promise<{
        error: string;
        feedback?: undefined;
        improved?: undefined;
    } | {
        feedback: string;
        improved: boolean;
        error?: undefined;
    }>;
    ingestDocumentation(docPath: any, content: any): Promise<void>;
    getHealth(): {
        totalTickets: number;
        resolved: number;
        escalated: number;
        resolutionRate: number;
        activeSessions: number;
    };
}
export const helper: HeadyMeHelper;
export function registerHelperRoutes(app: any): void;
//# sourceMappingURL=headyme-helper.d.ts.map