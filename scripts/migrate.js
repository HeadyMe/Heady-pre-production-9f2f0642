#!/usr/bin/env node
/**
 * =============================================================================
 * Heady Sovereign AI Platform — Database Migration Script
 * =============================================================================
 * Monorepo: github.com/HeadyMe/Heady-pre-production-9f2f0642
 * Maintained by: eric@headyconnection.org
 *
 * Usage:
 *   node scripts/migrate.js                    # run all pending migrations
 *   node scripts/migrate.js --dry-run          # print SQL, do not execute
 *   node scripts/migrate.js --rollback         # roll back last migration
 *   DATABASE_URL_DIRECT=... node scripts/migrate.js
 *
 * Design:
 *   - Pure pg library — no ORM dependency
 *   - Idempotent: safe to run multiple times (CREATE IF NOT EXISTS / DO blocks)
 *   - Transactional: each migration runs inside a BEGIN/COMMIT block
 *   - Version-tracked via schema_migrations table
 *   - Extensions and enum types created before tables
 *   - Vector indexes built after table creation (requires data to be populated
 *     for ivfflat; hnsw works on empty tables)
 * =============================================================================
 */

'use strict';

import pg from 'pg';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const { Pool } = pg;

// ─── Configuration ────────────────────────────────────────────────────────────

/** Always connect directly to Postgres (bypass PgBouncer) for migrations. */
const DATABASE_URL =
  process.env.DATABASE_URL_DIRECT ||
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER || 'heady'}:${process.env.POSTGRES_PASSWORD || 'heady'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'heady_production'}`;

const DRY_RUN    = process.argv.includes('--dry-run');
const ROLLBACK   = process.argv.includes('--rollback');
const VERBOSE    = process.argv.includes('--verbose') || process.env.LOG_LEVEL === 'debug';

// ─── Logging ──────────────────────────────────────────────────────────────────

const log = {
  info:  (...a) => console.log('[migrate]', ...a),
  ok:    (...a) => console.log('[migrate] ✓', ...a),
  warn:  (...a) => console.warn('[migrate] ⚠', ...a),
  error: (...a) => console.error('[migrate] ✗', ...a),
  debug: (...a) => VERBOSE && console.log('[migrate:debug]', ...a),
  sql:   (sql)  => VERBOSE && console.log('[migrate:sql]\n', sql.trim(), '\n'),
};

// ─── Pool setup ───────────────────────────────────────────────────────────────

function createPool() {
  const url = new URL(DATABASE_URL);
  return new Pool({
    host:     url.hostname,
    port:     parseInt(url.port || '5432', 10),
    database: url.pathname.replace(/^\//, ''),
    user:     url.username,
    password: url.password,
    ssl:      url.searchParams.get('sslmode') === 'disable'
                ? false
                : { rejectUnauthorized: false },
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis:       30_000,
    max:                     3,   // migrations don't need many connections
  });
}

// ─── SQL helpers ──────────────────────────────────────────────────────────────

async function exec(client, sql, label = '') {
  log.sql(sql);
  if (DRY_RUN) {
    log.info(`[DRY RUN] would execute: ${label || sql.trim().slice(0, 80)}`);
    return;
  }
  await client.query(sql);
}

// =============================================================================
// MIGRATIONS
// Each migration is an object with:
//   id:       string — unique, monotonically increasing (timestamp-prefixed)
//   label:    string — human description
//   up:       async (client) => void
//   down:     async (client) => void   (optional rollback)
// =============================================================================

const MIGRATIONS = [

  // ---------------------------------------------------------------------------
  // 0001 — Bootstrap: schema_migrations tracking table
  // ---------------------------------------------------------------------------
  {
    id:    '0001_schema_migrations',
    label: 'Create schema_migrations tracking table',
    async up(client) {
      await exec(client, `
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id          VARCHAR(255) PRIMARY KEY,
          label       TEXT         NOT NULL,
          applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
      `, 'schema_migrations');
    },
    async down(client) {
      await exec(client, `DROP TABLE IF EXISTS schema_migrations;`);
    },
  },

  // ---------------------------------------------------------------------------
  // 0002 — Extensions
  // ---------------------------------------------------------------------------
  {
    id:    '0002_extensions',
    label: 'Enable pgvector, uuid-ossp, pg_trgm, pgcrypto extensions',
    async up(client) {
      await exec(client, `CREATE EXTENSION IF NOT EXISTS vector;`,       'pgvector');
      await exec(client, `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,  'uuid-ossp');
      await exec(client, `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,      'pg_trgm');
      await exec(client, `CREATE EXTENSION IF NOT EXISTS pgcrypto;`,     'pgcrypto');
    },
    async down() {
      log.warn('Extension removal skipped (may break other schemas).');
    },
  },

  // ---------------------------------------------------------------------------
  // 0003 — Enum types
  // ---------------------------------------------------------------------------
  {
    id:    '0003_enum_types',
    label: 'Create enum types: user_role, user_tier, permission_level, permission_status, drift_severity',
    async up(client) {
      // Idempotent enum creation via DO block
      await exec(client, `
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
            CREATE TYPE user_role AS ENUM ('guest', 'user', 'pro', 'enterprise', 'admin');
          END IF;
        END $$;
      `, 'enum: user_role');

      await exec(client, `
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_tier') THEN
            CREATE TYPE user_tier AS ENUM ('free', 'pro', 'enterprise', 'sovereign');
          END IF;
        END $$;
      `, 'enum: user_tier');

      await exec(client, `
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_level') THEN
            CREATE TYPE permission_level AS ENUM ('read', 'write', 'execute', 'admin');
          END IF;
        END $$;
      `, 'enum: permission_level');

      await exec(client, `
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_status') THEN
            CREATE TYPE permission_status AS ENUM ('pending', 'approved', 'denied', 'revoked', 'expired');
          END IF;
        END $$;
      `, 'enum: permission_status');

      await exec(client, `
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'drift_severity') THEN
            CREATE TYPE drift_severity AS ENUM ('nominal', 'minor', 'moderate', 'critical');
          END IF;
        END $$;
      `, 'enum: drift_severity');

      await exec(client, `
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_folder') THEN
            CREATE TYPE email_folder AS ENUM ('inbox', 'sent', 'drafts', 'trash', 'spam', 'archive', 'starred');
          END IF;
        END $$;
      `, 'enum: email_folder');
    },
    async down(client) {
      for (const t of ['email_folder', 'drift_severity', 'permission_status', 'permission_level', 'user_tier', 'user_role']) {
        await exec(client, `DROP TYPE IF EXISTS ${t} CASCADE;`);
      }
    },
  },

  // ---------------------------------------------------------------------------
  // 0004 — Users table
  // ---------------------------------------------------------------------------
  {
    id:    '0004_users',
    label: 'Create users table',
    async up(client) {
      await exec(client, `
        CREATE TABLE IF NOT EXISTS users (
          id                   UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
          username             VARCHAR(64)   UNIQUE NOT NULL,
          email                VARCHAR(320)  UNIQUE NOT NULL,
          password_hash        TEXT,
          display_name         VARCHAR(128),
          avatar_url           TEXT,
          role                 user_role     NOT NULL DEFAULT 'user',
          tier                 user_tier     NOT NULL DEFAULT 'free',
          mfa_enabled          BOOLEAN       NOT NULL DEFAULT FALSE,
          mfa_secret_encrypted TEXT,
          email_verified       BOOLEAN       NOT NULL DEFAULT FALSE,
          permissions          JSONB         NOT NULL DEFAULT '{}',
          preferences          JSONB         NOT NULL DEFAULT '{}',
          onboarding_completed BOOLEAN       NOT NULL DEFAULT FALSE,
          created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
          updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
          last_login           TIMESTAMPTZ
        );

        -- Auto-update updated_at
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS users_updated_at ON users;
        CREATE TRIGGER users_updated_at
          BEFORE UPDATE ON users
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `, 'users');
    },
    async down(client) {
      await exec(client, `DROP TABLE IF EXISTS users CASCADE;`);
      await exec(client, `DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;`);
    },
  },

  // ---------------------------------------------------------------------------
  // 0005 — Sessions table
  // ---------------------------------------------------------------------------
  {
    id:    '0005_sessions',
    label: 'Create sessions table',
    async up(client) {
      await exec(client, `
        CREATE TABLE IF NOT EXISTS sessions (
          id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash   TEXT         NOT NULL UNIQUE,
          device_info  JSONB        NOT NULL DEFAULT '{}',
          ip_address   INET,
          expires_at   TIMESTAMPTZ  NOT NULL,
          created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
      `, 'sessions');
    },
    async down(client) {
      await exec(client, `DROP TABLE IF EXISTS sessions CASCADE;`);
    },
  },

  // ---------------------------------------------------------------------------
  // 0006 — Refresh tokens table
  // ---------------------------------------------------------------------------
  {
    id:    '0006_refresh_tokens',
    label: 'Create refresh_tokens table with token-family rotation support',
    async up(client) {
      await exec(client, `
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash  TEXT         NOT NULL UNIQUE,
          family_id   UUID         NOT NULL,
          is_revoked  BOOLEAN      NOT NULL DEFAULT FALSE,
          expires_at  TIMESTAMPTZ  NOT NULL,
          created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
      `, 'refresh_tokens');
    },
    async down(client) {
      await exec(client, `DROP TABLE IF EXISTS refresh_tokens CASCADE;`);
    },
  },

  // ---------------------------------------------------------------------------
  // 0007 — API keys table
  // ---------------------------------------------------------------------------
  {
    id:    '0007_api_keys',
    label: 'Create api_keys table',
    async up(client) {
      await exec(client, `
        CREATE TABLE IF NOT EXISTS api_keys (
          id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          key_hash     TEXT         NOT NULL UNIQUE,
          name         VARCHAR(128) NOT NULL,
          scopes       TEXT[]       NOT NULL DEFAULT '{}',
          last_used_at TIMESTAMPTZ,
          expires_at   TIMESTAMPTZ,
          is_revoked   BOOLEAN      NOT NULL DEFAULT FALSE,
          created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
      `, 'api_keys');
    },
    async down(client) {
      await exec(client, `DROP TABLE IF EXISTS api_keys CASCADE;`);
    },
  },

  // ---------------------------------------------------------------------------
  // 0008 — Permissions table
  // ---------------------------------------------------------------------------
  {
    id:    '0008_permissions',
    label: 'Create permissions table (resource-level RBAC grants)',
    async up(client) {
      await exec(client, `
        CREATE TABLE IF NOT EXISTS permissions (
          id               UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id          UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          resource_type    VARCHAR(64)      NOT NULL,
          resource_path    TEXT             NOT NULL,
          permission_level permission_level NOT NULL DEFAULT 'read',
          granted_by       UUID             REFERENCES users(id) ON DELETE SET NULL,
          expires_at       TIMESTAMPTZ,
          created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
        );
      `, 'permissions');
    },
    async down(client) {
      await exec(client, `DROP TABLE IF EXISTS permissions CASCADE;`);
    },
  },

  // ---------------------------------------------------------------------------
  // 0009 — Permission requests table
  // ---------------------------------------------------------------------------
  {
    id:    '0009_permission_requests',
    label: 'Create permission_requests table (approval workflow)',
    async up(client) {
      await exec(client, `
        CREATE TABLE IF NOT EXISTS permission_requests (
          id               UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id          UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          resource_type    VARCHAR(64)        NOT NULL,
          resource_path    TEXT               NOT NULL,
          requested_level  permission_level   NOT NULL,
          status           permission_status  NOT NULL DEFAULT 'pending',
          reviewed_by      UUID               REFERENCES users(id) ON DELETE SET NULL,
          created_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
          reviewed_at      TIMESTAMPTZ
        );
      `, 'permission_requests');
    },
    async down(client) {
      await exec(client, `DROP TABLE IF EXISTS permission_requests CASCADE;`);
    },
  },

  // ---------------------------------------------------------------------------
  // 0010 — Emails table
  // ---------------------------------------------------------------------------
  {
    id:    '0010_emails',
    label: 'Create emails table (sovereign encrypted email store)',
    async up(client) {
      await exec(client, `
        CREATE TABLE IF NOT EXISTS emails (
          id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id        UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          message_id     TEXT         UNIQUE,
          from_address   TEXT         NOT NULL,
          to_addresses   TEXT[]       NOT NULL DEFAULT '{}',
          subject        TEXT,
          body_encrypted BYTEA,
          headers        JSONB        NOT NULL DEFAULT '{}',
          attachments    JSONB        NOT NULL DEFAULT '[]',
          is_read        BOOLEAN      NOT NULL DEFAULT FALSE,
          is_starred     BOOLEAN      NOT NULL DEFAULT FALSE,
          folder         email_folder NOT NULL DEFAULT 'inbox',
          spam_score     FLOAT,
          created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
      `, 'emails');
    },
    async down(client) {
      await exec(client, `DROP TABLE IF EXISTS emails CASCADE;`);
    },
  },

  // ---------------------------------------------------------------------------
  // 0011 — Onboarding progress table
  // ---------------------------------------------------------------------------
  {
    id:    '0011_onboarding_progress',
    label: 'Create onboarding_progress table',
    async up(client) {
      await exec(client, `
        CREATE TABLE IF NOT EXISTS onboarding_progress (
          id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id          UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          current_step     VARCHAR(64)  NOT NULL DEFAULT 'WELCOME',
          completed_steps  TEXT[]       NOT NULL DEFAULT '{}',
          step_data        JSONB        NOT NULL DEFAULT '{}',
          started_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          completed_at     TIMESTAMPTZ,
          updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );

        DROP TRIGGER IF EXISTS onboarding_progress_updated_at ON onboarding_progress;
        CREATE TRIGGER onboarding_progress_updated_at
          BEFORE UPDATE ON onboarding_progress
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `, 'onboarding_progress');
    },
    async down(client) {
      await exec(client, `DROP TABLE IF EXISTS onboarding_progress CASCADE;`);
    },
  },

  // ---------------------------------------------------------------------------
  // 0012 — HeadyBuddy companion configs
  // ---------------------------------------------------------------------------
  {
    id:    '0012_buddy_configs',
    label: 'Create buddy_configs table (HeadyBuddy companion preferences)',
    async up(client) {
      await exec(client, `
        CREATE TABLE IF NOT EXISTS buddy_configs (
          id                     UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id                UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          companion_name         VARCHAR(64)  NOT NULL DEFAULT 'Heady',
          personality            VARCHAR(64)  NOT NULL DEFAULT 'balanced',
          memory_enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
          proactive_suggestions  BOOLEAN      NOT NULL DEFAULT TRUE,
          voice_enabled          BOOLEAN      NOT NULL DEFAULT FALSE,
          preferences            JSONB        NOT NULL DEFAULT '{}',
          created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );

        DROP TRIGGER IF EXISTS buddy_configs_updated_at ON buddy_configs;
        CREATE TRIGGER buddy_configs_updated_at
          BEFORE UPDATE ON buddy_configs
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `, 'buddy_configs');
    },
    async down(client) {
      await exec(client, `DROP TABLE IF EXISTS buddy_configs CASCADE;`);
    },
  },

  // ---------------------------------------------------------------------------
  // 0013 — HeadyBee UI configs
  // ---------------------------------------------------------------------------
  {
    id:    '0013_bee_configs',
    label: 'Create bee_configs table (HeadyBee UI template + HeadySwarm preferences)',
    async up(client) {
      await exec(client, `
        CREATE TABLE IF NOT EXISTS bee_configs (
          id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id             UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          active_template     VARCHAR(64)  NOT NULL DEFAULT 'cosmic-command',
          active_swarm        VARCHAR(64)  NOT NULL DEFAULT 'operations-swarm',
          widget_overrides    JSONB        NOT NULL DEFAULT '{}',
          theme               VARCHAR(32)  NOT NULL DEFAULT 'dark',
          color_scheme        VARCHAR(32)  NOT NULL DEFAULT 'cosmic',
          layout_preferences  JSONB        NOT NULL DEFAULT '{}',
          created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );

        DROP TRIGGER IF EXISTS bee_configs_updated_at ON bee_configs;
        CREATE TRIGGER bee_configs_updated_at
          BEFORE UPDATE ON bee_configs
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `, 'bee_configs');
    },
    async down(client) {
      await exec(client, `DROP TABLE IF EXISTS bee_configs CASCADE;`);
    },
  },

  // ---------------------------------------------------------------------------
  // 0014 — Drift history table
  // ---------------------------------------------------------------------------
  {
    id:    '0014_drift_history',
    label: 'Create drift_history table (vector drift detection records)',
    async up(client) {
      await exec(client, `
        CREATE TABLE IF NOT EXISTS drift_history (
          id                 UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
          category           VARCHAR(64)    NOT NULL,
          severity           drift_severity NOT NULL DEFAULT 'nominal',
          components         JSONB          NOT NULL DEFAULT '{}',
          cosine_similarity  FLOAT          NOT NULL,
          diagnosis          TEXT,
          remediation_taken  TEXT,
          detected_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
        );
      `, 'drift_history');
    },
    async down(client) {
      await exec(client, `DROP TABLE IF EXISTS drift_history CASCADE;`);
    },
  },

  // ---------------------------------------------------------------------------
  // 0015 — Health snapshots table
  // ---------------------------------------------------------------------------
  {
    id:    '0015_health_snapshots',
    label: 'Create health_snapshots table (periodic composite health scores)',
    async up(client) {
      await exec(client, `
        CREATE TABLE IF NOT EXISTS health_snapshots (
          id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
          overall_score    FLOAT        NOT NULL,
          component_scores JSONB        NOT NULL DEFAULT '{}',
          issues           JSONB        NOT NULL DEFAULT '[]',
          checked_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
      `, 'health_snapshots');
    },
    async down(client) {
      await exec(client, `DROP TABLE IF EXISTS health_snapshots CASCADE;`);
    },
  },

  // ---------------------------------------------------------------------------
  // 0016 — Vector memory tables (requires pgvector)
  // ---------------------------------------------------------------------------
  {
    id:    '0016_memory_vectors',
    label: 'Create memory_vectors and memory_baseline_vectors tables (384-dim pgvector)',
    async up(client) {
      const dims = parseInt(process.env.VECTOR_DIMENSIONS || '384', 10);

      await exec(client, `
        CREATE TABLE IF NOT EXISTS memory_vectors (
          id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          namespace  VARCHAR(128) NOT NULL DEFAULT 'default',
          content    TEXT         NOT NULL,
          embedding  vector(${dims}),
          metadata   JSONB        NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
      `, 'memory_vectors');

      await exec(client, `
        CREATE TABLE IF NOT EXISTS memory_baseline_vectors (
          id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
          component  VARCHAR(128) NOT NULL UNIQUE,
          embedding  vector(${dims}),
          created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
      `, 'memory_baseline_vectors');
    },
    async down(client) {
      await exec(client, `DROP TABLE IF EXISTS memory_vectors CASCADE;`);
      await exec(client, `DROP TABLE IF EXISTS memory_baseline_vectors CASCADE;`);
    },
  },

  // ---------------------------------------------------------------------------
  // 0017 — Login attempts table (brute-force tracking)
  // ---------------------------------------------------------------------------
  {
    id:    '0017_login_attempts',
    label: 'Create login_attempts table (rate limiting + lockout)',
    async up(client) {
      await exec(client, `
        CREATE TABLE IF NOT EXISTS login_attempts (
          id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
          identifier    TEXT         NOT NULL,
          ip_address    INET,
          success       BOOLEAN      NOT NULL DEFAULT FALSE,
          attempted_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
      `, 'login_attempts');
    },
    async down(client) {
      await exec(client, `DROP TABLE IF EXISTS login_attempts CASCADE;`);
    },
  },

  // ---------------------------------------------------------------------------
  // 0018 — Audit log table
  // ---------------------------------------------------------------------------
  {
    id:    '0018_audit_log',
    label: 'Create audit_log table (immutable event ledger)',
    async up(client) {
      await exec(client, `
        CREATE TABLE IF NOT EXISTS audit_log (
          id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id       UUID,
          action        VARCHAR(128) NOT NULL,
          resource_type VARCHAR(64),
          resource_id   TEXT,
          details       JSONB        NOT NULL DEFAULT '{}',
          ip_address    INET,
          created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );
      `, 'audit_log');
    },
    async down(client) {
      await exec(client, `DROP TABLE IF EXISTS audit_log CASCADE;`);
    },
  },

  // ---------------------------------------------------------------------------
  // 0019 — Indexes (btree, GIN, vector)
  // ---------------------------------------------------------------------------
  {
    id:    '0019_indexes',
    label: 'Create all indexes: btree on FKs/timestamps, GIN on JSONB, vector on embeddings',
    async up(client) {

      const idx = async (sql) => exec(client, sql);

      // ── users ──────────────────────────────────────────────────────────────
      await idx(`CREATE INDEX IF NOT EXISTS idx_users_email        ON users (email);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_users_username     ON users (username);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_users_role         ON users (role);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_users_tier         ON users (tier);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_users_created_at   ON users (created_at DESC);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_users_permissions  ON users USING GIN (permissions);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_users_preferences  ON users USING GIN (preferences);`);

      // ── sessions ───────────────────────────────────────────────────────────
      await idx(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions (user_id);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions (token_hash);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);`);

      // ── refresh_tokens ─────────────────────────────────────────────────────
      await idx(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id    ON refresh_tokens (user_id);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id  ON refresh_tokens (family_id);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);`);

      // ── api_keys ───────────────────────────────────────────────────────────
      await idx(`CREATE INDEX IF NOT EXISTS idx_api_keys_user_id   ON api_keys (user_id);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash  ON api_keys (key_hash);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_api_keys_scopes    ON api_keys USING GIN (scopes);`);

      // ── permissions ────────────────────────────────────────────────────────
      await idx(`CREATE INDEX IF NOT EXISTS idx_permissions_user_id        ON permissions (user_id);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_permissions_resource_type  ON permissions (resource_type);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_permissions_expires_at     ON permissions (expires_at);`);

      // ── permission_requests ────────────────────────────────────────────────
      await idx(`CREATE INDEX IF NOT EXISTS idx_permission_requests_user_id   ON permission_requests (user_id);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_permission_requests_status    ON permission_requests (status);`);

      // ── emails ─────────────────────────────────────────────────────────────
      await idx(`CREATE INDEX IF NOT EXISTS idx_emails_user_id     ON emails (user_id);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_emails_folder      ON emails (user_id, folder);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_emails_is_read     ON emails (user_id, is_read);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_emails_created_at  ON emails (created_at DESC);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_emails_headers     ON emails USING GIN (headers);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_emails_to_addrs    ON emails USING GIN (to_addresses);`);
      // Full-text trigram search on subject
      await idx(`CREATE INDEX IF NOT EXISTS idx_emails_subject_trgm ON emails USING GIN (subject gin_trgm_ops);`);

      // ── onboarding_progress ────────────────────────────────────────────────
      await idx(`CREATE INDEX IF NOT EXISTS idx_onboarding_user_id    ON onboarding_progress (user_id);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_onboarding_step_data  ON onboarding_progress USING GIN (step_data);`);

      // ── buddy_configs ──────────────────────────────────────────────────────
      await idx(`CREATE INDEX IF NOT EXISTS idx_buddy_configs_user_id     ON buddy_configs (user_id);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_buddy_configs_preferences ON buddy_configs USING GIN (preferences);`);

      // ── bee_configs ────────────────────────────────────────────────────────
      await idx(`CREATE INDEX IF NOT EXISTS idx_bee_configs_user_id          ON bee_configs (user_id);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_bee_configs_widget_overrides ON bee_configs USING GIN (widget_overrides);`);

      // ── drift_history ──────────────────────────────────────────────────────
      await idx(`CREATE INDEX IF NOT EXISTS idx_drift_history_detected_at  ON drift_history (detected_at DESC);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_drift_history_severity     ON drift_history (severity);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_drift_history_category     ON drift_history (category);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_drift_history_components   ON drift_history USING GIN (components);`);

      // ── health_snapshots ───────────────────────────────────────────────────
      await idx(`CREATE INDEX IF NOT EXISTS idx_health_snapshots_checked_at      ON health_snapshots (checked_at DESC);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_health_snapshots_component_scores ON health_snapshots USING GIN (component_scores);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_health_snapshots_issues           ON health_snapshots USING GIN (issues);`);

      // ── memory_vectors — HNSW (best recall; works on empty tables) ─────────
      const indexType = process.env.VECTOR_INDEX_TYPE || 'hnsw';
      const dims      = parseInt(process.env.VECTOR_DIMENSIONS || '384', 10);
      const hnswM     = parseInt(process.env.VECTOR_HNSW_M || '16', 10);
      const hnswEf    = parseInt(process.env.VECTOR_HNSW_EF_CONSTRUCTION || '64', 10);

      if (indexType === 'hnsw') {
        await idx(`
          CREATE INDEX IF NOT EXISTS idx_memory_vectors_embedding
            ON memory_vectors
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = ${hnswM}, ef_construction = ${hnswEf});
        `);
        await idx(`
          CREATE INDEX IF NOT EXISTS idx_baseline_vectors_embedding
            ON memory_baseline_vectors
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = ${hnswM}, ef_construction = ${hnswEf});
        `);
      } else {
        // ivfflat — better for large datasets; requires data for good clusters
        const lists = Math.max(100, Math.floor(dims / 4));
        await idx(`
          CREATE INDEX IF NOT EXISTS idx_memory_vectors_embedding
            ON memory_vectors
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = ${lists});
        `);
        await idx(`
          CREATE INDEX IF NOT EXISTS idx_baseline_vectors_embedding
            ON memory_baseline_vectors
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = ${lists});
        `);
      }

      await idx(`CREATE INDEX IF NOT EXISTS idx_memory_vectors_user_ns  ON memory_vectors (user_id, namespace);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_memory_vectors_metadata ON memory_vectors USING GIN (metadata);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_memory_vectors_created  ON memory_vectors (created_at DESC);`);

      // ── login_attempts ─────────────────────────────────────────────────────
      await idx(`CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier   ON login_attempts (identifier);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_login_attempts_ip           ON login_attempts (ip_address);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts (attempted_at DESC);`);

      // ── audit_log ──────────────────────────────────────────────────────────
      await idx(`CREATE INDEX IF NOT EXISTS idx_audit_log_user_id       ON audit_log (user_id);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_audit_log_action        ON audit_log (action);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_audit_log_resource_type ON audit_log (resource_type);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_audit_log_created_at    ON audit_log (created_at DESC);`);
      await idx(`CREATE INDEX IF NOT EXISTS idx_audit_log_details       ON audit_log USING GIN (details);`);
    },
    async down(client) {
      // Indexes are dropped automatically with CASCADE on their tables.
      log.warn('Indexes dropped implicitly when tables are dropped.');
    },
  },

  // ---------------------------------------------------------------------------
  // 0020 — Row-level security policies (optional hardening)
  // ---------------------------------------------------------------------------
  {
    id:    '0020_row_level_security',
    label: 'Enable row-level security on user-scoped tables',
    async up(client) {
      const tables = [
        'sessions', 'refresh_tokens', 'api_keys', 'permissions',
        'permission_requests', 'emails', 'onboarding_progress',
        'buddy_configs', 'bee_configs', 'memory_vectors',
      ];
      for (const t of tables) {
        await exec(client, `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`, `RLS: ${t}`);
        // Service role bypass — the application connects as the heady user
        await exec(client, `
          DROP POLICY IF EXISTS "${t}_service_bypass" ON ${t};
          CREATE POLICY "${t}_service_bypass"
            ON ${t}
            USING (true)
            WITH CHECK (true);
        `, `RLS policy: ${t}`);
      }
    },
    async down(client) {
      const tables = [
        'sessions', 'refresh_tokens', 'api_keys', 'permissions',
        'permission_requests', 'emails', 'onboarding_progress',
        'buddy_configs', 'bee_configs', 'memory_vectors',
      ];
      for (const t of tables) {
        await exec(client, `ALTER TABLE ${t} DISABLE ROW LEVEL SECURITY;`);
      }
    },
  },

];

// =============================================================================
// Migration runner
// =============================================================================

async function getAppliedMigrations(client) {
  const res = await client.query(
    `SELECT id FROM schema_migrations ORDER BY id ASC`
  );
  return new Set(res.rows.map(r => r.id));
}

async function markApplied(client, migration) {
  if (DRY_RUN) return;
  await client.query(
    `INSERT INTO schema_migrations (id, label) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
    [migration.id, migration.label]
  );
}

async function markReverted(client, migrationId) {
  if (DRY_RUN) return;
  await client.query(`DELETE FROM schema_migrations WHERE id = $1`, [migrationId]);
}

async function runMigrations(pool) {
  const client = await pool.connect();
  try {
    // Bootstrap: ensure schema_migrations table exists (migration 0001)
    log.info('Bootstrapping schema_migrations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id          VARCHAR(255) PRIMARY KEY,
        label       TEXT         NOT NULL,
        applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    const applied = await getAppliedMigrations(client);
    const pending = MIGRATIONS.filter(m => !applied.has(m.id));

    if (pending.length === 0) {
      log.ok('All migrations already applied. Database is up to date.');
      return;
    }

    log.info(`Found ${pending.length} pending migration(s):`);
    pending.forEach(m => log.info(`  → ${m.id}: ${m.label}`));

    for (const migration of pending) {
      log.info(`Running migration: ${migration.id} — ${migration.label}`);
      await client.query('BEGIN');
      try {
        await migration.up(client);
        await markApplied(client, migration);
        await client.query('COMMIT');
        log.ok(`Applied: ${migration.id}`);
      } catch (err) {
        await client.query('ROLLBACK');
        log.error(`Failed on ${migration.id}: ${err.message}`);
        throw err;
      }
    }

    log.ok(`All ${pending.length} migration(s) applied successfully.`);
  } finally {
    client.release();
  }
}

async function rollbackLastMigration(pool) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT id FROM schema_migrations ORDER BY applied_at DESC LIMIT 1`
    );
    if (res.rows.length === 0) {
      log.warn('No migrations to roll back.');
      return;
    }

    const lastId = res.rows[0].id;
    const migration = MIGRATIONS.find(m => m.id === lastId);

    if (!migration) {
      log.error(`Migration ${lastId} found in DB but not in code — cannot roll back.`);
      process.exit(1);
    }

    if (!migration.down) {
      log.error(`Migration ${lastId} has no rollback (down) function.`);
      process.exit(1);
    }

    log.info(`Rolling back: ${migration.id} — ${migration.label}`);
    await client.query('BEGIN');
    try {
      await migration.down(client);
      await markReverted(client, migration.id);
      await client.query('COMMIT');
      log.ok(`Rolled back: ${migration.id}`);
    } catch (err) {
      await client.query('ROLLBACK');
      log.error(`Rollback failed: ${err.message}`);
      throw err;
    }
  } finally {
    client.release();
  }
}

// =============================================================================
// Entry point
// =============================================================================

async function main() {
  if (DRY_RUN) log.warn('DRY RUN MODE — No SQL will be executed.');

  log.info(`Connecting to database (${DATABASE_URL.replace(/:[^:@]+@/, ':***@')})...`);
  const pool = createPool();

  try {
    // Verify connection
    const res = await pool.query('SELECT version()');
    log.info(`PostgreSQL: ${res.rows[0].version.split(',')[0]}`);

    if (ROLLBACK) {
      await rollbackLastMigration(pool);
    } else {
      await runMigrations(pool);
    }

    process.exit(0);
  } catch (err) {
    log.error(`Migration failed: ${err.message}`);
    if (VERBOSE) console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run when this file is executed directly (not imported)
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) main();

export { MIGRATIONS, runMigrations, rollbackLastMigration };
