export declare class HeadyClient {
    private apiKey;
    private baseUrl;
    constructor(apiKey: string, baseUrl?: string);
    callTool(name: string, args: any): Promise<any>;
    storeMemory(userId: string, x: number, y: number, z: number, embedding: number[], metadata: any): Promise<any>;
    queryMemory(userId: string, embedding: number[], limit?: number): Promise<any>;
    getMemoryStats(userId: string): Promise<any>;
    healthCheck(): Promise<any>;
}
//# sourceMappingURL=index.d.ts.map