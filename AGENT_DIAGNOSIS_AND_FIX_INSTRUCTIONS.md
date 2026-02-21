# 🚨 Heady Systems Agent Diagnosis & Fix Instructions

**Version**: 1.0.0  
**Purpose**: Comprehensive troubleshooting guide for broken websites, localhost/domain issues, memory counter problems, and excessive user babysitting  
**Status**: ACTIVE - Use this as your primary reference for system diagnosis

---

## 🎯 PRIMARY OBJECTIVES

Your mission is to **make the Heady environment reliably usable without constant human babysitting**. Focus on:

1. **Fix broken web frontends** where pages load but links/buttons do nothing
2. **Complete localhost → domain migration** according to existing docs
3. **Reduce repeated reminders** by adding tests, guards, and checklists
4. **Investigate memory counter stuck at 150** and implement monitoring
5. **Eliminate unnecessary prompts** that shouldn't require human input

---

## 🔍 ENVIRONMENT SANITY CHECKS (RUN FIRST)

Before touching any code, perform this inventory:

### 1. DNS/Hosts Verification
```bash
# Check heady.local mappings
cat /etc/hosts | grep heady.local

# Expected entries (from INFRASTRUCTURE_SETUP.md):
# 127.0.0.1 manager.heady.local
# 127.0.0.1 dashboard.heady.local
# 127.0.0.1 api.heady.local

# Check .dev.local.heady.internal mappings
cat /etc/hosts | grep dev.local.heady.internal

# Expected entries (from HCFP_INTEGRATION_GUIDE.md):
# 127.0.0.1 manager.dev.local.heady.internal
# 127.0.0.1 app-web.dev.local.heady.internal
# 127.0.0.1 db-postgres.dev.local.heady.internal
# 127.0.0.1 db-redis.dev.local.heady.internal
```

**If missing**: Add exact lines from docs, reference specific document sections.

### 2. Service Health Matrix
Create this table for each service:

| Service | Expected Domain | Port | Health Check Command | Result |
|---------|----------------|------|---------------------|--------|
| Manager | manager.heady.local | 3300 | `curl -f http://manager.heady.local:3300/api/health` | OK/FAIL |
| Dashboard | dashboard.heady.local | 3000 | `curl -f http://dashboard.heady.local:3000` | OK/FAIL |
| API Gateway | api.heady.local | 8080 | `curl -f http://api.heady.local:8080/api/pulse` | OK/FAIL |

**Document any FAIL results with exact error messages.**

### 3. Browser/Extension Sanity
```bash
# Check HeadyBrowser/PWA installation
ls -la ~/Applications/ | grep -i heady
ls -la ~/.local/share/applications/ | grep -i heady

# Check browser extensions
# Chrome: chrome://extensions/
# Look for "Heady" extensions and verify they're enabled
```

### 4. Clean Build Baseline
```bash
# HCIS clean build
./.-infrastructure-setup.ps1 -Mode clean-build

# HCFP clean build  
npm run clean-build

# Capture results:
# - Success/Failure
# - Error classification: transient, non-recoverable, infra
# - Exact error messages if failed
```

---

## 🌐 FIXING "WEBSITES LOAD BUT LINKS/BUTTONS DO NOTHING"

Treat this as **front-end + routing + environment mis-wiring**. Follow these steps:

### Step 1: Concrete Reproduction Logging
For each affected app:

1. **Open via correct domain** (not localhost)
2. **Record exactly**:
   - URL accessed
   - Element clicked (button/link text, selector)
   - Expected behavior (navigation, modal, API call)
   - Actual behavior (nothing, error, 404)
3. **Capture browser dev tools**:
   - Console errors (screenshot full console)
   - Network requests (filter by clicks, note if none fire)
   - Elements panel (verify event listeners)

### Step 2: Frontend Routing & Handler Analysis
```bash
# Search for localhost references in frontend code
grep -r "localhost:" frontend/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"

# Search for hardcoded ports
grep -r ":3000\|:3300\|:8080" frontend/ --include="*.js" --include="*.jsx"

# Check React Router configuration
find frontend/ -name "*.js" -o -name "*.jsx" | xargs grep -l "Route\|useHistory\|navigate"
```

**Fix patterns found**:
- Replace `localhost:PORT` with proper domains
- Update base URLs in API calls
- Verify router basename configuration

### Step 3: Event Handler Verification
For each non-working button/link:

1. **Locate component** in codebase
2. **Verify handler wiring**:
   ```javascript
   // BAD: Missing or typo
   <button onClick={handleClick}>Click me</button>  // handleClick undefined
   
   // GOOD: Properly wired
   <button onClick={() => handleClick()}>Click me</button>
   ```
3. **Check function exists** and is imported
4. **Verify function triggers** expected action (navigation/API call)

### Step 4: CORS & Mixed Origin Issues
```bash
# Check CORS configuration
grep -r "cors\|CORS" backend/ --include="*.js" --include="*.json"

# Verify API calls use HTTPS in production
grep -r "http://" frontend/ --include="*.js" --include="*.jsx"
```

**Fix CORS errors**:
- Add proper CORS headers in backend
- Ensure frontend uses HTTPS in production
- Check for mixed content warnings

### Step 5: Create Regression Tests
For each fixed path:

```javascript
// Example Playwright test
test('Impact Meter button navigates correctly', async ({ page }) => {
  await page.goto('https://dashboard.heady.local:3000');
  await page.click('[data-testid="impact-meter-button"]');
  await expect(page).toHaveURL(/.*impact-meter/);
});
```

**Integrate into CI pipeline** to prevent regressions.

---

## 🔄 COMPLETING LOCALHOST → DOMAIN MIGRATION

Execute structured migration, not ad-hoc patching:

### Step 1: Comprehensive Inventory
```bash
# HCIS inventory
./.-infrastructure-setup.ps1 -Mode inventory > localhost-inventory.csv

# HCFP verification
npx migrate-localhost-to-domains.js --verify-only > localhost-check.txt
```

**Generate deduplicated list**:
- File path, line number, current localhost target, recommended domain

### Step 2: Apply Official Mappings
Use these canonical mappings from docs:

**HCIS Mappings**:
- `localhost:3300` → `manager.heady.local:3300`
- `localhost:3000` → `dashboard.heady.local:3000`
- `localhost:8080` → `api.heady.local:8080`

**HCFP Mappings**:
- `localhost:3300` → `manager.dev.local.heady.internal:3300`
- `localhost:5432` → `db-postgres.dev.local.heady.internal:5432`
- `localhost:6379` → `db-redis.dev.local.heady.internal:6379`

### Step 3: Audited Migration
```bash
# Present summary for approval
npx migrate-localhost-to-domains.js --dry-run

# Execute after approval
npx migrate-localhost-to-domains.js

# Verify zero localhost references remain
npx migrate-localhost-to-domains.js --verify-only
```

### Step 4: Rebuild & Verify
```bash
# Clean build
npm run clean-build

# Re-run service health checks via domains
./scripts/health-check-domains.sh

# Re-run frontend tests
npm run test:e2e
```

---

## 🤖 REDUCING CONSTANT USER BABYSITTING

Encode recurring human reminders into the system:

### Step 1: Identify Recurring Error Patterns
From recent runs/logs, categorize:

**Transient Errors** (auto-retry):
- Network timeouts
- Registry connection failures  
- Flaky test runs

**Non-Recoverable Errors** (fail fast):
- Syntax errors
- Missing files/configs
- Test failures

**Infrastructure Errors** (alert, don't prompt):
- Permission issues
- Disk/memory problems
- Container failures

### Step 2: Automate Safe Handling
```javascript
// Example: Auto-retry wrapper for transient errors
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  backoffMs = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (isTransientError(error) && attempt < maxRetries) {
        await delay(backoffMs * attempt);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Step 3: Add Pre-Flight Checks
```bash
#!/bin/bash
# pre-flight-check.sh

echo "🔍 Running pre-flight checks..."

# Check localhost references
if grep -r "localhost:" . --include="*.js" --include="*.json" | grep -v node_modules; then
  echo "❌ Localhost references found. Run migration first."
  exit 1
fi

# Check required env vars
if [[ -z "$HEADY_API_BASE" ]]; then
  echo "❌ HEADY_API_BASE not set"
  exit 1
fi

# Check domain health
if ! curl -f http://manager.heady.local:3300/api/health; then
  echo "❌ Manager service unhealthy"
  exit 1
fi

echo "✅ Pre-flight checks passed"
```

### Step 4: Eliminate Unnecessary Prompts
**Default choices for technical config**:
- Use documented ports/domains without asking
- Choose standard file locations automatically
- Apply conventional naming patterns

**Only prompt for**:
- Product/strategy decisions
- User data handling choices
- Architecture direction changes

---

## 🧠 INVESTIGATING "MEMORIES STOPPED AT 150"

Treat "memories" as logs/persistent store:

### Step 1: Locate Memory Subsystem
```bash
# Find memory/storage components
find . -name "*.js" -o -name "*.py" | xargs grep -l "memory\|log\|persist"

# Check database connections
grep -r "postgres\|redis\|sqlite" . --include="*.js" --include="*.json"

# Look for memory limits
grep -r "MAX_MEMORIES\|MEMORY_LIMIT\|retention" . --include="*.js" --include="*.json"
```

### Step 2: Check for Hard Caps
```javascript
// Look for patterns like this:
const MAX_MEMORIES = 150;  // ← This is the problem!

// Or database limits:
await db.query('DELETE FROM memories WHERE id > 150');
```

### Step 3: Check Write Errors
```bash
# Check logs around when memories stopped
tail -n 1000 logs/app.log | grep -E "(error|fail|memory)" | tail -n 50

# Check disk space
df -h

# Check database health
curl -f http://db-postgres.dev.local.heady.internal:5432/health
```

### Step 4: Add Monitoring
```javascript
// Memory counter health metric
export async function getMemoryHealth() {
  const count = await getMemoryCount();
  const trend = await getMemoryTrend(); // Change over last hour
  
  return {
    count,
    trend,
    healthy: trend > 0, // Should be increasing
    alert: trend === 0 && count > 0
  };
}

// Alert if stuck
setInterval(async () => {
  const health = await getMemoryHealth();
  if (health.alert) {
    await sendAlert('Memory counter stuck at ' + health.count);
  }
}, 60000); // Check every minute
```

---

## 📋 REPORTING FORMAT

After completing diagnosis, produce this concise report:

```
## 📊 DIAGNOSIS REPORT

### What I Checked:
- DNS/Hosts configuration for heady.local and dev.local.heady.internal
- Service health matrix (5 services)
- Frontend routing and event handlers
- Localhost migration inventory
- Memory subsystem health

### What I Changed:
- Fixed 3 localhost references in frontend/config.js
- Added CORS headers to backend API
- Created regression tests for Impact Meter button
- Implemented auto-retry for transient network errors
- Added memory counter monitoring with alerts

### What Still Looks Broken:
- Dashboard navigation still not working on mobile
- Memory counter still stuck at 150 (needs DB investigation)
- Manager service health check failing intermittently

### Next Changes Needed:
- Fix mobile navigation CSS issue
- Investigate Postgres memory table for write errors
- Add manager service health monitoring
- All changes need human review before production deployment
```

---

## ❓ CLARIFYING QUESTIONS FOR USER

**Environment Context**:
1. Which environment breaks most: local dev (*.heady.local), internal dev (*.dev.local.heady.internal), staging, or production?
2. Are you using HeadyBrowser/PWA desktop apps or regular browser?
3. Which specific URLs show broken buttons/links? (exact URLs please)

**Memory System**:
4. Where are "memories" supposed to be stored (database vs files)?
5. When did memories stop incrementing - after any specific change?

**Unnecessary Prompts**:
6. Give concrete examples of prompts that shouldn't require human input (exact wording)
7. What types of decisions should the system handle automatically?

**Drupal Integration**:
8. Which specific sites should use Drupal vs pure React?
9. Do you have Drupal hosting preferences (Render, VPS, Kubernetes)?

---

## 🚨 IMMEDIATE ACTIONS TO TAKE

1. **Run environment sanity checks first** - document all failures
2. **Fix localhost references** using official mappings from docs
3. **Add regression tests** for each broken UI element
4. **Implement memory monitoring** to identify why counter stuck
5. **Create pre-flight checks** to prevent deployment with known issues

**Remember**: Your goal is autonomous operation. Every fix should include automation to prevent the same issue from requiring human intervention again.

---

*This document is living - update it with new patterns discovered during troubleshooting.*
