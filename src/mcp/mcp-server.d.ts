export = HeadyMCPServer;
declare class HeadyMCPServer {
    /**
     * @param {object} opts
     * @param {object} opts.conductor  - HeadyConductor instance (or compatible interface)
     * @param {object} [opts.logger]   - Pino/Winston-compatible logger
     */
    constructor({ conductor, logger }?: {
        conductor: object;
        logger?: object | undefined;
    });
    _conductor: object;
    _log: object;
    _registry: ToolRegistry;
    _server: Server<{
        method: string;
        params?: {
            [x: string]: unknown;
            _meta?: {
                [x: string]: unknown;
                progressToken?: string | number | undefined;
                "io.modelcontextprotocol/related-task"?: {
                    taskId: string;
                } | undefined;
            } | undefined;
        } | undefined;
    }, {
        method: string;
        params?: {
            [x: string]: unknown;
            _meta?: {
                [x: string]: unknown;
                progressToken?: string | number | undefined;
                "io.modelcontextprotocol/related-task"?: {
                    taskId: string;
                } | undefined;
            } | undefined;
        } | undefined;
    }, {
        [x: string]: unknown;
        _meta?: {
            [x: string]: unknown;
            progressToken?: string | number | undefined;
            "io.modelcontextprotocol/related-task"?: {
                taskId: string;
            } | undefined;
        } | undefined;
    }>;
    _buildDefaultLogger(): {
        info: (...a: any[]) => void;
        warn: (...a: any[]) => void;
        error: (...a: any[]) => void;
        debug: (...a: any[]) => false | void;
    };
    _registerAllTools(): void;
    _attachHandlers(): void;
    /**
     * Dispatch a tool call through the conductor or direct handlers.
     * @param {string} name
     * @param {object} args
     * @returns {Promise<object>}
     */
    _dispatch(name: string, args: object): Promise<object>;
    /**
     * Direct handler when no conductor is attached (standalone / test mode).
     */
    _handleDirect(name: any, args: any): Promise<{
        status: string;
        version: string;
        timestamp: string;
        mode: string;
        nodes: {
            total: number;
            active: number;
        };
        message: string;
        service?: undefined;
        uptime?: undefined;
        memory?: undefined;
        total?: undefined;
        budget?: undefined;
        score?: undefined;
        ready?: undefined;
        checks?: undefined;
        tool?: undefined;
        args?: undefined;
    } | {
        service: any;
        status: string;
        timestamp: string;
        uptime: number;
        memory: NodeJS.MemoryUsage;
        version?: undefined;
        mode?: undefined;
        nodes?: undefined;
        message?: undefined;
        total?: undefined;
        budget?: undefined;
        score?: undefined;
        ready?: undefined;
        checks?: undefined;
        tool?: undefined;
        args?: undefined;
    } | {
        nodes: never[];
        total: number;
        timestamp: string;
        message: string;
        status?: undefined;
        version?: undefined;
        mode?: undefined;
        service?: undefined;
        uptime?: undefined;
        memory?: undefined;
        budget?: undefined;
        score?: undefined;
        ready?: undefined;
        checks?: undefined;
        tool?: undefined;
        args?: undefined;
    } | {
        timestamp: string;
        budget: {
            total: number;
            used: number;
            remaining: number;
        };
        message: string;
        status?: undefined;
        version?: undefined;
        mode?: undefined;
        nodes?: undefined;
        service?: undefined;
        uptime?: undefined;
        memory?: undefined;
        total?: undefined;
        score?: undefined;
        ready?: undefined;
        checks?: undefined;
        tool?: undefined;
        args?: undefined;
    } | {
        score: number;
        timestamp: string;
        message: string;
        status?: undefined;
        version?: undefined;
        mode?: undefined;
        nodes?: undefined;
        service?: undefined;
        uptime?: undefined;
        memory?: undefined;
        total?: undefined;
        budget?: undefined;
        ready?: undefined;
        checks?: undefined;
        tool?: undefined;
        args?: undefined;
    } | {
        ready: boolean;
        timestamp: string;
        checks: {
            mcp_server: string;
            conductor: string;
            memory: string;
        };
        status?: undefined;
        version?: undefined;
        mode?: undefined;
        nodes?: undefined;
        message?: undefined;
        service?: undefined;
        uptime?: undefined;
        memory?: undefined;
        total?: undefined;
        budget?: undefined;
        score?: undefined;
        tool?: undefined;
        args?: undefined;
    } | {
        tool: any;
        args: any;
        timestamp: string;
        status: string;
        message: string;
        version?: undefined;
        mode?: undefined;
        nodes?: undefined;
        service?: undefined;
        uptime?: undefined;
        memory?: undefined;
        total?: undefined;
        budget?: undefined;
        score?: undefined;
        ready?: undefined;
        checks?: undefined;
    }>;
    /**
     * Attach a conductor instance after construction.
     * @param {object} conductor
     */
    setConductor(conductor: object): void;
    /**
     * Start listening on stdio transport.
     * @returns {Promise<void>}
     */
    start(): Promise<void>;
    /**
     * Gracefully shut down the server.
     * @returns {Promise<void>}
     */
    stop(): Promise<void>;
}
import ToolRegistry = require("./tool-registry");
import { Server } from "@modelcontextprotocol/sdk/server";
//# sourceMappingURL=mcp-server.d.ts.map