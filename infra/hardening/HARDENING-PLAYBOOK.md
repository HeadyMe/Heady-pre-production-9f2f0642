# Heady™ Infrastructure Hardening Playbook

> Priority: IMMEDIATE | Timeline: Start Now
> Impact: +$1M valuation (per Q1 2026 sensitivity analysis)

---

## Phase 1: Git History & Secret Purge (Day 1)

### 1.1 Run BFG Repo Cleaner

```bash
# Clone a mirror of the monorepo
git clone --mirror git@github.com:HeadyMe/Heady-pre-production-9f2f0642.git

# Remove all .env files, secrets, and keys from history
java -jar bfg.jar --delete-files '*.env' Heady-pre-production-9f2f0642.git
java -jar bfg.jar --delete-files '*.pem' Heady-pre-production-9f2f0642.git
java -jar bfg.jar --delete-files '*.key' Heady-pre-production-9f2f0642.git
java -jar bfg.jar --replace-text passwords.txt Heady-pre-production-9f2f0642.git

# Clean and push
cd Heady-pre-production-9f2f0642.git
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push
```

### 1.2 Rotate All Secrets

Execute `scripts/secret-rotation-immediate.sh` (provided in this package):

| Secret Type | Action | Tool |
|-------------|--------|------|
| GitHub PATs | Revoke + regenerate fine-grained | GitHub Settings |
| Cloudflare API keys | Rotate | Cloudflare Dashboard |
| GCP Service Account keys | Rotate via IAM | gcloud CLI |
| PostgreSQL passwords | Rotate | ALTER ROLE |
| Redis AUTH | Rotate | CONFIG SET requirepass |
| JWT signing keys | Rotate | scripts/rotate-jwt.js |
| Anthropic API key | Rotate | Anthropic Console |

### 1.3 Enforce .gitignore

Add to `.gitignore` at monorepo root:
```
.env
.env.*
*.pem
*.key
*.p12
**/secrets/
**/credentials/
.heady-memory/*.json
```

---

## Phase 2: CI/CD Security Gates (Day 1-2)

### 2.1 Add Coverage Gate to CI

Add to `.github/workflows/ci.yml`:

```yaml
  test-with-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npx jest --coverage --coverageReporters=json-summary
      - name: Check coverage threshold
        run: |
          COVERAGE=$(node -e "const c=require('./coverage/coverage-summary.json'); console.log(c.total.lines.pct)")
          echo "Line coverage: ${COVERAGE}%"
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "❌ Coverage ${COVERAGE}% is below 80% threshold"
            exit 1
          fi
```

### 2.2 Add Lockfile Integrity Check

```yaml
  lockfile-integrity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          npm ci --ignore-scripts
          git diff --exit-code package-lock.json || {
            echo "❌ Lockfile out of sync"
            exit 1
          }
```

### 2.3 Add SBOM Generation

```yaml
  sbom:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: CycloneDX/gh-node-module-generatebom@v1
        with:
          output: bom.json
      - uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: bom.json
```

### 2.4 Add Integration Test Stage

```yaml
  integration-tests:
    runs-on: ubuntu-latest
    needs: [test-with-coverage]
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx jest --testPathPattern='tests/(integration|e2e)' --runInBand
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/heady_test
          REDIS_URL: redis://localhost:6379
```

---

## Phase 3: Runtime Security Hardening (Day 2-3)

### 3.1 Helmet Configuration

File: `src/middleware/security-headers.js`
```javascript
const helmet = require('helmet');

module.exports = function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://*.headysystems.com", "https://*.headyme.com"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });
};
```

### 3.2 Rate Limiter Enhancement

File: `src/resilience/rate-limiter-hardened.js`
```javascript
const rateLimit = require('express-rate-limit');

const PHI = 1.6180339887;

// Fibonacci-stepped rate limits
const tiers = {
  free:       { windowMs: 60000, max: 13 },
  starter:    { windowMs: 60000, max: 21 },
  pro:        { windowMs: 60000, max: 34 },
  enterprise: { windowMs: 60000, max: 89 },
  internal:   { windowMs: 60000, max: 233 },
};

function createRateLimiter(tier = 'free') {
  const config = tiers[tier] || tiers.free;
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        tier,
        retryAfter: Math.ceil(config.windowMs / 1000),
        phi: PHI,
      });
    },
  });
}

module.exports = { createRateLimiter, tiers };
```

### 3.3 Environment Validator

File: `src/security/env-validator-hardened.js`
```javascript
const REQUIRED_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'ANTHROPIC_API_KEY',
  'CLOUDFLARE_API_TOKEN',
  'GCP_PROJECT_ID',
];

const FORBIDDEN_PATTERNS = [
  /localhost/i,
  /127\.0\.0\.1/,
  /0\.0\.0\.0/,
  /password123/i,
  /changeme/i,
];

function validateEnvironment() {
  const errors = [];
  const warnings = [];

  // Check required vars
  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      errors.push(`Missing required env var: ${key}`);
    }
  }

  // Check forbidden patterns
  for (const [key, value] of Object.entries(process.env)) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(value)) {
        errors.push(`Forbidden pattern in ${key}: ${pattern}`);
      }
    }
  }

  // Check for production readiness
  if (process.env.NODE_ENV !== 'production') {
    warnings.push('NODE_ENV is not set to production');
  }

  return { valid: errors.length === 0, errors, warnings };
}

module.exports = { validateEnvironment, REQUIRED_VARS };
```

---

## Phase 4: Secret Rotation Automation (Day 3)

### 4.1 Automated Secret Rotation Schedule

File: `src/security/rotation-scheduler.js`
```javascript
const cron = require('node-cron');
const { rotateJWTKeys } = require('./rotate-jwt');
const { rotateDBCredentials } = require('./rotate-db');
const { rotateAPIKeys } = require('./rotate-api-keys');

const PHI = 1.6180339887;

// Rotation intervals (days) — Fibonacci-scaled
const ROTATION_SCHEDULE = {
  jwt:       { intervalDays: 13, fn: rotateJWTKeys },
  database:  { intervalDays: 34, fn: rotateDBCredentials },
  apiKeys:   { intervalDays: 21, fn: rotateAPIKeys },
};

function startRotationScheduler() {
  for (const [name, config] of Object.entries(ROTATION_SCHEDULE)) {
    // Convert days to cron (run at 3am UTC)
    cron.schedule(`0 3 */${config.intervalDays} * *`, async () => {
      console.log(`[SecretRotation] Rotating: ${name}`);
      try {
        await config.fn();
        console.log(`[SecretRotation] ✅ ${name} rotated successfully`);
      } catch (err) {
        console.error(`[SecretRotation] ❌ ${name} rotation failed:`, err.message);
        // Alert via telemetry
      }
    });
  }
}

module.exports = { startRotationScheduler, ROTATION_SCHEDULE };
```

---

## Phase 5: Monitoring & SLO Framework (Day 3-4)

### 5.1 SLO Definitions

File: `configs/slo-definitions.yaml`
```yaml
slos:
  - name: api-availability
    target: 99.9%
    window: 30d
    metric: successful_requests / total_requests

  - name: api-latency-p99
    target: 2000ms
    window: 30d
    metric: http_request_duration_p99

  - name: orchestration-latency-p95
    target: 5000ms
    window: 30d
    metric: conductor_task_duration_p95

  - name: memory-query-latency-p95
    target: 100ms
    window: 30d
    metric: vector_query_duration_p95

  - name: swarm-consensus-time-p95
    target: 3000ms
    window: 30d
    metric: swarm_consensus_duration_p95

  - name: circuit-breaker-trip-rate
    target: <5%
    window: 7d
    metric: circuit_breaker_trips / total_calls
```

### 5.2 Health Check Endpoints

Ensure all services expose:

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `/health/live` | Kubernetes liveness | 200 if process alive |
| `/health/ready` | Kubernetes readiness | 200 if deps connected |
| `/health/startup` | Startup probe | 200 after boot complete |
| `/health` | Full health report | JSON with all component status |

---

## Hardening Checklist

- [ ] BFG repo cleaner run on all repos
- [ ] All secrets rotated
- [ ] .gitignore hardened
- [ ] Coverage gate added to CI (80% threshold)
- [ ] Lockfile integrity check in CI
- [ ] SBOM generation automated
- [ ] Integration test stage in CI
- [ ] Helmet security headers configured
- [ ] Rate limiter with Fibonacci tiers
- [ ] Environment validator hardened
- [ ] Secret rotation scheduler deployed
- [ ] SLO definitions published
- [ ] Health check endpoints verified
- [ ] Load testing added to pipeline
- [ ] Canary deployment workflow created
