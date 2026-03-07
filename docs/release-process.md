# HeadySystems Release Process

**Version:** 1.0.0  
**φ-revision:** 1.618  
**Last Updated:** 2026-03-07  

---

## Overview

This document defines the full release lifecycle for HeadySystems: branch strategy, versioning, changelog generation, release notes, and rollback procedure.

All releases follow semantic versioning and use φ-scaled timing for traffic rollouts.

---

## Branch Strategy

```
main                ← Production. Always deployable. Tagged with semver.
  ↑ merge
pre-production      ← Staging. Release candidates live here. CI runs full test suite.
  ↑ merge
feature/TICKET-xxx  ← Feature branches. Short-lived. Branch from pre-production.
fix/TICKET-xxx      ← Bug fix branches.
hotfix/TICKET-xxx   ← Emergency fixes. Branch from main, merge to both main + pre-production.
```

### Branch Protection Rules

**`main`:**
- Requires 1 PR review (or 2 for breaking changes)
- Requires all CI checks to pass
- No direct pushes (admin override for hotfixes only)
- Commit signing required

**`pre-production`:**
- Requires 1 PR review
- All CI checks required
- Force push allowed for rebase

### Merge Strategy

- Feature branches → pre-production: Squash merge (clean commit history)
- pre-production → main: Merge commit (preserve full history)
- Hotfix → main: Cherry-pick + create backport to pre-production

---

## Versioning — Semantic Versioning (SemVer)

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]

3.2.2        — Production release
3.3.0-beta.1 — Beta pre-release
3.3.0-rc.1   — Release candidate
```

### When to increment

| Change Type | Version | Example |
|------------|---------|---------|
| Breaking API changes | MAJOR | 3.x.x → 4.0.0 |
| New features (backward-compatible) | MINOR | 3.2.x → 3.3.0 |
| Bug fixes, patches | PATCH | 3.2.2 → 3.2.3 |
| Pre-release (beta, RC) | PRERELEASE | 3.3.0-beta.1 |

### Pre-release Tags

```
alpha.N  — Internal only, may break
beta.N   — Partner preview, API may change
rc.N     — Release candidate, API frozen
```

---

## Release Cadence

| Release Type | Cadence |
|-------------|---------|
| Patch releases | As needed (bug fixes, security) |
| Minor releases | Every fib(6)=8 weeks |
| Major releases | Announced fib(13)=233 days in advance |
| Hotfixes | Within fib(5)=5 hours of critical issue detection |

---

## Release Process — Step by Step

### 1. Pre-Release Checks (pre-production branch)

```bash
# Ensure pre-production is up to date
git checkout pre-production
git pull origin pre-production

# Run full test suite
pnpm test --coverage

# Run security scan
pnpm audit
gcloud artifacts docker images scan gcr.io/heady-production/heady-brain:latest

# Check test coverage thresholds (must meet φ-scaled minimums)
# Unit:        ≥ 61.8% (1/φ)
# Integration: ≥ 38.2% (1/φ²)
# E2E:         ≥ 21%   (fib8/100)

echo "✓ Pre-release checks passed"
```

### 2. Bump Version

```bash
# Determine version type: patch | minor | major
VERSION_TYPE="minor"

# Bump version using changeset
pnpm changeset
pnpm changeset version

# Or manual bump
pnpm version:bump $VERSION_TYPE  # uses custom script

# Resulting commits will be like:
# "chore: release v3.3.0"
```

### 3. Generate Changelog

```bash
# Generate CHANGELOG.md from commits since last tag
pnpm changelog:generate

# Review and edit the generated changelog
# Ensure it follows docs/release/changelog-template.md format

# Commit changelog
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for v3.3.0"
```

### 4. Create Release PR

```bash
# Create pre-production → main PR
gh pr create \
  --base main \
  --head pre-production \
  --title "Release: v3.3.0" \
  --body "$(cat .github/PULL_REQUEST_TEMPLATE/release.md)"
```

### 5. Pre-Production Staging Smoke Test

CI automatically deploys pre-production to the staging environment. Verify:

```bash
STAGING_URL="https://staging.headyme.com"

# Health checks
curl -f "$STAGING_URL/healthz"
curl -f "$STAGING_URL/api/v1/health"

# Smoke tests
pnpm test:e2e --env=staging

echo "✓ Staging smoke tests passed"
```

### 6. Merge and Tag

After PR approval:

```bash
# Merge pre-production → main
git checkout main
git merge --no-ff pre-production -m "Release: v3.3.0"

# Tag the release
git tag -s v3.3.0 -m "Release v3.3.0

$(head -50 CHANGELOG.md)"

git push origin main --tags
```

### 7. Deploy — Blue-Green Rollout

The GitHub Actions `deploy.yml` workflow triggers automatically on `main` push. It executes the blue-green deployment script:

```bash
# Automated by CI, but can be triggered manually:
./scalability/deployment/blue-green-deploy.sh \
  --service heady-gateway \
  --image gcr.io/heady-production/heady-gateway:v3.3.0

# Traffic schedule (φ-scaled):
# 0% → 5% (fib5)  wait 5 min  (fib5)
# 5% → 13% (fib7) wait 8 min  (fib6)
# 13% → 55% (fib10) wait 13 min (fib7)
# 55% → 100%
```

### 8. Post-Deploy Verification

```bash
# Wait for φ^5=5min after full traffic shift
sleep 300

# Verify production health
curl -f "https://api.headyme.com/healthz"
curl -f "https://api.headyme.com/api/v1/health"

# Check error rate < 1% (CSL LOW)
gcloud monitoring read \
  'metric.type="run.googleapis.com/request/count"' \
  --filter='metric.labels.response_code_class="5xx"' \
  --freshness=5m \
  --project=heady-production

echo "✓ Release v3.3.0 deployed successfully"
```

### 9. GitHub Release and Announcement

```bash
# Create GitHub release
gh release create v3.3.0 \
  --title "HeadySystems v3.3.0" \
  --notes-file docs/release/RELEASE-NOTES-v3.3.0.md \
  --latest

# Announce in #releases Slack channel and email newsletter
```

---

## Rollback Procedure

If a release causes issues, roll back immediately using the blue-green revision:

### Immediate Rollback (< 5 minutes)

```bash
# Get previous stable revision
PREV_REVISION=$(gcloud run revisions list \
  --service=heady-gateway \
  --region=us-central1 \
  --limit=2 \
  --format='value(name)' \
  --sort-by=~createTime | tail -1)

# Route 100% traffic to previous revision
gcloud run services update-traffic heady-gateway \
  --region=us-central1 \
  --to-revisions="$PREV_REVISION=100" \
  --project=heady-production

echo "✓ Rolled back to $PREV_REVISION"
```

### Rollback for All Services

```bash
./scalability/deployment/rollback-all.sh --reason "v3.3.0 regression: error rate exceeded 1/φ threshold"
```

### Post-Rollback

1. Create incident report in #incidents channel
2. Revert the release PR on GitHub
3. Create a new branch to fix the issue
4. Follow the full release process again

---

## Hotfix Process

For critical production issues that can't wait for a scheduled release:

```bash
# 1. Branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-security-patch

# 2. Fix the issue
# ... make changes ...

# 3. Bump patch version
pnpm version:bump patch

# 4. Test
pnpm test

# 5. Create PR directly to main
gh pr create --base main --title "hotfix: {description}" --label "hotfix"

# 6. After approval, merge and deploy
# (Uses expedited deploy: 0% → 13% → 55% → 100% with fib(5)=5s waits)
./scalability/deployment/blue-green-deploy.sh \
  --service heady-gateway \
  --image gcr.io/heady-production/heady-gateway:v3.2.3 \
  --fast  # compressed traffic schedule

# 7. Backport to pre-production
git checkout pre-production
git cherry-pick main
git push
```
