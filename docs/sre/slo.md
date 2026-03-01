# SLOs: API Latency by Endpoint Class

This document defines concrete latency objectives for Heady APIs and the CI/deploy performance gate that enforces them.

## Endpoint classes and targets

### 1) Static/cacheable endpoints
Examples: static assets, cache-hit API reads, immutable content.

* **Target:** `p95 < 150ms` (stretch target: `< 100ms`)
* **Availability objective:** 99.9%

### 2) Dynamic non-LLM APIs
Examples: orchestration, health/status, metadata, transactional API calls.

* **Target:** `p95 < 700ms` (stretch target: `< 500ms`)
* **Availability objective:** 99.9%

### 3) LLM APIs
Examples: chat/completions, summarize/generate, reasoning endpoints.

* **TTFT target (time-to-first-token):** `p95 < 1200ms`
* **Full completion target:** `p95 < 8000ms`
* **Availability objective:** 99.5%

## CI/deploy performance gate

Synthetic latency checks run in CI/deploy against:

* `/api/health`
* `/api/pulse`
* Top 3 business endpoints:
  * `/api/introspection`
  * `/api/branding`
  * `/api/principles`

Gate behavior:

1. Run multiple lightweight synthetic requests per endpoint.
2. Compute p95 latency per endpoint.
3. Fail the pipeline if any endpoint exceeds its SLO threshold.
4. Persist current and trend artifacts for historical comparison.

## Source of truth

Machine-readable SLO config: `configs/slo-latency.yaml`.

Performance gate script: `scripts/ci/synthetic-latency-check.js`.
