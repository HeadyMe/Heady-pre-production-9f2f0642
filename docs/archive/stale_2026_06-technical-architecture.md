<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Technical Architecture — SPEC Implementation Map

## System Topology

```
┌──────────────────── CLIENT LAYER ────────────────────┐
│  HeadyBuddy Overlay │ Chrome Extension │ CLI │ Mobile │
└──────────────────────────┬───────────────────────────┘
                           │
┌──────────────────── EDGE LAYER ──────────────────────┐
│  Cloudflare Workers    Vectorize (1536-dim)    KV    │
│  Workers AI @cf/bge    Text Classification    Cache  │
│  heady-edge-node       /api/search   /api/embed      │
└──────────────────────────┬───────────────────────────┘
                           │
┌──────────────────── ORIGIN LAYER ────────────────────┐
│                    heady-manager.js                   │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────────┐ │
│  │ Express │  │  HCFP    │  │  20 AI Node Router  │ │
│  │ Server  │  │ Pipeline │  │  Arena Orchestrator  │ │
│  └────┬────┘  └────┬─────┘  └──────────┬──────────┘ │
│       │            │                    │             │
│  ┌────┴────────────┴────────────────────┴──────────┐ │
│  │              SPEC ENGINE LAYER                   │ │
│  │  Monte Carlo │ Policy │ Drift │ Incidents │      │ │
│  │  Memory Rcpt │ Know.V │ Audit │ Consent   │      │ │
│  └──────────────────────┬──────────────────────────┘ │
└──────────────────────────┬───────────────────────────┘
                           │
┌──────────────────── DATA LAYER ──────────────────────┐
│  PostgreSQL (schema.sql)  │  Notion (Knowledge Sync) │
│  JSON Files (configs/)    │  SQLite (local cache)    │
└──────────────────────────────────────────────────────┘
```

## SPEC Implementation Files

### SPEC-1: Control Plane & Monte Carlo

| File | Purpose |
|------|---------|
| `src/monte-carlo.js` | Seeded PRNG, readiness scoring, full simulation |
| `db/schema.sql` | pipeline_runs, pipeline_stage_runs, tasks, workflows |
| `src/routes/spec-routes.js` | `/api/monte-carlo/*` endpoints |

### SPEC-2: DevSecOps

| File | Purpose |
|------|---------|
| `Dockerfile` | Hardened multi-stage, non-root, Alpine |
| `.github/workflows/security-scan.yml` | CodeQL SAST + TruffleHog |
| `.github/workflows/sbom-container-scan.yml` | CycloneDX SBOM + Trivy |
| `.github/workflows/release-please.yml` | Semantic versioning |
| `.github/dependabot.yml` | Automated dependency updates |
| `SECURITY.md` | Vulnerability disclosure |

### SPEC-3: Knowledge Vault

| File | Purpose |
|------|---------|
| `src/memory-receipts.js` | INGEST/EMBED/STORE/DROP tracking |
| `db/schema.sql` | documents, embeddings, memory_receipts |
| `src/routes/spec-routes.js` | `/api/knowledge/*` endpoints |

### SPEC-4: MCP Gateway

| File | Purpose |
|------|---------|
| `src/policy-engine.js` | RBAC, rate limits, approval gates |
| `db/schema.sql` | mcp_tools, tool_policies, tool_invocations |
| `src/routes/spec-routes.js` | `/api/mcp/*` endpoints |

### SPEC-5: Observability

| File | Purpose |
|------|---------|
| `src/drift-detector.js` | Config/registry/connectivity monitoring |
| `src/incident-manager.js` | Severity, auto-detect, postmortem |
| `db/schema.sql` | incidents, drift_events |
| `src/routes/spec-routes.js` | `/api/observability/*` endpoints |

### SPEC-6: HeadyBuddy Universal

| File | Purpose |
|------|---------|
| `db/schema.sql` | consents, devices, tracking_events, sync_blobs |
| `src/routes/spec-routes.js` | `/api/tracking`, `/api/privacy/*` endpoints |
| `public/buddy-universal.js` | Drop-in overlay script |

## Request Flow

1. **Client** → Cloudflare Edge (Workers AI for embedding/classification)
2. **Edge** → Origin (if cache miss or complex operation)
3. **Origin** → SPEC Engine (Monte Carlo check → Policy evaluation → Execute)
4. **Engine** → Data Layer (PostgreSQL or JSON files)
5. **Response** → Edge cache → Client (with receipt)

## Resilience Patterns

| Pattern | Implementation | Status |
|---------|---------------|--------|
| Circuit Breaker | Policy engine deny on repeated failures | ✅ |
| Rate Limiting | Per-tool, per-minute rate limits in PolicyEngine | ✅ |
| Retry with Backoff | Edge worker → origin fallback in CLI | ✅ |
| Health Checks | Drift detector connectivity monitoring | ✅ |
| Incident Auto-Detect | IncidentManager signal evaluation | ✅ |
| Config Drift Scan | DriftDetector directory scanning | ✅ |
| Audit Trail | Every tool invocation logged with requestId | ✅ |
