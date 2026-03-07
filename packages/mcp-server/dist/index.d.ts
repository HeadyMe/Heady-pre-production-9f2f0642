export interface MCPRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: any;
}
export interface MCPResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: any;
    error?: {
        code: number;
        message: string;
    };
}
export declare class MCPServer {
    private memoryStore;
    private tools;
    private startTime;
    constructor();
    private registerTools;
    handleRequest(request: MCPRequest): Promise<MCPResponse>;
}
//# sourceMappingURL=index.d.ts.map