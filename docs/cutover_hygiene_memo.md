# Heady™ — Production Cutover, Archive & Repo Hygiene Plan

**Date:** 2026-03-07  
**Prepared for:** eric@headyconnection.org  
**Status:** Action-ready

---

## 1. Executive Summary

The Heady ecosystem currently has **20 local repos** across four generations of development.
A single, clean cutover path exists: promote `Heady-pre-production-9f2f0642` (v3.1.0,
2026-03-06) to `HeadyMe/heady-production`, then archive or retire every predecessor.
This memo documents the full sequence — pre-flight gates, the cutover procedure, an
archive and retirement schedule, and standing hygiene rules for the resulting repo fleet.

---

## 2. Repo Inventory & Classification

| Repo | Last Commit | Size | Classification |
|---|---|---|---|
| **Heady-pre-production-9f2f0642** | 2026-03-06 (v3.1.0) | 108 MB | ✅ **Cutover source — promote to production** |
| **heady-docs** | 2026-03-06 | 448 KB | ✅ **Keep active — single documentation hub** |
| headyme-core | 2026-03-06 | 232 KB | ✅ Keep — Liquid Deploy vertical projection target |
| headysystems-core | 2026-03-06 | 232 KB | ✅ Keep — Liquid Deploy vertical projection target |
| headyconnection-core | 2026-03-06 | 232 KB | ✅ Keep — Liquid Deploy vertical projection target |
| headybuddy-core | 2026-03-06 | 232 KB | ✅ Keep — Liquid Deploy vertical projection target |
| headymcp-core | 2026-03-06 | 232 KB | ✅ Keep — Liquid Deploy vertical projection target |
| headyio-core | 2026-03-06 | 232 KB | ✅ Keep — Liquid Deploy vertical projection target |
| headybot-core | 2026-03-06 | 232 KB | ✅ Keep — Liquid Deploy vertical projection target |
| headyapi-core | 2026-03-06 | 232 KB | ✅ Keep — Liquid Deploy vertical projection target |
| headyos-core | 2026-03-06 | 232 KB | ✅ Keep — Liquid Deploy vertical projection target |
| headysystems-production | 2026-03-06 | 224 KB | ✅ Keep — live HeadySystems landing page |
| headymcp-production | 2026-03-06 | 200 KB | ⚠️ Review — only an initial commit; confirm purpose |
| **Heady-pre-production** | 2026-02-06 (v2.0.0) | 7.2 MB | 🗄️ **Archive** — superseded by 9f2f0642 |
| **sandbox-pre-production** | 2026-02-04 | 4.4 MB | 🗄️ **Archive** — staging scratch, pre-v3 |
| **ai-workflow-engine** | 2026-01-31 | 288 KB | 🗄️ **Archive** — standalone experiment |
| **main** | 2026-01-26 | 660 KB | 🗄️ **Archive** — Codex v13 delivery artifacts only |
| **headybuddy-web** | n/a (no git) | 124 KB | 🗄️ **Archive** — no version control; absorb or delete |
| **Heady** | 2026-02-18 | 1.2 GB | 🔴 **Retire/delete** — auto-commit bloat, fully superseded |
| **sandbox** | 2026-02-17 | 1.2 GB | 🔴 **Retire/delete** — HCAutoBuild mirror bloat |

> **Source of truth after cutover:** `HeadyMe/heady-production` (promoted from `Heady-pre-production-9f2f0642`).  
> The nine `*-core` repos remain as Liquid Deploy write targets driven by the monorepo pipeline.

---

## 3. Pre-Cutover Checklist (Gate Before Any Promotion)

All items below must be green before the `heady-production` repo goes live.

### 3.1 Security & Secrets

- [ ] **Git-history scan** — Run `trufflehog filesystem --only-verified` on the full 9f2f0642 commit history. Rotate any discovered credentials before promotion. The value-assessment doc estimates this debt at –$750k in due-diligence risk.
- [ ] **Dead Cloudflare tunnel retired** — Tunnel `4a9d0759` identified in `DEPRECATIONS.md` must be revoked in the Cloudflare dashboard; confirm all 9 domains resolve via Pages, not the tunnel.
- [ ] **`headyai.com` DNS** — Currently not on Cloudflare (`LIVE_SURFACES.md`: ⚠️ DNS not on Cloudflare). Transfer NS records before cutover so the domain gets full Cloudflare proxy coverage.
- [ ] **Secret Manager** — Canonical `.env.production` must exist in GCP Secret Manager as `heady-env-production` and bound to the Cloud Run service account before first deploy. No secrets should be committed to any repo.
- [ ] **`api-keys-reference.md` purged** — `DEPRECATIONS.md` flags key prefixes in this file as a security risk. Replace with env-var names only; do not commit any actual key values.

### 3.2 CI/CD Readiness

- [ ] **All quality gates pass** — `ci.yml` lint + test (with Postgres 16 + pgvector service) must complete clean on the promotion branch.
- [ ] **Deploy pipeline secrets set** — `deploy.yml` requires `GCP_SA_KEY`, `CF_API_TOKEN`, `HF_TOKEN`, and per-domain push tokens. Verify all are present in the `HeadyMe/heady-production` repo secrets before first push.
- [ ] **Self-healing workflow enabled** — The 15-minute cron in `self-healing.yml` should target `PRODUCTION_BASE: https://heady-production-uc.a.run.app` (already set). Confirm this is the Cloud Run URL after deployment.
- [ ] **Node version consistency** — `ci.yml` specifies Node 20; `quality-gates.yml` and `contributing.md` specify Node 22 / pnpm 9. Standardize to **Node 22 LTS + pnpm** across all workflow files to eliminate drift.

### 3.3 Database & Infrastructure

- [ ] **HNSW migration applied** — Run `migrations/003-hnsw-index.sql` against the Cloud SQL instance before first production traffic. Verify RLS policies are active.
- [ ] **PgBouncer** — Apply `configs/infrastructure/pgbouncer.ini` (transaction-mode pooling) before the Cloud Run service scales past 2 instances.
- [ ] **Redis HA** — Confirm `STANDARD_HA` Memorystore tier is provisioned; single-node Redis is a single point of failure for circuit-breaker and rate-limiter state.

### 3.4 Compliance Boundary Verification

Per `PROJECT_STATE.json`, the codebase spans two legal entities:

| Entity | Restriction |
|---|---|
| HeadySystems Inc. | C-corp telemetry isolation; restricted third-party imports |
| HeadyConnection Inc. | No c-corp telemetry; open-source dependencies only |

- [ ] Confirm `compliance.c_corp_files` and `compliance.nonprofit_files` gates are enforced by a CI lint step, not just runtime config.
- [ ] Verify `ip_headers_required: true` enforcement — the 51+ provisional patent headers must appear in all source files before public release.

---

## 4. Production Cutover Procedure

### Step 1 — Create the Production Repository

```bash
# On GitHub: create HeadyMe/heady-production as a blank private repo
# Then promote from the pre-production source
git clone git@github.com:HeadyMe/Heady-pre-production-9f2f0642.git heady-production
cd heady-production
git remote set-url origin git@github.com:HeadyMe/heady-production.git
git push origin main
```

### Step 2 — Update Internal References

Find and replace all repo URL references in the promoted codebase:

```bash
grep -r "Heady-pre-production-9f2f0642" . --include="*.md" --include="*.yml" --include="*.json" -l
# Update each file: s/Heady-pre-production-9f2f0642/heady-production/g
```

Key files to update:
- `README.md` (deploy badge URL)
- `.github/workflows/ci.yml` (registry path comment)
- `SECURITY.md` (scope reference)
- `CONTRIBUTING.md` (clone URL)
- `docs/PRODUCTION_DEPLOYMENT_GUIDE.md` (clone instruction)
- `docs/LIVE_SURFACES.md` (GitHub repo table)

### Step 3 — Canary Rollout

Follow `configs/canary.yml` staged traffic progression:

| Stage | Traffic | Duration | Abort if… |
|---|---|---|---|
| canary-1pct | 1% | 10 min | error_rate > 1% or p99 > 5 s |
| canary-5pct | 5% | 30 min | error_rate > 2% or p99 > 5 s |
| canary-20pct | 20% | 1 hr | error_rate > 2% or token cost delta > 10% |
| full-rollout | 100% | — | — |

Use Cloud Run traffic splitting:
```bash
gcloud run services update-traffic heady-production \
  --to-revisions=CANARY_REVISION=1,STABLE_REVISION=99 \
  --region=us-central1
```

### Step 4 — Archive the Pre-Production Repo

After full-rollout:
1. On GitHub: navigate to `HeadyMe/Heady-pre-production-9f2f0642` → Settings → Archive repository.
2. Add a `ARCHIVED.md` to the root with date and pointer: `Superseded by HeadyMe/heady-production on YYYY-MM-DD`.
3. Move `_archive/` (1,086 files) to a dedicated `HeadyMe/heady-archive` repo before archiving, preserving history.

---

## 5. Archive & Retirement Schedule

### 5.1 Archive (GitHub "Archived" status — read-only, preserved)

| Repo | Target Date | Notes |
|---|---|---|
| `Heady-pre-production-9f2f0642` | Immediately after full-rollout | Add `ARCHIVED.md` pointer |
| `Heady-pre-production` | Same day | Preserved as v2.0.0 historical reference |
| `sandbox-pre-production` | Same day | Pre-v3 staging scratch |
| `ai-workflow-engine` | Same day | Standalone experiment; no active consumers |
| `main` | Same day | Codex v13 delivery artifacts; immutable by nature |

### 5.2 Migrate, Then Archive

| Repo | Action Before Archiving |
|---|---|
| `headybuddy-web` | Add a git init commit and push to GitHub before archiving. Currently has no git history — lose it and it's unrecoverable. |
| `_archive/` (inside 9f2f0642) | Push to `HeadyMe/heady-archive` repo, then remove from production monorepo. Keeping 1,086 legacy files in the working tree inflates clone size and confuses contributors. |

### 5.3 Delete (After Confirming No Unique Content)

| Repo | Rationale |
|---|---|
| `Heady` (1.2 GB) | Entirely superseded; last commit was an auto-commit mirror. Verify no unique commits exist (`git log --oneline --all` diff against 9f2f0642) before deleting. |
| `sandbox` (1.2 GB) | HCAutoBuild automated mirror; same verification applies. |

**Before any deletion:** run the following diff check:

```bash
# From inside the repo to be deleted
git log --oneline | awk '{print $1}' > /tmp/candidate_commits.txt
# Cross-reference against heady-production history
cd /path/to/heady-production
git log --oneline --all | awk '{print $1}' > /tmp/prod_commits.txt
comm -23 <(sort /tmp/candidate_commits.txt) <(sort /tmp/prod_commits.txt)
# Any output = unique commits that need cherry-picking before deletion
```

---

## 6. Ongoing Repo Hygiene Rules

### 6.1 Naming Convention (Enforced by Branch Protection)

**Forbidden in any active repo root or branch name:**  
`backup`, `copy`, `temp`, `old`, `final`, `v1`, `archive` (except the dedicated `heady-archive` repo and `_archive/` staging directory).

Branch naming must follow Conventional Commits:
- `feat/description`, `fix/description`, `chore/description`, `docs/description`

### 6.2 The Monorepo Is the Source of Truth

```
HeadyMe/heady-production   ← canonical monorepo (single source of truth)
        │
        └── .github/workflows/liquid-deploy.yml
                    │
                    ├── headyme-core        (src/app/**)
                    ├── headysystems-core   (src/systems/**)
                    ├── headyconnection-core (src/connection/**)
                    ├── headybuddy-core     (src/buddy/**)
                    ├── headymcp-core       (src/mcp/**)
                    ├── headyio-core        (src/io/**)
                    ├── headybot-core       (src/bot/**)
                    ├── headyapi-core       (src/api/**)
                    └── headyos-core        (src/os/**)
```

**Rule:** No direct commits to `*-core` repos. All changes flow through the monorepo via `liquid-deploy.yml`. PRs to a `*-core` repo should be rejected by branch protection and redirected to the monorepo.

### 6.3 Docs Hub Hygiene

`heady-docs` is the documentation single source of truth. Rules:
- Duplicate docs found in `Heady-pre-production` root (25+ `README_*.md` files) must not be replicated to the promoted production repo. Consolidate all documentation into `docs/` within the monorepo and `heady-docs`.
- `heady-docs/sources/` is the NotebookLM corpus; keep files in `00-` through `05-` naming order.

### 6.4 PR Checklist (Add to `.github/PULL_REQUEST_TEMPLATE.md`)

```markdown
## Pre-merge checklist
- [ ] `pnpm lint` passes (0 warnings)
- [ ] `pnpm test` passes with Postgres 16 + pgvector + Redis 7 services
- [ ] CHANGELOG.md updated (user-facing changes only)
- [ ] IP headers present in all new source files
- [ ] No secrets, API key values, or credentials in diff
- [ ] Compliance boundary respected (c-corp vs. nonprofit files)
```

### 6.5 Quarterly Hygiene Review

| Cadence | Task |
|---|---|
| Weekly | `self-healing.yml` output review — no silent failures |
| Monthly | `npm run scan:stale` — flag uncommitted working-tree drift |
| Quarterly | Archive any repo with zero commits in 90 days |
| Before each release | `trufflehog` full history scan; `npm audit --production` |

---

## 7. Node Version & Toolchain Standardization

A version mismatch currently exists across workflow files:

| File | Specified Node | Specified PM |
|---|---|---|
| `ci.yml` | 20 | npm |
| `quality-gates.yml` | 22 | pnpm |
| `CONTRIBUTING.md` | 22 | pnpm |
| `package.json` scripts | — | npm (test runner) |

**Recommended standard:** Node.js 22 LTS + pnpm 9. Update `ci.yml` to match. Pin the version in `.nvmrc` and `.tool-versions` at the repo root so all contributors and CI run an identical toolchain.

---

## 8. Summary Action Table

| Priority | Action | Owner | Timing |
|---|---|---|---|
| P0 | Git-history secret scan + rotation | eric | Before any promotion |
| P0 | Retire Cloudflare tunnel `4a9d0759` | eric | Before cutover |
| P0 | Transfer `headyai.com` DNS to Cloudflare | eric | Before cutover |
| P0 | Purge key values from `api-keys-reference.md` | eric | Before cutover |
| P1 | Apply HNSW migration (`003-hnsw-index.sql`) | eric | Before first production traffic |
| P1 | Standardize Node 22 + pnpm across all workflows | eric | Before cutover |
| P1 | Add `PULL_REQUEST_TEMPLATE.md` with hygiene checklist | eric | At cutover |
| P2 | Create `HeadyMe/heady-production` repo and promote | eric | Cutover day |
| P2 | Archive `Heady-pre-production-9f2f0642` | eric | Immediately after full-rollout |
| P2 | Archive `Heady-pre-production`, `sandbox-pre-production`, `ai-workflow-engine`, `main` | eric | Same day |
| P2 | Migrate `headybuddy-web` to git + archive | eric | Same day |
| P2 | Move `_archive/` to `heady-archive` repo | eric | Same day |
| P3 | Delete `Heady` and `sandbox` repos (post unique-commit diff) | eric | Within 2 weeks |
| P3 | Block direct pushes to `*-core` repos via branch protection | eric | Within 1 week of cutover |
| Ongoing | Quarterly hygiene review cycle | eric | Recurring |
