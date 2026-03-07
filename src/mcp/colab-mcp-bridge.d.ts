#!/usr/bin/env node
export function callTool(name: any, args: any): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError?: undefined;
} | {
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
export const vectorStore: any;
export let HEADY_TOOLS: any[];
export function handleJsonRpc(msg: any, ...args: any[]): Promise<{
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
    };
    error?: undefined;
} | {
    jsonrpc: string;
    id: any;
    result: {
        tools: any[];
        protocolVersion?: undefined;
        capabilities?: undefined;
        serverInfo?: undefined;
        resources?: undefined;
        contents?: undefined;
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
        isError?: undefined;
    } | {
        content: {
            type: string;
            text: string;
        }[];
        isError: boolean;
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
//# sourceMappingURL=colab-mcp-bridge.d.ts.map