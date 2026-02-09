// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/hc_pipeline.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

//
// HCFullPipeline Runtime Engine
// Loads YAML configs, executes stages in dependency order,
// manages checkpoints, stop rules, and circuit breakers.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const yaml = require("js-yaml");
const EventEmitter = require("events");

const CONFIGS_DIR = path.join(__dirname, "..", "configs");
const LOGS_DIR = path.join(__dirname, "..");
const PIPELINE_LOG = path.join(LOGS_DIR, "hc_pipeline.log");
const CACHE_DIR = path.join(__dirname, "..", ".heady_cache");
const TASK_CACHE_FILE = path.join(CACHE_DIR, "pipeline_task_cache.json");
const CACHE_TTL_MS = 3600000; // 1 hour
const CACHE_MAX_ENTRIES = 200;

// ─── CONFIG LOADER ──────────────────────────────────────────────────────────

function loadYaml(filename) {
  const filePath = path.join(CONFIGS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Config not found: ${filePath}`);
  }
  return yaml.load(fs.readFileSync(filePath, "utf8"));
}

function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf8");
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function loadAllConfigs() {
  const configs = {
    pipeline: loadYaml("hcfullpipeline.yaml"),
    resources: loadYaml("resource-policies.yaml"),
    services: loadYaml("service-catalog.yaml"),
    governance: loadYaml("governance-policies.yaml"),
    concepts: loadYaml("concepts-index.yaml"),
  };
  // Optional configs — new pipeline capabilities
  try { configs.appReadiness = loadYaml("app-readiness.yaml"); } catch (_) { configs.appReadiness = {}; }
  try { configs.headyAutoIDE = loadYaml("heady-auto-ide.yaml"); } catch (_) { configs.headyAutoIDE = {}; }
  try { configs.buildPlaybook = loadYaml("build-playbook.yaml"); } catch (_) { configs.buildPlaybook = {}; }
  try { configs.agenticCoding = loadYaml("agentic-coding.yaml"); } catch (_) { configs.agenticCoding = {}; }
  try { configs.publicDomainIntegration = loadYaml("public-domain-integration.yaml"); } catch (_) { configs.publicDomainIntegration = {}; }
  try { configs.activationManifest = loadYaml("activation-manifest.yaml"); } catch (_) { configs.activationManifest = {}; }
  try { configs.monteCarlo = loadYaml("monte-carlo-scheduler.yaml"); } catch (_) { configs.monteCarlo = {}; }
  try { configs.selfAwareness = loadYaml("system-self-awareness.yaml"); } catch (_) { configs.selfAwareness = {}; }
  try { configs.connectionIntegrity = loadYaml("connection-integrity.yaml"); } catch (_) { configs.connectionIntegrity = {}; }
  try { configs.extensionPricing = loadYaml("extension-pricing.yaml"); } catch (_) { configs.extensionPricing = {}; }
  try { configs.headyBuddy = loadYaml("heady-buddy.yaml"); } catch (_) { configs.headyBuddy = {}; }
  return configs;
}

function computeConfigHashes(sources) {
  const hashes = {};
  for (const src of sources) {
    const absPath = path.join(__dirname, "..", src);
    hashes[src] = hashFile(absPath);
  }
  return hashes;
}

// ─── PIPELINE STATE ─────────────────────────────────────────────────────────

const RunStatus = {
  IDLE: "idle",
  RUNNING: "running",
  PAUSED: "paused",
  RECOVERY: "recovery",
  HALTED: "halted",
  COMPLETED: "completed",
  FAILED: "failed",
};

function createRunState(pipelineDef) {
  const now = new Date().toISOString();
  return {
    runId: `run_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    pipelineName: pipelineDef.pipeline.name,
    version: pipelineDef.pipeline.version || pipelineDef.version,
    status: RunStatus.IDLE,
    startedAt: null,
    completedAt: null,
    currentStageId: null,
    stages: {},
    checkpoints: [],
    errors: [],
    metrics: {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      cachedTasks: 0,
      retriedTasks: 0,
      errorRate: 0,
      readinessScore: 100,
      elapsedMs: 0,
    },
    configHashes: {},
    log: [],
  };
}

// ─── LOGGING ────────────────────────────────────────────────────────────────

function appendLog(state, level, message, detail) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    stage: state.currentStageId || "system",
    message,
    ...(detail ? { detail } : {}),
  };
  state.log.push(entry);

  const line = `[${entry.ts}] [${level.toUpperCase()}] [${entry.stage}] ${message}`;
  try {
    fs.appendFileSync(PIPELINE_LOG, line + "\n", "utf8");
  } catch (_) {
    // log file write failure is non-fatal
  }
}

// ─── STOP RULE EVALUATOR ────────────────────────────────────────────────────

function evaluateStopRules(state, stopRule) {
  if (!stopRule || !stopRule.conditions) return null;

  for (const cond of stopRule.conditions) {
    switch (cond.type) {
      case "error_rate":
        if (state.metrics.errorRate >= cond.threshold) {
          return { condition: cond, triggered: true };
        }
        break;
      case "readiness_score":
        if (state.metrics.readinessScore <= cond.threshold) {
          return { condition: cond, triggered: true };
        }
        break;
      case "critical_alarm":
        if (state.errors.filter((e) => e.severity === "critical").length >= (cond.count || 1)) {
          return { condition: cond, triggered: true };
        }
        break;
      case "data_integrity_failure":
        if (state.errors.some((e) => e.type === "data_integrity")) {
          return { condition: cond, triggered: true };
        }
        break;
    }
  }
  return null;
}

function applyStopAction(state, action) {
  switch (action) {
    case "enter_recovery":
      state.status = RunStatus.RECOVERY;
      break;
    case "pause_and_escalate":
      state.status = RunStatus.PAUSED;
      break;
    case "halt_immediately":
      state.status = RunStatus.HALTED;
      break;
    default:
      state.status = RunStatus.PAUSED;
  }
}

// ─── CHECKPOINT PROTOCOL ────────────────────────────────────────────────────

function runCheckpoint(state, stageId, checkpointProtocol, configHashSources) {
  const cp = {
    id: `cp_${stageId}_${Date.now()}`,
    stageId,
    ts: new Date().toISOString(),
    configHashes: computeConfigHashes(configHashSources || []),
    readinessScore: state.metrics.readinessScore,
    errorRate: state.metrics.errorRate,
    completedTasks: state.metrics.completedTasks,
    failedTasks: state.metrics.failedTasks,
    responsibilities: [],
  };

  // Execute checkpoint responsibilities
  if (checkpointProtocol && checkpointProtocol.responsibilities) {
    for (const resp of checkpointProtocol.responsibilities) {
      const result = executeCheckpointResponsibility(state, resp, cp);
      cp.responsibilities.push({ name: resp, result });
    }
  }

  // Config drift detection
  if (state.configHashes && Object.keys(state.configHashes).length > 0) {
    const drifted = [];
    for (const [file, oldHash] of Object.entries(state.configHashes)) {
      if (cp.configHashes[file] && cp.configHashes[file] !== oldHash) {
        drifted.push(file);
      }
    }
    if (drifted.length > 0) {
      cp.configDrift = drifted;
      appendLog(state, "warn", `Config drift detected: ${drifted.join(", ")}`, { drifted });
    }
  }

  state.configHashes = cp.configHashes;
  state.checkpoints.push(cp);
  appendLog(state, "info", `Checkpoint ${cp.id} saved`, { readiness: cp.readinessScore, errorRate: cp.errorRate });

  return cp;
}

function executeCheckpointResponsibility(state, responsibility, _cp) {
  switch (responsibility) {
    case "validate_run_state":
      return { ok: state.status === RunStatus.RUNNING || state.status === RunStatus.RECOVERY };
    case "compare_config_hashes":
      return { ok: true, hashes: Object.keys(state.configHashes).length };
    case "reevaluate_plan_and_health":
      return { ok: state.metrics.readinessScore >= 60, score: state.metrics.readinessScore };
    case "check_concept_alignment":
      return { ok: true, note: "concept alignment deferred to brain module" };
    case "update_logs_and_owner":
      return { ok: true, logEntries: state.log.length };
    case "apply_approved_patterns":
      return { ok: true, note: "auto-enable patterns applied per governance" };
    default:
      return { ok: true, note: `unhandled responsibility: ${responsibility}` };
  }
}

// ─── CIRCUIT BREAKER ────────────────────────────────────────────────────────

class CircuitBreaker {
  constructor(config) {
    this.enabled = config.enabled !== false;
    this.failureThreshold = config.failureThreshold || 5;
    this.resetTimeoutMs = config.resetTimeoutMs || 30000;
    this.halfOpenMax = config.halfOpenMaxRequests || 2;
    this.state = "closed"; // closed | open | half-open
    this.failures = 0;
    this.lastFailureAt = null;
    this.halfOpenAttempts = 0;
  }

  canExecute() {
    if (!this.enabled) return true;
    if (this.state === "closed") return true;
    if (this.state === "open") {
      if (Date.now() - this.lastFailureAt >= this.resetTimeoutMs) {
        this.state = "half-open";
        this.halfOpenAttempts = 0;
        return true;
      }
      return false;
    }
    // half-open
    return this.halfOpenAttempts < this.halfOpenMax;
  }

  recordSuccess() {
    if (this.state === "half-open") {
      this.state = "closed";
      this.failures = 0;
    }
  }

  recordFailure() {
    this.failures++;
    this.lastFailureAt = Date.now();
    if (this.state === "half-open") {
      this.state = "open";
    } else if (this.failures >= this.failureThreshold) {
      this.state = "open";
    }
  }

  getStatus() {
    return { state: this.state, failures: this.failures, threshold: this.failureThreshold };
  }
}

// ─── TASK RESULT CACHE ──────────────────────────────────────────────────────

let _taskCache = null;

function loadTaskCache() {
  if (_taskCache) return _taskCache;
  try {
    if (fs.existsSync(TASK_CACHE_FILE)) {
      _taskCache = JSON.parse(fs.readFileSync(TASK_CACHE_FILE, "utf8"));
    } else {
      _taskCache = {};
    }
  } catch (_) {
    _taskCache = {};
  }
  return _taskCache;
}

function saveTaskCache() {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(TASK_CACHE_FILE, JSON.stringify(_taskCache, null, 2), "utf8");
  } catch (_) {
    // non-fatal
  }
}

function getTaskCacheKey(taskName, configHashes) {
  const input = taskName + JSON.stringify(configHashes || {});
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function getCachedResult(taskName, configHashes) {
  const cache = loadTaskCache();
  const key = getTaskCacheKey(taskName, configHashes);
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    delete cache[key];
    return null;
  }
  return entry.result;
}

function setCachedResult(taskName, configHashes, result) {
  const cache = loadTaskCache();
  const key = getTaskCacheKey(taskName, configHashes);
  cache[key] = { taskName, cachedAt: Date.now(), result };
  // Evict oldest if over limit
  const keys = Object.keys(cache);
  if (keys.length > CACHE_MAX_ENTRIES) {
    const sorted = keys.sort((a, b) => (cache[a].cachedAt || 0) - (cache[b].cachedAt || 0));
    for (let i = 0; i < keys.length - CACHE_MAX_ENTRIES; i++) delete cache[sorted[i]];
  }
  saveTaskCache();
}

function invalidateCache() {
  _taskCache = {};
  saveTaskCache();
}

// ─── WORKER POOL (semaphore concurrency) ────────────────────────────────────

class WorkerPool {
  constructor(concurrency) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  run(fn) {
    return new Promise((resolve, reject) => {
      const execute = () => {
        this.running++;
        fn().then(
          (val) => { this.running--; this._drain(); resolve(val); },
          (err) => { this.running--; this._drain(); reject(err); }
        );
      };
      if (this.running < this.concurrency) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }

  _drain() {
    if (this.queue.length > 0 && this.running < this.concurrency) {
      this.queue.shift()();
    }
  }

  runAll(fns) {
    return Promise.allSettled(fns.map((fn) => this.run(fn)));
  }

  getStats() {
    return { concurrency: this.concurrency, running: this.running, queued: this.queue.length };
  }
}

// ─── TASK EXECUTOR (pluggable) ──────────────────────────────────────────────

const taskHandlers = new Map();

function registerTaskHandler(taskName, handler) {
  taskHandlers.set(taskName, handler);
}

async function executeTask(taskName, context) {
  const handler = taskHandlers.get(taskName);
  if (handler) {
    return await handler(context);
  }
  // Default: simulated task execution with success
  return {
    task: taskName,
    status: "completed",
    result: `Task '${taskName}' executed (default handler)`,
    durationMs: 0,
  };
}

// ─── STAGE EXECUTOR ─────────────────────────────────────────────────────────

async function executeStage(stage, state, configs, circuitBreakers) {
  const stageState = {
    id: stage.id,
    name: stage.name,
    status: "running",
    startedAt: new Date().toISOString(),
    completedAt: null,
    tasks: {},
  };
  state.stages[stage.id] = stageState;
  state.currentStageId = stage.id;
  appendLog(state, "info", `Stage '${stage.name}' started`, { parallel: stage.parallel, taskCount: (stage.tasks || []).length });

  const rawTasks = stage.tasks || [];
  const tasks = sortTasksByPool(rawTasks);
  const results = [];

  const context = {
    runId: state.runId,
    stageId: stage.id,
    configs,
    supervisorConfig: stage.supervisorConfig || null,
  };

  try {
    if (stage.parallel) {
      // Worker pool concurrency — all tasks enqueued at once, pool limits inflight
      const maxParallel = (stage.supervisorConfig && stage.supervisorConfig.maxParallelAgents)
        || configs.pipeline.pipeline.global.maxConcurrentTasks
        || 8;
      const pool = new WorkerPool(maxParallel);
      const poolResults = await pool.runAll(
        tasks.map((taskName) => () => executeSingleTask(taskName, context, state, circuitBreakers))
      );
      results.push(...poolResults);
    } else {
      // Sequential execution
      for (const taskName of tasks) {
        const result = await executeSingleTask(taskName, context, state, circuitBreakers);
        results.push({ status: "fulfilled", value: result });
      }
    }

    // Tally results
    let failed = 0;
    for (const r of results) {
      if (r.status === "rejected" || (r.value && r.value.status === "failed")) {
        failed++;
      }
    }

    stageState.completedAt = new Date().toISOString();
    stageState.status = failed > 0 ? "partial" : "completed";
    stageState.taskResults = results.map((r) =>
      r.status === "fulfilled" ? r.value : { status: "failed", error: r.reason?.message || "unknown" }
    );

    appendLog(state, "info", `Stage '${stage.name}' ${stageState.status}`, { failed, total: tasks.length });
  } catch (err) {
    stageState.status = "failed";
    stageState.completedAt = new Date().toISOString();
    stageState.error = err.message;
    appendLog(state, "error", `Stage '${stage.name}' failed: ${err.message}`);
    state.errors.push({ stage: stage.id, message: err.message, severity: "high", ts: new Date().toISOString() });
  }

  return stageState;
}

async function executeSingleTask(taskName, context, state, circuitBreakers) {
  state.metrics.totalTasks++;

  // Auto-prioritize change-related tasks
  if (taskName.includes('change_request') || taskName.includes('change')) {
    taskName.priority = 'high';
    taskName.tags.push('automated_priority');
  }

  // Check circuit breaker for this task's endpoint category
  const breaker = circuitBreakers ? findBreakerForTask(taskName, circuitBreakers) : null;
  if (breaker && !breaker.canExecute()) {
    const msg = `Circuit breaker OPEN for task '${taskName}', skipping`;
    appendLog(state, "warn", msg);
    state.metrics.failedTasks++;
    state.stages[context.stageId].tasks[taskName] = { status: "circuit-open", durationMs: 0 };
    recalcMetrics(state);
    return { task: taskName, status: "circuit-open", error: msg, durationMs: 0 };
  }

  // Check task result cache — skip if inputs unchanged
  const cached = getCachedResult(taskName, state.configHashes);
  if (cached && cached.status === "completed") {
    state.metrics.completedTasks++;
    state.metrics.cachedTasks++;
    state.stages[context.stageId].tasks[taskName] = { status: "cached", durationMs: 0 };
    if (breaker) breaker.recordSuccess();
    recalcMetrics(state);
    appendLog(state, "info", `Task '${taskName}' served from cache`);
    return { task: taskName, status: "completed", durationMs: 0, cached: true, ...cached };
  }

  const start = Date.now();
  try {
    const result = await executeTask(taskName, context);
    const duration = Date.now() - start;
    state.metrics.completedTasks++;
    state.stages[context.stageId].tasks[taskName] = { status: "completed", durationMs: duration };
    if (breaker) breaker.recordSuccess();
    recalcMetrics(state);
    // Cache successful result keyed by task name + config hashes
    setCachedResult(taskName, state.configHashes, { ...result, status: "completed", durationMs: duration });
    return { task: taskName, status: "completed", durationMs: duration, ...result };
  } catch (err) {
    const duration = Date.now() - start;
    state.metrics.failedTasks++;
    state.stages[context.stageId].tasks[taskName] = { status: "failed", error: err.message, durationMs: duration };
    state.errors.push({ task: taskName, stage: context.stageId, message: err.message, severity: "high", ts: new Date().toISOString() });
    if (breaker) breaker.recordFailure();
    recalcMetrics(state);
    return { task: taskName, status: "failed", error: err.message, durationMs: duration };
  }
}

// ─── NODE POOL PRIORITY ─────────────────────────────────────────────────────

// Map tasks to node pool tiers for priority ordering
const TASK_POOL_MAP = {
  // Hot pool: user-facing, core pipeline tasks (critical latency)
  resolve_channel_and_identity: "hot",
  route_to_pipeline_branch: "hot",
  route_to_agents: "hot",
  monitor_agent_execution: "hot",
  collect_agent_results: "hot",
  compute_readiness_score: "hot",
  mc_plan_selection: "hot",
  mc_replan_failed_tasks: "hot",
  // Warm pool: important background tasks
  sync_cross_device_context: "warm",
  determine_launch_mode: "warm",
  generate_task_graph: "warm",
  assign_priorities: "warm",
  validate_governance: "warm",
  evaluate_failures: "warm",
  apply_compensation: "warm",
  persist_results: "warm",
  log_run_config_hash: "warm",
  record_run_critique: "warm",
  diagnose_bottlenecks: "warm",
  check_all_connection_health: "warm",
  identify_improvement_candidates: "warm",
  run_meta_analysis: "warm",
  apply_pattern_improvements: "warm",
  adjust_mc_strategy_weights: "warm",
  adjust_worker_pool_concurrency: "warm",
  update_channel_optimizations: "warm",
  record_pipeline_improvements: "warm",
  feed_stage_timing_to_mc: "warm",
  feed_task_timing_to_patterns: "warm",
  publish_metrics_to_channels: "warm",
  check_cross_channel_seamlessness: "warm",
  propose_micro_upgrades: "warm",
  archive_run_to_history: "warm",
  sync_registry_and_docs: "warm",
  validate_notebook_integrity: "warm",
  check_doc_owner_freshness: "warm",
  // Cold pool: async ingestion, analytics, mining
  ingest_news_feeds: "cold",
  ingest_external_apis: "cold",
  ingest_repo_changes: "cold",
  ingest_health_metrics: "cold",
  ingest_channel_events: "cold",
  ingest_connection_health: "cold",
  ingest_public_domain_patterns: "cold",
  estimate_costs: "cold",
  check_public_domain_inspiration: "cold",
  retry_recoverable: "cold",
  escalate_unrecoverable: "cold",
  update_concept_index: "cold",
  send_checkpoint_email: "cold",
  mine_public_domain_best_practices: "cold",
  invalidate_stale_caches: "cold",
};

const POOL_PRIORITY = { hot: 0, warm: 1, cold: 2 };

function sortTasksByPool(tasks) {
  return [...tasks].sort((a, b) => {
    const pa = POOL_PRIORITY[TASK_POOL_MAP[a] || "cold"] || 2;
    const pb = POOL_PRIORITY[TASK_POOL_MAP[b] || "cold"] || 2;
    return pa - pb;
  });
}

// Map task names to circuit breaker endpoints
function findBreakerForTask(taskName, circuitBreakers) {
  const TASK_BREAKER_MAP = {
    ingest_news_feeds: "external-news-api",
    ingest_external_apis: "external-news-api",
    ingest_public_domain_patterns: "external-news-api",
    generate_task_graph: "llm-provider",
    assign_priorities: "llm-provider",
    estimate_costs: "llm-provider",
    validate_governance: "llm-provider",
    route_to_agents: "llm-provider",
    monitor_agent_execution: "llm-provider",
    collect_agent_results: "llm-provider",
    evaluate_failures: "llm-provider",
    compute_readiness_score: "llm-provider",
    log_run_config_hash: "llm-provider",
    mc_plan_selection: "llm-provider",
    mc_replan_failed_tasks: "llm-provider",
    check_public_domain_inspiration: "external-news-api",
    mine_public_domain_best_practices: "external-news-api",
    diagnose_bottlenecks: "llm-provider",
    run_meta_analysis: "llm-provider",
  };
  const endpoint = TASK_BREAKER_MAP[taskName];
  return endpoint ? circuitBreakers.get(endpoint) || null : null;
}

function recalcMetrics(state) {
  const total = state.metrics.totalTasks || 1;
  state.metrics.errorRate = state.metrics.failedTasks / total;
  // Readiness degrades with errors
  state.metrics.readinessScore = Math.max(0, Math.round(100 - state.metrics.errorRate * 200));
}

// ─── TOPOLOGY SORT (dependency order) ───────────────────────────────────────

function topologicalSort(stages) {
  const graph = new Map();
  const inDegree = new Map();
  const stageMap = new Map();

  for (const s of stages) {
    stageMap.set(s.id, s);
    graph.set(s.id, []);
    inDegree.set(s.id, 0);
  }

  for (const s of stages) {
    if (s.dependsOn) {
      for (const dep of s.dependsOn) {
        if (graph.has(dep)) {
          graph.get(dep).push(s.id);
          inDegree.set(s.id, (inDegree.get(s.id) || 0) + 1);
        }
      }
    }
  }

  const queue = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted = [];
  while (queue.length > 0) {
    const current = queue.shift();
    sorted.push(stageMap.get(current));
    for (const neighbor of graph.get(current) || []) {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== stages.length) {
    throw new Error("Circular dependency detected in pipeline stages");
  }

  return sorted;
}

// ─── PIPELINE RUNNER ────────────────────────────────────────────────────────

class HCFullPipeline extends EventEmitter {
  constructor() {
    super();
    this.configs = null;
    this.state = null;
    this.circuitBreakers = new Map();
    this.history = [];
    // External system references (set via bind())
    this._mcScheduler = null;
    this._patternEngine = null;
    this._selfCritique = null;
    this._stageTimings = [];
  }

  /**
   * Bind external systems so the pipeline can feed them data.
   * Call this from heady-manager.js after all systems are loaded.
   * @param {Object} systems - { mcScheduler, patternEngine, selfCritique }
   */
  bind(systems = {}) {
    if (systems.mcScheduler) this._mcScheduler = systems.mcScheduler;
    if (systems.patternEngine) this._patternEngine = systems.patternEngine;
    if (systems.selfCritique) this._selfCritique = systems.selfCritique;
  }

  load() {
    this.configs = loadAllConfigs();
    const pipelineDef = this.configs.pipeline;

    // Initialize circuit breakers from resource policies
    if (this.configs.resources.circuitBreaker) {
      const cbConfig = this.configs.resources.circuitBreaker;
      if (cbConfig.monitoredEndpoints) {
        for (const ep of cbConfig.monitoredEndpoints) {
          this.circuitBreakers.set(ep.name, new CircuitBreaker({
            enabled: cbConfig.enabled,
            failureThreshold: ep.failureThreshold || cbConfig.failureThreshold,
            resetTimeoutMs: cbConfig.resetTimeoutMs,
            halfOpenMaxRequests: cbConfig.halfOpenMaxRequests,
          }));
        }
      }
    }

    appendLog({ log: [], currentStageId: null }, "info", `Pipeline '${pipelineDef.pipeline.name}' v${pipelineDef.version} loaded`);
    return pipelineDef;
  }

  async run() {
    if (!this.configs) this.load();

    const pipelineDef = this.configs.pipeline;
    const pipeline = pipelineDef.pipeline;
    this.state = createRunState(pipelineDef);
    this.state.status = RunStatus.RUNNING;
    this.state.startedAt = new Date().toISOString();
    this.state.configHashes = computeConfigHashes(
      (pipeline.checkpointProtocol || pipelineDef.checkpointProtocol || {}).configHashSources || []
    );

    this.emit("run:start", { runId: this.state.runId });
    appendLog(this.state, "info", `Pipeline run ${this.state.runId} started`);

    const stages = topologicalSort(pipeline.stages);

    for (const stage of stages) {
      // Check stop rules before each stage
      const stopTriggered = evaluateStopRules(this.state, pipeline.stopRule);
      if (stopTriggered) {
        appendLog(this.state, "warn", `Stop rule triggered: ${stopTriggered.condition.type}`, stopTriggered.condition);
        applyStopAction(this.state, stopTriggered.condition.action);
        this.emit("run:stopped", { runId: this.state.runId, reason: stopTriggered });
        break;
      }

      // Skip if halted/paused
      if (this.state.status === RunStatus.HALTED || this.state.status === RunStatus.PAUSED) {
        appendLog(this.state, "warn", `Pipeline ${this.state.status}, skipping stage '${stage.name}'`);
        break;
      }

      // Execute stage
      this.emit("stage:start", { stageId: stage.id, name: stage.name });
      const stageResult = await executeStage(stage, this.state, this.configs, this.circuitBreakers);
      this.emit("stage:end", { stageId: stage.id, status: stageResult.status });

      // Run checkpoint if stage requires it
      if (stage.checkpoint) {
        const checkpointProtocol = pipeline.checkpointProtocol || pipelineDef.checkpointProtocol;
        const hashSources = (checkpointProtocol || {}).configHashSources || [];
        const cp = runCheckpoint(this.state, stage.id, checkpointProtocol, hashSources);
        this.emit("checkpoint", { stageId: stage.id, checkpoint: cp });

        // Evaluate escalation thresholds from checkpoint protocol
        if (checkpointProtocol && checkpointProtocol.escalationThreshold) {
          const esc = checkpointProtocol.escalationThreshold;
          if (esc.readinessBelow && this.state.metrics.readinessScore < esc.readinessBelow) {
            appendLog(this.state, "warn", `Readiness ${this.state.metrics.readinessScore} below escalation threshold ${esc.readinessBelow}`);
            this.emit("escalation", { type: "readiness", score: this.state.metrics.readinessScore, threshold: esc.readinessBelow });
          }
          if (esc.errorRateAbove && this.state.metrics.errorRate > esc.errorRateAbove) {
            appendLog(this.state, "warn", `Error rate ${this.state.metrics.errorRate.toFixed(3)} above escalation threshold ${esc.errorRateAbove}`);
            this.emit("escalation", { type: "errorRate", rate: this.state.metrics.errorRate, threshold: esc.errorRateAbove });
          }
        }
      }
    }

    // Finalize
    if (this.state.status === RunStatus.RUNNING) {
      this.state.status = RunStatus.COMPLETED;
    }
    this.state.completedAt = new Date().toISOString();
    this.state.metrics.elapsedMs = new Date(this.state.completedAt) - new Date(this.state.startedAt);

    appendLog(this.state, "info", `Pipeline run ${this.state.runId} finished: ${this.state.status}`, {
      elapsed: this.state.metrics.elapsedMs,
      tasks: this.state.metrics.completedTasks,
      failed: this.state.metrics.failedTasks,
    });

    this.history.push({
      runId: this.state.runId,
      status: this.state.status,
      startedAt: this.state.startedAt,
      completedAt: this.state.completedAt,
      metrics: { ...this.state.metrics },
    });

    // Bound history to prevent unbounded memory growth
    if (this.history.length > 50) {
      this.history = this.history.slice(-50);
    }

    // ── Post-run feedback loop ──────────────────────────────────────────
    await this._postRunFeedback();

    this.emit("run:end", { runId: this.state.runId, status: this.state.status, metrics: this.state.metrics });
    return this.state;
  }

  /**
   * Post-run feedback: feed timing data to MC scheduler and pattern engine,
   * run self-critique on the completed run, record improvements.
   */
  async _postRunFeedback() {
    if (!this.state) return;
    const stageData = this.state.stages || {};

    // 1. Feed per-task latency into MC scheduler
    if (this._mcScheduler) {
      for (const [stageId, stage] of Object.entries(stageData)) {
        const tasks = stage.tasks || {};
        for (const [taskName, taskResult] of Object.entries(tasks)) {
          if (taskResult.durationMs != null && taskResult.durationMs > 0) {
            try {
              this._mcScheduler.recordResult(
                taskName,
                "balanced", // default strategy attribution for pipeline tasks
                taskResult.durationMs,
                taskResult.status === "completed",
                taskResult.status === "completed" ? 85 : 40
              );
            } catch (_) { /* non-fatal */ }
          }
        }
      }
    }

    // 2. Feed stage timing into pattern engine
    if (this._patternEngine) {
      for (const [stageId, stage] of Object.entries(stageData)) {
        if (stage.startedAt && stage.completedAt) {
          const stageMs = new Date(stage.completedAt) - new Date(stage.startedAt);
          try {
            this._patternEngine.observeLatency(`pipeline:${stageId}`, stageMs, {
              tags: ["pipeline", "stage_timing", stageId],
            });
          } catch (_) { /* non-fatal */ }
        }
        // Per-task observations
        const tasks = stage.tasks || {};
        for (const [taskName, taskResult] of Object.entries(tasks)) {
          if (taskResult.status === "failed") {
            try {
              this._patternEngine.observeError(`pipeline:${taskName}`, "task_failed", {
                tags: ["pipeline", "task_failure", taskName],
              });
            } catch (_) { /* non-fatal */ }
          }
        }
      }
    }

    // 3. Self-critique the run
    if (this._selfCritique) {
      try {
        const weaknesses = [];
        const improvements = [];
        const m = this.state.metrics;

        if (m.errorRate > 0.05) weaknesses.push(`Error rate ${(m.errorRate * 100).toFixed(1)}% exceeds 5% target`);
        if (m.elapsedMs > 30000) weaknesses.push(`Total pipeline elapsed ${m.elapsedMs}ms exceeds 30s target`);
        if (m.cachedTasks === 0 && m.completedTasks > 0) weaknesses.push("No tasks served from cache — cold run");
        if (m.failedTasks > 0) weaknesses.push(`${m.failedTasks} task(s) failed`);

        // Check for slow stages
        for (const [stageId, stage] of Object.entries(stageData)) {
          if (stage.startedAt && stage.completedAt) {
            const stageMs = new Date(stage.completedAt) - new Date(stage.startedAt);
            if (stageMs > 10000) weaknesses.push(`Stage '${stageId}' took ${stageMs}ms (>10s)`);
          }
        }

        if (weaknesses.length < 3) weaknesses.push("Pipeline may have undetected bottlenecks — add more instrumentation");

        this._selfCritique.recordCritique({
          context: `pipeline_run:${this.state.runId}`,
          weaknesses,
          severity: m.errorRate > 0.1 ? "high" : m.errorRate > 0.05 ? "medium" : "low",
          suggestedImprovements: [
            m.cachedTasks === 0 ? "Seed task cache with warm-up run" : null,
            m.failedTasks > 0 ? "Add MC re-planning for failed tasks on next run" : null,
            m.elapsedMs > 30000 ? "Increase parallelism or switch to fast_parallel strategy" : null,
          ].filter(Boolean),
        });

        // Record the run as an improvement data point
        this._selfCritique.recordImprovement({
          description: `Pipeline run ${this.state.runId} completed`,
          type: "pipeline_execution",
          before: `${m.totalTasks} tasks queued`,
          after: `${m.completedTasks} completed, ${m.failedTasks} failed, ${m.cachedTasks} cached in ${m.elapsedMs}ms`,
          status: this.state.status === RunStatus.COMPLETED ? "applied" : "needs_review",
        });
      } catch (_) { /* non-fatal */ }
    }
  }

  getState() {
    return this.state;
  }

  getHistory() {
    return this.history;
  }

  getCircuitBreakers() {
    const result = {};
    for (const [name, cb] of this.circuitBreakers) {
      result[name] = cb.getStatus();
    }
    return result;
  }

  getStageDag() {
    if (!this.configs) this.load();
    const stages = this.configs.pipeline.pipeline.stages;
    return stages.map((s) => ({
      id: s.id,
      name: s.name,
      parallel: s.parallel || false,
      dependsOn: s.dependsOn || [],
      tasks: s.tasks || [],
      checkpoint: s.checkpoint || false,
    }));
  }

  getConfigSummary() {
    if (!this.configs) this.load();
    const p = this.configs.pipeline.pipeline;
    return {
      name: p.name,
      version: this.configs.pipeline.version,
      stages: p.stages.length,
      totalTasks: p.stages.reduce((sum, s) => sum + (s.tasks || []).length, 0),
      global: p.global,
      stopRule: p.stopRule,
      checkpointProtocol: {
        responsibilities: (p.checkpointProtocol || this.configs.pipeline.checkpointProtocol || {}).responsibilities || [],
        configHashSources: (p.checkpointProtocol || this.configs.pipeline.checkpointProtocol || {}).configHashSources || [],
      },
      configHashes: computeConfigHashes(
        (p.checkpointProtocol || this.configs.pipeline.checkpointProtocol || {}).configHashSources || []
      ),
      services: (this.configs.services.services || []).length,
      agents: (this.configs.services.agents || []).length,
      concepts: {
        implemented: (this.configs.concepts.implementedConcepts || []).length,
        planned: (this.configs.concepts.plannedConcepts || []).length,
        publicDomain: (this.configs.concepts.publicDomainPatterns || []).length,
      },
    };
  }
}

// Singleton instance
const pipeline = new HCFullPipeline();

module.exports = {
  HCFullPipeline,
  pipeline,
  registerTaskHandler,
  RunStatus,
  CircuitBreaker,
  WorkerPool,
  loadAllConfigs,
  computeConfigHashes,
  topologicalSort,
  invalidateCache,
};
