-- ============================================================================
-- Heady Liquid Architecture v3.1 — Migration 001
-- Extensions, Schemas, and Multi-Tenant Foundation
-- © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
-- ============================================================================
-- Usage:
--   psql $DATABASE_URL -f migrations/001_extensions_and_schemas.sql
--
-- This migration establishes the foundational layer:
--   1. Required PostgreSQL extensions (pgvector, pgcrypto, pg_trgm)
--   2. Schema namespace isolation per domain
--   3. Multi-tenant infrastructure with RLS
--   4. Tenant registry table
--   5. Session-level tenant context functions
-- ============================================================================

BEGIN;

-- ————————————————————————————————————————————————————————————————————————————
-- 1. Extensions
-- ————————————————————————————————————————————————————————————————————————————
CREATE EXTENSION IF NOT EXISTS vector;          -- pgvector for 384-dim embeddings
CREATE EXTENSION IF NOT EXISTS pgcrypto;        -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS pg_trgm;         -- trigram similarity for fuzzy search
CREATE EXTENSION IF NOT EXISTS btree_gist;      -- GiST index support for exclusion constraints
CREATE EXTENSION IF NOT EXISTS pg_stat_statements; -- query performance monitoring

-- ————————————————————————————————————————————————————————————————————————————
-- 2. Schema Namespaces (Domain Isolation)
-- ————————————————————————————————————————————————————————————————————————————
-- Each Heady domain gets its own schema for clean separation.
-- The public schema holds shared infrastructure (tenants, audit, etc.).

CREATE SCHEMA IF NOT EXISTS heady_core;         -- vector_memories, agent_state
CREATE SCHEMA IF NOT EXISTS heady_swarm;        -- swarm_topology, task_queue
CREATE SCHEMA IF NOT EXISTS heady_audit;        -- audit_logs, governance events
CREATE SCHEMA IF NOT EXISTS heady_pipeline;     -- pipeline runs, stage state
CREATE SCHEMA IF NOT EXISTS heady_identity;     -- tenants, users, RBAC

-- ————————————————————————————————————————————————————————————————————————————
-- 3. Tenant Registry
-- ————————————————————————————————————————————————————————————————————————————

CREATE TABLE IF NOT EXISTS heady_identity.tenants (
    tenant_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            TEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    tier            TEXT NOT NULL DEFAULT 'free'
                    CHECK (tier IN ('free', 'pro', 'enterprise', 'sovereign')),
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
    vector_quota    INTEGER NOT NULL DEFAULT 100000,      -- max vectors per tenant
    api_key_hash    TEXT,                                   -- bcrypt hash of API key
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_slug ON heady_identity.tenants (slug);
CREATE INDEX idx_tenants_active ON heady_identity.tenants (is_active) WHERE is_active = true;

-- ————————————————————————————————————————————————————————————————————————————
-- 4. Tenant Context Functions (Session-Level RLS)
-- ————————————————————————————————————————————————————————————————————————————
-- Every connection sets current_setting('app.tenant_id') before queries.
-- RLS policies reference this to enforce row-level tenant isolation.

CREATE OR REPLACE FUNCTION heady_identity.set_tenant(p_tenant_id UUID)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.tenant_id', p_tenant_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION heady_identity.current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.tenant_id', true)::UUID,
        '00000000-0000-0000-0000-000000000000'::UUID  -- system tenant fallback
    );
EXCEPTION WHEN OTHERS THEN
    RETURN '00000000-0000-0000-0000-000000000000'::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- ————————————————————————————————————————————————————————————————————————————
-- 5. Updated-at Trigger Function (reused across all tables)
-- ————————————————————————————————————————————————————————————————————————————

CREATE OR REPLACE FUNCTION heady_core.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ————————————————————————————————————————————————————————————————————————————
-- 6. System Tenant (ID = all zeros — used for platform-level operations)
-- ————————————————————————————————————————————————————————————————————————————

INSERT INTO heady_identity.tenants (tenant_id, slug, display_name, tier, vector_quota)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'system',
    'Heady System',
    'sovereign',
    999999999
)
ON CONFLICT (tenant_id) DO NOTHING;

COMMIT;
