/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Zero-Repo AST Schema — Executable Logic in pgvector ═══
 *
 * Defines the PostgreSQL schema for storing executable JSON AST blocks
 * alongside their vector embeddings and governance hashes.
 * The codebase is no longer files — it's potential stored as
 * mathematically embedded logic nodes in a locked database.
 *
 * Tables:
 *   ast_nodes — The universe of executable logic
 *   ast_edges — Relationships between nodes (imports, calls, inherits)
 *   ast_projections — Materialization records (what was compiled, when)
 *   ast_governance — Perfect Governance ledger (cryptographic stamps)
 */

'use strict';

const logger = require('../utils/logger').child('ast-schema');

/**
 * Database migration — creates the Zero-Repo AST schema.
 * Idempotent (IF NOT EXISTS everywhere).
 */
const MIGRATION_SQL = `
-- ═══════════════════════════════════════════════════════════════
-- Enable pgvector extension
-- ═══════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS vector;

-- ═══════════════════════════════════════════════════════════════
-- ast_nodes — The universe of executable logic
-- Each row is one function, class, module, or config block.
-- The AST JSON is the executable potential; the embedding is its
-- position in semantic space.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ast_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    node_path TEXT NOT NULL,              -- e.g. "src/services/vault-boot.js::bootVault"
    node_type TEXT NOT NULL,              -- function | class | module | config | template | route
    node_name TEXT NOT NULL,              -- e.g. "bootVault"
    module_name TEXT,                     -- e.g. "vault-boot"
    swarm_category TEXT,                  -- which swarm owns this (infrastructure, security, etc.)

    -- The Executable Potential
    ast_json JSONB NOT NULL,              -- Full AST in JSON (parsed by acorn/babel/esprima)
    source_hash TEXT NOT NULL,            -- SHA-256 of the original source code
    compiled_output TEXT,                 -- Cached compiled JS (filled by HologramBee on demand)
    compiled_hash TEXT,                   -- SHA-256 of compiled output
    compiled_at TIMESTAMPTZ,

    -- Vector Embedding (1536-dim for OpenAI ada-002 or 768-dim for local)
    embedding vector(1536),

    -- Governance
    governance_hash TEXT NOT NULL,        -- Perfect Governance cryptographic stamp
    governance_version INTEGER DEFAULT 1,
    governance_signed_by TEXT DEFAULT 'system',

    -- Metadata
    language TEXT DEFAULT 'javascript',
    dependencies JSONB DEFAULT '[]'::jsonb,   -- array of node_path refs this node depends on
    exports JSONB DEFAULT '[]'::jsonb,        -- what this node exports
    tags TEXT[] DEFAULT '{}',
    byte_size INTEGER DEFAULT 0,
    line_count INTEGER DEFAULT 0,

    -- Lifecycle
    status TEXT DEFAULT 'active',         -- active | deprecated | archived | glaciated
    access_count INTEGER DEFAULT 0,       -- how many times this node was materialized
    last_accessed_at TIMESTAMPTZ,
    glaciated_at TIMESTAMPTZ,             -- when GlacierBee moved this to cold storage
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_ast_nodes_path ON ast_nodes(node_path);
CREATE INDEX IF NOT EXISTS idx_ast_nodes_type ON ast_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_ast_nodes_module ON ast_nodes(module_name);
CREATE INDEX IF NOT EXISTS idx_ast_nodes_status ON ast_nodes(status);
CREATE INDEX IF NOT EXISTS idx_ast_nodes_swarm ON ast_nodes(swarm_category);
CREATE INDEX IF NOT EXISTS idx_ast_nodes_embedding ON ast_nodes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_ast_nodes_governance ON ast_nodes(governance_hash);

-- ═══════════════════════════════════════════════════════════════
-- ast_edges — Relationships between AST nodes
-- (imports, function calls, class inheritance, route wiring)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ast_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES ast_nodes(id) ON DELETE CASCADE,
    target_id UUID REFERENCES ast_nodes(id) ON DELETE CASCADE,
    edge_type TEXT NOT NULL,              -- imports | calls | extends | wires | depends
    weight FLOAT DEFAULT 1.0,            -- relationship strength
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(source_id, target_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_ast_edges_source ON ast_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_ast_edges_target ON ast_edges(target_id);

-- ═══════════════════════════════════════════════════════════════
-- ast_projections — Materialization records
-- Every time code is compiled on-demand, a record is created.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ast_projections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID REFERENCES ast_nodes(id) ON DELETE SET NULL,
    projection_target TEXT NOT NULL,      -- cloudflare-edge | cloud-run | browser | colab
    triggered_by TEXT DEFAULT 'system',   -- HologramBee | manual | api
    compiled_bytes INTEGER DEFAULT 0,
    compile_time_ms INTEGER DEFAULT 0,
    cache_hit BOOLEAN DEFAULT FALSE,
    governance_hash TEXT,
    projected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ast_projections_node ON ast_projections(node_id);
CREATE INDEX IF NOT EXISTS idx_ast_projections_target ON ast_projections(projection_target);

-- ═══════════════════════════════════════════════════════════════
-- ast_governance — Perfect Governance ledger
-- Immutable audit trail of every mutation to the AST universe.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ast_governance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID REFERENCES ast_nodes(id) ON DELETE SET NULL,
    action TEXT NOT NULL,                 -- create | update | compile | glaciate | thaw | delete
    before_hash TEXT,                     -- governance hash before mutation
    after_hash TEXT NOT NULL,             -- governance hash after mutation
    mutated_by TEXT DEFAULT 'ASTMutatorBee',
    mutation_detail JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ast_governance_node ON ast_governance(node_id);
CREATE INDEX IF NOT EXISTS idx_ast_governance_action ON ast_governance(action);
CREATE INDEX IF NOT EXISTS idx_ast_governance_time ON ast_governance(timestamp);
`;

/**
 * Run the migration against the Neon database.
 */
async function migrate(dbClient) {
    try {
        if (!dbClient) {
            const neonDb = require('./neon-db');
            const connResult = await neonDb.connect();
            if (!connResult.ok) {
                return { ok: false, error: `DB connection failed: ${connResult.error}` };
            }
            const result = await neonDb.query(MIGRATION_SQL);
            logger.info('AST schema migration complete');
            return { ok: true, tables: ['ast_nodes', 'ast_edges', 'ast_projections', 'ast_governance'] };
        }

        await dbClient.query(MIGRATION_SQL);
        logger.info('AST schema migration complete');
        return { ok: true, tables: ['ast_nodes', 'ast_edges', 'ast_projections', 'ast_governance'] };
    } catch (err) {
        logger.error(`Migration failed: ${err.message}`);
        return { ok: false, error: err.message };
    }
}

/**
 * Get the raw SQL for external execution.
 */
function getMigrationSQL() {
    return MIGRATION_SQL;
}

module.exports = { migrate, getMigrationSQL, MIGRATION_SQL };
