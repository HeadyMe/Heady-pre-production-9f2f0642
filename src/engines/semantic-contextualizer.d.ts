export const router: any;
export function contextualize(rawMessages: any, opts?: {}): {
    ok: boolean;
    service: string;
    pipeline: string;
    context: {
        topic: any;
        significance: any;
        messageCount: any;
        classifications: any;
        tokens: any;
        content: any;
    }[];
    stats: {
        inputMessages: any;
        sanitizedMessages: any;
        meaningfulMessages: any;
        elapsedMs: number;
        tokenSavings: string;
        totalClusters: any;
        packedClusters: number;
        droppedClusters: number;
        totalTokens: number;
        compressionRatio: number;
    };
    dropped: {
        topic: any;
        significance: any;
        tokens: any;
    }[];
};
export function sanitizeMessage(message: any): {
    text: any;
    role: any;
    originalLength: any;
};
export function classifyMessage(text: any, role: any): "technical" | "context" | "decision" | "question" | "chitchat" | "metadata";
export function clusterMessages(messages: any): {
    messages: never[];
    topic: null;
    totalTokens: number;
}[];
export namespace CONFIG {
    let stripMetadataFields: string[];
    namespace piiPatterns {
        let email: RegExp;
        let phone: RegExp;
        let ssn: RegExp;
        let creditCard: RegExp;
        let ipv4: RegExp;
    }
    let maxClusterSize: number;
    let topicShiftThreshold: number;
    let slidingWindowSize: number;
    let minClusterMessages: number;
    namespace significanceWeights {
        let decision: number;
        let technical: number;
        let question: number;
        let context: number;
        let chitchat: number;
        let metadata: number;
    }
    let maxContextWindowTokens: number;
    let compressionTarget: number;
}
//# sourceMappingURL=semantic-contextualizer.d.ts.map