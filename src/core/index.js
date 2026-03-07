/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * @fileoverview Barrel export for all heady-core modules.
 * The heady-core suite replaces the following external packages:
 *   - express         → heady-server
 *   - cors            → src/middleware/cors
 *   - dotenv          → heady-env
 *   - jsonwebtoken    → heady-jwt
 *   - bcrypt          → heady-crypt
 *   - node-cron       → heady-scheduler
 *   - js-yaml         → heady-yaml
 *   - node-cache      → heady-kv
 *   - node-fetch/axios → heady-fetch
 *
 * @module src/core
 *
 * @example
 * const {
 *   headyFetch, loadEnv, createServer,
 *   sign, verify, hash, compare,
 *   defaultScheduler, defaultStore, parse, stringify
 * } = require('./src/core');
 */

// ── Environment loader ────────────────────────────────────────────────────
const headyEnv = require('./heady-env');

// ── HTTP Fetch client ─────────────────────────────────────────────────────
const headyFetchModule = require('./heady-fetch');

// ── HTTP Server ───────────────────────────────────────────────────────────
const headyServerModule = require('./heady-server');

// ── JWT ───────────────────────────────────────────────────────────────────
const headyJwt = require('./heady-jwt');

// ── Password hashing ──────────────────────────────────────────────────────
const headyCrypt = require('./heady-crypt');

// ── Task scheduler ────────────────────────────────────────────────────────
const headySchedulerModule = require('./heady-scheduler');

// ── Key-value store ───────────────────────────────────────────────────────
const headyKvModule = require('./heady-kv');

// ── YAML parser ───────────────────────────────────────────────────────────
const headyYaml = require('./heady-yaml');

// ---------------------------------------------------------------------------
// Named re-exports (tree-shakeable style)
// ---------------------------------------------------------------------------

module.exports = {
  // ── heady-env ─────────────────────────────────────────────────────────
  /** Parse a .env file string */
  parseEnv: headyEnv.parse,
  /** Load .env file into process.env */
  loadEnv: headyEnv.loadEnv,
  /** Load multiple .env files */
  loadEnvFiles: headyEnv.loadEnvFiles,
  /** Get env var or throw */
  requireEnv: headyEnv.requireEnv,
  /** Get env var with default */
  getEnv: headyEnv.getEnv,
  /** Is production? */
  isProduction: headyEnv.isProduction,
  /** Is test? */
  isTest: headyEnv.isTest,
  /** Is development? */
  isDevelopment: headyEnv.isDevelopment,

  // ── heady-fetch ───────────────────────────────────────────────────────
  /** Main fetch function with retry + circuit breaker */
  headyFetch: headyFetchModule.headyFetch || headyFetchModule,
  /** GET shorthand */
  fetchGet: (headyFetchModule.headyFetch || headyFetchModule).get,
  /** POST shorthand */
  fetchPost: (headyFetchModule.headyFetch || headyFetchModule).post,
  /** PUT shorthand */
  fetchPut: (headyFetchModule.headyFetch || headyFetchModule).put,
  /** PATCH shorthand */
  fetchPatch: (headyFetchModule.headyFetch || headyFetchModule).patch,
  /** DELETE shorthand */
  fetchDelete: (headyFetchModule.headyFetch || headyFetchModule).delete,
  /** Get circuit breaker status */
  getCircuitStatus: headyFetchModule.getCircuitStatus,
  /** Reset a specific circuit */
  resetCircuit: headyFetchModule.resetCircuit,

  // ── heady-server ──────────────────────────────────────────────────────
  /** HeadyServer class */
  HeadyServer: headyServerModule.HeadyServer,
  /** HeadyRouter class */
  HeadyRouter: headyServerModule.HeadyRouter,
  /** Create a new server instance */
  createServer: headyServerModule.createServer,
  /** MIME type map */
  MIME_TYPES: headyServerModule.MIME_TYPES,

  // ── heady-jwt ─────────────────────────────────────────────────────────
  /** Sign a JWT */
  sign: headyJwt.sign,
  /** Verify a JWT */
  verify: headyJwt.verify,
  /** Decode a JWT without verification */
  decode: headyJwt.decode,
  /** Refresh (re-sign) a JWT */
  refreshToken: headyJwt.refresh,
  /** Generate a JWT ID */
  generateJwtId: headyJwt.generateJwtId,

  // ── heady-crypt ───────────────────────────────────────────────────────
  /** Hash a password (async) */
  hash: headyCrypt.hash,
  /** Hash a password (sync) */
  hashSync: headyCrypt.hashSync,
  /** Compare password to hash (async) */
  compare: headyCrypt.compare,
  /** Compare password to hash (sync) */
  compareSync: headyCrypt.compareSync,
  /** Generate a random hex token */
  generateToken: headyCrypt.generateToken,
  /** Generate a Heady API key (hk_...) */
  generateApiKey: headyCrypt.generateApiKey,
  /** Check if hash needs re-hashing */
  needsRehash: headyCrypt.needsRehash,
  /** Timing-safe string equality */
  timingSafeEqual: headyCrypt.timingSafeEqual,

  // ── heady-scheduler ───────────────────────────────────────────────────
  /** HeadyScheduler class */
  HeadyScheduler: headySchedulerModule.HeadyScheduler,
  /** Default global scheduler */
  defaultScheduler: headySchedulerModule.defaultScheduler,
  /** Create an isolated scheduler */
  createScheduler: headySchedulerModule.createScheduler,
  /** Parse a cron expression */
  parseCronExpression: headySchedulerModule.parseCronExpression,

  // ── heady-kv ──────────────────────────────────────────────────────────
  /** HeadyKV class */
  HeadyKV: headyKvModule.HeadyKV,
  /** Create a new KV store */
  createKV: headyKvModule.createKV,
  /** Default global KV store */
  defaultStore: headyKvModule.defaultStore,

  // ── heady-yaml ────────────────────────────────────────────────────────
  /** Parse a YAML string */
  parseYaml: headyYaml.parse,
  /** Parse all YAML documents */
  parseAllYaml: headyYaml.parseAll,
  /** Stringify a value to YAML */
  stringifyYaml: headyYaml.stringify,
  /** Alias: yaml.load */
  yamlLoad: headyYaml.parse,
  /** Alias: yaml.dump */
  yamlDump: headyYaml.stringify,

  // ── Module references (for direct import) ─────────────────────────────
  /** Full heady-env module */
  env: headyEnv,
  /** Full heady-jwt module */
  jwt: headyJwt,
  /** Full heady-crypt module */
  crypt: headyCrypt,
  /** Full heady-yaml module */
  yaml: headyYaml,
};
