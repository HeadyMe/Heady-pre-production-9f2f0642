export class DeepIntelEngine extends EventEmitter<[never]> {
    constructor();
    vectorStore: VectorStore3D;
    scanHistory: any[];
    totalScans: number;
    totalFindings: number;
    nodesUsed: Set<any>;
    startedAt: number;
    deepScanProject(projectPath: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        path: any;
        startedAt: number;
        perspectives: {};
        findings: never[];
        nodesInvoked: never[];
    }>;
    deepScanComponent(componentPath: any, componentType: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        component: any;
        type: any;
        perspectives: {
            structural: {
                score: number;
                summary: string;
                depth: string;
            };
            competitive: {
                score: number;
                summary: string;
                sources: string[];
            };
            battlefield: {
                score: number;
                summary: string;
                winner: string;
                rounds: number;
            };
            simulation: {
                score: number;
                summary: string;
                scenarios: string[];
            };
        };
    }>;
    _scanPerspective(projectPath: any, perspName: any, persp: any): Promise<{
        perspective: any;
        score: number;
        summary: string;
        weight: any;
        analysisDepth: number;
        ts: number;
    }>;
    _invokeNode(nodeName: any, nodeConfig: any, scan: any): Promise<{
        node: any;
        role: any;
        finding: string;
        score: number;
        ts: number;
    }>;
    _analyzeStructure(componentPath: any): Promise<{
        score: number;
        summary: string;
        depth: string;
    }>;
    _reconBestPractice(componentType: any): Promise<{
        score: number;
        summary: string;
        sources: string[];
    }>;
    _battleTest(componentPath: any, componentType: any): Promise<{
        score: number;
        summary: string;
        winner: string;
        rounds: number;
    }>;
    _simulate(componentPath: any): Promise<{
        score: number;
        summary: string;
        scenarios: string[];
    }>;
    getStatus(): {
        engine: string;
        status: string;
        totalScans: number;
        totalFindings: number;
        nodesUsed: any[];
        vectorStore: {
            totalVectors: number;
            totalClusters: number;
            auditEntries: number;
            dimensions: {
                x: string;
                y: string;
                z: string;
            };
            avgConfidence: number;
            perspectiveCoverage: number;
        };
        perspectives: number;
        auditChainLength: number;
        uptime: number;
    };
}
export class VectorStore3D {
    vectors: Map<any, any>;
    clusters: Map<any, any>;
    auditLog: any[];
    dimensions: {
        x: string;
        y: string;
        z: string;
    };
    store(id: any, data: any, perspectives: any, position3d?: null): {
        id: any;
        position: any[];
        data: any;
        perspectives: any;
        storedAt: number;
        hash: string;
        confidence: number;
        connections: never[];
    };
    queryByPerspective(perspective: any, threshold?: number): {
        id: any;
        score: any;
        data: any;
        position: any;
    }[];
    nearestNeighbors(position: any, k?: number): {
        id: any;
        distance: number;
        data: any;
    }[];
    autoCluster(resolution?: number): Map<any, any>;
    _computePosition(data: any, perspectives: any): any[];
    _computeConfidence(perspectives: any): number;
    _distance3d(a: any, b: any): number;
    _chainHash(): string;
    getStats(): {
        totalVectors: number;
        totalClusters: number;
        auditEntries: number;
        dimensions: {
            x: string;
            y: string;
            z: string;
        };
        avgConfidence: number;
        perspectiveCoverage: number;
    };
}
export function registerDeepIntelRoutes(app: any, engine: any): void;
export namespace PERSPECTIVES {
    namespace structural {
        let desc: string;
        let weight: number;
    }
    namespace behavioral {
        let desc_1: string;
        export { desc_1 as desc };
        let weight_1: number;
        export { weight_1 as weight };
    }
    namespace performance {
        let desc_2: string;
        export { desc_2 as desc };
        let weight_2: number;
        export { weight_2 as weight };
    }
    namespace security {
        let desc_3: string;
        export { desc_3 as desc };
        let weight_3: number;
        export { weight_3 as weight };
    }
    namespace quality {
        let desc_4: string;
        export { desc_4 as desc };
        let weight_4: number;
        export { weight_4 as weight };
    }
    namespace evolutionary {
        let desc_5: string;
        export { desc_5 as desc };
        let weight_5: number;
        export { weight_5 as weight };
    }
    namespace narrative {
        let desc_6: string;
        export { desc_6 as desc };
        let weight_6: number;
        export { weight_6 as weight };
    }
    namespace competitive {
        let desc_7: string;
        export { desc_7 as desc };
        let weight_7: number;
        export { weight_7 as weight };
    }
    namespace integration {
        let desc_8: string;
        export { desc_8 as desc };
        let weight_8: number;
        export { weight_8 as weight };
    }
    namespace resilience {
        let desc_9: string;
        export { desc_9 as desc };
        let weight_9: number;
        export { weight_9 as weight };
    }
}
export namespace NODE_ROLES {
    namespace HeadyResearch {
        let role: string;
        let triggers: string[];
    }
    namespace HeadySims {
        let role_1: string;
        export { role_1 as role };
        let triggers_1: string[];
        export { triggers_1 as triggers };
    }
    namespace HeadyBattle {
        let role_2: string;
        export { role_2 as role };
        let triggers_2: string[];
        export { triggers_2 as triggers };
    }
    namespace HeadyScientific {
        let role_3: string;
        export { role_3 as role };
        let triggers_3: string[];
        export { triggers_3 as triggers };
    }
    namespace HeadyVinci {
        let role_4: string;
        export { role_4 as role };
        let triggers_4: string[];
        export { triggers_4 as triggers };
    }
    namespace HeadyBrain {
        let role_5: string;
        export { role_5 as role };
        let triggers_5: string[];
        export { triggers_5 as triggers };
    }
    namespace HeadyConductor {
        let role_6: string;
        export { role_6 as role };
        let triggers_6: string[];
        export { triggers_6 as triggers };
    }
    namespace HeadyPatterns {
        let role_7: string;
        export { role_7 as role };
        let triggers_7: string[];
        export { triggers_7 as triggers };
    }
    namespace HeadyMemory {
        let role_8: string;
        export { role_8 as role };
        let triggers_8: string[];
        export { triggers_8 as triggers };
    }
    namespace HeadySoul {
        let role_9: string;
        export { role_9 as role };
        let triggers_9: string[];
        export { triggers_9 as triggers };
    }
}
import { EventEmitter } from "events";
//# sourceMappingURL=hc_deep_intel.d.ts.map