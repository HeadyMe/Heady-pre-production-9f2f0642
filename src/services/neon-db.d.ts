/**
 * Initialize the connection pool.
 * Uses pg Pool for standard queries. Falls back gracefully.
 */
export function connect(): Promise<{
    ok: boolean;
    serverTime: any;
    pgVersion: any;
    plan: string;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
    serverTime?: undefined;
    pgVersion?: undefined;
    plan?: undefined;
}>;
/**
 * Execute a parameterized query.
 * @param {string} text - SQL query with $1, $2 placeholders
 * @param {Array} params - Query parameters
 * @returns {Object} { ok, rows, rowCount }
 */
export function query(text: string, params?: any[]): Object;
/**
 * Run the schema migration from db/schema.sql.
 */
export function migrate(): Promise<Object | {
    ok: boolean;
    error: string;
}>;
/**
 * Graceful shutdown — drain the connection pool.
 */
export function disconnect(): Promise<void>;
export function health(): {
    service: string;
    status: string;
    plan: string;
    features: string[];
    limits: {
        computeHours: number;
        storageMb: number;
        branches: number;
        roles: string;
    };
    stats: {
        connectionCount: number;
        queryCount: number;
        lastError: any;
    };
    hasConnectionString: boolean;
    hasApiKey: boolean;
    schemaPath: string;
    ts: string;
};
/**
 * Call the Neon management API.
 * @param {string} endpoint - API path (e.g. "/projects")
 * @param {string} method - HTTP method
 * @param {Object} body - Request body
 */
export function neonApi(endpoint: string, method?: string, body?: Object): Promise<{
    ok: boolean;
    status: number;
    error: any;
    data?: undefined;
} | {
    ok: boolean;
    data: unknown;
    status?: undefined;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
    status?: undefined;
    data?: undefined;
}>;
/**
 * List Neon projects.
 */
export function listProjects(): Promise<{
    ok: boolean;
    status: number;
    error: any;
    data?: undefined;
} | {
    ok: boolean;
    data: unknown;
    status?: undefined;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
    status?: undefined;
    data?: undefined;
}>;
/**
 * Get project details.
 */
export function getProject(projectId: any): Promise<{
    ok: boolean;
    status: number;
    error: any;
    data?: undefined;
} | {
    ok: boolean;
    data: unknown;
    status?: undefined;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
    status?: undefined;
    data?: undefined;
}>;
/**
 * List branches for a project.
 */
export function listBranches(projectId: any): Promise<{
    ok: boolean;
    status: number;
    error: any;
    data?: undefined;
} | {
    ok: boolean;
    data: unknown;
    status?: undefined;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
    status?: undefined;
    data?: undefined;
}>;
/**
 * Create a database branch (Neon's killer feature).
 */
export function createBranch(projectId: any, branchName: any, parentBranchId?: null): Promise<{
    ok: boolean;
    status: number;
    error: any;
    data?: undefined;
} | {
    ok: boolean;
    data: unknown;
    status?: undefined;
    error?: undefined;
} | {
    ok: boolean;
    error: any;
    status?: undefined;
    data?: undefined;
}>;
export namespace NEON_CONFIG {
    let plan: string;
    let features: string[];
    namespace limits {
        let computeHours: number;
        let storageMb: number;
        let branches: number;
        let roles: string;
    }
}
//# sourceMappingURL=neon-db.d.ts.map