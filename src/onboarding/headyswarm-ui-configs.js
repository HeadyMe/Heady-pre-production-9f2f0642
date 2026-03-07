/**
 * @file headyswarm-ui-configs.js
 * @description HeadySwarm UI configurations that orchestrate groups of HeadyBee
 *   UI templates using a Fibonacci-based resource allocation model. Each swarm
 *   is an autonomous coordination unit that manages a designated slice of the
 *   headyme.com workspace, communicates with peer swarms via defined channels,
 *   and self-monitors via health checks.
 *
 *   Fibonacci allocation pattern (total = 115% scaled to 100%):
 *     operations-swarm        34%  (Fib: 34)
 *     intelligence-swarm      21%  (Fib: 21)
 *     creation-swarm          21%  (Fib: 21) — shared Fib tier
 *     security-swarm          13%  (Fib: 13)
 *     edge-cloud-swarm         8%  (Fib: 8)
 *     companion-swarm          8%  (Fib: 8)  — shared Fib tier
 *     analytics-swarm          5%  (Fib: 5)
 *     sacred-governance-swarm  5%  (Fib: 5)  — shared Fib tier
 *
 * @module onboarding/headyswarm-ui-configs
 * @author HeadyConnection <eric@headyconnection.org>
 * @version 1.0.0
 */

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

/** Fibonacci sequence — used for allocation % and priority weighting */
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

/** Inter-swarm communication channel types */
const CHANNEL = Object.freeze({
  EVENT_BUS:    'event-bus',      // Fire-and-forget events (Kafka/Redis pub-sub)
  RPC:          'rpc',            // Request/response (gRPC)
  STATE_SYNC:   'state-sync',     // CRDT/Redis synchronisation
  PRIORITY_Q:   'priority-queue', // Prioritised work queue (BullMQ)
});

/** Auto-scaling trigger types */
const SCALE_TRIGGER = Object.freeze({
  CPU:       'cpu_utilization',
  MEMORY:    'memory_utilization',
  QUEUE:     'queue_depth',
  LATENCY:   'p95_latency_ms',
  ERROR:     'error_rate_percent',
  CUSTOM:    'custom_metric',
});

/** Health check protocols */
const HC_PROTOCOL = Object.freeze({
  HTTP:    'http',
  GRPC:    'grpc',
  REDIS:   'redis_ping',
  CUSTOM:  'custom',
});

/** UI layout region assignments */
const UI_REGION = Object.freeze({
  MAIN:        'main-content',
  SIDEBAR_L:   'sidebar-left',
  SIDEBAR_R:   'sidebar-right',
  HEADER:      'header',
  FOOTER:      'footer',
  MODAL:       'modal-overlay',
  PANEL_TOP:   'panel-top',
  PANEL_BOTTOM:'panel-bottom',
  FULL:        'full-viewport',
});

// ---------------------------------------------------------------------------
// Helper builders
// ---------------------------------------------------------------------------

/**
 * Builds a communication channel descriptor.
 * @param {string} targetSwarmId
 * @param {string} channelType
 * @param {string} [topic]
 * @param {number} [priority=5]
 * @returns {object}
 */
function channel(targetSwarmId, channelType, topic, priority = 5) {
  return { targetSwarmId, channelType, topic: topic || `heady.${targetSwarmId}`, priority };
}

/**
 * Builds an auto-scaling rule.
 * @param {string} trigger
 * @param {number} threshold
 * @param {string} direction - 'up' | 'down'
 * @param {number} [minInstances=1]
 * @param {number} [maxInstances=13]
 * @returns {object}
 */
function scaleRule(trigger, threshold, direction, minInstances = 1, maxInstances = 13) {
  return {
    trigger, threshold, direction, minInstances, maxInstances,
    cooldownSeconds: direction === 'up' ? 60 : 300,
  };
}

/**
 * Builds a health check definition.
 * @param {string} protocol
 * @param {string} endpoint
 * @param {number} [intervalSeconds=30]
 * @param {number} [timeoutSeconds=5]
 * @returns {object}
 */
function healthCheck(protocol, endpoint, intervalSeconds = 30, timeoutSeconds = 5) {
  return {
    protocol, endpoint, intervalSeconds, timeoutSeconds,
    unhealthyThreshold: 3,
    healthyThreshold:   1,
    failureAction:      'restart_worker',
  };
}

// ---------------------------------------------------------------------------
// HEADY_SWARM_CONFIGS registry
// ---------------------------------------------------------------------------

/**
 * Complete HeadySwarm UI configuration registry.
 * Keyed by swarmId.
 *
 * @type {Object.<string, HeadySwarmConfig>}
 */
export const HEADY_SWARM_CONFIGS = {

  // =========================================================================
  // 1. operations-swarm  (34% allocation)
  // =========================================================================

  'operations-swarm': {
    swarmId:     'operations-swarm',
    name:        'Operations Swarm',
    description: 'The backbone of headyme.com infrastructure. Manages system health, ' +
                 'deployment pipelines, container orchestration, log aggregation, ' +
                 'service discovery, and runbook automation. The highest-allocated ' +
                 'swarm by Fibonacci design — it must keep everything else alive.',
    fibAllocation:  34,          // Fib[9]
    allocationPct:  34,
    priorityLevel:  1,           // Highest priority
    uiLayoutRegion: UI_REGION.MAIN,

    includedTemplates: [
      'heady-command-center',
      'heady-bot-manager',
      'heady-enterprise-admin',
    ],

    workerAssignments: [
      { workerId: 'bee-ops-monitor',  role: 'lead',    instances: 3 },
      { workerId: 'bee-deploy',       role: 'primary', instances: 2 },
      { workerId: 'bee-log-agg',      role: 'primary', instances: 3 },
      { workerId: 'bee-scheduler',    role: 'primary', instances: 2 },
      { workerId: 'bee-sla',          role: 'support', instances: 2 },
      { workerId: 'bee-api-gw',       role: 'support', instances: 3 },
      { workerId: 'bee-package-ops',  role: 'support', instances: 1 },
      { workerId: 'bee-git-ops',      role: 'support', instances: 2 },
    ],

    interSwarmChannels: [
      channel('intelligence-swarm', CHANNEL.EVENT_BUS,  'heady.ops.alerts',      8),
      channel('security-swarm',     CHANNEL.RPC,         'heady.ops.auth',        9),
      channel('edge-cloud-swarm',   CHANNEL.STATE_SYNC,  'heady.ops.edge',        7),
      channel('analytics-swarm',    CHANNEL.EVENT_BUS,  'heady.ops.metrics',     6),
      channel('companion-swarm',    CHANNEL.PRIORITY_Q,  'heady.ops.buddy',       5),
    ],

    autoScalingRules: [
      scaleRule(SCALE_TRIGGER.CPU,     75, 'up',   2, 21),
      scaleRule(SCALE_TRIGGER.CPU,     20, 'down', 2, 21),
      scaleRule(SCALE_TRIGGER.QUEUE,   100,'up',   2, 21),
      scaleRule(SCALE_TRIGGER.ERROR,   5,  'up',   3, 34),
      scaleRule(SCALE_TRIGGER.LATENCY, 500,'up',   2, 21),
    ],

    healthChecks: [
      healthCheck(HC_PROTOCOL.HTTP,  '/ops/health',    15, 5),
      healthCheck(HC_PROTOCOL.REDIS, 'redis://ops-cache', 10, 3),
      healthCheck(HC_PROTOCOL.GRPC,  'ops.HealthCheck', 20, 8),
    ],

    uiWidgetRegions: {
      primary:   ['system-health', 'deployment-pipeline', 'log-viewer'],
      secondary: ['swarm-overview', 'error-rate', 'api-usage'],
    },

    slaTargets: {
      uptimePct:     99.9,
      p95LatencyMs:  200,
      errorRatePct:  0.1,
    },
  },

  // =========================================================================
  // 2. intelligence-swarm  (21% allocation)
  // =========================================================================

  'intelligence-swarm': {
    swarmId:     'intelligence-swarm',
    name:        'Intelligence Swarm',
    description: 'LLM routing, multi-model inference, research orchestration, ' +
                 'semantic search, RAG pipelines, knowledge graph management, ' +
                 'and market/financial intelligence for trading and analysis workspaces.',
    fibAllocation:  21,          // Fib[8]
    allocationPct:  21,
    priorityLevel:  2,
    uiLayoutRegion: UI_REGION.MAIN,

    includedTemplates: [
      'heady-research-lab',
      'heady-trading-desk',
      'heady-mcp-dashboard',
    ],

    workerAssignments: [
      { workerId: 'bee-llm-router',   role: 'lead',    instances: 5 },
      { workerId: 'bee-research',     role: 'primary', instances: 3 },
      { workerId: 'bee-knowledge',    role: 'primary', instances: 2 },
      { workerId: 'bee-mcp-bridge',   role: 'primary', instances: 3 },
      { workerId: 'bee-market-data',  role: 'support', instances: 2 },
      { workerId: 'bee-citations',    role: 'support', instances: 1 },
      { workerId: 'bee-model-cfg',    role: 'support', instances: 2 },
      { workerId: 'bee-strategy',     role: 'support', instances: 2 },
    ],

    interSwarmChannels: [
      channel('operations-swarm',   CHANNEL.EVENT_BUS,  'heady.intel.health',    8),
      channel('creation-swarm',     CHANNEL.RPC,         'heady.intel.gen',       7),
      channel('analytics-swarm',    CHANNEL.STATE_SYNC,  'heady.intel.metrics',   6),
      channel('companion-swarm',    CHANNEL.PRIORITY_Q,  'heady.intel.buddy',     8),
      channel('security-swarm',     CHANNEL.RPC,         'heady.intel.perm',      9),
    ],

    autoScalingRules: [
      scaleRule(SCALE_TRIGGER.QUEUE,   50,  'up',   3, 34),
      scaleRule(SCALE_TRIGGER.QUEUE,   10,  'down', 3, 34),
      scaleRule(SCALE_TRIGGER.LATENCY, 800, 'up',   3, 21),
      scaleRule(SCALE_TRIGGER.CPU,     80,  'up',   3, 21),
      scaleRule(SCALE_TRIGGER.CUSTOM,  0.9, 'up',   3, 55, ), // token_budget pct
    ],

    healthChecks: [
      healthCheck(HC_PROTOCOL.HTTP,  '/intel/health',     20, 8),
      healthCheck(HC_PROTOCOL.GRPC,  'intel.HealthCheck', 30, 10),
      healthCheck(HC_PROTOCOL.REDIS, 'redis://intel-cache', 15, 3),
    ],

    uiWidgetRegions: {
      primary:   ['llm-router', 'research-search', 'knowledge-graph'],
      secondary: ['mcp-tool-browser', 'sentiment', 'ai-signals'],
    },

    slaTargets: {
      uptimePct:     99.5,
      p95LatencyMs:  1500,
      errorRatePct:  0.5,
    },
  },

  // =========================================================================
  // 3. creation-swarm  (21% allocation)
  // =========================================================================

  'creation-swarm': {
    swarmId:     'creation-swarm',
    name:        'Creation Swarm',
    description: 'Generative AI and developer tooling swarm. Covers code generation, ' +
                 'creative content creation, music/art production, test automation, ' +
                 'documentation synthesis, and the full developer console workflow.',
    fibAllocation:  21,          // Fib[8] — shares tier with intelligence-swarm
    allocationPct:  21,
    priorityLevel:  2,
    uiLayoutRegion: UI_REGION.MAIN,

    includedTemplates: [
      'heady-developer-console',
      'heady-creative-studio',
      'heady-bot-manager',
    ],

    workerAssignments: [
      { workerId: 'bee-codegen',       role: 'lead',    instances: 5 },
      { workerId: 'bee-creative-gen',  role: 'primary', instances: 3 },
      { workerId: 'bee-workflow',      role: 'primary', instances: 3 },
      { workerId: 'bee-image-gen',     role: 'primary', instances: 2 },
      { workerId: 'bee-audio-proc',    role: 'support', instances: 2 },
      { workerId: 'bee-doc-proc',      role: 'support', instances: 2 },
      { workerId: 'bee-test-ops',      role: 'support', instances: 2 },
      { workerId: 'bee-publish',       role: 'support', instances: 1 },
      { workerId: 'bee-content-sched', role: 'support', instances: 1 },
      { workerId: 'bee-experiment',    role: 'support', instances: 1 },
    ],

    interSwarmChannels: [
      channel('intelligence-swarm', CHANNEL.RPC,         'heady.create.llm',     8),
      channel('operations-swarm',   CHANNEL.EVENT_BUS,  'heady.create.health',   7),
      channel('analytics-swarm',    CHANNEL.EVENT_BUS,  'heady.create.metrics',  5),
      channel('companion-swarm',    CHANNEL.PRIORITY_Q,  'heady.create.buddy',   6),
      channel('edge-cloud-swarm',   CHANNEL.STATE_SYNC,  'heady.create.assets',  5),
    ],

    autoScalingRules: [
      scaleRule(SCALE_TRIGGER.QUEUE,   30, 'up',   2, 21),
      scaleRule(SCALE_TRIGGER.QUEUE,   5,  'down', 2, 21),
      scaleRule(SCALE_TRIGGER.CPU,     70, 'up',   2, 21),
      scaleRule(SCALE_TRIGGER.MEMORY,  80, 'up',   2, 13),
    ],

    healthChecks: [
      healthCheck(HC_PROTOCOL.HTTP,  '/create/health',     30, 8),
      healthCheck(HC_PROTOCOL.GRPC,  'create.HealthCheck', 30, 10),
    ],

    uiWidgetRegions: {
      primary:   ['code-editor', 'canvas', 'workflow-builder'],
      secondary: ['ai-writing', 'ai-image-gen', 'sample-library'],
    },

    slaTargets: {
      uptimePct:     99.0,
      p95LatencyMs:  3000,
      errorRatePct:  1.0,
    },
  },

  // =========================================================================
  // 4. security-swarm  (13% allocation)
  // =========================================================================

  'security-swarm': {
    swarmId:     'security-swarm',
    name:        'Security Swarm',
    description: 'Authentication, authorisation, audit, compliance, threat detection, ' +
                 'and permissions enforcement. Every inbound request to headyme.com ' +
                 'passes through this swarm\'s auth gateway before reaching workers.',
    fibAllocation:  13,          // Fib[7]
    allocationPct:  13,
    priorityLevel:  1,           // Co-equal with operations — security is critical path
    uiLayoutRegion: UI_REGION.SIDEBAR_R,

    includedTemplates: [
      'heady-enterprise-admin',
    ],

    workerAssignments: [
      { workerId: 'bee-auth-guard',  role: 'lead',    instances: 5 },
      { workerId: 'bee-audit',       role: 'primary', instances: 3 },
      { workerId: 'bee-compliance',  role: 'primary', instances: 2 },
      { workerId: 'bee-user-mgr',    role: 'primary', instances: 2 },
      { workerId: 'bee-tenant-mgr',  role: 'primary', instances: 2 },
      { workerId: 'bee-billing',     role: 'support', instances: 2 },
      { workerId: 'bee-governance',  role: 'support', instances: 1 },
    ],

    interSwarmChannels: [
      channel('operations-swarm',    CHANNEL.RPC,         'heady.sec.ops',     9),
      channel('intelligence-swarm',  CHANNEL.RPC,         'heady.sec.intel',   9),
      channel('creation-swarm',      CHANNEL.RPC,         'heady.sec.create',  9),
      channel('companion-swarm',     CHANNEL.RPC,         'heady.sec.buddy',   9),
      channel('sacred-governance-swarm', CHANNEL.STATE_SYNC, 'heady.sec.gov', 8),
    ],

    autoScalingRules: [
      scaleRule(SCALE_TRIGGER.CPU,     60,  'up',   5, 34),   // More aggressive: security is critical
      scaleRule(SCALE_TRIGGER.QUEUE,   200, 'up',   5, 34),
      scaleRule(SCALE_TRIGGER.ERROR,   1,   'up',   5, 34),   // Very low error threshold
      scaleRule(SCALE_TRIGGER.LATENCY, 300, 'up',   5, 21),
    ],

    healthChecks: [
      healthCheck(HC_PROTOCOL.HTTP,  '/security/health',     10, 3),
      healthCheck(HC_PROTOCOL.GRPC,  'security.HealthCheck', 10, 3),
      healthCheck(HC_PROTOCOL.REDIS, 'redis://sec-cache',    10, 2),
    ],

    uiWidgetRegions: {
      primary:   ['security-alerts', 'audit-log', 'compliance'],
      secondary: ['user-management', 'tenant-overview', 'security-overview'],
    },

    slaTargets: {
      uptimePct:     99.99,   // Four nines — security cannot go down
      p95LatencyMs:  100,
      errorRatePct:  0.01,
    },
  },

  // =========================================================================
  // 5. edge-cloud-swarm  (8% allocation)
  // =========================================================================

  'edge-cloud-swarm': {
    swarmId:     'edge-cloud-swarm',
    name:        'Edge & Cloud Swarm',
    description: 'Cloudflare Workers, Cloud Run deployment, global CDN management, ' +
                 'edge caching, DNS orchestration, and geo-distributed request routing. ' +
                 'Powers headyme.com\'s sub-50ms edge performance globally.',
    fibAllocation:  8,           // Fib[6]
    allocationPct:  8,
    priorityLevel:  3,
    uiLayoutRegion: UI_REGION.PANEL_TOP,

    includedTemplates: [
      'heady-developer-console',
      'heady-command-center',
    ],

    workerAssignments: [
      { workerId: 'bee-edge-proxy',   role: 'lead',    instances: 5 },
      { workerId: 'bee-cdn-mgr',      role: 'primary', instances: 3 },
      { workerId: 'bee-dns-ops',      role: 'primary', instances: 2 },
      { workerId: 'bee-geo-data',     role: 'support', instances: 2 },
      { workerId: 'bee-cache-ops',    role: 'support', instances: 3 },
    ],

    interSwarmChannels: [
      channel('operations-swarm',   CHANNEL.STATE_SYNC, 'heady.edge.health',   8),
      channel('security-swarm',     CHANNEL.RPC,         'heady.edge.tls',      9),
      channel('analytics-swarm',    CHANNEL.EVENT_BUS,  'heady.edge.metrics',  6),
    ],

    autoScalingRules: [
      scaleRule(SCALE_TRIGGER.LATENCY, 50,  'up',   3, 89),   // Edge scales aggressively
      scaleRule(SCALE_TRIGGER.CPU,     80,  'up',   3, 34),
      scaleRule(SCALE_TRIGGER.QUEUE,   500, 'up',   3, 55),
      scaleRule(SCALE_TRIGGER.LATENCY, 10,  'down', 3, 89),
    ],

    healthChecks: [
      healthCheck(HC_PROTOCOL.HTTP,  '/edge/health',     5,  2),   // Fast checks — edge is latency-sensitive
      healthCheck(HC_PROTOCOL.HTTP,  '/cdn/health',      10, 3),
    ],

    uiWidgetRegions: {
      primary:   ['edge-stats'],
      secondary: ['latency-heatmap'],
    },

    slaTargets: {
      uptimePct:     99.95,
      p95LatencyMs:  50,
      errorRatePct:  0.05,
    },
  },

  // =========================================================================
  // 6. companion-swarm  (8% allocation)
  // =========================================================================

  'companion-swarm': {
    swarmId:     'companion-swarm',
    name:        'Companion Swarm',
    description: 'HeadyBuddy conversational AI, contextual memory management, ' +
                 'preference learning, proactive suggestion engine, and the onboarding ' +
                 'guide experience. The primary interface layer between users and HeadyBuddy.',
    fibAllocation:  8,           // Fib[6] — shares tier with edge-cloud-swarm
    allocationPct:  8,
    priorityLevel:  2,
    uiLayoutRegion: UI_REGION.SIDEBAR_L,

    includedTemplates: [
      'heady-companion',
      'heady-onboarding-lite',
      'heady-community-hub',
      'heady-focus-mode',
    ],

    workerAssignments: [
      { workerId: 'bee-companion',    role: 'lead',    instances: 5 },
      { workerId: 'bee-memory',       role: 'primary', instances: 3 },
      { workerId: 'bee-onboarding',   role: 'primary', instances: 2 },
      { workerId: 'bee-notification', role: 'support', instances: 2 },
      { workerId: 'bee-social',       role: 'support', instances: 1 },
    ],

    interSwarmChannels: [
      channel('intelligence-swarm', CHANNEL.PRIORITY_Q,  'heady.buddy.intel',   9),
      channel('operations-swarm',   CHANNEL.EVENT_BUS,  'heady.buddy.health',   7),
      channel('creation-swarm',     CHANNEL.RPC,         'heady.buddy.create',  7),
      channel('security-swarm',     CHANNEL.RPC,         'heady.buddy.auth',    9),
      channel('analytics-swarm',    CHANNEL.EVENT_BUS,  'heady.buddy.metrics',  5),
    ],

    autoScalingRules: [
      scaleRule(SCALE_TRIGGER.QUEUE,   20,  'up',   3, 21),
      scaleRule(SCALE_TRIGGER.LATENCY, 200, 'up',   3, 13),
      scaleRule(SCALE_TRIGGER.CPU,     70,  'up',   3, 13),
      scaleRule(SCALE_TRIGGER.QUEUE,   3,   'down', 3, 21),
    ],

    healthChecks: [
      healthCheck(HC_PROTOCOL.HTTP,  '/companion/health',     20, 5),
      healthCheck(HC_PROTOCOL.REDIS, 'redis://memory-cache',  15, 3),
    ],

    uiWidgetRegions: {
      primary:   ['companion-chat', 'companion-chat-main'],
      secondary: ['memory-panel', 'quick-tools', 'getting-started'],
    },

    slaTargets: {
      uptimePct:     99.5,
      p95LatencyMs:  400,
      errorRatePct:  0.5,
    },
  },

  // =========================================================================
  // 7. analytics-swarm  (5% allocation)
  // =========================================================================

  'analytics-swarm': {
    swarmId:     'analytics-swarm',
    name:        'Analytics Swarm',
    description: 'Telemetry collection, real-time metrics aggregation, performance ' +
                 'dashboards, usage pattern analysis, A/B test evaluation, and the ' +
                 'Sacred Geometry scoring engine for UI optimisation feedback loops.',
    fibAllocation:  5,           // Fib[5]
    allocationPct:  5,
    priorityLevel:  4,
    uiLayoutRegion: UI_REGION.PANEL_BOTTOM,

    includedTemplates: [],       // Embedded into other templates' analytics widgets

    workerAssignments: [
      { workerId: 'bee-telemetry',  role: 'lead',    instances: 3 },
      { workerId: 'bee-analytics',  role: 'primary', instances: 3 },
      { workerId: 'bee-tracer',     role: 'primary', instances: 2 },
      { workerId: 'bee-experiment', role: 'support', instances: 1 },
    ],

    interSwarmChannels: [
      channel('operations-swarm',   CHANNEL.EVENT_BUS,  'heady.analytics.ops',     6),
      channel('intelligence-swarm', CHANNEL.EVENT_BUS,  'heady.analytics.intel',   6),
      channel('creation-swarm',     CHANNEL.EVENT_BUS,  'heady.analytics.create',  5),
      channel('companion-swarm',    CHANNEL.EVENT_BUS,  'heady.analytics.buddy',   5),
      channel('edge-cloud-swarm',   CHANNEL.EVENT_BUS,  'heady.analytics.edge',    5),
    ],

    autoScalingRules: [
      scaleRule(SCALE_TRIGGER.QUEUE,  1000, 'up',   2, 13),
      scaleRule(SCALE_TRIGGER.QUEUE,  100,  'down', 2, 13),
      scaleRule(SCALE_TRIGGER.CPU,    85,   'up',   2, 8),
    ],

    healthChecks: [
      healthCheck(HC_PROTOCOL.HTTP,  '/analytics/health', 30, 5),
      healthCheck(HC_PROTOCOL.GRPC,  'analytics.Health',  30, 8),
    ],

    uiWidgetRegions: {
      primary:   ['analytics-charts', 'pnl-chart', 'bot-metrics'],
      secondary: ['token-usage', 'latency-heatmap', 'error-rate'],
    },

    slaTargets: {
      uptimePct:     99.0,
      p95LatencyMs:  2000,
      errorRatePct:  2.0,
    },
  },

  // =========================================================================
  // 8. sacred-governance-swarm  (5% allocation)
  // =========================================================================

  'sacred-governance-swarm': {
    swarmId:     'sacred-governance-swarm',
    name:        'Sacred Governance Swarm',
    description: 'Sacred Geometry scoring, design system governance, policy enforcement, ' +
                 'ethical AI guardrails, nonprofit compliance (501c3 alignment for ' +
                 'HeadyConnection), constitutional AI rules, and the Divine Proportion ' +
                 'layout validation pipeline that ensures every projection honours φ.',
    fibAllocation:  5,           // Fib[5] — shares tier with analytics-swarm
    allocationPct:  5,
    priorityLevel:  3,
    uiLayoutRegion: UI_REGION.MODAL,

    sacredGeometryConfig: {
      phi:              1.6180339887,
      fibonacciSequence: [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144],
      goldenAngleDeg:   137.5077640500,
      scoringDimensions: [
        { name: 'column_alignment',    weight: 0.20 },
        { name: 'area_distribution',   weight: 0.25 },
        { name: 'role_tier_match',     weight: 0.20 },
        { name: 'device_responsive',   weight: 0.15 },
        { name: 'template_baseline',   weight: 0.20 },
      ],
      minimumPassScore:  60,
      warningThreshold:  75,
      optimalThreshold:  90,
    },

    constitutionalAIRules: [
      { id: 'no-harm',        rule: 'Do not generate content that facilitates harm to users or communities.' },
      { id: 'transparency',   rule: 'Always disclose when actions are AI-assisted.'                         },
      { id: 'privacy',        rule: 'Never persist personal data beyond user-consented retention windows.'  },
      { id: 'accessibility',  rule: 'Every projection must meet WCAG 2.1 AA minimum standards.'            },
      { id: 'nonprofit',      rule: 'HeadyConnection mission: tools must empower, not exploit.'            },
      { id: 'sacred-design',  rule: 'Layout projections must achieve a Sacred Geometry score ≥ 60.'       },
    ],

    includedTemplates: [],       // Governance applies system-wide, not per-template

    workerAssignments: [
      { workerId: 'bee-governance', role: 'lead',    instances: 2 },
      { workerId: 'bee-compliance', role: 'primary', instances: 2 },
      { workerId: 'bee-audit',      role: 'primary', instances: 2 },
      { workerId: 'bee-policy',     role: 'support', instances: 1 },
    ],

    interSwarmChannels: [
      channel('security-swarm',     CHANNEL.STATE_SYNC, 'heady.gov.security',   9),
      channel('operations-swarm',   CHANNEL.EVENT_BUS,  'heady.gov.ops',        7),
      channel('intelligence-swarm', CHANNEL.RPC,         'heady.gov.ai-rules',  9),
      channel('creation-swarm',     CHANNEL.RPC,         'heady.gov.content',   8),
      channel('companion-swarm',    CHANNEL.RPC,         'heady.gov.buddy',     8),
      channel('analytics-swarm',    CHANNEL.EVENT_BUS,  'heady.gov.metrics',    6),
    ],

    autoScalingRules: [
      scaleRule(SCALE_TRIGGER.CPU,   70,  'up',   2, 8),
      scaleRule(SCALE_TRIGGER.QUEUE, 50,  'up',   2, 8),
      scaleRule(SCALE_TRIGGER.QUEUE, 5,   'down', 2, 8),
    ],

    healthChecks: [
      healthCheck(HC_PROTOCOL.HTTP,  '/governance/health', 30, 5),
      healthCheck(HC_PROTOCOL.GRPC,  'governance.Health',  30, 8),
    ],

    uiWidgetRegions: {
      primary:   ['policy-editor', 'compliance'],
      secondary: ['audit-log'],
    },

    slaTargets: {
      uptimePct:     99.5,
      p95LatencyMs:  500,
      errorRatePct:  0.5,
    },
  },
};

// ---------------------------------------------------------------------------
// Exports: derived utilities
// ---------------------------------------------------------------------------

/**
 * Returns all swarm configs sorted by priorityLevel ascending (lowest = highest priority).
 *
 * @returns {HeadySwarmConfig[]}
 */
export function getSwarmsByPriority() {
  return Object.values(HEADY_SWARM_CONFIGS)
    .sort((a, b) => a.priorityLevel - b.priorityLevel);
}

/**
 * Returns all swarm configs sorted by Fibonacci allocation descending.
 *
 * @returns {HeadySwarmConfig[]}
 */
export function getSwarmsByAllocation() {
  return Object.values(HEADY_SWARM_CONFIGS)
    .sort((a, b) => b.fibAllocation - a.fibAllocation);
}

/**
 * Returns the swarm config responsible for a given HeadyBee template ID.
 *
 * @param {string} templateId
 * @returns {HeadySwarmConfig|null}
 */
export function getSwarmForTemplate(templateId) {
  return Object.values(HEADY_SWARM_CONFIGS).find(
    (s) => s.includedTemplates.includes(templateId),
  ) || null;
}

/**
 * Returns all communication channels between two swarms (bidirectional lookup).
 *
 * @param {string} swarmIdA
 * @param {string} swarmIdB
 * @returns {object[]} Channel descriptors
 */
export function getChannelsBetween(swarmIdA, swarmIdB) {
  const swarmA = HEADY_SWARM_CONFIGS[swarmIdA];
  const swarmB = HEADY_SWARM_CONFIGS[swarmIdB];
  if (!swarmA || !swarmB) return [];

  const aToB = (swarmA.interSwarmChannels || [])
    .filter((c) => c.targetSwarmId === swarmIdB);
  const bToA = (swarmB.interSwarmChannels || [])
    .filter((c) => c.targetSwarmId === swarmIdA);

  return [...aToB, ...bToA];
}

/**
 * Validates that the total Fibonacci allocation across all swarms sums to
 * the expected Fibonacci-aligned total. Emits warnings for mis-alignments.
 *
 * @returns {{ valid: boolean, totalAllocation: number, warning?: string }}
 */
export function validateFibonacciAllocation() {
  const total = Object.values(HEADY_SWARM_CONFIGS)
    .reduce((sum, s) => sum + s.fibAllocation, 0);

  // Expected: 34 + 21 + 21 + 13 + 8 + 8 + 5 + 5 = 115
  // Normalised to 100% in the UI — we validate against 115 as the raw Fibonacci sum
  const EXPECTED = 115;
  const valid    = total === EXPECTED;

  return {
    valid,
    totalAllocation: total,
    normalised: Math.round((total / EXPECTED) * 100),
    ...(valid ? {} : { warning: `Fibonacci allocation sum ${total} ≠ expected ${EXPECTED}` }),
  };
}

// ---------------------------------------------------------------------------
// JSDoc typedef
// ---------------------------------------------------------------------------

/**
 * @typedef {object} HeadySwarmConfig
 * @property {string}   swarmId
 * @property {string}   name
 * @property {string}   description
 * @property {number}   fibAllocation          - Raw Fibonacci number
 * @property {number}   allocationPct          - Effective resource allocation percentage
 * @property {number}   priorityLevel          - 1 = highest priority
 * @property {string}   uiLayoutRegion         - UI_REGION value
 * @property {string[]} includedTemplates      - HeadyBee template IDs managed by this swarm
 * @property {object[]} workerAssignments
 * @property {object[]} interSwarmChannels
 * @property {object[]} autoScalingRules
 * @property {object[]} healthChecks
 * @property {object}   uiWidgetRegions
 * @property {object}   slaTargets
 */
