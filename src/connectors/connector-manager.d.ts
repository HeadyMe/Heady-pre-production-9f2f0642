export class ConnectorManager extends EventEmitter<[never]> {
    /**
     * @param {object} opts
     * @param {object}  [opts.kv]           - HeadyKV for state caching
     * @param {boolean} [opts.autoConnect=true]
     * @param {number}  [opts.healthIntervalMs=30000]
     */
    constructor(opts?: {
        kv?: object | undefined;
        autoConnect?: boolean | undefined;
        healthIntervalMs?: number | undefined;
    });
    _kv: any;
    autoConnect: boolean;
    healthIntervalMs: number;
    /** @type {Map<string, ConnectorEntry>} */
    _connectors: Map<string, ConnectorEntry>;
    /** @type {Map<string, CircuitBreaker>} */
    _breakers: Map<string, CircuitBreaker>;
    _healthTimer: NodeJS.Timeout | null;
    init(): Promise<this>;
    shutdown(): Promise<void>;
    /**
     * Register a named connector.
     * @param {string} name
     * @param {object} connector
     * @param {Function}  connector.connect      - async () => void
     * @param {Function}  connector.disconnect   - async () => void
     * @param {Function}  connector.health       - async () => { healthy, details? }
     * @param {Function}  [connector.getClient]  - () => underlying client (pool, etc.)
     * @param {object}    [connector.config]     - Connector-specific config
     */
    register(name: string, connector: {
        connect: Function;
        disconnect: Function;
        health: Function;
        getClient?: Function | undefined;
        config?: object | undefined;
    }): this;
    /**
     * Get the underlying client/pool for a connector.
     * @param {string} name
     * @returns {any}
     */
    get(name: string): any;
    /**
     * Execute a function with the connector, routing through circuit breaker.
     * @param {string}   name
     * @param {Function} fn  - async (client) => result
     */
    use(name: string, fn: Function): Promise<any>;
    /**
     * Run a health check on a connector.
     * @param {string} name
     * @returns {Promise<{ name, status, healthy, details? }>}
     */
    health(name: string): Promise<{
        name: any;
        status: any;
        healthy: any;
        details?: any;
    }>;
    /**
     * Health check all connectors.
     * @returns {Promise<object[]>}
     */
    healthAll(): Promise<object[]>;
    getStatus(name: any): {
        name: any;
        status: any;
        reconnectAttempts: any;
        lastConnectedAt: any;
        lastHealthAt: any;
        lastHealthResult: any;
        circuitBreaker: any;
    } | null;
    getAllStatuses(): ({
        name: any;
        status: any;
        reconnectAttempts: any;
        lastConnectedAt: any;
        lastHealthAt: any;
        lastHealthResult: any;
        circuitBreaker: any;
    } | null)[];
    listConnectors(): string[];
    _connect(name: any): Promise<void>;
    _disconnect(name: any): Promise<void>;
    _scheduleReconnect(name: any): void;
    _connectAll(): Promise<void>;
    _startHealthLoop(): void;
}
export const CONNECTOR_STATUS: Readonly<{
    DISCONNECTED: "disconnected";
    CONNECTING: "connecting";
    CONNECTED: "connected";
    DEGRADED: "degraded";
    ERROR: "error";
}>;
/**
 * Build a GitHub (Octokit) connector.
 * @param {object} opts - { auth, baseUrl }
 */
export function buildGitHubConnector(opts?: object): {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    health(): Promise<{
        healthy: boolean;
        details: any;
    }>;
    getClient(): any;
};
/**
 * Build a Cloudflare API connector.
 * @param {object} opts - { apiToken, accountId }
 */
export function buildCloudflareConnector(opts?: object): {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    health(): Promise<{
        healthy: boolean;
        details?: undefined;
    } | {
        healthy: any;
        details: {
            status: any;
        };
    }>;
    getClient(): {
        fetch: (path: any, init?: {}) => any;
        accountId: any;
    };
};
/**
 * Build a PostgreSQL connector via heady-neon pooler.
 * @param {object} opts - { connectionString }
 */
export function buildPostgresConnector(opts?: object): {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    health(): Promise<{
        healthy: boolean;
        details: any;
    }>;
    getClient(): any;
};
/**
 * Build a Redis connector via HeadyKV.
 * @param {object} opts - { url }
 */
export function buildRedisConnector(opts?: object): {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    health(): Promise<{
        healthy: boolean;
        details?: undefined;
    } | {
        healthy: boolean;
        details: any;
    }>;
    getClient(): any;
};
import { EventEmitter } from "events";
//# sourceMappingURL=connector-manager.d.ts.map