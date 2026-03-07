/*
 * © 2026 HeadySystems Inc.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ─── Heady Ecosystem Integration Map ────────────────────────────────────────
 *
 * Single source of truth for all services, repos, domains, and their
 * integration points across the entire Heady ecosystem.
 *
 * Usage:
 *   const map = require('./ecosystem-integration-map');
 *
 *   // Find service by domain
 *   const svc = map.getServiceByDomain('headymcp.com');
 *
 *   // Get all integration points for a service
 *   const edges = map.getIntegrationEdges('headymcp-core');
 *
 *   // Get full topology
 *   const topology = map.getTopology();
 *
 *   // Validate an integration path
 *   const valid = map.validatePath('headyme-core', 'headymcp-core');
 */

'use strict';

// ─── Constants ──────────────────────────────────────────────────────────────

const PHI = 1.6180339887;

const ECOSYTEM_VERSION = '3.1.0';
const SCHEMA_VERSION = '1.0.0';

// ─── Service Definitions ────────────────────────────────────────────────────

/**
 * All known Heady services, repos, and domains.
 * Each entry defines the service identity, deployment target,
 * public API surface, and internal capabilities.
 */
const SERVICES = {

  // ═══════════════════════════════════════════════════════════════
  // TIER 0 — MONOREPO (source of truth)
  // ═══════════════════════════════════════════════════════════════

  'heady-pre-production': {
    id: 'heady-pre-production',
    displayName: 'Heady Pre-Production Monorepo',
    type: 'monorepo',
    tier: 0,
    repo: 'https://github.com/HeadyMe/Heady-pre-production-9f2f0642',
    version: '3.1.0',
    runtime: 'node:22-alpine',
    deployment: 'cloud-run',
    region: 'us-central1',
    entrypoint: 'heady-manager.js',
    port: 3301,
    publicPort: 443,
    domains: [
      'headyme.com',
      'headysystems.com',
      'headyapi.com',
      'headyconnection.org',
      'headybuddy.org',
      'headymcp.com',
      'headyio.com',
      'headybot.com',
      'headyai.com',
    ],
    cloudRunEndpoint: 'https://heady-manager-609590223909.us-central1.run.app',
    status: 'active',
    capabilities: [
      'hc-full-pipeline',
      'buddy-core',
      'vector-memory',
      'self-awareness',
      'bee-factory',
      'heady-conductor',
      'sacred-geometry-orchestration',
      'ternary-logic',
      'mcp-server',
      'mcp-client',
      'llm-router',
      'creative-engine',
      'edge-diffusion',
      'auth',
      'onboarding',
      'projection-governance',
      'budget-tracker',
      'domain-router',
      'autonomous-scheduler',
    ],
    healthEndpoints: [
      '/health/live',
      '/health/ready',
      '/health/full',
      '/api/health',
      '/api/pulse',
      '/api/system/status',
    ],
    apiRoutes: [
      '/api/pipeline/run',
      '/api/pipeline/state',
      '/api/pipeline/stream/:runId',
      '/api/conductor/dispatch',
      '/api/conductor/status',
      '/api/conductor/priority',
      '/api/buddy/decide',
      '/api/buddy/status',
      '/api/buddy/health',
      '/api/buddy/mcp-tools',
      '/api/buddy/mcp-invoke',
      '/api/vector/3d/topology',
      '/api/vector/query',
      '/api/vector/store',
      '/api/vector/graph/query',
      '/api/vector/drift/check',
      '/api/vector/coherence/check',
      '/api/agents/spawn',
      '/api/agents/observe',
      '/api/llm/route',
      '/api/llm/health',
      '/api/llm/stats',
      '/api/llm/models',
      '/api/domains/resolve',
      '/api/domains/matrix',
      '/api/sdk/register',
      '/api/sdk/blueprint',
      '/api/budget/summary/:projectId',
      '/api/governance/dashboard',
      '/api/v2/ternary/classify',
      '/api/v2/ternary/stats',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // TIER 1 — CORE REPOS (projected from monorepo)
  // ═══════════════════════════════════════════════════════════════

  'headymcp-core': {
    id: 'headymcp-core',
    displayName: 'HeadyMCP — Master Control Program',
    type: 'core-service',
    tier: 1,
    repo: 'https://github.com/HeadyMe/headymcp-core',
    npmPackage: '@heady/headymcp-core',
    version: '1.0.0',
    runtime: 'node:22-alpine',
    deployment: 'cloud-run',
    region: 'us-central1',
    entrypoint: 'index.js',
    port: 3302,
    publicPort: 443,
    domains: ['headymcp.com'],
    status: 'projected', // Not yet built
    capabilities: [
      'mcp-server',
      'tool-registry',
      '31-mcp-tools',
      'zero-latency-dispatch',
      'autonomous-orchestration',
      'universal-connect',
    ],
    plannedApiRoutes: [
      '/mcp',
      '/mcp/tools',
      '/mcp/resources',
      '/mcp/prompts',
      '/mcp/sampling',
      '/health',
    ],
    upstreamDependencies: ['heady-pre-production', 'headyapi-core'],
    downstreamConsumers: ['headyme-core', 'headybuddy-core', 'headybot-core'],
    sharedModulesNeeded: ['@heady/shared', '@modelcontextprotocol/sdk'],
  },

  'headyos-core': {
    id: 'headyos-core',
    displayName: 'HeadyOS — Latent Operating System',
    type: 'core-service',
    tier: 1,
    repo: 'https://github.com/HeadyMe/headyos-core',
    npmPackage: '@heady/headyos-core',
    version: '1.0.0',
    runtime: 'node:22-alpine',
    deployment: 'cloud-run',
    region: 'us-central1',
    entrypoint: 'index.js',
    port: 3303,
    publicPort: 443,
    domains: [], // TODO: headyos.com not yet in domain table
    status: 'projected',
    capabilities: [
      'latent-reasoning',
      'persistent-memory',
      'self-evolution',
      'sacred-geometry-core',
      'process-manager',
      'memory-manager',
      'scheduler',
      'ipc-bus',
    ],
    plannedApiRoutes: [
      '/os/processes',
      '/os/memory',
      '/os/scheduler',
      '/os/events',
      '/health',
    ],
    upstreamDependencies: ['heady-pre-production'],
    downstreamConsumers: ['headysystems-core', 'headyme-core'],
    sharedModulesNeeded: ['@heady/shared'],
  },

  'headybuddy-core': {
    id: 'headybuddy-core',
    displayName: 'HeadyBuddy — AI Companion',
    type: 'core-service',
    tier: 1,
    repo: 'https://github.com/HeadyMe/headybuddy-core',
    npmPackage: '@heady/headybuddy-core',
    version: '1.0.0',
    runtime: 'node:22-alpine',
    deployment: 'cloud-run',
    region: 'us-central1',
    entrypoint: 'index.js',
    port: 3304,
    publicPort: 443,
    domains: ['headybuddy.org'],
    status: 'projected',
    capabilities: [
      'always-on-chat',
      'persistent-memory',
      'creative-suite',
      'smart-notes',
      'personality-engine',
      'voice-interface',
    ],
    plannedApiRoutes: [
      '/chat',
      '/chat/stream',
      '/embed',
      '/companion/config',
      '/companion/memory',
      '/health',
    ],
    upstreamDependencies: ['heady-pre-production', 'headymcp-core', 'headyapi-core'],
    downstreamConsumers: ['headyme-core'],
    sharedModulesNeeded: ['@heady/shared'],
  },

  'headyapi-core': {
    id: 'headyapi-core',
    displayName: 'HeadyAPI — Unified API Gateway',
    type: 'core-service',
    tier: 1,
    repo: 'https://github.com/HeadyMe/headyapi-core',
    npmPackage: '@heady/headyapi-core',
    version: '1.0.0',
    runtime: 'node:22-alpine',
    deployment: 'cloud-run',
    region: 'us-central1',
    entrypoint: 'index.js',
    port: 3305,
    publicPort: 443,
    domains: ['headyapi.com'],
    status: 'projected',
    capabilities: [
      'intelligent-routing',
      'auth-jwt',
      'auth-api-key',
      'rate-limiting',
      'analytics',
      'versioning',
      'oidc-discovery',
    ],
    plannedApiRoutes: [
      '/v1/*',
      '/v2/*',
      '/ws',
      '/health',
      '/metrics',
      '/.well-known/openid-configuration',
    ],
    upstreamDependencies: ['heady-pre-production'],
    downstreamConsumers: ['all'],
    sharedModulesNeeded: ['@heady/shared'],
  },

  'headyio-core': {
    id: 'headyio-core',
    displayName: 'HeadyIO — Developer SDK & IO',
    type: 'core-service',
    tier: 1,
    repo: 'https://github.com/HeadyMe/headyio-core',
    npmPackage: '@heady/headyio-core',
    version: '1.0.0',
    runtime: 'node:22-alpine',
    deployment: 'cloud-run',
    region: 'us-central1',
    entrypoint: 'index.js',
    port: 3306,
    publicPort: 443,
    domains: ['headyio.com'],
    status: 'projected',
    capabilities: [
      'hive-sdk',
      'sacred-geometry-sdk',
      'mcp-client',
      'connector-registry',
      'sync-engine',
      'documentation',
    ],
    plannedApiRoutes: [
      '/integrations/*',
      '/webhooks/*',
      '/sync/*',
      '/sdk',
      '/health',
    ],
    upstreamDependencies: ['heady-pre-production', 'headyapi-core'],
    downstreamConsumers: ['headyme-core'],
    sharedModulesNeeded: ['@heady/shared'],
  },

  'headybot-core': {
    id: 'headybot-core',
    displayName: 'HeadyBot — Autonomous Bot Framework',
    type: 'core-service',
    tier: 1,
    repo: 'https://github.com/HeadyMe/headybot-core',
    npmPackage: '@heady/headybot-core',
    version: '1.0.0',
    runtime: 'node:22-alpine',
    deployment: 'cloud-run',
    region: 'us-central1',
    entrypoint: 'index.js',
    port: 3307,
    publicPort: 443,
    domains: ['headybot.com'],
    status: 'projected',
    capabilities: [
      'bot-orchestrator',
      'swarm-intelligence',
      'multi-platform',
      'event-driven',
      'discord-adapter',
      'slack-adapter',
      'telegram-adapter',
    ],
    plannedApiRoutes: [
      '/bot/*',
      '/slack',
      '/discord',
      '/telegram',
      '/health',
    ],
    upstreamDependencies: ['heady-pre-production', 'headymcp-core'],
    downstreamConsumers: [],
    sharedModulesNeeded: ['@heady/shared'],
  },

  'headysystems-core': {
    id: 'headysystems-core',
    displayName: 'HeadySystems — AI Infrastructure Engine',
    type: 'core-service',
    tier: 1,
    repo: 'https://github.com/HeadyMe/headysystems-core',
    npmPackage: '@heady/headysystems-core',
    version: '1.0.0',
    runtime: 'node:22-alpine',
    deployment: 'cloud-run',
    region: 'us-central1',
    entrypoint: 'index.js',
    port: 3308,
    publicPort: 443,
    domains: ['headysystems.com'],
    status: 'projected',
    capabilities: [
      'self-healing-infrastructure',
      'buddy-orchestrator',
      'live-telemetry',
      'zero-trust-security',
      'health-monitor',
      'admin-panel',
    ],
    plannedApiRoutes: [
      '/admin',
      '/health/detailed',
      '/metrics',
      '/otel',
      '/health',
    ],
    upstreamDependencies: ['heady-pre-production', 'headyos-core'],
    downstreamConsumers: [],
    sharedModulesNeeded: ['@heady/shared'],
  },

  'headyme-core': {
    id: 'headyme-core',
    displayName: 'HeadyMe — Personal Cloud Hub',
    type: 'core-service',
    tier: 1,
    repo: 'https://github.com/HeadyMe/headyme-core',
    npmPackage: '@heady/headyme-core',
    version: '1.0.0',
    runtime: 'node:22-alpine',
    deployment: 'cloud-run',
    region: 'us-central1',
    entrypoint: 'index.js',
    port: 3309,
    publicPort: 443,
    domains: ['headyme.com'],
    status: 'projected',
    capabilities: [
      'personal-dashboard',
      'ai-memory',
      'cloud-storage',
      'cross-vertical-sync',
      'onboarding',
      'user-management',
    ],
    plannedApiRoutes: [
      '/',
      '/auth/*',
      '/onboarding/*',
      '/dashboard',
      '/settings',
      '/health',
    ],
    upstreamDependencies: [
      'heady-pre-production',
      'headyapi-core',
      'headybuddy-core',
      'headymcp-core',
      'headyio-core',
    ],
    downstreamConsumers: [],
    sharedModulesNeeded: ['@heady/shared'],
  },

  'headyconnection-core': {
    id: 'headyconnection-core',
    displayName: 'HeadyConnection — Community & Connection',
    type: 'core-service',
    tier: 1,
    repo: 'https://github.com/HeadyMe/headyconnection-core',
    npmPackage: '@heady/headyconnection-core',
    version: '1.0.0',
    runtime: 'node:22-alpine',
    deployment: 'cloud-run',
    region: 'us-central1',
    entrypoint: 'index.js',
    port: 3310,
    publicPort: 443,
    domains: ['headyconnection.org'],
    status: 'projected',
    capabilities: [
      'collaborative-workspaces',
      'knowledge-sharing',
      'community-hub',
      'deep-integration',
      'developer-portal',
      'webhook-api',
    ],
    plannedApiRoutes: [
      '/docs',
      '/sdk',
      '/webhooks',
      '/auth/callback',
      '/health',
    ],
    upstreamDependencies: ['heady-pre-production', 'headyapi-core'],
    downstreamConsumers: [],
    sharedModulesNeeded: ['@heady/shared'],
  },

  // ═══════════════════════════════════════════════════════════════
  // TIER 2 — INFRASTRUCTURE SERVICES
  // ═══════════════════════════════════════════════════════════════

  'heady-event-bus': {
    id: 'heady-event-bus',
    displayName: 'Heady Event Bus',
    type: 'infrastructure',
    tier: 2,
    repo: 'https://github.com/HeadyMe/Heady-pre-production-9f2f0642',
    file: 'heady-event-bus.js',
    status: 'new', // Provided in this deliverable
    capabilities: [
      'pub-sub',
      'cross-service-events',
      'redis-backed',
      'local-fallback',
      'replay',
      'dead-letter',
    ],
  },

  'heady-service-mesh': {
    id: 'heady-service-mesh',
    displayName: 'Heady Service Mesh',
    type: 'infrastructure',
    tier: 2,
    repo: 'https://github.com/HeadyMe/Heady-pre-production-9f2f0642',
    file: 'heady-service-mesh.js',
    status: 'new',
    capabilities: [
      'service-discovery',
      'load-balancing',
      'circuit-breaking',
      'mTLS',
      'health-checking',
    ],
  },

  'heady-config-server': {
    id: 'heady-config-server',
    displayName: 'Heady Config Server',
    type: 'infrastructure',
    tier: 2,
    repo: 'https://github.com/HeadyMe/Heady-pre-production-9f2f0642',
    file: 'heady-config-server.js',
    status: 'new',
    capabilities: [
      'runtime-config',
      'hot-reload',
      'environment-tiers',
      'secret-management',
      'config-versioning',
    ],
  },

  'heady-observability': {
    id: 'heady-observability',
    displayName: 'Heady Observability',
    type: 'infrastructure',
    tier: 2,
    repo: 'https://github.com/HeadyMe/Heady-pre-production-9f2f0642',
    file: 'heady-observability.js',
    status: 'new',
    capabilities: [
      'distributed-tracing',
      'metrics',
      'structured-logging',
      'span-correlation',
      'prometheus-export',
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // TIER 3 — EXTERNAL INFRASTRUCTURE
  // ═══════════════════════════════════════════════════════════════

  'cloudflare-edge': {
    id: 'cloudflare-edge',
    displayName: 'Cloudflare Edge Workers',
    type: 'edge',
    tier: 3,
    deployment: 'cloudflare',
    status: 'active',
    capabilities: [
      'rate-limiting',
      'routing',
      'security-headers',
      'cache',
      'maintenance-mode',
      'country-blocking',
    ],
    endpoint: 'https://heady.headyme.com',
  },

  'google-cloud-run': {
    id: 'google-cloud-run',
    displayName: 'Google Cloud Run',
    type: 'cloud-platform',
    tier: 3,
    deployment: 'gcp',
    region: 'us-central1',
    status: 'active',
    capabilities: [
      'container-hosting',
      'auto-scaling',
      'blue-green-deploy',
      'secret-manager',
      'cloud-sql',
      'memorystore',
      'pub-sub',
      'artifact-registry',
    ],
  },

  'postgresql-pgvector': {
    id: 'postgresql-pgvector',
    displayName: 'PostgreSQL 16 + pgvector',
    type: 'database',
    tier: 3,
    deployment: 'cloud-sql',
    status: 'active',
    capabilities: [
      'vector-storage',
      'hnsw-index',
      'row-level-security',
      'user-management',
      'sessions',
      'audit-log',
      'drift-history',
    ],
    tables: [
      'users', 'sessions', 'refresh_tokens', 'api_keys',
      'permissions', 'permission_requests',
      'emails', 'onboarding_progress', 'buddy_configs', 'bee_configs',
      'drift_history', 'health_snapshots',
      'memory_vectors', 'memory_baseline_vectors',
      'login_attempts', 'audit_log',
      'schema_migrations',
    ],
  },

  'redis': {
    id: 'redis',
    displayName: 'Redis 7 (Memorystore)',
    type: 'cache',
    tier: 3,
    deployment: 'cloud-memorystore',
    status: 'active',
    capabilities: [
      'session-store',
      'rate-limiting',
      'task-locks',
      'ephemeral-ternary-cache',
      'onboarding-progress',
      'pubsub-backend',
    ],
  },

  'huggingface-spaces': {
    id: 'huggingface-spaces',
    displayName: 'HuggingFace Spaces',
    type: 'ml-platform',
    tier: 3,
    deployment: 'huggingface',
    status: 'active',
    spaces: ['heady-ai', 'heady-demo', 'heady-systems', 'heady-connection'],
    capabilities: [
      'demo-hosting',
      'gradio-interfaces',
      'model-inference',
    ],
  },
};

// ─── Integration Edges ──────────────────────────────────────────────────────

/**
 * Directed integration edges defining how services communicate.
 * Each edge specifies: source → target, protocol, auth, and data flow.
 */
const INTEGRATION_EDGES = [

  // ── Monorepo → Databases ──────────────────────────────────────────────────
  {
    id: 'edge:monorepo→postgres',
    source: 'heady-pre-production',
    target: 'postgresql-pgvector',
    protocol: 'postgres-wire',
    auth: 'password+tls',
    dataFlow: 'bidirectional',
    purpose: 'primary persistence (users, sessions, vectors)',
    status: 'active',
  },
  {
    id: 'edge:monorepo→redis',
    source: 'heady-pre-production',
    target: 'redis',
    protocol: 'redis-resp',
    auth: 'password',
    dataFlow: 'bidirectional',
    purpose: 'session store, rate limiting, task locks',
    status: 'active',
  },

  // ── Cloudflare → Monorepo ──────────────────────────────────────────────────
  {
    id: 'edge:cloudflare→monorepo',
    source: 'cloudflare-edge',
    target: 'heady-pre-production',
    protocol: 'https',
    auth: 'cf-tunnel',
    dataFlow: 'request-response',
    purpose: 'route all 9 domains to Cloud Run origin',
    status: 'active',
    rateLimit: { unauthenticated: '100/min', authenticated: '500/min' },
  },

  // ── Pipeline → Self-Awareness ─────────────────────────────────────────────
  {
    id: 'edge:pipeline→self-awareness',
    source: 'hc-full-pipeline',
    target: 'self-awareness',
    protocol: 'in-process-events',
    auth: 'none',
    dataFlow: 'push',
    purpose: 'telemetry ingestion for metacognitive loop',
    status: 'active',
    events: [
      'stage:completed', 'stage:failed', 'self-heal:match',
      'run:completed', 'run:failed',
    ],
  },

  // ── Buddy → Conductor ────────────────────────────────────────────────────
  {
    id: 'edge:buddy→conductor',
    source: 'buddy-core',
    target: 'heady-conductor',
    protocol: 'in-process',
    auth: 'none',
    dataFlow: 'request-response',
    purpose: 'task routing via sacred geometry',
    status: 'active',
  },

  // ── Buddy → Vector Memory ────────────────────────────────────────────────
  {
    id: 'edge:buddy→vectormemory',
    source: 'buddy-core',
    target: 'vector-memory',
    protocol: 'in-process',
    auth: 'none',
    dataFlow: 'bidirectional',
    purpose: 'error resolution semantic search, rule ingestion',
    status: 'active',
  },

  // ── Core Repos → API Gateway ─────────────────────────────────────────────
  {
    id: 'edge:cores→headyapi',
    source: 'all-core-repos',
    target: 'headyapi-core',
    protocol: 'https',
    auth: 'jwt+api-key',
    dataFlow: 'request-response',
    purpose: 'unified API access with auth and rate limiting',
    status: 'planned',
  },

  // ── HeadyMe → HeadyBuddy ─────────────────────────────────────────────────
  {
    id: 'edge:headyme→headybuddy',
    source: 'headyme-core',
    target: 'headybuddy-core',
    protocol: 'https+websocket',
    auth: 'jwt',
    dataFlow: 'bidirectional',
    purpose: 'companion chat, memory access, creative tools',
    status: 'planned',
  },

  // ── HeadyMe → HeadyMCP ───────────────────────────────────────────────────
  {
    id: 'edge:headyme→headymcp',
    source: 'headyme-core',
    target: 'headymcp-core',
    protocol: 'mcp',
    auth: 'jwt',
    dataFlow: 'bidirectional',
    purpose: 'tool invocation from user dashboard',
    status: 'planned',
  },

  // ── HeadyBot → HeadyMCP ──────────────────────────────────────────────────
  {
    id: 'edge:headybot→headymcp',
    source: 'headybot-core',
    target: 'headymcp-core',
    protocol: 'mcp',
    auth: 'api-key',
    dataFlow: 'bidirectional',
    purpose: 'bots use MCP tools for AI capabilities',
    status: 'planned',
  },

  // ── Event Bus (cross-service) ────────────────────────────────────────────
  {
    id: 'edge:eventbus',
    source: 'heady-event-bus',
    target: 'all-services',
    protocol: 'redis-pubsub+websocket',
    auth: 'internal-token',
    dataFlow: 'bidirectional',
    purpose: 'cross-service event propagation',
    status: 'new',
    topics: [
      'heady.pipeline.*',
      'heady.bee.*',
      'heady.system.*',
      'heady.alert.*',
      'heady.user.*',
    ],
  },

  // ── Observability → All Services ─────────────────────────────────────────
  {
    id: 'edge:observability',
    source: 'heady-observability',
    target: 'all-services',
    protocol: 'in-process+otel',
    auth: 'none',
    dataFlow: 'push',
    purpose: 'distributed tracing, metrics, structured logs',
    status: 'new',
  },

  // ── Service Mesh ─────────────────────────────────────────────────────────
  {
    id: 'edge:service-mesh',
    source: 'heady-service-mesh',
    target: 'all-core-repos',
    protocol: 'https+hmac',
    auth: 'hmac-sha256',
    dataFlow: 'request-response',
    purpose: 'service discovery, routing, circuit breaking',
    status: 'new',
  },
];

// ─── Domain → Service Map ───────────────────────────────────────────────────

const DOMAIN_MAP = {
  'headyme.com':         { service: 'headyme-core',         primaryPurpose: 'Consumer-facing app, onboarding entry point' },
  'headyapi.com':        { service: 'headyapi-core',         primaryPurpose: 'Public REST + WebSocket API' },
  'headysystems.com':    { service: 'headysystems-core',     primaryPurpose: 'Internal platform monitoring + ops' },
  'headyconnection.org': { service: 'headyconnection-core',  primaryPurpose: 'Developer portal + community' },
  'headybuddy.org':      { service: 'headybuddy-core',       primaryPurpose: 'HeadyBuddy companion landing + embed' },
  'headymcp.com':        { service: 'headymcp-core',         primaryPurpose: 'Model Context Protocol endpoint' },
  'headyio.com':         { service: 'headyio-core',          primaryPurpose: 'I/O integrations hub (connectors)' },
  'headybot.com':        { service: 'headybot-core',         primaryPurpose: 'Chatbot / messaging channel integrations' },
  'headyai.com':         { service: 'heady-pre-production',  primaryPurpose: 'AI model gateway + inference proxy' },
};

// ─── GCP Pub/Sub Topics ─────────────────────────────────────────────────────

const PUBSUB_TOPICS = {
  'heady-swarm-tasks': {
    purpose: 'Background task distribution to worker instances',
    producers: ['heady-pre-production', 'headymcp-core', 'headysystems-core'],
    consumers: ['heady-pre-production/worker'],
    messageSchema: {
      taskType: 'string',
      payload: 'object',
      priority: 'number',
      traceId: 'string',
    },
  },
  'heady-admin-triggers': {
    purpose: 'Priority admin-triggered operations (God Mode)',
    producers: ['heady-pre-production', 'headysystems-core'],
    consumers: ['heady-pre-production'],
    messageSchema: {
      action: 'string',
      actorId: 'string',
      payload: 'object',
    },
  },
  'heady-dead-letter': {
    purpose: 'Failed task repository for manual inspection',
    producers: ['all'],
    consumers: ['headysystems-core/admin'],
    retentionDays: 7,
  },
};

// ─── HeadyEventBus Topics Registry ─────────────────────────────────────────

const EVENT_TOPICS = {
  // Pipeline events
  'heady.pipeline.run.created':   { schema: { runId: 'string', request: 'object' } },
  'heady.pipeline.run.started':   { schema: { runId: 'string' } },
  'heady.pipeline.run.completed': { schema: { runId: 'string', result: 'object' } },
  'heady.pipeline.run.failed':    { schema: { runId: 'string', error: 'string' } },
  'heady.pipeline.stage.started': { schema: { runId: 'string', stage: 'string' } },
  'heady.pipeline.stage.completed': { schema: { runId: 'string', stage: 'string', metrics: 'object' } },
  'heady.pipeline.stage.failed':  { schema: { runId: 'string', stage: 'string', error: 'string' } },

  // Bee events
  'heady.bee.registered':   { schema: { beeId: 'string' } },
  'heady.bee.task.dispatched': { schema: { executionId: 'string', beeId: 'string', taskType: 'string' } },
  'heady.bee.task.completed':  { schema: { executionId: 'string', durationMs: 'number' } },
  'heady.bee.task.failed':     { schema: { executionId: 'string', error: 'string' } },
  'heady.bee.alerts':          { schema: { target: 'string', alerts: 'array' } },

  // System events
  'heady.system.boot':          { schema: { version: 'string', ts: 'string' } },
  'heady.system.health.changed': { schema: { status: 'string', score: 'number' } },
  'heady.system.circuit.changed': { schema: { breaker: 'string', from: 'string', to: 'string' } },
  'heady.system.drift.detected':  { schema: { severity: 'string', similarity: 'number' } },

  // User events
  'heady.user.registered':    { schema: { userId: 'string', tier: 'string' } },
  'heady.user.authenticated': { schema: { userId: 'string', method: 'string' } },
  'heady.user.onboarding.completed': { schema: { userId: 'string' } },

  // Alert events
  'heady.alert.critical':  { schema: { source: 'string', message: 'string', data: 'object' } },
  'heady.alert.warning':   { schema: { source: 'string', message: 'string' } },
};

// ─── Integration Map API ─────────────────────────────────────────────────────

class EcosystemIntegrationMap {
  constructor() {
    this._services = new Map(Object.entries(SERVICES));
    this._edges = new Map(INTEGRATION_EDGES.map(e => [e.id, e]));
    this._domainMap = new Map(Object.entries(DOMAIN_MAP));
    this._eventTopics = new Map(Object.entries(EVENT_TOPICS));
    this._pubsubTopics = new Map(Object.entries(PUBSUB_TOPICS));
  }

  /**
   * Get a service definition by ID.
   */
  getService(serviceId) {
    return this._services.get(serviceId) || null;
  }

  /**
   * Get a service by domain name.
   */
  getServiceByDomain(domain) {
    const entry = this._domainMap.get(domain);
    if (!entry) return null;
    return this.getService(entry.service);
  }

  /**
   * Get all integration edges for a service (as source or target).
   */
  getIntegrationEdges(serviceId) {
    const result = { outbound: [], inbound: [] };
    for (const edge of this._edges.values()) {
      if (edge.source === serviceId) result.outbound.push(edge);
      if (edge.target === serviceId) result.inbound.push(edge);
    }
    return result;
  }

  /**
   * Validate that a direct integration path exists between two services.
   */
  validatePath(sourceId, targetId) {
    for (const edge of this._edges.values()) {
      if (edge.source === sourceId && (edge.target === targetId || edge.target === 'all-services' || edge.target === 'all-core-repos')) {
        return { valid: true, edge };
      }
    }
    return { valid: false, edge: null };
  }

  /**
   * Get services by tier.
   */
  getServicesByTier(tier) {
    const result = [];
    for (const svc of this._services.values()) {
      if (svc.tier === tier) result.push(svc);
    }
    return result;
  }

  /**
   * Get full ecosystem topology.
   */
  getTopology() {
    return {
      version: ECOSYTEM_VERSION,
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      services: Object.fromEntries(this._services),
      integrationEdges: Object.fromEntries(this._edges),
      domainMap: Object.fromEntries(this._domainMap),
      eventTopics: EVENT_TOPICS,
      pubsubTopics: PUBSUB_TOPICS,
      stats: {
        totalServices: this._services.size,
        activeServices: [...this._services.values()].filter(s => s.status === 'active').length,
        projectedServices: [...this._services.values()].filter(s => s.status === 'projected').length,
        newServices: [...this._services.values()].filter(s => s.status === 'new').length,
        totalEdges: this._edges.size,
        totalDomains: this._domainMap.size,
        totalEventTopics: this._eventTopics.size,
      },
    };
  }

  /**
   * Get all domains in the ecosystem.
   */
  getAllDomains() {
    return [...this._domainMap.entries()].map(([domain, meta]) => ({
      domain,
      service: meta.service,
      purpose: meta.primaryPurpose,
    }));
  }

  /**
   * Get the canonical event topic schema.
   */
  getEventTopics() {
    return Object.fromEntries(this._eventTopics);
  }

  /**
   * Register routes on an Express app for runtime topology introspection.
   */
  registerRoutes(app) {
    app.get('/api/ecosystem/topology', (req, res) => {
      res.json({ ok: true, ...this.getTopology() });
    });

    app.get('/api/ecosystem/services', (req, res) => {
      const { tier, status } = req.query;
      let services = [...this._services.values()];
      if (tier !== undefined) services = services.filter(s => s.tier === parseInt(tier, 10));
      if (status) services = services.filter(s => s.status === status);
      res.json({ ok: true, count: services.length, services });
    });

    app.get('/api/ecosystem/domains', (req, res) => {
      res.json({ ok: true, domains: this.getAllDomains() });
    });

    app.get('/api/ecosystem/edges', (req, res) => {
      const { source, target } = req.query;
      let edges = [...this._edges.values()];
      if (source) edges = edges.filter(e => e.source === source);
      if (target) edges = edges.filter(e => e.target === target);
      res.json({ ok: true, count: edges.length, edges });
    });

    app.get('/api/ecosystem/events', (req, res) => {
      res.json({ ok: true, topics: this.getEventTopics() });
    });

    app.get('/api/ecosystem/domain/:domain', (req, res) => {
      const svc = this.getServiceByDomain(req.params.domain);
      if (!svc) return res.status(404).json({ ok: false, error: 'Domain not found' });
      const edges = this.getIntegrationEdges(svc.id);
      res.json({ ok: true, service: svc, edges });
    });
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
const ecosystemMap = new EcosystemIntegrationMap();

module.exports = {
  EcosystemIntegrationMap,
  ecosystemMap,
  SERVICES,
  INTEGRATION_EDGES,
  DOMAIN_MAP,
  PUBSUB_TOPICS,
  EVENT_TOPICS,
  ECOSYTEM_VERSION,
};
