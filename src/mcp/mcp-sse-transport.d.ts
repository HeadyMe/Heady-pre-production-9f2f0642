export class McpSseTransport {
    constructor(opts?: {});
    oauthProvider: any;
    baseUrl: any;
    apiKey: any;
    sessions: Map<any, any>;
    router: any;
    _authenticate(req: any): any;
    _headyPost(path: any, body: any, apiKey: any): Promise<any>;
    _headyGet(path: any, apiKey: any): Promise<any>;
    _getTools(): any;
    _executeTool(name: any, args: any, apiKey: any): Promise<{
        content: {
            type: string;
            text: string;
        }[];
        isError: boolean;
    } | {
        content: {
            type: string;
            text: any;
        }[];
        isError?: undefined;
    }>;
    _handleJsonRpc(message: any, auth: any): Promise<{
        jsonrpc: string;
        id: any;
        result: {
            protocolVersion: string;
            capabilities: {
                tools: {};
                resources: {};
                prompts: {};
            };
            serverInfo: {
                name: string;
                version: string;
            };
            tools?: undefined;
            resources?: undefined;
            contents?: undefined;
            prompts?: undefined;
        };
        error?: undefined;
    } | {
        jsonrpc: string;
        id: any;
        result: {
            tools: any;
            protocolVersion?: undefined;
            capabilities?: undefined;
            serverInfo?: undefined;
            resources?: undefined;
            contents?: undefined;
            prompts?: undefined;
        };
        error?: undefined;
    } | {
        jsonrpc: string;
        id: any;
        result: {
            content: {
                type: string;
                text: string;
            }[];
            isError: boolean;
        } | {
            content: {
                type: string;
                text: any;
            }[];
            isError?: undefined;
        };
        error?: undefined;
    } | {
        jsonrpc: string;
        id: any;
        result: {
            resources: {
                uri: string;
                name: string;
                mimeType: string;
            }[];
            protocolVersion?: undefined;
            capabilities?: undefined;
            serverInfo?: undefined;
            tools?: undefined;
            contents?: undefined;
            prompts?: undefined;
        };
        error?: undefined;
    } | {
        jsonrpc: string;
        id: any;
        result: {
            contents: {
                uri: any;
                mimeType: string;
                text: string;
            }[];
            protocolVersion?: undefined;
            capabilities?: undefined;
            serverInfo?: undefined;
            tools?: undefined;
            resources?: undefined;
            prompts?: undefined;
        };
        error?: undefined;
    } | {
        jsonrpc: string;
        id: any;
        result: {
            prompts: {
                name: string;
                description: string;
            }[];
            protocolVersion?: undefined;
            capabilities?: undefined;
            serverInfo?: undefined;
            tools?: undefined;
            resources?: undefined;
            contents?: undefined;
        };
        error?: undefined;
    } | {
        jsonrpc: string;
        id: any;
        result: {
            protocolVersion?: undefined;
            capabilities?: undefined;
            serverInfo?: undefined;
            tools?: undefined;
            resources?: undefined;
            contents?: undefined;
            prompts?: undefined;
        };
        error?: undefined;
    } | {
        jsonrpc: string;
        id: any;
        error: {
            code: number;
            message: string;
        };
        result?: undefined;
    } | null>;
    _setupRoutes(): void;
    getRouter(): any;
}
//# sourceMappingURL=mcp-sse-transport.d.ts.map