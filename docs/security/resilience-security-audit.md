# Heady Platform — Resilience & Security Audit

**Date:** 2026-03-07  
**Scope:** circuit-breaker.js, exponential-backoff.js, pool.js, auto-heal.js, saga.js,
security-bee.js, governance-engine.js, policy-engine.js, governance-bee.js,
auth-manager.js, rulez-gatekeeper.js, SECURITY.md, worker-api-gateway.js (stub),
worker-auth-service.js (stub)  
**Analyst:** Automated security/resilience audit  
**Platform version:** 3.1.x

---

## Executive Summary

The Heady platform demonstrates a solid foundational architecture with a genuine investment in
resilience (circuit breakers, bulkheads, connection pools, sagas) and governance (policy engine,
audit trail, content safety). However, several **critical and high-severity gaps** were identified
that could allow authentication bypass, distributed transaction data corruption, cascading failure
propagation, and unauthorized access under adversarial conditions.

**Finding summary:**

| Severity | Count |
|----------|-------|
| CRITICAL | 4     |
| HIGH     | 9     |
| MEDIUM   | 11    |
| LOW      | 7     |
| **Total**| **31**|

---

## CRITICAL Findings

### CRIT-001 — Hardcoded JWT Secret Fallback
**File:** `auth-manager.js` line 44  
**Detail:**
```js
this._jwt = opts.jwt || new HeadyJWT({
  secret: opts.jwtSecret || process.env.JWT_SECRET || 'heady-default-secret-change-in-prod'
});
```
If `JWT_SECRET` is absent from the environment (misconfigured deployment, env file not loaded,
container startup race), the system silently falls back to a publicly known static secret. Any
attacker who reads the source code can forge valid JWTs for any role including `admin`.

**Impact:** Complete authentication bypass; privilege escalation to admin; full platform takeover.  
**Remediation:** Remove the fallback entirely. Throw a hard startup error when `JWT_SECRET` is
missing. Enforce a minimum entropy check (≥ 256 bits). See `auth-hardening.js`.

---

### CRIT-002 — Admin Role Bypasses All Governance Checks
**File:** `governance-engine.js` line 330  
```js
if (role === 'admin') return { decision: GovernanceDecision.ALLOW, reason: 'admin_bypass' };
```
The access control check returns ALLOW for *every* admin action with no audit, no rate limit
check, and no content safety check. Combined with CRIT-001, a forged admin JWT is a golden key
with zero governance friction.

**Impact:** Complete governance bypass via a forged or stolen admin token.  
**Remediation:** Remove blanket admin bypass. Admins should pass content safety and budget checks.
Sensitive admin actions (user_delete, data_export, deploy) require MFA step-up. All admin decisions
must be written to the immutable audit trail. See `governance-engine-v2.js`.

---

### CRIT-003 — Saga Compensation Has No Timeout, Dead Letter, or Idempotency
**File:** `saga.js` lines 44–52  
Compensation handlers execute sequentially with `await comp.compensate(context)` but:
- There is no per-step timeout — a hanging compensation blocks the entire rollback chain.
- Compensation errors are swallowed (`logger.warn`) with no dead-letter queue or alerting.
- Steps have no idempotency keys, so a retry after partial compensation may double-compensate.
- There is no maximum compensation retry count.

**Impact:** A failed distributed transaction can silently leave the system in a partially rolled-back
state (e.g., money debited but no credit issued), constituting data corruption.  
**Remediation:** Add per-step compensation timeouts, idempotency keys, dead-letter queue, and
re-runnable compensation via saga state persistence. See `saga-orchestrator-v2.js`.

---

### CRIT-004 — RuleZGatekeeper Singleton Loaded with No Schema = Deny (Correct), But Path Traversal in YAML Loading
**File:** `rulez-gatekeeper.js` lines 18–25  
```js
const content = fs.readFileSync(`${rulesDir}${file}`, 'utf8');
```
The `rulesDir` is passed directly from the constructor call site with no path normalization.
If `rulesDir` is influenced by untrusted input (e.g., a config field loaded from a database or
API parameter), an attacker can traverse to arbitrary filesystem locations (`../../etc/passwd`).
Additionally, the schema match (`_checkSchemaMatch`) only checks top-level required fields' types;
nested objects, arrays, and unknown keys pass validation silently.

**Impact:** Arbitrary file read (path traversal); schema bypass via extra/nested malicious fields.  
**Remediation:** Normalize and jail `rulesDir` to a project-relative whitelist. Add recursive deep
validation with strict unknown-key rejection. See `security-hardening.js`.

---

## HIGH Findings

### HIGH-001 — Circuit Breaker: No Rolling Window for Error Rate
**File:** `circuit-breaker.js` lines 65–74  
`failureCount` increments for every failure but is reset to 0 on *any* success. This means:
- Intermittent failures that never consecutively hit the threshold never open the circuit.
- A 50% error rate on a busy service (alternating success/failure) will never trip the breaker.
- No time-based sliding window means old failures count against fresh successes.

**Remediation:** Implement a sliding window (count- or time-based) with configurable error rate
threshold. Track p50/p99 latency to also trip on latency SLA violations. See `circuit-breaker-v2.js`.

---

### HIGH-002 — Circuit Breaker: Half-Open Allows Unlimited Concurrent Probe Requests
**File:** `circuit-breaker.js` lines 33–40  
When the breaker transitions to HALF_OPEN, every concurrent caller that executes before the first
probe completes will also enter the service. Under high concurrency this defeats the purpose of
HALF_OPEN and can overwhelm a recovering service.

**Remediation:** Limit HALF_OPEN to a single probe at a time using a mutex/flag. Queue or fail-fast
all other callers during the probe window. See `circuit-breaker-v2.js`.

---

### HIGH-003 — No Cascading Failure Detection Across Circuit Breakers
**File:** `circuit-breaker.js` (all), `auto-heal.js`  
Individual breakers are independent. There is no mechanism to detect when multiple downstream
services open simultaneously (a cascading failure pattern). `auto-heal.js` iterates open breakers
but its recovery action is a stub (`exec` call commented out).

**Remediation:** Add a `BreakerRegistry` that emits a `cascade-alert` event when ≥ N breakers open
within a time window. Wire to real process restart or traffic shedding. See `circuit-breaker-v2.js`.

---

### HIGH-004 — No Distributed Rate Limiting (In-Process Only)
**File:** `governance-engine.js` `_checkBudgetLimits` (lines 344–379), `security-bee.js` line 80  
Rate limiting is tracked per-session in an in-process `Map`. In a horizontally scaled deployment
(multiple Cloud Run instances), each instance has its own counter and the effective rate limit is
`limit × instanceCount`. A client can burst to `N × limit` by distributing requests across instances.

**Remediation:** Move rate-limit state to a shared store (Redis or Cloudflare KV). Implement a
sliding window algorithm rather than a windowed counter. See `rate-limiter-v2.js`.

---

### HIGH-005 — worker-api-gateway.js and worker-auth-service.js Are Stubs (404 Placeholder)
**File:** `worker-api-gateway.js`, `worker-auth-service.js`  
Both Cloudflare Worker files contain only `404: Not Found`. These are listed as in-scope in
`SECURITY.md`. Critical security controls (rate limiting, authentication, CORS, security headers)
that should live in the edge layer are absent.

**Remediation:** Implement full worker logic including JWT verification at edge, security headers
(CSP, HSTS, X-Frame-Options), rate limiting via Cloudflare KV, and request sanitization. See
`security-hardening.js`.

---

### HIGH-006 — Auth `requireRole` Middleware Accepts Bare Token Without `Bearer` Enforcement
**File:** `auth-manager.js` line 275  
```js
const token = req.headers.authorization;
```
The middleware reads the raw `Authorization` header and passes it to `verifyToken`, which strips the
`Bearer ` prefix if present. This means both `Bearer <token>` and raw `<token>` are accepted. This
weakens token binding — a token stolen from a cookie or query string can be replayed in the
Authorization header without the `Bearer` prefix, bypassing any WAF rule that patterns on `Bearer`.

**Remediation:** Enforce strict `Bearer ` prefix in `requireRole`. Reject non-conforming requests
with 401. Add token binding via request fingerprint (IP + User-Agent hash). See `auth-hardening.js`.

---

### HIGH-007 — SHA-256 Used for Refresh Token and API Key Hashing (No Salt)
**File:** `auth-manager.js` lines 372–374  
```js
function _hashSecret(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
```
Plain SHA-256 without salt is used for refresh tokens and API keys. While these are high-entropy
random values (making rainbow tables impractical), there is no defense against a database-level
dictionary attack if the hash store is exfiltrated, and no iteration count to slow brute force.

**Remediation:** Use HMAC-SHA256 with a server-side pepper stored in a secret manager, or use
bcrypt/argon2 for values at rest. See `auth-hardening.js`.

---

### HIGH-008 — Policy Engine CUSTOM Condition Allows Arbitrary Code Execution
**File:** `policy-engine.js` lines 276–282  
```js
if (condition.operator === ConditionOp.CUSTOM && typeof condition.fn === 'function') {
  try { return condition.fn(evalCtx); } catch { return false; }
}
```
Policies loaded from a JSON file (`loadPolicies`) cannot include functions. However, policies added
programmatically via `addPolicy` can supply a `fn` function. If the `addPolicy` call site is
reachable from any API endpoint (even indirectly), an attacker can inject arbitrary code that runs
with the full Node.js process privileges inside the governance evaluation loop.

**Remediation:** Remove `CUSTOM` from condition operators entirely, or sandbox it using a VM2/
isolated-vm context with a strict allowlist. Audit all `addPolicy` call sites for exposure to
untrusted input. See `governance-engine-v2.js`.

---

### HIGH-009 — Content Safety Patterns Are Inadequate for Prompt Injection
**File:** `governance-engine.js` lines 64–73  
The `blockedPatterns` array covers only a handful of PII patterns and the `escalatePatterns` array
has a single drug-related pattern. The SECURITY.md claims "5-layer prompt injection defense" but no
such defense is visible in the governance code. There is no protection against:
- Jailbreak patterns ("ignore previous instructions", "DAN mode")
- System prompt extraction ("repeat your system prompt")
- Indirect injection via tool output
- Unicode homoglyph attacks to evade regex matching

**Remediation:** Integrate a dedicated prompt injection classifier. Expand blocked patterns.
Normalize Unicode before pattern matching. See `security-hardening.js`.

---

## MEDIUM Findings

### MED-001 — Exponential Backoff: No Circuit Breaker Integration
`withBackoff` retries unconditionally up to `maxRetries` without checking whether the target's
circuit breaker is open. This means a HALF_OPEN circuit can receive a burst of `maxRetries` probes
from a single failed request.

---

### MED-002 — ConnectionPool: No Health Check / Eviction of Stale Connections
`pool.js` tracks `active` count but has no idle connection timeout, health-check ping, or eviction
of connections that have been active longer than `timeoutMs` (they are never force-killed).

---

### MED-003 — AutoHeal: Recovery Action is a Commented-Out Stub
`auto-heal.js` line 53: `// exec(...)`. The recovery logic was never implemented. The class emits
"recovery cycle complete" after a 5-second `setTimeout` regardless of whether recovery occurred.
This creates false confidence in health dashboards.

---

### MED-004 — Governance Audit Trail is In-Process Only (Memory)
The audit trail (`_auditTrail`) is an in-memory array trimmed to `auditMaxEntries`. A process
restart, crash, or scale-down event silently discards all audit history. GDPR Article 30 requires
durable records. SECURITY.md claims "Immutable SHA-256 hash-chain audit log" but no hash-chaining
is implemented.

---

### MED-005 — Budget State is In-Process Only; No Window Reset Logic
`_checkBudgetLimits` uses `windowStart` in the budget state but never resets counters when the
window expires (there is no comparison against `windowStart + windowDuration`). Budget limits are
effectively lifetime caps per session, not per-minute/per-hour rolling limits.

---

### MED-006 — HeadyAssure Certification Has No Expiry Check
`headyAssure` issues a 24-hour certificate stored in `_certifications` Map. However, nothing
checks `expiresAt` when the certificate is later consumed; a caller can use an expired certificate
indefinitely.

---

### MED-007 — Policy Engine `loadPolicies` is Synchronous
`fs.readFileSync` is used in `loadPolicies`. In a high-throughput server this blocks the event loop
for the entire file read duration. On a 1 MB policy file this can cause visible latency spikes.

---

### MED-008 — No Rate Limiting on Auth Endpoints (login, refresh, API key creation)
`auth-manager.js` provides the token/session operations but no built-in rate limiting for brute
force protection on login attempts, refresh token replay attempts, or API key creation.

---

### MED-009 — OAuth2 Stub Leaks Provider-Specific Information in Errors
`handleOAuth2Callback` stubs are not production-safe. The stub user's `email` embeds the provider
name (`oauth2-user@${storedState.provider}.example`), and `oauthCode: '[redacted]'` is stored in
session metadata but the comment reveals the expected real implementation.

---

### MED-010 — Health Routes Expose Full System Internals Without Auth
`health-routes.js` `/health/full` returns `process.pid`, memory usage, CPU counters, Node.js
version, platform, arch, and resilience circuit breaker status with no authentication requirement.
This is an information disclosure vector useful to attackers for fingerprinting.

---

### MED-011 — RuleZGatekeeper Singleton Pattern Prevents Testing / Hot-Reload
`module.exports = new RuleZGatekeeper()` exports a singleton instantiated at require-time. This
prevents test isolation, makes rules hot-reloadable only via process restart, and ties YAML loading
to module cache initialization.

---

## LOW Findings

### LOW-001 — `_checkMissionAlignment` Uses Plain String `includes()` on JSON-Serialized Payload
Phrases like `"deny access"` could appear legitimately in a JSON-serialized context object (e.g., a
message saying "we should not deny access to users") and would trip the deny check.

### LOW-002 — Session TTL (8h) vs Refresh TTL (30 days) Gap Creates Long Re-Authentication Window
A refresh token valid for 30 days with no device/IP binding allows persistent access long after a
session should expire.

### LOW-003 — `_randomId` Uses `bytes` Parameter as Byte Length, Not Character Length
`_randomId(64)` generates 128 hex chars. The naming is ambiguous and misuse (passing 16 expecting
16 chars but getting 32) can lead to insufficient entropy in some call sites.

### LOW-004 — No `SameSite`/`Secure` Cookie Directives in Auth Middleware
If cookies are used for session tokens (e.g., in browser SSR flows), `requireRole` only reads the
`Authorization` header; cookie-based auth paths are not hardened.

### LOW-005 — Bulkhead `rejected` Counter Never Resets
`Bulkhead.rejected` increments indefinitely with no reset, making operational dashboards misleading
over long uptimes.

### LOW-006 — `logger.warn` Used for Security Events (Should Be `logger.security` / Structured Alert)
Security-relevant events (circuit opens, governance denials, token failures) log at `warn` level
mixed with operational warnings. A dedicated security audit log stream is needed.

### LOW-007 — No Dependency Pinning / SBOM
`package.json` is not included in the scanned files, but the heady-scan directory shows `pnpm-workspace.yaml`. Without a lockfile and SBOM, supply chain attacks via transitive dependency
injection are not detectable.

---

## Improvement File Mapping

| Finding(s)                             | Improvement File              |
|----------------------------------------|-------------------------------|
| CRIT-001, HIGH-006, HIGH-007, LOW-002  | `auth-hardening.js`           |
| CRIT-002, HIGH-008, HIGH-009, MED-004  | `governance-engine-v2.js`     |
| CRIT-003                               | `saga-orchestrator-v2.js`     |
| CRIT-004, HIGH-005, HIGH-009           | `security-hardening.js`       |
| HIGH-001, HIGH-002, HIGH-003, MED-001  | `circuit-breaker-v2.js`       |
| HIGH-004, MED-005, MED-008             | `rate-limiter-v2.js`          |

---

## Recommended Immediate Actions (Priority Order)

1. **[TODAY]** Rotate `JWT_SECRET` and enforce hard startup failure if missing (CRIT-001)
2. **[TODAY]** Remove admin governance bypass; add audit for all admin actions (CRIT-002)
3. **[This Sprint]** Replace in-process rate limiting with Redis/KV-backed sliding window (HIGH-004)
4. **[This Sprint]** Add saga compensation timeouts and dead-letter queue (CRIT-003)
5. **[This Sprint]** Implement actual worker-api-gateway and worker-auth-service (HIGH-005)
6. **[Next Sprint]** Migrate audit trail to durable, hash-chained persistent store (MED-004)
7. **[Next Sprint]** Replace circuit breaker error-count with sliding window (HIGH-001)
8. **[Next Sprint]** Add prompt injection classifier layer (HIGH-009)
