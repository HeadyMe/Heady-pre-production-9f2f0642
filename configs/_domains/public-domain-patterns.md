<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: configs/public-domain-patterns.md                                                    ║
<!-- ║  LAYER: config                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
<!-- ╔══════════════════════════════════════════════════════════════════╗ -->
<!-- ║  █╗  █╗███████╗ █████╗ ██████╗ █╗   █╗                     ║ -->
<!-- ║  █║  █║█╔════╝█╔══█╗█╔══█╗╚█╗ █╔╝                     ║ -->
<!-- ║  ███████║█████╗  ███████║█║  █║ ╚████╔╝                      ║ -->
<!-- ║  █╔══█║█╔══╝  █╔══█║█║  █║  ╚█╔╝                       ║ -->
<!-- ║  █║  █║███████╗█║  █║██████╔╝   █║                        ║ -->
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║ -->
<!-- ║                                                                  ║ -->
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║ -->
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║ -->
<!-- ║  FILE: configs/public-domain-patterns.md                          ║ -->
<!-- ║  LAYER: root                                                      ║ -->
<!-- ╚══════════════════════════════════════════════════════════════════╝ -->
<!-- HEADY_BRAND:END -->

# Public Domain Patterns Registry

Maintained by HCFullPipeline. Consulted at every checkpoint to recommend or auto-enable beneficial patterns.

## Implemented

| Pattern | Description | Source | Location |
|---------|-------------|--------|----------|
| Multi-Agent Supervisor | Central coordinator with agents-as-tools, parallel calls, centralized aggregation | LangGraph, Bedrock | `packages/hc-supervisor/` |
| Retry + Exponential Backoff + Jitter | Avoid thundering herd, respect rate limits | AWS Architecture Blog | `packages/networking/src/client.js` |
| Idempotent Task Design | Safe retries without duplicate side effects | Kleppmann, DDIA | All pipeline tasks |
| Direct API Routing (No-Proxy) | Bypass proxies for internal Heady service calls | Standard networking practice | `packages/networking/` |
| Checkpoint Protocol | Deep re-analysis at each pipeline stage boundary | Erlang/OTP supervision, database WAL | `packages/hc-checkpoint/` |
| Deterministic Builds | Same inputs + config = same outputs, seeded randomness | CI/CD best practices | Pipeline-wide |

## Planned

| Pattern | Description | Source | Target | Priority |
|---------|-------------|--------|--------|----------|
| Circuit Breaker | Stop calling failing services after threshold; periodic test | Nygard, Netflix Hystrix | `packages/networking/` | High |
| Saga / Compensation | Multi-step workflow undo on partial failure | Garcia-Molina & Salem | `packages/hc-supervisor/` | High |
| Bulkhead / Isolation | Separate critical from noisy workloads | Azure Architecture Patterns | Node pools | Medium |
| Event Sourcing | Immutable event log for full state replay | Fowler, Greg Young | Audit system | Medium |
| CQRS | Separate read/write models for query optimization | Microsoft Docs | Dashboard reads | Medium |
| Observability 3 Pillars | Logs + Metrics + Traces via OpenTelemetry | OpenTelemetry.io | All services | High |
| Skill-Based Routing | Match tasks to agents by skill tags + health | Call center routing theory | `packages/hc-supervisor/` | High |
| Auto-Tuning Loop | Self-optimize concurrency, batch sizes, costs | Control theory, PID loops | `packages/hc-brain/` | Medium |
| Hot/Cold Path Separation | Priority queues for latency-sensitive vs async work | Kafka/streaming best practices | Scheduler | Medium |

## Not Applicable

| Pattern | Reason |
|---------|--------|
| (None currently) | Add patterns here if evaluated and rejected with reason |

## Evaluation Criteria

Before adopting a public-domain pattern:
1. **Applicability**: Does it solve a real observed issue in Heady?
2. **Complexity vs Benefit**: Is the implementation effort justified?
3. **IP Safety**: Confirm it is truly public domain / appropriately licensed.
4. **Governance**: Does it require human approval per `governance-policies.yaml`?
5. **Incremental**: Can it be rolled out gradually behind a feature flag?
