# Security & CI Improvement Memo
**To:** Heady Engineering  
**From:** Security & Platform Review  
**Date:** 2026-03-07  
**Subject:** Secret Exposure, Deploy Gating, and Release Hardening — Findings and Remediation

---

## Executive Summary

A cross-repo audit of 20 Heady repositories identified **four critical secret exposures** embedded in tracked files, several CI workflow weaknesses that undermine the existing deploy-gating architecture, and a cluster of hardening gaps that increase blast radius on any future compromise. Immediate action is required on secret rotation; the CI/release issues are remediable within one sprint.

---

## 1. Secret Exposure — Critical (Rotate Immediately)

Four confirmed plaintext secrets exist in committed, tracked files. These are live credentials, not placeholders.

| # | Repo | File | Secret Type | Detail |
|---|------|------|------------|--------|
| S-1 | `Heady-pre-production` | `heady_protocol.ps1` line 85 | GitHub PAT | `ghp_xyz…` (pattern match; same script in S-4 is confirmed real) |
| S-2 | `Heady-pre-production-9f2f0642` | `.vscode/mcp.json` | Internal Bearer Token | `hdy_int_4d2d3fe4becc8ad3eea4c9c9b25ba68a83b28335143b89ab` — full value committed, grants access to `heady.headyme.com/sse` |
| S-3 | `heady-docs` | `api/api-keys-reference.md` | GitHub PATs (×2) | `ghp_49EA…` (GITHUB_TOKEN primary) and `ghp_9xLg…` (GITHUB_TOKEN_SECONDARY) — listed as "verified/active" with partial values; combined with Sentry org token `sntrys_ey…` |
| S-4 | `sandbox-pre-production` | `heady_protocol.ps1` line 83 | GitHub PAT pattern | `ghp_xyz…` (same file structure as S-1; treat as real until confirmed otherwise) |

**A BFG Repo Cleaner run was already executed** on `Heady-pre-production-9f2f0642` (report dated 2026-03-06), which removed TLS private keys (`ca.key`, `client.key`, `server.key`, `client.pem`, `server.pem`) from git history. This is good — but S-2 (`.vscode/mcp.json`) appears to have been committed after or outside the BFG scope and remains live in the working tree.

### Required Actions

1. **Rotate all four secrets now.** Assume GitHub PATs `ghp_49EA…` and `ghp_9xLg…` and the internal bearer token are compromised. Rotate at GitHub → Settings → Developer settings and at the issuing service.
2. **Revoke and reissue** the `hdy_int_*` MCP bearer token via whatever internal service manages it.
3. **Run BFG or `git filter-repo`** on all four affected repos to scrub secrets from history, then force-push. A rewrite is not optional — rotating the token without removing the committed value leaves the old value permanently accessible to anyone with repo access.
4. **Remove `heady-docs/api/api-keys-reference.md` entirely** or replace all partial key values with vault references (`{{ secrets.GITHUB_TOKEN }}`). A public-facing API reference that lists partial live keys is a reconnaissance aid.
5. **Add `.vscode/` to the root `.gitignore`** of every repo that doesn't already exclude it. The `.gitignore` in `Heady-pre-production-9f2f0642` is otherwise well-constructed (SEC-004 hardening) but omits `.vscode/`.

---

## 2. Deploy Gating — Gaps and Inconsistencies

The `Heady-pre-production-9f2f0642` CI pipeline (`ci.yml` + `deploy.yml`) is the most mature in the fleet. The core gating chain (lint → test → security-scan → build → staging → prod) is sound. The gaps below weaken it.

### 2.1 Snyk Scan Is Advisory-Only and Does Not Block Deploys

In `ci.yml`, the Snyk step is explicitly marked `continue-on-error: true` with the comment "advisory — does not block deploy." High-severity findings in third-party dependencies pass silently through to production.

**Fix:** Remove `continue-on-error: true` from the Snyk step or add a required status check that fails the build when Snyk reports HIGH or CRITICAL. The `npm audit --audit-level=high` step above it is blocking, but Snyk catches CVEs that npm audit misses.

### 2.2 Post-Deploy Smoke Tests Exit 0 on Failure (`deploy.yml`)

The `smoke-tests` job in `deploy.yml` ends with an unconditional `exit 0` regardless of how many health checks failed. A failed canary that cannot reach its health endpoint passes CI anyway.

```yaml
# Current behavior — always green:
exit 0

# Required:
if [ "$STATUS" != "200" ]; then
  exit 1
fi
```

**Fix:** Replace the final `exit 0` with a conditional that exits non-zero when the primary health endpoint (`/health`) returns anything other than `200`. Edge/secondary failures can remain warnings.

### 2.3 Cosign Image Signing Is `continue-on-error: true`

The Docker image signing step (`ci.yml` build job) is soft-failures:

```yaml
- name: Sign the image with Cosign
  uses: sigstore/cosign-installer@v3
  continue-on-error: true
- name: Sign
  run: cosign sign …
  continue-on-error: true
```

Unsigned images can be deployed to production. Without signature verification at pull time (in Cloud Run or a policy controller), this signing step provides no actual supply-chain guarantee.

**Fix:** Either (a) enforce signing — remove `continue-on-error`, add a `cosign verify` step in the deploy job before any `gcloud run deploy` call — or (b) remove the signing steps entirely until enforcement is in place. A soft-signing workflow creates false confidence.

### 2.4 `Heady-pre-production` Deploy Triggers Directly on `push` to `main` Without CI Gate

The `deploy-render.yml` in `Heady-pre-production` fires on every `push` to `main` without a `needs:` dependency on `ci.yml` (the separate lint/build job). The CI and deploy are independent workflows; a broken commit can trigger both simultaneously and the deploy races ahead.

**Fix:** Either merge CI and deploy into one workflow with an explicit `needs:` chain, or add a branch protection rule on `main` that requires `CI / build` to pass before any merge is accepted.

### 2.5 Production Deploy in `deploy.yml` Sets `--allow-unauthenticated` on Cloud Run

Both staging and production Cloud Run deploys pass `--allow-unauthenticated`, which bypasses Cloud Run's built-in IAM layer and relies solely on application-level auth. This is a wider attack surface than needed for a managed internal backend.

**Fix:** Remove `--allow-unauthenticated` from production; route requests through an authenticated Cloudflare Worker (which already sits in front) or use `--no-allow-unauthenticated` + a Cloud Run Invoker service account bound to the edge layer.

---

## 3. Release Hardening Gaps

### 3.1 Third-Party GitHub Actions Pinned to Mutable Tags, Not SHAs

Several actions use mutable version tags that can be silently repointed:

| Action | Current Pin | Risk |
|--------|------------|------|
| `trufflesecurity/trufflehog@main` | floating `main` branch | Any commit to upstream main executes in your runner |
| `aquasecurity/trivy-action@master` | floating `master` | Same |
| `slackapi/slack-github-action@v1` | mutable semver tag | Tag could be repointed |
| `softprops/action-gh-release@v1` | mutable semver tag | Tag could be repointed |

**Fix:** Pin all third-party actions to full commit SHAs:
```yaml
# Instead of:
uses: trufflesecurity/trufflehog@main
# Use:
uses: trufflesecurity/trufflehog@6c0da3d32e66e2fbbc0acafabaf1f78ae3aae8dd  # v3.x.x
```
Dependabot is already configured for `github-actions` ecosystem (weekly, Mondays) — it will keep SHA-pinned actions updated automatically.

### 3.2 `liquid-deploy.yml` Has No Dependency on Security Scan

The `liquid-deploy` workflow, which pushes code from the monorepo into all 9 vertical `*-core` repos, does not declare a `needs:` on any security-scanning job. It also does not use Workload Identity Federation (OIDC) for GCP auth — the `liquid-deploy` job has no `permissions: id-token: write` block, unlike `deploy.yml` which at least has the field. If GCP credentials are needed for the projection pipeline, they should use OIDC rather than long-lived service-account JSON.

**Fix:** Add `needs: [security-scan]` at the top of the projection job matrix. Add `permissions: id-token: write` and switch to `google-github-actions/auth@v2` with `workload_identity_provider` if Cloud Run or Artifact Registry access is needed.

### 3.3 Pre-Commit Hook Is Not Installed by Default

The URL-policy enforcement hook (`pre-commit-url-check.sh`) exists but requires manual installation (`cp scripts/pre-commit-url-check.sh .git/hooks/pre-commit`). It is not auto-installed, meaning it is likely absent on most developer machines. The 777 localhost references in `Heady` and 585 in `Heady-pre-production-9f2f0642` are partly a symptom of this.

**Fix:** Add a `prepare` script to `package.json`:
```json
"scripts": {
  "prepare": "cp .githooks/pre-commit-url-check.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit"
}
```
Or use `husky` (already present in the `_archive`) to manage hooks declaratively. Also extend the hook to detect secret patterns (`ghp_`, `sk-`, `hdy_int_`, `AIzaSy`, `Bearer `) in staged files — this would have caught S-2 before commit.

### 3.4 `heady-docs`, `headymcp-production`, `headysystems-production`, `main`, and `headybuddy-web` Have Zero CI Workflows

Five repos contain committed code (or Dockerfiles, in the case of `main`) with no automated checks whatsoever. `heady-docs` is the repo with two confirmed secret exposures and has no CI.

**Fix:** At minimum, add a single `ci.yml` to each of these repos that runs:
1. Secret detection via gitleaks or TruffleHog (the fleet already uses both)
2. Markdown/YAML lint for docs repos

The `*-production` repos should have at minimum a read-only drift check — a job that verifies the production state matches the tagged release.

### 3.5 Unresolved Merge Conflict Markers in Production-Adjacent Repos

| Repo | Conflict Markers |
|------|-----------------|
| `Heady` | 52,546 |
| `sandbox` | 51,709 |
| `Heady-pre-production-9f2f0642` | 3,448 |
| `Heady-pre-production` | 692 |
| `sandbox-pre-production` | 564 |

These are `<<<<<<<`, `=======`, `>>>>>>>` markers left unresolved in committed code. They indicate the actual deployed codebase may contain duplicated or contradictory logic blocks, some of which could affect auth paths, config loading, or environment branching.

**Fix:** Add a merge-conflict check to CI:
```yaml
- name: Check for merge conflict markers
  run: |
    if git grep -rn "^<<<<<<< \|^=======$\|^>>>>>>> " --include="*.js" --include="*.ts" --include="*.json" .; then
      echo "Merge conflict markers found. Resolve before merging."
      exit 1
    fi
```
Then systematically resolve the backlog, starting with files in `src/` and `configs/`.

---

## 4. Priority Matrix

| Priority | Item | Effort | Risk Reduced |
|----------|------|--------|-------------|
| **P0 — Immediate** | Rotate all 4 exposed secrets (S-1 through S-4) | 1–2 hrs | Critical |
| **P0 — Immediate** | BFG/filter-repo history rewrite on 4 affected repos | 2–4 hrs | Critical |
| **P0 — Immediate** | Add `.vscode/` to `.gitignore` fleet-wide | 30 min | High |
| **P1 — This Sprint** | Remove or redact `heady-docs` API keys reference | 1 hr | High |
| **P1 — This Sprint** | Fix smoke-tests `exit 0` → conditional exit | 30 min | High |
| **P1 — This Sprint** | Make Snyk scan blocking (remove `continue-on-error`) | 30 min | High |
| **P1 — This Sprint** | Pin all floating action refs to commit SHAs | 2 hrs | Medium |
| **P1 — This Sprint** | Add `security-scan` as `needs:` in `liquid-deploy.yml` | 1 hr | High |
| **P2 — Next Sprint** | Enforce or remove Cosign signing (no soft-sign) | 2 hrs | Medium |
| **P2 — Next Sprint** | Remove `--allow-unauthenticated` from production Cloud Run | 2 hrs | Medium |
| **P2 — Next Sprint** | Auto-install pre-commit hook via `prepare` script + add secret patterns | 2 hrs | Medium |
| **P2 — Next Sprint** | Add minimal CI (secret scan + lint) to 5 no-workflow repos | 3 hrs | Medium |
| **P3 — Backlog** | Resolve merge conflict marker backlog (52k+ markers) | Ongoing | Medium |
| **P3 — Backlog** | Switch `liquid-deploy` GCP auth to OIDC Workload Identity | 3 hrs | Medium |
| **P3 — Backlog** | Decouple Heady-pre-production CI and deploy workflows | 2 hrs | Medium |

---

## 5. What Is Already Working Well

- **`Heady-pre-production-9f2f0642`** has the strongest pipeline architecture in the fleet: gated lint → test → security-scan → build → staging smoke test → manual-approval production, with canary traffic splitting and automated rollback on 5xx errors.
- **BFG history rewrite** was already run on 2026-03-06, removing committed TLS private keys from git history.
- **Dependabot** is configured for npm, GitHub Actions, and Docker on a weekly cadence.
- **CODEOWNERS** covers all sensitive paths (security/, auth/, workflows/, Dockerfiles).
- **TruffleHog and gitleaks** are both present in various workflows — coverage just needs to be made universal and blocking.
- **Google Secret Manager** is used correctly in the Cloud Run deploy commands (`--set-secrets=…`) for runtime secrets, which is the right pattern.
- **`sandbox-pre-production`** deploy-render workflow is correctly gated to `workflow_dispatch` only (no auto-deploy on push), unlike its sibling.

---

*Prepared from static analysis of `/home/user/workspace/heady_repos` and `/home/user/workspace/heady_improvement_package/data/` (repo_summary.json + repo_issues.csv).*
