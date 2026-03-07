/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * Auto-Success Task Catalog — 135+ tasks across 9 categories.
 * Extracted from hc_auto_success.js for maintainability.
 */

// ─── EXTERNAL TASK SOURCES ──────────────────────────────────────────────────
let extraTasks = [];
try { extraTasks = require('../auto-flow-tasks.json'); } catch (e) { }
let nonprofitTasks = [];
try { nonprofitTasks = require('../nonprofit-tasks.json'); } catch (e) { }
let buddyTasks = [];
try { buddyTasks = require('../buddy-tasks.json'); } catch (e) { }
let prodOptTasks = [];
try { prodOptTasks = require('./production-optimization-tasks.json'); } catch (e) { }

const TASK_CATALOG = [
    ...extraTasks,
    ...nonprofitTasks,
    ...buddyTasks,
    ...prodOptTasks,
    // ═══ LEARNING (20) — Targeted system learning ═══════════════════════════
    { id: "learn-001", name: "Analyze config drift patterns", cat: "learning", pool: "warm", w: 3, desc: "Compare current configs against historical snapshots to detect drift" },
    { id: "learn-002", name: "Study service dependency graph", cat: "learning", pool: "warm", w: 3, desc: "Map and analyze inter-service dependencies for optimization" },
    { id: "learn-003", name: "Profile API response latencies", cat: "learning", pool: "warm", w: 4, desc: "Collect and analyze response time distributions across endpoints" },
    { id: "learn-004", name: "Review pipeline stage timing", cat: "learning", pool: "warm", w: 3, desc: "Analyze HCFullPipeline stage execution times for bottleneck ID" },
    { id: "learn-005", name: "Index configuration parameters", cat: "learning", pool: "cold", w: 2, desc: "Build searchable index of all YAML config params and relationships" },
    { id: "learn-006", name: "Map node capability matrix", cat: "learning", pool: "warm", w: 3, desc: "Update the capability matrix for all registered Heady nodes" },
    { id: "learn-007", name: "Analyze error frequency distribution", cat: "learning", pool: "warm", w: 4, desc: "Study error patterns to identify systemic vs transient failures" },
    { id: "learn-008", name: "Profile memory allocation patterns", cat: "learning", pool: "warm", w: 3, desc: "Track heap and RSS memory patterns to predict pressure points" },
    { id: "learn-009", name: "Study event bus throughput", cat: "learning", pool: "cold", w: 2, desc: "Measure event emission rates and listener response times" },
    { id: "learn-010", name: "Catalog available integrations", cat: "learning", pool: "cold", w: 2, desc: "Enumerate all integration points and their current utilization" },
    { id: "learn-011", name: "Analyze circuit breaker trip patterns", cat: "learning", pool: "warm", w: 3, desc: "Study which circuit breakers trip most and correlate with conditions" },
    { id: "learn-012", name: "Profile worker pool utilization", cat: "learning", pool: "warm", w: 3, desc: "Measure concurrency saturation across hot/warm/cold pools" },
    { id: "learn-013", name: "Map orchestrator routing decisions", cat: "learning", pool: "cold", w: 2, desc: "Track HCSysOrchestrator routing patterns for optimization paths" },
    { id: "learn-014", name: "Study HeadySims convergence rates", cat: "learning", pool: "warm", w: 3, desc: "Analyze Monte Carlo simulation convergence for strategy tuning" },
    { id: "learn-015", name: "Review self-critique effectiveness", cat: "learning", pool: "cold", w: 2, desc: "Measure if self-critique recommendations lead to improvements" },
    { id: "learn-016", name: "Analyze story driver narrative quality", cat: "learning", pool: "cold", w: 2, desc: "Review generated narratives for coherence and actionability" },
    { id: "learn-017", name: "Profile checkpoint protocol timing", cat: "learning", pool: "warm", w: 3, desc: "Measure checkpoint save/restore times for pipeline resilience" },
    { id: "learn-018", name: "Study task cache hit rates", cat: "learning", pool: "warm", w: 3, desc: "Analyze cache effectiveness and identify wasteful entries" },
    { id: "learn-019", name: "Map brain connector endpoint health", cat: "learning", pool: "warm", w: 4, desc: "Track brain endpoint availability patterns over time" },
    { id: "learn-020", name: "Analyze registry node activation patterns", cat: "learning", pool: "cold", w: 2, desc: "Study which nodes activate together and optimize sequences" },

    // ═══ OPTIMIZATION (20) — Performance tuning ════════════════════════════
    { id: "opt-001", name: "Optimize hot pool task ordering", cat: "optimization", pool: "hot", w: 5, desc: "Reorder hot pool tasks based on learned dependency timing" },
    { id: "opt-002", name: "Tune circuit breaker thresholds", cat: "optimization", pool: "warm", w: 4, desc: "Adjust failure thresholds based on actual error rates" },
    { id: "opt-003", name: "Rebalance worker pool concurrency", cat: "optimization", pool: "warm", w: 4, desc: "Adjust pool sizes based on current resource availability" },
    { id: "opt-004", name: "Compress task cache entries", cat: "optimization", pool: "cold", w: 2, desc: "Remove stale cache entries and compact cache storage" },
    { id: "opt-005", name: "Optimize event listener chains", cat: "optimization", pool: "warm", w: 3, desc: "Profile and streamline eventBus listener execution order" },
    { id: "opt-006", name: "Tune HeadySims cycle parameters", cat: "optimization", pool: "warm", w: 3, desc: "Adjust Monte Carlo parameters based on convergence analysis" },
    { id: "opt-007", name: "Optimize config reload frequency", cat: "optimization", pool: "cold", w: 2, desc: "Balance config freshness against file I/O overhead" },
    { id: "opt-008", name: "Tune pattern engine analysis window", cat: "optimization", pool: "warm", w: 3, desc: "Adjust sliding window sizes for optimal pattern detection" },
    { id: "opt-009", name: "Optimize log rotation schedules", cat: "optimization", pool: "cold", w: 2, desc: "Set rotation based on actual log volume patterns" },
    { id: "opt-010", name: "Tune improvement scheduler interval", cat: "optimization", pool: "warm", w: 3, desc: "Adjust 15-min cycle based on improvement generation rates" },
    { id: "opt-011", name: "Optimize conductor poll frequency", cat: "optimization", pool: "warm", w: 3, desc: "Balance system visibility against poll overhead" },
    { id: "opt-012", name: "Tune brain connector pool size", cat: "optimization", pool: "warm", w: 4, desc: "Adjust connection pool based on brain endpoint patterns" },
    { id: "opt-013", name: "Optimize resource manager poll interval", cat: "optimization", pool: "warm", w: 3, desc: "Balance resource awareness against CPU overhead from polling" },
    { id: "opt-014", name: "Tune safe mode activation thresholds", cat: "optimization", pool: "warm", w: 4, desc: "Prevent premature safe mode while protecting against overload" },
    { id: "opt-015", name: "Optimize pipeline stage parallelism", cat: "optimization", pool: "hot", w: 5, desc: "Increase parallel execution where stages are independent" },
    { id: "opt-016", name: "Tune connectivity pattern retention", cat: "optimization", pool: "cold", w: 2, desc: "Optimize how many connectivity patterns to retain for analysis" },
    { id: "opt-017", name: "Optimize Notion sync batch size", cat: "optimization", pool: "cold", w: 2, desc: "Balance sync completeness against API rate limits" },
    { id: "opt-018", name: "Tune self-critique severity thresholds", cat: "optimization", pool: "warm", w: 3, desc: "Calibrate severity levels to reduce false alarms" },
    { id: "opt-019", name: "Optimize middleware ordering", cat: "optimization", pool: "warm", w: 3, desc: "Profile Express middleware and optimize execution order" },
    { id: "opt-020", name: "Tune rate limiter parameters", cat: "optimization", pool: "warm", w: 3, desc: "Adjust rate limits based on actual traffic patterns" },

    // ═══ INTEGRATION (15) — Cross-system connectivity ═════════════════════
    { id: "int-001", name: "Validate service mesh connectivity", cat: "integration", pool: "warm", w: 4, desc: "Test all inter-service connections and log results" },
    { id: "int-002", name: "Sync registry with active services", cat: "integration", pool: "warm", w: 3, desc: "Ensure heady-registry.json reflects actual availability" },
    { id: "int-003", name: "Verify MCP tool endpoint coverage", cat: "integration", pool: "warm", w: 3, desc: "Confirm all MCP tools have working backend endpoints" },
    { id: "int-004", name: "Test brain API endpoint rotation", cat: "integration", pool: "warm", w: 4, desc: "Verify brain connector failover works correctly" },
    { id: "int-005", name: "Validate Conductor–Lens agreement", cat: "integration", pool: "warm", w: 3, desc: "Compare conductor macro vs lens micro for blind spots" },
    { id: "int-006", name: "Test eventBus producer–consumer chains", cat: "integration", pool: "warm", w: 3, desc: "Verify all eventBus emitters have corresponding listeners" },
    { id: "int-007", name: "Validate pipeline–MC scheduler wiring", cat: "integration", pool: "warm", w: 3, desc: "Confirm pipeline timing data feeds into Monte Carlo" },
    { id: "int-008", name: "Verify pattern engine–self-critique loop", cat: "integration", pool: "warm", w: 3, desc: "Confirm pattern stagnation triggers self-critique" },
    { id: "int-009", name: "Test resource mgr–task scheduler wire", cat: "integration", pool: "warm", w: 3, desc: "Verify safe mode propagates from resource mgr to scheduler" },
    { id: "int-010", name: "Validate story driver event ingestion", cat: "integration", pool: "cold", w: 2, desc: "Confirm all system events route into story narratives" },
    { id: "int-011", name: "Sync HeadyBuddy conversation context", cat: "integration", pool: "cold", w: 2, desc: "Ensure buddy chat has access to current system state" },
    { id: "int-012", name: "Verify Notion audit trail integrity", cat: "integration", pool: "cold", w: 2, desc: "Confirm Notion sync state matches actual operations" },
    { id: "int-013", name: "Test orchestrator multi-brain routing", cat: "integration", pool: "warm", w: 4, desc: "Verify HCSysOrchestrator correctly routes to brain layers" },
    { id: "int-014", name: "Validate HCFP interceptor pipeline", cat: "integration", pool: "warm", w: 4, desc: "Confirm HCFP HeadyBattle interceptor catches events" },
    { id: "int-015", name: "Test auto-task conversion pipeline", cat: "integration", pool: "warm", w: 3, desc: "Verify recommendation events convert to tasks" },

    // ═══ MONITORING (15) — Continuous health tracking ═════════════════════
    { id: "mon-001", name: "Track CPU utilization trend", cat: "monitoring", pool: "warm", w: 4, desc: "Monitor CPU patterns and predict future pressure" },
    { id: "mon-002", name: "Track RAM utilization trend", cat: "monitoring", pool: "warm", w: 4, desc: "Monitor memory patterns and predict OOM risk" },
    { id: "mon-003", name: "Monitor disk usage growth rate", cat: "monitoring", pool: "cold", w: 2, desc: "Track disk consumption and alert on approaching limits" },
    { id: "mon-004", name: "Track service response time SLAs", cat: "monitoring", pool: "hot", w: 5, desc: "Monitor response times against SLA targets" },
    { id: "mon-005", name: "Monitor event bus queue depth", cat: "monitoring", pool: "warm", w: 3, desc: "Track event backlog for early bottleneck detection" },
    { id: "mon-006", name: "Track error rate per service", cat: "monitoring", pool: "warm", w: 4, desc: "Monitor error rates and trigger alerts on anomalies" },
    { id: "mon-007", name: "Monitor node heartbeat freshness", cat: "monitoring", pool: "warm", w: 3, desc: "Track last-seen timestamps for registered nodes" },
    { id: "mon-008", name: "Track pipeline run duration trends", cat: "monitoring", pool: "warm", w: 3, desc: "Monitor pipeline times for degradation detection" },
    { id: "mon-009", name: "Monitor brain endpoint health scores", cat: "monitoring", pool: "warm", w: 4, desc: "Track brain connector health across all endpoints" },
    { id: "mon-010", name: "Track connectivity pattern anomalies", cat: "monitoring", pool: "cold", w: 2, desc: "Detect unusual connectivity patterns in service mesh" },
    { id: "mon-011", name: "Monitor safe mode activation frequency", cat: "monitoring", pool: "warm", w: 3, desc: "Track how often and why safe mode activates" },
    { id: "mon-012", name: "Track pattern engine convergence health", cat: "monitoring", pool: "warm", w: 3, desc: "Monitor whether patterns converge or stagnate" },
    { id: "mon-013", name: "Monitor HeadySims drift frequency", cat: "monitoring", pool: "warm", w: 3, desc: "Track Monte Carlo drift alerts and resolution" },
    { id: "mon-014", name: "Track improvement implementation rate", cat: "monitoring", pool: "cold", w: 2, desc: "Monitor how many improvements get implemented" },
    { id: "mon-015", name: "Monitor continuous pipeline gate health", cat: "monitoring", pool: "warm", w: 3, desc: "Track quality/resource/stability gate pass rates" },

    // ═══ MAINTENANCE (15) — System housekeeping ═══════════════════════════
    { id: "maint-001", name: "Rotate conductor orchestration logs", cat: "maintenance", pool: "cold", w: 2, desc: "Trim conductor log to prevent unbounded memory growth" },
    { id: "maint-002", name: "Clean stale connectivity patterns", cat: "maintenance", pool: "cold", w: 2, desc: "Remove connectivity patterns older than 48 hours" },
    { id: "maint-003", name: "Compact task result cache", cat: "maintenance", pool: "cold", w: 2, desc: "Remove expired and low-value cache entries" },
    { id: "maint-004", name: "Validate registry node consistency", cat: "maintenance", pool: "warm", w: 3, desc: "Ensure heady-registry.json has no orphaned entries" },
    { id: "maint-005", name: "Clean expired circuit breaker states", cat: "maintenance", pool: "cold", w: 2, desc: "Reset circuit breakers past their timeout" },
    { id: "maint-006", name: "Trim service stub activity logs", cat: "maintenance", pool: "cold", w: 2, desc: "Cap service stub logs to prevent memory bloat" },
    { id: "maint-007", name: "Verify data directory integrity", cat: "maintenance", pool: "cold", w: 2, desc: "Ensure data/ files are valid JSON and not corrupted" },
    { id: "maint-008", name: "Update pipeline run history TTL", cat: "maintenance", pool: "cold", w: 2, desc: "Archive old pipeline runs and keep history compact" },
    { id: "maint-009", name: "Clean orphaned event listeners", cat: "maintenance", pool: "warm", w: 3, desc: "Detect and remove listeners for destroyed components" },
    { id: "maint-010", name: "Refresh node capability metadata", cat: "maintenance", pool: "warm", w: 3, desc: "Update node metadata from registry for fresh tracking" },
    { id: "maint-011", name: "Verify config file parse-ability", cat: "maintenance", pool: "cold", w: 2, desc: "Test-parse all YAML configs to catch syntax errors early" },
    { id: "maint-012", name: "Compact auto-success task history", cat: "maintenance", pool: "cold", w: 1, desc: "Trim auto-success history to cap at 2000 entries" },
    { id: "maint-013", name: "Reset stale pattern observations", cat: "maintenance", pool: "cold", w: 2, desc: "Clear pattern engine observations older than window" },
    { id: "maint-014", name: "Validate Notion sync state integrity", cat: "maintenance", pool: "cold", w: 2, desc: "Ensure Notion sync state matches actual sync status" },
    { id: "maint-015", name: "Health-check all mounted routers", cat: "maintenance", pool: "warm", w: 3, desc: "Verify all Express routers respond without errors" },

    // ═══ DISCOVERY (15) — Finding new opportunities ═══════════════════════
    { id: "disc-001", name: "Scan for unused config parameters", cat: "discovery", pool: "cold", w: 2, desc: "Find config params defined but never referenced in code" },
    { id: "disc-002", name: "Identify underutilized node capabilities", cat: "discovery", pool: "warm", w: 3, desc: "Find node capabilities that are rarely exercised" },
    { id: "disc-003", name: "Discover cross-service optimization paths", cat: "discovery", pool: "warm", w: 4, desc: "Identify where services could share data" },
    { id: "disc-004", name: "Map potential parallelization points", cat: "discovery", pool: "warm", w: 3, desc: "Find sequential operations that could run in parallel" },
    { id: "disc-005", name: "Identify recurring error patterns", cat: "discovery", pool: "warm", w: 4, desc: "Discover error patterns suggesting architecture improvements" },
    { id: "disc-006", name: "Scan for caching opportunities", cat: "discovery", pool: "warm", w: 3, desc: "Find repeatedly computed values that benefit from caching" },
    { id: "disc-007", name: "Discover integration gaps", cat: "discovery", pool: "warm", w: 3, desc: "Find services that should be wired together but aren't" },
    { id: "disc-008", name: "Identify resource waste patterns", cat: "discovery", pool: "warm", w: 4, desc: "Find allocated resources not effectively utilized" },
    { id: "disc-009", name: "Map potential automation targets", cat: "discovery", pool: "cold", w: 2, desc: "Identify manual processes that could be automated" },
    { id: "disc-010", name: "Discover latency reduction opportunities", cat: "discovery", pool: "hot", w: 5, desc: "Find top latency contributors and model reduction paths" },
    { id: "disc-011", name: "Scan for missing health endpoints", cat: "discovery", pool: "cold", w: 2, desc: "Find services without health endpoints" },
    { id: "disc-012", name: "Identify event bus dead letter paths", cat: "discovery", pool: "warm", w: 3, desc: "Find events emitted but never consumed" },
    { id: "disc-013", name: "Discover config simplification paths", cat: "discovery", pool: "cold", w: 2, desc: "Find redundant or overlapping configuration entries" },
    { id: "disc-014", name: "Map public domain best practice alignment", cat: "discovery", pool: "cold", w: 2, desc: "Compare architecture against industry best practices" },
    { id: "disc-015", name: "Identify capacity scaling trigger points", cat: "discovery", pool: "warm", w: 3, desc: "Discover thresholds where scaling decisions should trigger" },

    // ═══ VERIFICATION (15) — HeadyVerifier: Liquid Architecture Compliance ══
    { id: "verify-001", name: "Verify component capability definitions", cat: "verification", pool: "warm", w: 5, desc: "Ensure all components define capabilities, not static locations" },
    { id: "verify-002", name: "Verify multi-presence allocation", cat: "verification", pool: "warm", w: 5, desc: "Confirm each component has presences in all sensible locations" },
    { id: "verify-003", name: "Verify context-aware routing active", cat: "verification", pool: "hot", w: 5, desc: "Confirm LiquidAllocator context analysis runs on every flow" },
    { id: "verify-004", name: "Verify affinity scoring accuracy", cat: "verification", pool: "warm", w: 4, desc: "Validate affinity scores correlate with actual component fitness" },
    { id: "verify-005", name: "Verify no static service binding", cat: "verification", pool: "warm", w: 5, desc: "Ensure no service is hardwired — all route through liquid allocator" },
    { id: "verify-006", name: "Verify always-present components active", cat: "verification", pool: "hot", w: 5, desc: "Confirm patterns, auto-success, stream, and cloud are always present" },
    { id: "verify-007", name: "Verify flow decision SSE broadcast", cat: "verification", pool: "warm", w: 3, desc: "Confirm liquid flow decisions broadcast via SSE for real-time visibility" },
    { id: "verify-008", name: "Verify liquid state persistence", cat: "verification", pool: "cold", w: 2, desc: "Confirm liquid allocator state persists to disk every 60s" },
    { id: "verify-009", name: "Verify circuit breaker liquid coverage", cat: "verification", pool: "warm", w: 4, desc: "Ensure all critical liquid components have circuit breaker protection" },
    { id: "verify-010", name: "Verify dynamic allocation under pressure", cat: "verification", pool: "warm", w: 4, desc: "Confirm allocator reduces allocation count under resource pressure" },
    { id: "verify-011", name: "Verify cross-domain component availability", cat: "verification", pool: "warm", w: 4, desc: "Ensure components are available across all 7 Heady domains" },
    { id: "verify-012", name: "Verify HeadyBuddy bridge connectivity", cat: "verification", pool: "warm", w: 3, desc: "Confirm HeadyBuddy can access all services via bridge proxy" },
    { id: "verify-013", name: "Verify registry reflects liquid state", cat: "verification", pool: "warm", w: 4, desc: "Ensure heady-registry.json is updated with liquid allocation data" },
    { id: "verify-014", name: "Verify best-practice scores above threshold", cat: "verification", pool: "warm", w: 5, desc: "Confirm deep-scan best practice scores are >= 0.8 across all evaluators" },
    { id: "verify-015", name: "Verify cloud connector domain completeness", cat: "verification", pool: "cold", w: 3, desc: "Confirm all 7 domains and their subdomains are mapped in cloud status" },

    // ═══ CREATIVE (10) — HeadyCreative Engine Health ════════════════════════
    { id: "create-001", name: "Monitor creative engine job throughput", cat: "creative", pool: "warm", w: 4, desc: "Track jobs per minute and identify throughput bottlenecks" },
    { id: "create-002", name: "Verify model routing accuracy", cat: "creative", pool: "warm", w: 5, desc: "Confirm input→output routes to optimal models" },
    { id: "create-003", name: "Track pipeline completion rates", cat: "creative", pool: "warm", w: 4, desc: "Monitor multi-step pipeline success across all 8 pipelines" },
    { id: "create-004", name: "Monitor creative session persistence", cat: "creative", pool: "cold", w: 2, desc: "Ensure active sessions maintain state correctly" },
    { id: "create-005", name: "Verify input type coverage", cat: "creative", pool: "warm", w: 3, desc: "Confirm all 9 input types are routable to at least one model" },
    { id: "create-006", name: "Track error absorption patterns", cat: "creative", pool: "warm", w: 3, desc: "Monitor which creative operations absorb errors most frequently" },
    { id: "create-007", name: "Verify SSE creative job broadcast", cat: "creative", pool: "warm", w: 3, desc: "Confirm creative job completions broadcast via SSE" },
    { id: "create-008", name: "Monitor model provider availability", cat: "creative", pool: "hot", w: 5, desc: "Track which AI providers are responsive for creative tasks" },
    { id: "create-009", name: "Verify remix multi-input processing", cat: "creative", pool: "warm", w: 4, desc: "Confirm remix endpoint handles 2+ inputs correctly" },
    { id: "create-010", name: "Track creative output quality scores", cat: "creative", pool: "warm", w: 4, desc: "Monitor HeadyVinci's quality evaluation of creative outputs" },

    // ═══ DEEP-INTEL (10) — Deep System Intelligence Protocol ════════════════
    { id: "intel-001", name: "Monitor 3D vector store health", cat: "deep-intel", pool: "warm", w: 4, desc: "Track vector count, clustering quality, and dimension utilization" },
    { id: "intel-002", name: "Verify audit chain integrity", cat: "deep-intel", pool: "hot", w: 5, desc: "Validate SHA-256 hash chain continuity in deterministic behavior audit" },
    { id: "intel-003", name: "Track perspective coverage completeness", cat: "deep-intel", pool: "warm", w: 4, desc: "Ensure all 10 analysis perspectives are contributing findings" },
    { id: "intel-004", name: "Monitor Heady node utilization rates", cat: "deep-intel", pool: "warm", w: 3, desc: "Track which of the 10 Heady nodes are being invoked and their contribution" },
    { id: "intel-005", name: "Verify vector cluster quality", cat: "deep-intel", pool: "cold", w: 3, desc: "Analyze cluster distribution and identify under-connected regions" },
    { id: "intel-006", name: "Track composite scan score trends", cat: "deep-intel", pool: "warm", w: 4, desc: "Monitor project health scores over time for improvement trajectory" },
    { id: "intel-007", name: "Monitor multi-perspective data richness", cat: "deep-intel", pool: "warm", w: 4, desc: "Verify each stored vector has comprehensive perspective coverage" },
    { id: "intel-008", name: "Verify nearest-neighbor query accuracy", cat: "deep-intel", pool: "cold", w: 3, desc: "Test 3D spatial queries return semantically related vectors" },
    { id: "intel-009", name: "Track HeadyResearch recon success rate", cat: "deep-intel", pool: "warm", w: 4, desc: "Monitor best-practice discovery and implementation matching" },
    { id: "intel-010", name: "Monitor HeadyBattle competitive analysis freshness", cat: "deep-intel", pool: "warm", w: 3, desc: "Ensure competitive benchmarks are recent and relevant" },

    // ═══ HIVE-INTEGRATION (20) — External APIs, MCP Aggregation, SDK ════════
    { id: "hive-001", name: "HeadyCompute Assistants API health check", cat: "hive-integration", pool: "warm", w: 4, desc: "Validate HeadyCompute file search / retrieval API endpoint availability" },
    { id: "hive-002", name: "HeadyCompute embeddings endpoint readiness", cat: "hive-integration", pool: "warm", w: 4, desc: "Test text-embedding-3-small endpoint availability and latency" },
    { id: "hive-003", name: "HeadyCompute batch API queue depth", cat: "hive-integration", pool: "cold", w: 2, desc: "Check pending batch job status and completion rate" },
    { id: "hive-004", name: "Google Cloud Vertex AI health", cat: "hive-integration", pool: "warm", w: 3, desc: "Ping Vertex AI prediction endpoint and check quota" },
    { id: "hive-005", name: "Google Cloud Vision API readiness", cat: "hive-integration", pool: "cold", w: 2, desc: "Test Vision API with lightweight probe request" },
    { id: "hive-006", name: "Google Cloud NLP availability", cat: "hive-integration", pool: "cold", w: 2, desc: "Validate Natural Language API entity/sentiment endpoints" },
    { id: "hive-007", name: "Google BigQuery connection test", cat: "hive-integration", pool: "cold", w: 2, desc: "Verify BigQuery dataset access and query capability" },
    { id: "hive-008", name: "GitHub MCP server connectivity", cat: "hive-integration", pool: "warm", w: 4, desc: "Test upstream GitHub MCP server for PR/issue tool availability" },
    { id: "hive-009", name: "Puppeteer MCP server readiness", cat: "hive-integration", pool: "cold", w: 2, desc: "Validate browser automation MCP server connection" },
    { id: "hive-010", name: "Memory MCP knowledge graph sync", cat: "hive-integration", pool: "warm", w: 4, desc: "Check memory MCP server persistence and entity retrieval" },
    { id: "hive-011", name: "LiteLLM gateway model roster check", cat: "hive-integration", pool: "warm", w: 4, desc: "Verify all registered models callable through LiteLLM proxy" },
    { id: "hive-012", name: "Heady Hive SDK package integrity", cat: "hive-integration", pool: "warm", w: 3, desc: "Validate heady-hive-sdk exports, dependencies, and version" },
    { id: "hive-013", name: "SDK authentication flow test", cat: "hive-integration", pool: "warm", w: 4, desc: "Test token issue → verify → refresh lifecycle through SDK" },
    { id: "hive-014", name: "SDK event streaming health", cat: "hive-integration", pool: "warm", w: 3, desc: "Validate SSE client connection, heartbeat, and reconnect" },
    { id: "hive-015", name: "MCP aggregator tool count validation", cat: "hive-integration", pool: "warm", w: 3, desc: "Confirm all upstream MCP tools registered in aggregator" },
    { id: "hive-016", name: "Cloudflare Workers edge latency", cat: "hive-integration", pool: "cold", w: 2, desc: "Measure Cloudflare Worker response time from origin" },
    { id: "hive-017", name: "HeadyCompute Retrieval index freshness", cat: "hive-integration", pool: "cold", w: 2, desc: "Check assistant file upload age and vector store status" },
    { id: "hive-018", name: "Cross-provider model availability sync", cat: "hive-integration", pool: "warm", w: 4, desc: "Ensure model availability consistent across HeadyJules/Codex/HeadyPythia/Grok" },
    { id: "hive-019", name: "SDK client connection pool monitor", cat: "hive-integration", pool: "warm", w: 3, desc: "Track active SDK client connections and pool health" },
    { id: "hive-020", name: "Hive integration compliance audit", cat: "hive-integration", pool: "hot", w: 5, desc: "Full sweep of all external integrations, APIs, and SDK endpoints" },

    // ═══ MOP — MASTER ORCHESTRATION PROTOCOL (45) ════════════════════════════
    // Security Shield Protocol
    { id: "mop-sec-001", name: "Purge .env.hybrid from Git history", cat: "mop-security", pool: "hot", w: 5, desc: "Run git filter-repo/BFG to erase all .env.hybrid commits from history" },
    { id: "mop-sec-002", name: "Rotate leaked DB credentials", cat: "mop-security", pool: "hot", w: 5, desc: "Rotate heady_secret PostgreSQL credentials and update all services" },
    { id: "mop-sec-003", name: "Enable GitHub secret scanning org-wide", cat: "mop-security", pool: "hot", w: 5, desc: "Activate GitHub Advanced Security secret scanning on HeadyMe org" },
    { id: "mop-sec-004", name: "Remove tracked metadata files", cat: "mop-security", pool: "warm", w: 4, desc: "git rm --cached server.pid, *.jsonl, *.bak from index" },
    { id: "mop-sec-005", name: "Cryptographic signing for MCP servers", cat: "mop-security", pool: "warm", w: 4, desc: "Sign all deployed MCP server artifacts with verified checksums" },

    // Architectural Modularization
    { id: "mop-arch-001", name: "Decompose heady-manager.js God class", cat: "mop-architecture", pool: "hot", w: 5, desc: "Split 1158-line heady-manager.js into src/routing, orchestrator, health modules" },
    { id: "mop-arch-002", name: "Decompose site-generator.js", cat: "mop-architecture", pool: "hot", w: 5, desc: "Split 91KB site-generator into factory pattern with template JSON schemas" },
    { id: "mop-arch-003", name: "Separate Python and Node.js codebases", cat: "mop-architecture", pool: "warm", w: 4, desc: "Isolate Python AI logic into /services/py-core with own requirements.txt" },
    { id: "mop-arch-004", name: "Merge duplicate config directories", cat: "mop-architecture", pool: "warm", w: 3, desc: "Audit and consolidate config/ and configs/ into single authoritative dir" },
    { id: "mop-arch-005", name: "Consolidate PowerShell build scripts", cat: "mop-architecture", pool: "warm", w: 3, desc: "Merge 4 hcautobuild*.ps1 scripts into single Build-Heady.ps1 with params" },

    // Documentation & Versioning
    { id: "mop-doc-001", name: "Consolidate README files into /docs portal", cat: "mop-docs", pool: "warm", w: 3, desc: "Merge 7+ README files into single organized /docs/ documentation portal" },
    { id: "mop-doc-002", name: "Sync all version references to registry", cat: "mop-docs", pool: "warm", w: 3, desc: "Make heady-registry.json single source of truth, sync package.json + .env" },
    { id: "mop-doc-003", name: "Formalize Sacred Geometry architecture docs", cat: "mop-docs", pool: "cold", w: 2, desc: "Document Sacred Geometry + Pentagonal Architecture in technical specs" },

    // Structured Logging + Redis + Firestore
    { id: "mop-infra-001", name: "Replace console.log with pino structured logger", cat: "mop-infrastructure", pool: "hot", w: 5, desc: "Deploy pino JSON logger across all services, deprecate console.log" },
    { id: "mop-infra-002", name: "Implement Redis connection pooling", cat: "mop-infrastructure", pool: "hot", w: 5, desc: "Configure aggressive TCP connection pooling for agent state sharing" },
    { id: "mop-infra-003", name: "Add Firestore persistent artifact storage", cat: "mop-infrastructure", pool: "warm", w: 4, desc: "Implement /artifacts/{appId}/ schema in Firestore for persistent data" },
    { id: "mop-infra-004", name: "Schema segregation public vs agent data", cat: "mop-infrastructure", pool: "warm", w: 3, desc: "Enforce strict boundaries between public data and agent operational data" },

    // CI/CD Hardening
    { id: "mop-cicd-001", name: "Add post-deploy smoke tests", cat: "mop-cicd", pool: "warm", w: 4, desc: "Add automated smoke tests that ping /health after every Cloud Run deploy" },
    { id: "mop-cicd-002", name: "Unify build/deploy pipeline", cat: "mop-cicd", pool: "warm", w: 4, desc: "Merge fragmented deploy scripts into single CI/CD pipeline" },
    { id: "mop-cicd-003", name: "Add Cloud Run deploy step to deploy.yml", cat: "mop-cicd", pool: "warm", w: 3, desc: "Automate Cloud Run deployments in GitHub Actions" },
    { id: "mop-cicd-004", name: "Enforce branch protection on main", cat: "mop-cicd", pool: "warm", w: 3, desc: "Require mandatory peer reviews before merge to main" },

    // MCP Production Hardening
    { id: "mop-mcp-001", name: "Implement MCP Tool Search deferred loading", cat: "mop-mcp", pool: "hot", w: 5, desc: "Dynamic tool discovery instead of injecting all schemas — 90%+ token savings" },
    { id: "mop-mcp-002", name: "Design macro-tools for aggregate endpoints", cat: "mop-mcp", pool: "hot", w: 5, desc: "Replace granular CRUD MCP tools with high-level macro-tools (solve N+1)" },
    { id: "mop-mcp-003", name: "OAuth 2.1 for all MCP servers", cat: "mop-mcp", pool: "warm", w: 4, desc: "Implement OAuth 2.1 with .well-known/oauth-protected-resource on all MCP" },
    { id: "mop-mcp-004", name: "Non-deterministic MCP session IDs", cat: "mop-mcp", pool: "warm", w: 3, desc: "Use UUIDv4 session IDs and validate Origin/Host headers for CSRF prevention" },
    { id: "mop-mcp-005", name: "Pydantic/Zod strict data contracts", cat: "mop-mcp", pool: "warm", w: 4, desc: "Enforce strict I/O schemas on all agent communication with Zod validation" },

    // AI Gateway & Liquid Architecture
    { id: "mop-ai-001", name: "Deploy centralized AI Gateway", cat: "mop-ai-gateway", pool: "hot", w: 5, desc: "Central gateway for all outbound LLM traffic with token monitoring" },
    { id: "mop-ai-002", name: "Assign OpenAI Business as Supervisor Swarm", cat: "mop-ai-gateway", pool: "warm", w: 4, desc: "Route supervisor routing tasks through 2x OpenAI Business seats" },
    { id: "mop-ai-003", name: "Assign Claude Max as MCP Tool Caller", cat: "mop-ai-gateway", pool: "warm", w: 4, desc: "Deploy Claude Max for Code Execution and MCP Tool interaction" },
    { id: "mop-ai-004", name: "Assign Google AI Ultra for multimodal", cat: "mop-ai-gateway", pool: "warm", w: 4, desc: "Route multimodal analysis and GCloud integration to AI Ultra" },
    { id: "mop-ai-005", name: "Assign Perplexity Enterprise as Research Oracle", cat: "mop-ai-gateway", pool: "warm", w: 3, desc: "Route external truth grounding through Perplexity Enterprise API" },
    { id: "mop-ai-006", name: "Configure 3x Colab Pro+ compute nodes", cat: "mop-ai-gateway", pool: "warm", w: 4, desc: "Set up 3 decoupled Colab nodes: data synthesis, fine-tuning, validation" },
    { id: "mop-ai-007", name: "Intelligent model routing by complexity", cat: "mop-ai-gateway", pool: "hot", w: 5, desc: "Route cheap models for simple tasks, heavy models for complex reasoning" },
    { id: "mop-ai-008", name: "Per-agent token budget enforcement", cat: "mop-ai-gateway", pool: "warm", w: 4, desc: "Monitor and enforce per-agent token consumption budgets" },
    { id: "mop-ai-009", name: "Move model weights to HuggingFace Business", cat: "mop-ai-gateway", pool: "warm", w: 3, desc: "Move Sacred Geometry model weights and embeddings to 2x HF Business seats" },

    // Performance + Auth + Dynamic Sites
    { id: "mop-perf-001", name: "Standardized health endpoint JSON schema", cat: "mop-performance", pool: "warm", w: 4, desc: "Uniform /health response across ALL Cloud Run services" },
    { id: "mop-perf-002", name: "Binary inter-agent communication", cat: "mop-performance", pool: "warm", w: 3, desc: "Implement Protocol Buffers or MessagePack for agent communication" },
    { id: "mop-auth-001", name: "Standardize auth across all Heady surfaces", cat: "mop-auth", pool: "hot", w: 5, desc: "Unified auth middleware for Cloud Run, Workers, MCP, widgets — one template everywhere" },
    { id: "mop-auth-002", name: "Deploy Cloudflare Worker proxy for manager", cat: "mop-auth", pool: "warm", w: 4, desc: "Proxy manager.headysystems.com through Cloudflare Worker to Cloud Run" },
    { id: "mop-site-001", name: "Deploy site-generator as Cloud Run service", cat: "mop-sites", pool: "hot", w: 5, desc: "Interactive on-the-fly site builds tailored per user/audience on Cloud Run" },
    { id: "mop-site-002", name: "Per-user dynamic template rendering", cat: "mop-sites", pool: "warm", w: 4, desc: "Implement audience-aware template rendering for dynamic sites" },
    { id: "mop-site-003", name: "Remove PM2 site entries from ecosystem", cat: "mop-sites", pool: "warm", w: 3, desc: "Remove 40+ site PM2 entries from ecosystem.config.cjs" },
];

// ─── POOL PRIORITIES ────────────────────────────────────────────────────────
const POOL_PRIORITY = { hot: 0, warm: 1, cold: 2 };

module.exports = { TASK_CATALOG, POOL_PRIORITY };
