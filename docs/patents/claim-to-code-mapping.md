# Claim-to-Code Mapping
## Heady Latent OS — Reduction-to-Practice Evidence
### Version 1.0 | March 2026

> **DISCLAIMER**: This document maps patent claim elements to source code files for purposes of establishing reduction-to-practice evidence under 35 U.S.C. §§ 101–103 and 112. It is for internal strategic use only and does not constitute legal advice. This mapping does not create attorney-client privilege. Code files referenced should be maintained in a version-controlled repository with timestamped commit history to establish dates of conception and reduction to practice.

---

## How to Use This Document

This document serves three critical legal purposes:

1. **Reduction-to-Practice Evidence**: Demonstrates that each claimed invention was reduced to an actual working implementation (not just a concept), supporting the provisional patent dates.

2. **Written Description Support (§ 112(a))**: Confirms that specific code files implement each claim element, providing evidence that the specification's written description is supported by concrete implementation.

3. **Alice/Mayo § 101 Defense**: Demonstrates that the claimed inventions exist as specific, running software systems with measurable technical improvements — not abstract concepts.

**Code Commit Protocol**:
- All referenced files must be committed with timestamps **before** the provisional filing date for that patent
- Use `git log --follow <file>` to extract precise commit timestamps
- Retain commit history permanently — do not squash or rewrite history on patent-relevant commits

---

## Patent 1: CSL Geometric Logic Gates

**Heady Patent #1** | Provisional: [Date] | Non-Provisional Target: [Date]

### Claim Element → Code Mapping

| Claim Element | Code File | Function/Class | Description |
|---|---|---|---|
| **CSL engine processor** | `src/csl/geometric-gates.js` | `CSLEngine` class | Core engine executing geometric logic gate chains |
| **Geometric logic gates (angular interpolation)** | `src/csl/gate-types.js` | `angularInterpolateGate()` | Computes angular interpolation between input vectors |
| **Geometric logic gates (hypersphere projection)** | `src/csl/gate-types.js` | `hypersphereProjectionGate()` | Projects vectors onto unit hypersphere surface |
| **Geometric logic gates (affine rotation)** | `src/csl/gate-types.js` | `affineRotationGate()` | Applies affine rotation in embedding space |
| **Output vector in range [-1, +1]^n** | `src/csl/geometric-gates.js` | `normalizeOutput()` | L2 normalization ensuring output in valid range |
| **Gate composition engine** | `src/csl/gate-chain.js` | `GateChain.compose()` | Chains gate outputs as inputs to next gate |
| **Normalization operation** | `src/csl/gate-chain.js` | `intermediateNormalize()` | Per-gate normalization preventing semantic drift |
| **Confidence propagation module** | `src/csl/confidence-propagator.js` | `ConfidencePropagator` class | Tracks cumulative uncertainty across gate chain |
| **Final confidence score output** | `src/csl/confidence-propagator.js` | `computeFinalConfidence()` | Returns confidence alongside inference result |
| **Directed acyclic graph of gates** | `src/csl/gate-graph.js` | `GateGraph` class | DAG structure storing gate topology |
| **Inference rules encoded as DAGs** | `config/csl-engine-config.json` | `gateGraphDefinitions[]` | Production gate graph configurations |
| **Agent inference API** | `src/agents/csl-inference-engine.js` | `CSLInferenceEngine.infer()` | Agent-facing CSL invocation interface |
| **Benchmark (reduces hallucination %)** | `tests/csl/gate-accuracy-benchmark.test.js` | `runHallucinationBenchmark()` | Measures hallucination rate vs. binary logic baseline |

### Architecture Reference

```
┌──────────────────────────────────────────────┐
│  Agent Query (vector)                        │
│       ↓                                      │
│  Gate 1: angularInterpolateGate()            │  ← gate-types.js
│       ↓                                      │
│  intermediateNormalize()                     │  ← gate-chain.js
│       ↓                                      │
│  Gate 2: hypersphereProjectionGate()         │  ← gate-types.js
│       ↓                                      │
│  ConfidencePropagator.accumulate()           │  ← confidence-propagator.js
│       ↓                                      │
│  {outputVector, confidenceScore}             │
└──────────────────────────────────────────────┘
```

### Data Structures

| Data Structure | Code Location | Schema |
|---|---|---|
| Gate definition object | `src/csl/gate-types.js:GateDefinition` | `{type, params, inputDim, outputDim}` |
| Gate chain configuration | `config/csl-engine-config.json` | `{gates[], connections[], rootGateId}` |
| Inference result | `src/csl/geometric-gates.js:InferenceResult` | `{outputVector, confidence, gateTrace}` |

---

## Patent 2: Sacred Geometry Agent Topology

**Heady Patent #2** | Provisional: [Date] | Non-Provisional Target: [Date]

### Claim Element → Code Mapping

| Claim Element | Code File | Function/Class | Description |
|---|---|---|---|
| **Agent topology manager** | `src/orchestration/sacred-geometry-topology.js` | `TopologyManager` class | Maintains agent geometric arrangement |
| **Golden ratio bandwidth allocation (φ ≈ 1.618)** | `src/orchestration/phi-allocation.js` | `PhiAllocator.allocateBandwidth()` | Assigns phi-ratio bandwidth weights |
| **Platonic solid configurations** | `src/orchestration/platonic-solids.js` | `PlatonicSolid` enum + configs | Tetrahedron, octahedron, cube, icosahedron, dodecahedron |
| **Vertex/edge/face agent role assignment** | `src/agents/topology-role-assigner.js` | `TopologyRoleAssigner.assign()` | Maps agent to topology position by capacity |
| **Communication bus (geometry-weighted)** | `src/transport/geometry-weighted-bus.js` | `GeometryBus.send()` | Prioritizes adjacent-topology messages |
| **Topological adjacency score** | `src/orchestration/sacred-geometry-topology.js` | `computeAdjacencyScore()` | Distance metric in geometric topology |
| **Load balancer (topology-nearest)** | `src/orchestration/topology-load-balancer.js` | `TopologyLoadBalancer.migrate()` | Migrates tasks to nearest available agent |
| **Task routing to geometrically complete subtopologies** | `src/orchestration/sacred-geometry-topology.js` | `routeToSubtopology()` | Routes tasks to complete geometric subsets |
| **Topology mutation engine** | `src/orchestration/sacred-geometry-topology.js` | `promoteEdgeToVertex()` | Handles vertex agent failure |
| **Benchmark (reduces routing overhead %)** | `tests/orchestration/topology-performance.test.js` | `runTopologyBenchmark()` | Measures vs. flat mesh baseline |

### Architecture Reference

```
PlatonicSolid configuration (platonic-solids.js)
    ↓
TopologyManager.initTopology() — assigns agents to vertices/edges/faces
    ↓
TopologyRoleAssigner.assign() — designates primary/worker/specialist roles
    ↓
GeometryBus.send() — routes messages by adjacency score
    ↓
TopologyLoadBalancer.migrate() — handles overload via geometric proximity
```

### Deployment Configuration

| Config | Location | Description |
|---|---|---|
| Topology configuration | `config/orchestration/topology-config.yaml` | Platonic solid selection, agent count, phi parameters |
| Agent capacity thresholds | `config/orchestration/capacity-thresholds.yaml` | Spawn/termination triggers |

---

## Patent 3: 3D Spatial Vector Memory with STM→LTM Consolidation

**Heady Patent #3** | Provisional: [Date] | Non-Provisional Target: [Date]

### Claim Element → Code Mapping

| Claim Element | Code File | Function/Class | Description |
|---|---|---|---|
| **STM store (3D spatial index)** | `src/memory/stm-store.js` | `STMStore` class | Short-term memory with 3D spatial indexing |
| **3D coordinate assignment (x, y, z from n-dim)** | `src/memory/spatial-index-3d.js` | `SpatialIndex3D.project()` | UMAP-based projection to 3D coordinates |
| **Recency buffer (most recent M embeddings in RAM)** | `src/memory/stm-store.js` | `RecencyBuffer` class | LRU cache of recent memories |
| **Spatial proximity search (O(log M))** | `src/memory/spatial-index-3d.js` | `SpatialIndex3D.radiusSearch()` | k-d tree radius search |
| **LTM store (compressed importance-weighted)** | `src/memory/ltm-store.js` | `LTMStore` class | Long-term compressed memory index |
| **Compressed embedding index (deduplicated)** | `src/memory/ltm-store.js` | `CompressedEmbeddingIndex` | Deduplication with angular distance preservation |
| **ANN index over LTM** | `src/memory/ltm-store.js` | `ANNIndex` class | HNSW or IVF index for LTM search |
| **Consolidation engine** | `src/memory/consolidation-engine.js` | `ConsolidationEngine` class | Background STM→LTM transfer |
| **Importance score (frequency + recency + outcome)** | `src/memory/consolidation-engine.js` | `computeImportanceScore()` | Weighted importance computation |
| **Compression transform (preserves angular distances)** | `src/memory/consolidation-engine.js` | `compressEmbedding()` | Dimensionality reduction with angular constraint |
| **Eviction of low-importance embeddings** | `src/memory/stm-store.js` | `evictLowImportance()` | Removes below-threshold memories |
| **Agent-facing memory API** | `src/agents/memory-interface.js` | `MemoryInterface` class | Unified read/write API for agents |
| **Primary implementation** | `src/vector-memory.js` | `VectorMemory` class | Top-level vector memory facade |
| **Retrieval performance benchmark** | `tests/memory/retrieval-performance.test.js` | `runRetrievalBenchmark()` | Latency + accuracy vs. flat vector DB |

### Data Structure Mapping

| Data Structure | Code Location | Claim Correspondence |
|---|---|---|
| Memory embedding record | `src/memory/stm-store.js:MemoryRecord` | `{embedding, xyz, importanceScore, recency, taskOutcome}` |
| LTM compressed entry | `src/memory/ltm-store.js:LTMEntry` | `{compressedEmbedding, sourceIds[], version}` |
| Consolidation manifest | `src/memory/consolidation-engine.js:ConsolidationManifest` | `{promoted[], evicted[], timestamp}` |

### Integration Point: pgvector / Cloudflare Vectorize

| Integration | Code File | Description |
|---|---|---|
| pgvector backend | `src/vector-memory.js` | PostgreSQL pgvector for LTM persistent storage |
| Vectorize sync | `src/edge/vectorize-sync.js` (section4) | Cloudflare Vectorize sync for edge deployments |
| Hybrid search | `src/vector-db/hybrid-search.js` (section1) | BM25 + vector hybrid for LTM search |
| Migrations | `migrations/001_hnsw_optimization.sql` | HNSW index optimization for LTM queries |

---

## Patent 4: Bee/Swarm Autonomous Agent Factory

**Heady Patent #4** | Provisional: [Date] | Non-Provisional Target: [Date]

### Claim Element → Code Mapping

| Claim Element | Code File | Function/Class | Description |
|---|---|---|---|
| **Agent factory** | `src/bees/bee-factory.js` | `BeeFactory` class | Core agent spawning and lifecycle system |
| **Task demand signal from queue** | `src/bees/bee-factory.js` | `BeeFactory.monitorDemand()` | Reads task queue depth and arrival rate |
| **Spawn new agent above threshold** | `src/bees/bee-factory.js` | `BeeFactory.spawnBee()` | Creates new bee agent instance |
| **Capability profile from registry** | `src/bees/capability-registry.js` | `CapabilityRegistry.selectProfile()` | Matches task type to capability |
| **Terminate agents below threshold** | `src/bees/bee-factory.js` | `BeeFactory.terminateBee()` | Graceful agent shutdown |
| **Role classification (scout/worker/specialist/queen)** | `src/bees/bee-factory.js` | `BeeRole` enum | Role assignment at spawn time |
| **Swarm coordinator** | `src/bees/swarm-coordinator.js` | `SwarmCoordinator` class | Central coordination layer |
| **Gradient map (task density)** | `src/bees/gradient-map.js` | `GradientMap` class | Task embedding density tracker |
| **Task-completion signal deposit** | `src/bees/gradient-map.js` | `GradientMap.deposit()` | Quality-weighted signal deposition |
| **Route task by gradient + cosine similarity** | `src/bees/swarm-coordinator.js` | `SwarmCoordinator.route()` | Task-to-agent routing algorithm |
| **Role transition (worker→specialist)** | `src/bees/swarm-coordinator.js` | `triggerRoleTransition()` | Performance-triggered specialization |
| **Health monitor** | `src/bees/health-monitor.js` | `HealthMonitor` class | Failure detection with heartbeat |
| **Replace failed agent within X ms** | `src/bees/health-monitor.js` | `HealthMonitor.replaceFailedAgent()` | Failure response with SLA tracking |
| **Queen agent** | `src/bees/queen-agent.js` | `QueenAgent` class | Swarm governance and registry updates |
| **Scout agent (pre-fetch)** | `src/bees/scout-agent.js` | `ScoutAgent.prefetch()` | Anticipatory context pre-loading |
| **Gradient map decay** | `src/bees/gradient-map.js` | `GradientMap.decay()` | Exponential temporal decay function |
| **Scaling benchmark** | `tests/bees/swarm-scaling.test.js` | `runScalingBenchmark()` | Latency SLA at variable task rates |
| **Section 2 integration** | `src/orchestration/swarm-coordinator.js` (section2) | `SwarmCoordinator` | Orchestration layer integration |

### Swarm Architecture Deployment Config

| Config | Location | Description |
|---|---|---|
| Bee factory parameters | `config/bees/factory-config.yaml` | Spawn/terminate thresholds, health check intervals |
| Capability profiles | `config/bees/capability-profiles.json` | Available agent capability definitions |
| Gradient map parameters | `config/bees/gradient-config.yaml` | Decay rate, hot-spot thresholds |

---

## Patent 5: Multi-Provider AI Gateway with Phi-Ratio Backoff

**Heady Patent #5** | Provisional: [Date] | Non-Provisional Target: [Date]

### Claim Element → Code Mapping

| Claim Element | Code File | Function/Class | Description |
|---|---|---|---|
| **Request router** | `src/gateway/multi-provider-gateway.js` | `MultiProviderGateway` class | Core gateway request handler |
| **Task embedding computation** | `src/gateway/semantic-router.js` | `SemanticRouter.embedTask()` | Converts prompt to embedding for routing |
| **Provider registry with capability embeddings** | `src/gateway/provider-registry.js` | `ProviderRegistry` class | Stores provider capabilities and metrics |
| **Composite score (semantic + quality + latency)** | `src/gateway/semantic-router.js` | `computeCompositeScore()` | Multi-factor provider scoring |
| **Semantic match score** | `src/gateway/semantic-router.js` | `cosineSimilarity()` | Task-to-provider embedding similarity |
| **Real-time quality metric** | `src/gateway/quality-monitor.js` | `QualityMonitor.getScore()` | Rolling quality window per provider |
| **Latency estimate (rolling window)** | `src/gateway/provider-registry.js` | `ProviderMetrics.getLatencyP95()` | P95 latency from recent responses |
| **Phi-ratio backoff controller** | `src/gateway/phi-backoff-controller.js` | `PhiBackoffController` class | φ ≈ 1.618 retry interval multiplier |
| **Phi-ratio retry sequence** | `src/gateway/phi-backoff-controller.js` | `PhiBackoffController.nextInterval()` | Returns interval × φ on each retry |
| **Provider exclusion on retry** | `src/gateway/phi-backoff-controller.js` | `PhiBackoffController.excludeProvider()` | Removes failed providers from retry pool |
| **Quality monitor (response evaluation)** | `src/gateway/quality-monitor.js` | `QualityMonitor` class | Evaluates responses against quality rubric |
| **Failover trigger (rolling quality drop)** | `src/gateway/quality-monitor.js` | `QualityMonitor.checkFailover()` | Triggers provider switch on quality decline |
| **Circuit breaker** | `src/gateway/circuit-breaker.js` | `CircuitBreaker` class | Temporary provider pool removal |
| **Semantic response cache** | `src/gateway/semantic-cache.js` | `SemanticCache` class | Cosine similarity cache for repeat queries |
| **Performance benchmark** | `tests/gateway/routing-performance.test.js` | `runRoutingBenchmark()` | Quality % and latency vs. round-robin |
| **MCP gateway integration** | `src/mcp/meta-server.js` (section3) | MCP gateway | Gateway used within MCP meta-server |

### Configuration Files

| Config | Location | Description |
|---|---|---|
| Provider registry config | `config/gateway/providers.yaml` | Registered AI providers and capabilities |
| Phi-backoff parameters | `config/gateway/backoff-config.yaml` | Base interval, max retries, phi parameter |
| Quality rubric | `config/gateway/quality-rubric.json` | Response evaluation criteria and weights |

---

## Patent 6: Edge-Origin AI Workload Partitioning

**Heady Patent #6** | Provisional: [Date] | Non-Provisional Target: [Date]

### Claim Element → Code Mapping

| Claim Element | Code File | Function/Class | Description |
|---|---|---|---|
| **Edge controller** | `src/edge/edge-controller.js` | `EdgeController` class | On-device inference orchestrator |
| **Round-trip latency measurement** | `src/edge/latency-monitor.js` | `LatencyMonitor.measure()` | Continuous latency sampling |
| **Available compute capacity (FLOPS + memory)** | `src/edge/edge-controller.js` | `EdgeController.measureCapacity()` | Hardware resource measurement |
| **Request complexity score** | `src/edge/edge-controller.js` | `computeComplexityScore()` | Token count + layer estimation |
| **Partitioning engine** | `src/edge/workload-partitioner.js` | `WorkloadPartitioner` class | 3D input → partition decision mapping |
| **Partitioning function (latency, capacity, complexity → decision)** | `src/edge/workload-partitioner.js` | `WorkloadPartitioner.partition()` | Core partitioning algorithm |
| **SPLIT_AT_LAYER_K execution** | `src/edge/layer-split-executor.js` | `LayerSplitExecutor.executeSplit()` | Runs first K layers locally |
| **Intermediate activation transmission** | `src/edge/layer-split-executor.js` | `LayerSplitExecutor.transmitActivations()` | Sends activations to origin |
| **Parameter update based on outcome** | `src/edge/workload-partitioner.js` | `WorkloadPartitioner.updateParams()` | Online learning of partitioning function |
| **Origin server (activation receiver)** | `src/origin/activation-receiver.js` | `ActivationReceiver` class | Receives activations, completes inference |
| **Origin server (remaining layers)** | `src/origin/activation-receiver.js` | `ActivationReceiver.completeInference()` | Executes layers K+1 through final |
| **Privacy classifier (for claim 3)** | `src/edge/privacy-classifier.js` | `PrivacyClassifier.classify()` | Detects PII in intermediate activations |
| **Offline fallback compressed model** | `src/edge/offline-fallback.js` | `OfflineFallback.infer()` | Reduced-quality local model |
| **Wrangler/edge deployment** | `src/edge/workers/edge-inference-worker.js` | Cloudflare Worker | Edge deployment target |
| **Vectorize sync** | `src/edge/modules/vectorize-sync.js` | `VectorizeSync` | Edge vector memory sync |
| **Partition latency benchmark** | `tests/edge/partition-latency.test.js` | `runPartitionBenchmark()` | End-to-end latency vs. always-remote |

### Deployment Configuration

| Config | Location | Description |
|---|---|---|
| Partitioning parameters | `src/edge/configs/workload-partitioning.yaml` | Thresholds for LOCAL/SPLIT/REMOTE decisions |
| Edge worker config | `src/edge/workers/wrangler.toml` | Cloudflare Workers deployment |
| Layer split model config | `config/edge/model-split-config.yaml` | Model layer definitions and split points |

---

## Patent 7: Semantic Backpressure for Agent Orchestration

**Heady Patent #7** | Provisional: [Date] | Non-Provisional Target: [Date]

### Claim Element → Code Mapping

| Claim Element | Code File | Function/Class | Description |
|---|---|---|---|
| **Backpressure monitor (per agent)** | `src/orchestration/backpressure-monitor.js` | `BackpressureMonitor` class | Per-agent pressure measurement |
| **Queue depth, latency, quality measurement** | `src/orchestration/backpressure-monitor.js` | `BackpressureMonitor.measure()` | Rolling window metrics collection |
| **Backpressure signal value [0.0, 1.0]** | `src/orchestration/backpressure-monitor.js` | `computePressureSignal()` | Weighted combination formula |
| **Signal transmission to upstream agents** | `src/orchestration/backpressure-monitor.js` | `BackpressureMonitor.broadcast()` | Upstream notification mechanism |
| **Flow controller (per upstream agent)** | `src/orchestration/flow-controller.js` | `FlowController` class | Rate reduction logic |
| **Task submission rate reduction** | `src/orchestration/flow-controller.js` | `FlowController.throttle()` | Proportional throttle application |
| **Divert to priority queue above threshold** | `src/orchestration/flow-controller.js` | `FlowController.divertToPriority()` | Priority queue diversion |
| **Semantic quality guard** | `src/orchestration/quality-guard.js` | `SemanticQualityGuard` class | Quality vs. throughput decision engine |
| **Quality loss function** | `src/orchestration/quality-guard.js` | `computeQualityLoss()` | Semantic quality metric |
| **Latency cost function** | `src/orchestration/quality-guard.js` | `computeLatencyCost()` | Latency impact metric |
| **Override backpressure when quality impact minimal** | `src/orchestration/quality-guard.js` | `shouldOverrideThrottle()` | Throttle override decision |
| **Pipeline agent integration** | `src/agents/pipeline-agent.js` | `PipelineAgent` class | Agent with backpressure hooks |
| **Scaling benchmark** | `tests/orchestration/backpressure-scaling.test.js` | `runBackpressureBenchmark()` | Quality maintained at variable load |
| **Self-correction integration** | `src/orchestration/self-correction-loop.js` (section2) | Self-correction | Related orchestration mechanism |

---

## Patent 8: MCP Meta-Server Aggregation with CSL Routing

**Heady Patent #8** | Provisional: [Date] | Non-Provisional Target: [Date]

### Claim Element → Code Mapping

| Claim Element | Code File | Function/Class | Description |
|---|---|---|---|
| **Meta-server** | `src/mcp/meta-server.js` | `MCPMetaServer` class | Central aggregation server |
| **Active connections to MCP tool servers** | `src/mcp/connection-pool.js` | `ConnectionPool` class | Persistent MCP server connections |
| **Tool capability registry** | `src/mcp/tool-registry.js` | `ToolRegistry` class | Tool → capability embedding mapping |
| **CSL routing engine** | `src/mcp/csl-router.js` | `CSLRouter` class | Geometric routing for tool selection |
| **Intent embedding computation** | `src/mcp/csl-router.js` | `CSLRouter.embedIntent()` | Converts natural language to embedding |
| **Angular distance computation** | `src/mcp/csl-router.js` | `computeAngularDistance()` | Intent-to-tool embedding distance |
| **Primary tool selection (minimum angular distance)** | `src/mcp/csl-router.js` | `CSLRouter.selectTool()` | Picks nearest tool in embedding space |
| **Secondary tool fallback list** | `src/mcp/csl-router.js` | `CSLRouter.buildFallbackList()` | Ordered fallback by angular distance |
| **MCP protocol handler** | `src/mcp/mcp-protocol.js` | `MCPProtocolHandler` class | MCP wire protocol implementation |
| **Connection pool multiplexing** | `src/mcp/connection-pool.js` | `ConnectionPool.multiplex()` | Shared connection pool for all tools |
| **Dynamic tool registration** | `src/mcp/tool-registry.js` | `ToolRegistry.register()` | Runtime tool server registration |
| **Tool composition engine (claim 5)** | `src/mcp/meta-server.js` | `MetaServer.composeTools()` | Multi-tool chaining for complex requests |
| **LRU cache for top-K tools** | `src/mcp/csl-router.js` | `CSLRouter.cache` | LRU cache for frequent intents |
| **Authentication delegation** | `src/mcp/meta-server.js` | `MetaServer.authenticate()` | Unified auth abstraction |
| **Transport adapter** | `src/mcp/transport-adapter.js` (section3) | `TransportAdapter` | Multi-transport support (HTTP/SSE/stdio) |
| **Zero-trust sandbox** | `src/mcp/zero-trust-sandbox.js` (section3) | `ZeroTrustSandbox` | Tool execution isolation |
| **Routing accuracy benchmark** | `tests/mcp/routing-accuracy.test.js` | `runRoutingAccuracyTest()` | Tool selection accuracy vs. keyword matching |
| **Section 3 gateway** | `src/mcp/gateway/mcp-gateway.js` (section3) | MCPGateway | Full MCP gateway with rate limiting |

### Configuration Files

| Config | Location | Description |
|---|---|---|
| MCP gateway config | `src/mcp/configs/mcp-gateway-config.yaml` | Server connections, routing parameters |
| Tool registry seed | `config/mcp/tools.json` | Initial tool capability embeddings |

---

## Patent 9: Self-Aware Software with Drift Detection

**Heady Patent #9** | Provisional: [Date] | Non-Provisional Target: [Date]

### Claim Element → Code Mapping

| Claim Element | Code File | Function/Class | Description |
|---|---|---|---|
| **Behavioral baseline store** | `src/self-aware/baseline-store.js` | `BaselineStore` class | Reference embedding distribution storage |
| **Reference embedding distributions** | `src/self-aware/baseline-store.js` | `BaselineStore.getDistribution()` | Expected output embedding distribution |
| **Drift detector** | `src/self-aware/drift-detector.js` | `DriftDetector` class | Statistical drift measurement |
| **Output sampling at configurable rate** | `src/self-aware/drift-detector.js` | `DriftDetector.sample()` | Periodic output sampling |
| **Frozen reference embedding model** | `src/self-aware/drift-detector.js` | `DriftDetector.referenceModel` | Non-updating baseline embedder |
| **MMD/Jensen-Shannon drift score** | `src/self-aware/drift-detector.js` | `computeDriftScore()` | Statistical distribution distance |
| **Drift alert emission above threshold** | `src/self-aware/drift-detector.js` | `DriftDetector.emitAlert()` | Threshold-triggered alert generation |
| **Behavioral integrity monitor** | `src/self-aware/behavioral-monitor.js` | `BehavioralMonitor` class | Audit log + fingerprint comparison |
| **Audit log (decisions, tools, embeddings)** | `src/self-aware/behavioral-monitor.js` | `BehavioralMonitor.log()` | Timestamped action recording |
| **Behavioral fingerprint comparison** | `src/self-aware/behavioral-monitor.js` | `compareFingerprintSimilarity()` | Cosine similarity to baseline behavior |
| **Remediation controller** | `src/self-aware/remediation-controller.js` | `RemediationController` class | Alert response orchestrator |
| **CONSTRAIN action** | `src/self-aware/remediation-controller.js` | `applyConstraint()` | Disables high-drift tool categories |
| **ROLLBACK action** | `src/self-aware/remediation-controller.js` | `rollbackToCheckpoint()` | Reverts model to pre-drift checkpoint |
| **RETRAIN action** | `src/self-aware/remediation-controller.js` | `triggerRetrain()` | Initiates fine-tuning pipeline |
| **Self-aware agent** | `src/agents/self-aware-agent.js` | `SelfAwareAgent` class | Agent with integrated drift monitoring |
| **Drift detection tests** | `tests/self-aware/drift-detection.test.js` | `runDriftDetectionTest()` | Accuracy vs. static deployment baseline |

---

## Patent 10: HDC Binding/Bundling for Agent Consensus

**Heady Patent #10** | Provisional: [Date] | Non-Provisional Target: [Date]

### Claim Element → Code Mapping

| Claim Element | Code File | Function/Class | Description |
|---|---|---|---|
| **Binary HDV encoding (D ≥ 8,192)** | `src/hdc/hdc-engine.js` | `HDCEngine.encode()` | VSA encoding to high-dim binary vectors |
| **Binding via XOR/element-wise multiply** | `src/hdc/hdc-engine.js` | `HDCEngine.bind()` | Knowledge component binding operation |
| **Bound HDV transmission** | `src/agents/hdc-agent.js` | `HDCAgent.transmitHDV()` | Agent-to-aggregator HDV transmission |
| **Consensus aggregator** | `src/hdc/consensus-aggregator.js` | `ConsensusAggregator` class | Receives and processes agent HDVs |
| **Majority-vote bundling** | `src/hdc/consensus-aggregator.js` | `ConsensusAggregator.bundle()` | Dimension-wise majority vote operation |
| **Hamming distance alignment score** | `src/hdc/consensus-aggregator.js` | `computeAlignmentScore()` | Agent-to-consensus distance metric |
| **Outlier agent identification** | `src/hdc/consensus-aggregator.js` | `identifyOutliers()` | High-distance agent detection |
| **Knowledge store (indexed by query embeddings)** | `src/hdc/associative-memory.js` | `AssociativeMemory` class | HDV storage with embedding index |
| **Associative retrieval (Hamming distance search)** | `src/hdc/associative-memory.js` | `AssociativeMemory.retrieve()` | Nearest HDV by Hamming distance |
| **Temporal binding (claim 4)** | `src/hdc/hdc-engine.js` | `HDCEngine.bindTemporal()` | Position HDV binding for time-ordering |
| **Hierarchical bundling (claim 5)** | `src/hdc/consensus-aggregator.js` | `bundleHierarchical()` | Cluster-then-global bundling |
| **HDC operations core** | `src/csl/hdc-operations.js` (section5) | `HDCOperations` | Core HDC operations library |
| **Consensus accuracy tests** | `tests/hdc/consensus-accuracy.test.js` | `runConsensusAccuracyTest()` | Accuracy vs. centralized arbitration |

---

## Patent 11: Monte Carlo Simulation for System Optimization

**Heady Patent #11** | Provisional: [Date] | Non-Provisional Target: [Date]

### Claim Element → Code Mapping

| Claim Element | Code File | Function/Class | Description |
|---|---|---|---|
| **Platform model store** | `src/optimization/platform-simulator.js` | `PlatformSimulator` class | Parameterized simulation model |
| **Configuration vector (agent count, memory thresholds, routing weights, backpressure params)** | `src/optimization/platform-simulator.js` | `ConfigVector` type | All tunable parameters |
| **Monte Carlo optimizer** | `src/optimization/monte-carlo-optimizer.js` | `MonteCarloOptimizer` class | Core MC optimization engine |
| **Prior distribution sampling** | `src/optimization/monte-carlo-optimizer.js` | `sampleFromPrior()` | Initial configuration space sampling |
| **Performance metric vector (throughput, latency, quality, cost)** | `src/optimization/platform-simulator.js` | `PerformanceMetrics` type | Multi-objective evaluation output |
| **Importance sampling** | `src/optimization/importance-sampler.js` | `ImportanceSampler` class | Concentrates sampling on Pareto-optimal regions |
| **Pareto-optimal performance regions** | `src/optimization/importance-sampler.js` | `ImportanceSampler.computePareto()` | Pareto frontier computation |
| **Highest weighted performance score** | `src/optimization/monte-carlo-optimizer.js` | `computeWeightedScore()` | Multi-objective scoring function |
| **Configuration deployer** | `src/optimization/config-deployer.js` | `ConfigDeployer` class | Safe configuration rollout |
| **Gradual rollout strategy** | `src/optimization/config-deployer.js` | `ConfigDeployer.gradualRollout()` | Incremental config change application |
| **Abort on metric degradation** | `src/optimization/config-deployer.js` | `ConfigDeployer.watchAndAbort()` | Live metric monitoring + abort |
| **GP surrogate model (Bayesian, claim 3)** | `src/optimization/monte-carlo-optimizer.js` | `GaussianProcessSurrogate` | Gaussian Process for unexplored regions |
| **Convergence tests** | `tests/optimization/optimizer-convergence.test.js` | `runConvergenceTest()` | Optimization quality vs. default config |

---

## Patent 12: Context Capsule Transfer Between Agents

**Heady Patent #12** | Provisional: [Date] | Non-Provisional Target: [Date]

### Claim Element → Code Mapping

| Claim Element | Code File | Function/Class | Description |
|---|---|---|---|
| **Context capsule serializer** | `src/agents/capsule-serializer.js` | `CapsuleSerializer` class | Captures and serializes agent state |
| **Working memory snapshot (embeddings + scores + timestamps)** | `src/agents/capsule-serializer.js` | `serializeWorkingMemory()` | Memory state capture |
| **Reasoning chain (ordered inference steps)** | `src/agents/capsule-serializer.js` | `serializeReasoningChain()` | Structured inference step sequence |
| **Active tool context map** | `src/agents/capsule-serializer.js` | `serializeToolContexts()` | Tool session state capture |
| **Trust level metadata** | `src/agents/capsule-serializer.js` | `serializeTrustLevel()` | Privilege scope encoding |
| **Standardized context capsule schema** | `src/agents/context-capsule.js` | `ContextCapsule` class | Capsule data structure definition |
| **Cryptographic signature** | `src/agents/capsule-serializer.js` | `CapsuleSerializer.sign()` | HMAC/Ed25519 signature of capsule |
| **Context capsule deserializer** | `src/agents/capsule-deserializer.js` | `CapsuleDeserializer` class | Restores agent state from capsule |
| **Signature verification** | `src/agents/capsule-deserializer.js` | `CapsuleDeserializer.verify()` | Cryptographic signature check |
| **Cognitive state restoration** | `src/agents/capsule-deserializer.js` | `restoreAgentState()` | Loads capsule into receiving agent |
| **Trust level compatibility check** | `src/agents/capsule-deserializer.js` | `validateTrustCompatibility()` | Verifies receiving agent scope |
| **Context transfer protocol** | `src/transport/capsule-transfer.js` | `CapsuleTransferProtocol` class | Network transfer wire format |
| **Partial capsule transfer (bandwidth-constrained)** | `src/transport/capsule-transfer.js` | `sendPartial()` | Chunked transmission for low-bandwidth |
| **Checkpoint manager (claim 5)** | `src/agents/checkpoint-manager.js` | `CheckpointManager` class | Periodic checkpoint persistence |
| **Context window manager** | `src/orchestration/context-window-manager.js` (section2) | `ContextWindowManager` | Related context management |
| **Transfer accuracy tests** | `tests/agents/context-transfer.test.js` | `runTransferAccuracyTest()` | Task completion % after transfer |

---

## Patent 13: Ternary Semantic Logic for Uncertainty Handling

**Heady Patent #13** | Provisional: [Date] | Non-Provisional Target: [Date]

### Claim Element → Code Mapping

| Claim Element | Code File | Function/Class | Description |
|---|---|---|---|
| **Ternary evaluator** | `src/csl/ternary-evaluator.js` | `TernaryEvaluator` class | Core ternary logic evaluation engine |
| **Continuous values [-1, +1] with TRUE/FALSE/UNCERTAIN zones** | `src/csl/ternary-evaluator.js` | `TernaryEvaluator.evaluate()` | Zone-based truth value assignment |
| **t_threshold configuration** | `src/csl/ternary-evaluator.js` | `TernaryEvaluator.threshold` | Configurable zone boundary |
| **Ternary AND operator** | `src/csl/ternary-operators.js` | `ternaryAND()` | UNCERTAIN propagation with FALSE priority |
| **Ternary OR operator** | `src/csl/ternary-operators.js` | `ternaryOR()` | UNCERTAIN propagation with TRUE priority |
| **Ternary NOT operator** | `src/csl/ternary-operators.js` | `ternaryNOT()` | TRUE↔FALSE with UNCERTAIN negation |
| **Decision gateway** | `src/agents/ternary-decision-gateway.js` | `TernaryDecisionGateway` class | Routes actions based on ternary result |
| **Execute on TRUE** | `src/agents/ternary-decision-gateway.js` | `gateway.executeOnTrue()` | Action execution path |
| **Block on FALSE** | `src/agents/ternary-decision-gateway.js` | `gateway.blockOnFalse()` | Action blocking path |
| **Route to clarification on UNCERTAIN** | `src/agents/ternary-decision-gateway.js` | `gateway.routeToHandler()` | Clarification handler dispatch |
| **Confidence calibrator** | `src/csl/confidence-calibrator.js` | `ConfidenceCalibrator` class | Historical accuracy → threshold adaptation |
| **Threshold adjustment for target clarification rate** | `src/csl/confidence-calibrator.js` | `calibrateThreshold()` | Closed-loop threshold optimization |
| **CSL engine integration** | `src/csl/csl-engine.js` (section5) | `CSLEngine` | Section 5 CSL engine with ternary logic |
| **Ternary logic tests** | `tests/csl/ternary-logic.test.js` | `runTernaryLogicTest()` | Decision error rate vs. binary baseline |

---

## Patent 14: Liquid Deploy (Latent-to-Physical Projection)

**Heady Patent #14** | Provisional: [Date] | Non-Provisional Target: [Date]

### Claim Element → Code Mapping

| Claim Element | Code File | Function/Class | Description |
|---|---|---|---|
| **Latent configuration store** | `src/deploy/latent-config-store.js` | `LatentConfigStore` class | Technology-neutral spec storage |
| **Abstract resource vectors (compute, memory, latency)** | `src/deploy/latent-config-store.js` | `ResourceVector` type | Compute intensity, memory footprint, latency sensitivity |
| **Communication topology (adjacency matrix)** | `src/deploy/latent-config-store.js` | `TopologyMatrix` type | Inter-agent weighted adjacency |
| **Persistence requirements specification** | `src/deploy/latent-config-store.js` | `PersistenceSpec` type | Durability and retrieval latency specs |
| **Projection engine** | `src/deploy/projection-engine.js` | `ProjectionEngine` class | Latent → physical manifest generator |
| **Deployment target specification** | `src/deploy/projection-engine.js` | `DeploymentTarget` type | Infrastructure environment descriptor |
| **Projection function (latent → concrete)** | `src/deploy/projection-engine.js` | `ProjectionEngine.project()` | Core projection algorithm |
| **Platform-specific manifest generation** | `src/deploy/projection-engine.js` | `ProjectionEngine.generateManifest()` | Outputs valid deployment YAML/JSON |
| **Kubernetes projector** | `src/deploy/projectors/kubernetes-projector.js` | `KubernetesProjector` class | K8s YAML manifest generator |
| **Docker Compose projector** | `src/deploy/projectors/docker-compose-projector.js` | `DockerComposeProjector` class | Docker Compose YAML generator |
| **Serverless projector** | `src/deploy/projectors/serverless-projector.js` | `ServerlessProjector` class | Lambda/Workers config generator |
| **Fidelity evaluator** | `src/deploy/fidelity-evaluator.js` | `FidelityEvaluator` class | Latent vs. projected comparison |
| **Fidelity score computation** | `src/deploy/fidelity-evaluator.js` | `computeFidelityScore()` | Environment satisfaction metric |
| **Unsatisfied requirement reporting** | `src/deploy/fidelity-evaluator.js` | `reportFidelityGaps()` | Identifies unmet latent requirements |
| **Live migration module (claim 5)** | `src/deploy/live-migrator.js` | `LiveMigrator` class | Zero-downtime migration manifests |
| **Projection accuracy tests** | `tests/deploy/projection-accuracy.test.js` | `runProjectionAccuracyTest()` | Fidelity across platform types |
| **Deployment configs** | `config/projectors/` | Various YAML | Per-platform projection parameters |

---

## Patent 15: Fibonacci Resource Allocation for AI Workloads

**Heady Patent #15** | Provisional: [Date] | Non-Provisional Target: [Date]

### Claim Element → Code Mapping

| Claim Element | Code File | Function/Class | Description |
|---|---|---|---|
| **Workload classifier** | `src/resources/workload-classifier.js` | `WorkloadClassifier` class | Assigns workloads to priority tiers |
| **Tier assignment (latency, customer tier, compute intensity)** | `src/resources/workload-classifier.js` | `classifyWorkload()` | Multi-factor tier assignment |
| **Fibonacci allocator** | `src/resources/fibonacci-allocator.js` | `FibonacciAllocator` class | Core Fibonacci-proportional allocation |
| **N compute resource pools with Fibonacci sizes** | `src/resources/fibonacci-allocator.js` | `FibonacciAllocator.initPools()` | F(i) proportional pool initialization |
| **Fibonacci sequence F(i) = F(i-1) + F(i-2)** | `src/resources/fibonacci-allocator.js` | `computeFibonacciSequence()` | Sequence computation |
| **Tier pool allocation** | `src/resources/fibonacci-allocator.js` | `FibonacciAllocator.allocate()` | Allocates from tier's Fibonacci pool |
| **Inter-tier borrowing protocol** | `src/resources/pool-borrower.js` | `PoolBorrower` class | Lower-priority borrows from higher |
| **Reserve threshold check for borrowing** | `src/resources/pool-borrower.js` | `checkReserveThreshold()` | Guards high-priority pool minimum |
| **Resource governor** | `src/resources/resource-governor.js` | `ResourceGovernor` class | Minimum floors + rebalancing |
| **Minimum resource floors (F(1)/sum × total)** | `src/resources/resource-governor.js` | `enforceMinimumFloor()` | Guarantees minimum allocation per tier |
| **Dynamic rebalancing** | `src/resources/resource-governor.js` | `rebalancePools()` | Pool size adjustment on load changes |
| **Tier pool manager** | `src/resources/tier-pool-manager.js` | `TierPoolManager` class | Pool lifecycle management |
| **Burst handling (claim 3)** | `src/resources/fibonacci-allocator.js` | `handleBurst()` | High-priority pool burst expansion |
| **Fibonacci backoff for rebalancing (claim 4)** | `src/resources/resource-governor.js` | `fibonacciRebalanceDelay()` | Prevents oscillation via Fibonacci delays |
| **Multi-resource type allocation (claim 5)** | `src/resources/fibonacci-allocator.js` | `allocateMultiResource()` | GPU, memory, network, storage allocation |
| **Cost allocator (claim 6)** | `src/resources/cost-allocator.js` | `CostAllocator` class | Billing for pool consumption |
| **Allocation performance tests** | `tests/resources/allocation-performance.test.js` | `runAllocationBenchmark()` | Latency + utilization vs. uniform allocation |
| **Deployment config** | `config/resource-tiers.yaml` | Tier definitions | Fibonacci tier sizes and thresholds |

---

## Cross-Patent Code Integration Map

| System Component | Used By Patents | Key Integration Point |
|---|---|---|
| `src/vector-memory.js` | #3, #9, #10, #12 | Shared memory system; all agent memory operations |
| `src/bees/bee-factory.js` | #4, #15 | Bee spawning + Fibonacci resource allocation |
| `src/csl/geometric-gates.js` | #1, #8, #13 | CSL engine shared by MCP router and ternary logic |
| `src/orchestration/swarm-coordinator.js` | #4, #7 | Swarm + backpressure integration |
| `src/gateway/multi-provider-gateway.js` | #5, #8 | Gateway used within MCP meta-server |
| `src/edge/edge-controller.js` | #6, #15 | Edge deployment + Fibonacci resource management |
| `src/agents/context-capsule.js` | #12, #9 | Capsule includes self-aware behavioral state |
| `src/deploy/projection-engine.js` | #14, #4 | Liquid deploy for swarm factory deployment |

---

## Evidence Preservation Checklist

To ensure these code mappings serve as valid reduction-to-practice evidence:

- [ ] All referenced files exist and are committed to version-controlled repository
- [ ] Commit timestamps precede provisional filing dates for all referenced inventions
- [ ] `git log --follow <file>` outputs predate each patent's provisional filing date
- [ ] Repository has access controls preventing retroactive history rewriting
- [ ] Key commits are tagged with semantic version numbers for reference
- [ ] README or CHANGELOG documents feature implementation dates
- [ ] Test files (*.test.js) run successfully and produce passing results
- [ ] Internal documentation (engineering logs, PRDs) corroborates development timeline
- [ ] Third-party review (code review PRs with timestamps) provides additional evidence

---

*Document Version 1.0 | March 2026 | Heady Connection, Inc.*
*This document is for internal strategic use only and does not constitute legal advice.*
*Maintain this document as code evolves — update mappings when refactoring changes file paths.*
