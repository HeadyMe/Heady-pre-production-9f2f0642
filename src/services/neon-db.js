/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * ═══════════════════════════════════════════════════════════════
 * Neon Serverless Postgres Connector
 * ═══════════════════════════════════════════════════════════════
 *
 * Connects to Neon Scale Plan serverless Postgres.
 * Uses the @neondatabase/serverless driver for HTTP-based queries
 * (no persistent TCP connection required — ideal for Cloud Run).
 *
 * Environment Variables:
 *   DATABASE_URL    — Neon connection string (postgres://...)
 *   NEON_API_KEY    — Neon platform API key for management ops
 *
 * The schema is defined in db/schema.sql (pgvector enabled).
 */

const logger = require("../utils/logger");

// ═══════════════════════════════════════════════════════════════
// Connection Configuration
// ═══════════════════════════════════════════════════════════════

const NEON_CONFIG = {
    plan: "scale",
    features: [
        "autoscaling-compute",
        "pgvector",
        "branching",
        "read-replicas",
        "logical-replication",
        "ip-allow",
    ],
    limits: {
        computeHours: 750,       // Scale plan
        storageMb: 50_000,       // 50 GB
        branches: 500,
        roles: "unlimited",
    },
};

let _pool = null;
let _neonApi = null;
let _connectionCount = 0;
let _queryCount = 0;
let _lastError = null;

// ═══════════════════════════════════════════════════════════════
// Connection Pool
// ═══════════════════════════════════════════════════════════════

function _getConnectionString() {
    return process.env.DATABASE_URL || null;
}

function _getApiKey() {
    return process.env.NEON_API_KEY || null;
}

/**
 * Initialize the connection pool.
 * Uses pg Pool for standard queries. Falls back gracefully.
 */
async function connect() {
    const connectionString = _getConnectionString();
    if (!connectionString) {
        logger.warn("[neon-db] DATABASE_URL not set — database unavailable");
        return { ok: false, error: "DATABASE_URL not set" };
    }

    try {
        // Use standard pg driver (works with Neon's Postgres-compatible endpoint)
        const { Pool } = require("pg");
        _pool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000,
        });

        // Test the connection
        const client = await _pool.connect();
        const result = await client.query("SELECT NOW() AS server_time, version() AS pg_version");
        client.release();

        _connectionCount++;
        const info = result.rows[0];

        logger.info("[neon-db] Connected to Neon Scale Plan", {
            serverTime: info.server_time,
            pgVersion: info.pg_version?.split(" ")[1],
        });

        return {
            ok: true,
            serverTime: info.server_time,
            pgVersion: info.pg_version,
            plan: NEON_CONFIG.plan,
        };
    } catch (err) {
        _lastError = err.message;
        logger.error("[neon-db] Connection failed", { error: err.message });
        return { ok: false, error: err.message };
    }
}

/**
 * Execute a parameterized query.
 * @param {string} text - SQL query with $1, $2 placeholders
 * @param {Array} params - Query parameters
 * @returns {Object} { ok, rows, rowCount }
 */
async function query(text, params = []) {
    if (!_pool) {
        const conn = await connect();
        if (!conn.ok) return { ok: false, error: conn.error, rows: [] };
    }

    try {
        _queryCount++;
        const result = await _pool.query(text, params);
        return { ok: true, rows: result.rows, rowCount: result.rowCount };
    } catch (err) {
        _lastError = err.message;
        logger.error("[neon-db] Query failed", { error: err.message, query: text.slice(0, 100) });
        return { ok: false, error: err.message, rows: [] };
    }
}

/**
 * Run the schema migration from db/schema.sql.
 */
async function migrate() {
    const fs = require("fs");
    const path = require("path");
    const schemaPath = path.join(__dirname, "..", "..", "db", "schema.sql");

    if (!fs.existsSync(schemaPath)) {
        return { ok: false, error: "db/schema.sql not found" };
    }

    const sql = fs.readFileSync(schemaPath, "utf-8");
    const result = await query(sql);

    if (result.ok) {
        logger.info("[neon-db] Schema migration complete");
    }

    return result;
}

// ═══════════════════════════════════════════════════════════════
// Neon Platform API (Management)
// ═══════════════════════════════════════════════════════════════

/**
 * Call the Neon management API.
 * @param {string} endpoint - API path (e.g. "/projects")
 * @param {string} method - HTTP method
 * @param {Object} body - Request body
 */
async function neonApi(endpoint, method = "GET", body = null) {
    const apiKey = _getApiKey();
    if (!apiKey) {
        return { ok: false, error: "NEON_API_KEY not set" };
    }

    try {
        const url = `https://console.neon.tech/api/v2${endpoint}`;
        const options = {
            method,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        };

        if (body && method !== "GET") {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            return { ok: false, status: response.status, error: data.message || JSON.stringify(data) };
        }

        return { ok: true, data };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

/**
 * List Neon projects.
 */
async function listProjects() {
    return neonApi("/projects");
}

/**
 * Get project details.
 */
async function getProject(projectId) {
    return neonApi(`/projects/${projectId}`);
}

/**
 * List branches for a project.
 */
async function listBranches(projectId) {
    return neonApi(`/projects/${projectId}/branches`);
}

/**
 * Create a database branch (Neon's killer feature).
 */
async function createBranch(projectId, branchName, parentBranchId = null) {
    const body = { branch: { name: branchName } };
    if (parentBranchId) body.branch.parent_id = parentBranchId;
    return neonApi(`/projects/${projectId}/branches`, "POST", body);
}

// ═══════════════════════════════════════════════════════════════
// Health & Status
// ═══════════════════════════════════════════════════════════════

function health() {
    return {
        service: "neon-db",
        status: _pool ? "CONNECTED" : "DISCONNECTED",
        plan: NEON_CONFIG.plan,
        features: NEON_CONFIG.features,
        limits: NEON_CONFIG.limits,
        stats: {
            connectionCount: _connectionCount,
            queryCount: _queryCount,
            lastError: _lastError,
        },
        hasConnectionString: !!_getConnectionString(),
        hasApiKey: !!_getApiKey(),
        schemaPath: "db/schema.sql",
        ts: new Date().toISOString(),
    };
}

/**
 * Graceful shutdown — drain the connection pool.
 */
async function disconnect() {
    if (_pool) {
        await _pool.end();
        _pool = null;
        logger.info("[neon-db] Connection pool closed");
    }
}

module.exports = {
    connect,
    query,
    migrate,
    disconnect,
    health,
    neonApi,
    listProjects,
    getProject,
    listBranches,
    createBranch,
    NEON_CONFIG,
};
