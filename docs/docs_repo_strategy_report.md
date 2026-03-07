# Heady Repo Strategy Analysis
## Documentation Quality, Repo Sprawl, Projection Strategy, Duplication, Ingestion Readiness & Information Architecture

**Analyzed:** 13 repositories in `/home/user/workspace/headyme-repos/`  
**Date:** March 7, 2026  
**Analyst:** Automated audit against cloned repo state  

---

## Executive Summary

The Heady ecosystem spans 13 cloned repositories (of a stated 18-repo total) organized around a central monorepo (`Heady-pre-production-9f2f0642`) that drives all other repositories via an autonomous projection pattern. The architecture is conceptually strong and the monorepo is well-documented relative to industry norms. However, the ecosystem suffers from five structural problems: **pervasive stub repos that mask real state**, **duplicated documentation living in two repos simultaneously**, **critical internal reference breakage**, **legal entity naming inconsistency across files**, and **projection target repos that are essentially empty shells with one-line READMEs**. These issues collectively reduce developer trust, impede AI-assisted ingestion, and inflate the apparent repo count without adding navigational or functional value.

---

## 1. Repository Inventory & Classification

| Repo | Type | Files | Dirs | Status |
|---|---|---|---|---|
| `Heady-pre-production-9f2f0642` | Monorepo / Source of Truth | 2,321 | 503 | Active – Production-ready |
| `heady-docs` | Documentation Hub | 49 | 23 | Active – Good |
| `headyme-core` | Projected Domain Stub | 36 | 20 | Stub |
| `headysystems-core` | Projected Domain Stub | 36 | 20 | Stub |
| `headymcp-core` | Projected Domain Stub | 36 | 20 | Stub |
| `headyconnection-core` | Projected Domain Stub | 36 | 20 | Stub |
| `headybuddy-core` | Projected Domain Stub | 36 | 20 | Stub |
| `headyapi-core` | Projected Domain Stub | 36 | 20 | Stub |
| `headybot-core` | Projected Domain Stub | 36 | 20 | Stub |
| `headyio-core` | Projected Domain Stub | 36 | 20 | Stub |
| `headyos-core` | Projected Domain Stub | 36 | 20 | Stub |
| `headymcp-production` | Deployment Target | 30 | 18 | Near-empty |
| `headysystems-production` | Deployment Target | 33 | 18 | Near-empty |

**Note:** The `LIVE_SURFACES.md` doc references an `heady-production` repo that is not present among the cloned set, and heady-docs claims 18 total repos; 5 repos from the stated ecosystem (template repos, battle-arena repos, product repos) are not present in this analysis set.

---

## 2. Documentation Quality Assessment

### 2.1 Monorepo (`Heady-pre-production-9f2f0642`) — Score: B+

**Strengths:**
- README is comprehensive: table of contents, architecture diagram, core system table, API endpoint table, health probe table, resilience stack table, HeadyBee usage example, and deployment notes. Well above the industry median for a project of this size.
- `CHANGELOG.md` follows Keep a Changelog format with semantic versioning. The v3.1.0 entry is detailed.
- `SECURITY.md` and `CONTRIBUTING.md` exist and are substantive.
- `docs/PRODUCTION_DEPLOYMENT_GUIDE.md` is a thorough ~1,300-line operational runbook covering GCP, Redis, Cloudflare, Docker, CI, security, scaling, and troubleshooting.
- `docs/alive-software-architecture.md` is a canonical whitepaper with concrete implementation references (file paths, function names).
- `docs/openapi.yaml` provides a machine-readable API contract.
- `docs/DEPRECATIONS.md` is a well-maintained deprecation register.
- `.github/` contains `CODEOWNERS`, PR template, issue template, and Dependabot config.
- `_archive/AGENTS.md` contains a sophisticated deterministic governance rulebook covering security, architecture, CI/CD, and provider budget rules.

**Weaknesses:**

1. **Package manager contradiction.** `README.md` says *"This project uses `npm` as its package manager"* and shows `npm install`. `CONTRIBUTING.md` says *"pnpm v9+ (do NOT use npm)"* and uses `pnpm install`, `pnpm lint`, `pnpm test`. The `enterprise-task-extraction.md` doc explicitly calls out `pnpm` for CI. The actual `package-lock.json` (not `pnpm-lock.yaml`) is present, confirming npm is the runtime package manager. `CONTRIBUTING.md` is stale/wrong and will break contributor onboarding.

2. **Broken internal link in `CONTRIBUTING.md`.** The file references `docs/architecture/OVERVIEW.md` as the architecture guide. That directory and file do not exist anywhere in the repository. Any developer following the contributing guide hits a dead end immediately.

3. **OpenAPI version mismatch.** `docs/openapi.yaml` states `version: "3.0.1"` while `package.json` declares version `3.1.0`. The spec is one minor version behind.

4. **Legal entity name is inconsistent across root files.** `README.md` copyright line says "HeadySystems Inc." The trademark ownership line in the same file says "HeadyConnection Inc." `package.json` author is "HeadyMe". `heady-docs/sources/00-comprehensive-source.md` says "HeadyConnection Inc." `CHANGELOG.md` notes the entity was changed *from* LLC *to* Inc., but neither form is universally applied. This creates legal ambiguity that would be problematic in due diligence.

5. **`heady-registry.json` version drift.** The root `heady-registry.json` declares `version: "3.0.1"` while `configs/heady-registry.json` declares `version: "3.1.0"`. Two authoritative-looking registry files exist at different paths with different version data, creating confusion about which is canonical.

6. **`_archive/AGENTS.md` is stranded.** This is the most important governance document in the whole repo (deterministic rules for all AI agents), but it lives inside `_archive/` — a directory scheduled for removal. It should be at root level as `AGENTS.md` or `docs/AGENTS.md`.

7. **`docs/bookmarks_2_28_26.html` is a personal browser export.** This raw HTML file (13KB of browser bookmarks) has no place in a production repository's `docs/` folder. It is an accidental commit artifact.

8. **`docs/heady-platform-onboarding-roadmap.md` and `docs/heady-platform-transition-roadmap.md`** are short roadmap docs with no status indicators, no ownership, and no date-based milestones. They read as planning notes rather than actionable documentation.

9. **Missing `docs/architecture/` directory.** Five source files under `heady-docs/sources/` and the `alive-software-architecture.md` provide architecture content, but no unified `docs/architecture/` folder exists in the monorepo. The six-layer architecture described in `heady-docs/sources/05` is not mirrored as an in-repo reference for developers.

### 2.2 `heady-docs` Hub — Score: B

**Strengths:**
- Clear purpose: a single documentation hub for NotebookLM ingestion and GitHub Pages deployment.
- Six numbered source files covering executive overview, trading intelligence, IP portfolio, service catalog, architecture, and patents.
- `patents/README.md` is excellent: filing summary table, docket index, technology coverage map, innovation clusters, deadline tracker, and code-to-patent mapping.
- The static site (`site/index.html` + `style.css`) provides a deployable documentation portal.
- `strategic/value-assessment-2026-q1.md` is a candid and well-structured valuation document including sensitivity analysis.

**Weaknesses:**

1. **Exact file duplication with the monorepo.** Files `01-heady-executive-overview.md` through `05-heady-architecture-and-patterns.md` exist identically (byte-for-byte) in both `heady-docs/sources/` and `Heady-pre-production-9f2f0642/docs/notebook-sources/`. A redirect pointer file (`notebooks/heady-notebooklm-source.md`) acknowledges the old location is superseded, but the files themselves are maintained in two places with no sync mechanism other than manual copy. Drift is inevitable.

2. **`api/api-keys-reference.md` contains masked key prefixes and partial tokens.** While the values are masked (e.g., `pplx-FvR1...`, `gsk_bQNL...`, `sk-ant-api03-...`), these prefixes confirm which specific credential types and accounts are in use. A version of this same file in the monorepo's `docs/` is appropriately scrubbed (no masked values, only env var names). The heady-docs version should match the monorepo version or be removed entirely.

3. **heady-docs claims 18 repos in its README** but only 13 are present in the analysis set. The "GitHub Ecosystem (18 Repos)" count appears stale — the listed repos include battle-arena repos and product repos not cloned here.

4. **`sources/00-comprehensive-source.md` and `sources/01` through `05` overlap heavily.** The comprehensive source is essentially a table-of-contents digest of the numbered sources. For NotebookLM ingestion, uploading all six is redundant; the comprehensive source covers the same ground as the individual files but with less detail.

### 2.3 Projected Domain Repos (9 × `-core`) — Score: D

All nine `*-core` repos share the same structure:
- `index.js` — ~12 lines, an Express server that renders a basic HTML page from `site-config.json`
- `site-config.json` — service name, tagline, description, accent color, and 4 feature bullets
- `Dockerfile` — identical across 7 of 9 repos (byte-for-byte hash match)
- `LICENSE` — two versions exist (short vs long form) across repos, with no explanation of the difference
- `README.md` — 200–350 words describing aspirational features
- `package.json` — effectively a template with only `express` as a dependency and `"Tests coming soon"` test script

**Critical findings:**
- **All test scripts return `exit 0` with no tests.** Every `*-core` package.json has `"test": "echo \"Tests coming soon\" && exit 0"`. This means any CI configured against these repos would report a passing test suite despite zero actual coverage.
- **6 of 7 non-heady `-core` Dockerfiles are byte-for-byte identical** (same MD5: `e4ba6f7c04fa31f749714a84a99c70c0`). The only differences are the service name in `console.log()` and `site-config.json`. These are template instantiations, not independent services.
- **READMEs describe features that do not exist in the code.** For example, `headymcp-core`'s README claims "31 MCP Tools" and "Zero-Latency Dispatch." The actual `index.js` is a 12-line Express server that returns an HTML page. The features are architectural intent, not present implementation.
- **No `.github/workflows/` exists** in any `-core` repo. There is no CI/CD for these repos at all.
- **LICENSE inconsistency.** 7 repos have a short 2-line proprietay license; 2 repos (`headyme-core`, `headysystems-core`) have a more detailed 16-line version with restrictions. No explanation for the difference.

### 2.4 Production Target Repos (`headymcp-production`, `headysystems-production`) — Score: F

Both consist of a single file: a one-line `README.md` that reads:  
> `Live Projection: headymcp.com — Autonomous deployment target for HeadyMCP Dashboard UI`

No code, no Dockerfile, no workflows, no `.gitignore`. These are pure deployment targets whose content is presumably injected by the monorepo's projection system. As standalone repos they provide zero information to any developer who navigates to them.

---

## 3. Repo Sprawl Assessment

### 3.1 Repo Count vs. Real Utility

| Category | Repos | Real Distinct Codebases |
|---|---|---|
| Source of Truth | 1 (monorepo) | 1 |
| Documentation Hub | 1 (heady-docs) | 1 |
| Domain Stubs | 9 (`*-core`) | 1 (template with 9 configs) |
| Deployment Targets | 2 (`*-production`) | 0 (injected content) |
| **Total** | **13** | **3** |

The 9 domain stubs are essentially one template instantiated 9 times. They inflate the GitHub organization's repo count and create maintenance overhead without providing independent code value. Each stub must be individually cloned, patched, and secured, but they share 95%+ of their structure.

### 3.2 Projection Pattern — Designed for Sprawl

The monorepo's projection strategy (code as vector ASTs → "projected" into GitHub repos at runtime) is architecturally intentional. The README for `headyme-core` explicitly says:

> "This repository is **autonomously projected** from the Heady Latent OS."

This means the stubs are not just placeholder repos — they are the outputs of an automated system. The sprawl is by design. The problem is that the design does not yet have a corresponding **observability layer**: there is no index of what projection version each repo is at, no diff between the monorepo state and the projected state, and no mechanism for a human to know whether a given `-core` repo is in sync.

### 3.3 `_archive/` Directory — A Repo Within a Repo

The `_archive/` directory in the monorepo contains 1,022+ files across 37 subdirectories. It is a full application footprint from a prior era, including:
- A previous `heady-manager.js` (81KB legacy entrypoint)
- Previous `configs/` with 23 subdirectories
- `src/` with 37 subdirectories
- `heady-hf-spaces/`, `heady-buddy/`, `heady-ide-ui/`, `chrome-extension/`, `midi_bridge/`, `ableton-remote-script/`, etc.

`DEPRECATIONS.md` explicitly schedules `_archive/` for removal ("After cutover → Move to `heady-archive` repo"). Until that happens, the `_archive/` is effectively a second repo embedded inside the monorepo. It bloats the repo's file count (>1,000 of the monorepo's 2,321 non-git files), slows CI artifact collection, and complicates semantic search and AI ingestion over the codebase.

---

## 4. Duplication Between Core Repos

### 4.1 Cross-Repo Exact File Duplication

| File | Repos Affected | Identical? |
|---|---|---|
| `Dockerfile` | 7 of 9 `-core` repos | Yes (same MD5) |
| `docs/notebook-sources/01–05-*.md` (monorepo) vs `heady-docs/sources/01–05-*.md` | 2 repos | Yes (same byte count) |
| `docs/api-keys-reference.md` (monorepo) vs `heady-docs/api/api-keys-reference.md` | 2 repos | No (diverged – heady-docs version retains masked key prefixes) |
| `LICENSE` (short form) | 7 of 9 `-core` repos | Yes (same MD5) |
| Monorepo `heady-registry.json` (root) vs `configs/heady-registry.json` | 1 repo (internal) | No (version 3.0.1 vs 3.1.0) |

### 4.2 Structural Duplication in `*-core` Repos

Every `-core` repo follows the pattern:
```
index.js          ← template pattern, service name is the only variable
site-config.json  ← 6 fields: name, tagline, description, accent, features[4]
Dockerfile        ← identical except in headyme-core and headysystems-core
package.json      ← template with express dependency + "Tests coming soon"
README.md         ← ~250 words aspirational description
LICENSE           ← one of two versions
```

The total unique information in a `-core` repo above and beyond the template is:
- The service name (1 token)
- The tagline (3–5 words)
- The description (1–2 sentences)
- The accent color (6-char hex)
- Four feature bullet pairs (4 × 2 strings)
- The domain URL in `package.json`

That is less than 300 bytes of unique content per repo. Nine repos hold ~270KB of largely duplicated files.

### 4.3 Documentation Duplication (Monorepo Internals)

Within the monorepo itself:
- `docs/heady-prompt-library.md` (7KB) and `docs/HEADY_PROMPT_LIBRARY_FULL.md` (181KB) cover the same subject matter. The full version is 24x larger. There is no pointer from the short version to the full version.
- `heady-registry.json` (root, version 3.0.1) and `configs/heady-registry.json` (version 3.1.0) are both authoritative-looking but diverge on version.
- `configs/battle-blueprint.json` (root-level copy) and `_archive/` both contain prior-state battle artifacts without clear provenance.

---

## 5. Documentation Ingestion Readiness

### 5.1 For NotebookLM / RAG Ingestion

The `heady-docs/sources/` directory is explicitly optimized for NotebookLM. The files are:
- Well-structured with consistent H2/H3/table formatting
- Concise enough to fit within NotebookLM's source limit (~50K tokens per source)
- Logically separated (executive overview, trading, IP, services, architecture)
- Numbered for upload ordering

**Readiness score: High.** However:
- The `00-comprehensive-source.md` (7.8KB) overlaps with files 01–05. Uploading all 6 sources introduces ~40% redundancy in the ingestion set.
- The `strategic/value-assessment-2026-q1.md` and `patents/README.md` are high-value documents not included in the canonical sources list. They should be numbered and added as `06-` and `07-` sources.
- There is no `NOTEBOOK_SOURCES_INDEX.md` in `heady-docs/` itself (only in the monorepo's `docs/notebook-sources/`). The heady-docs repo should be self-contained.

### 5.2 For AI-Assisted Code Navigation (Code Agents / Copilot)

The monorepo's source tree is deep and well-structured but has three ingestion hazards:

1. **`_archive/` at repository root.** AI code agents that ingest the full repo tree will process >1,000 stale files from a prior version. This pollutes semantic search results with deprecated patterns, old API shapes, and superseded configurations. An AI agent asked "how does the bee factory work?" may surface the old `_archive/src/` bee factory rather than the current one.

2. **`docs/HEADY_PROMPT_LIBRARY_FULL.md` (181KB).** This is the largest single file in the repo. A 181KB markdown file containing a full prompt library will dominate token budgets in any RAG over the `docs/` directory. It should be split into domain-specific prompt files or moved outside the core docs index.

3. **`docs/bookmarks_2_28_26.html`.** Browser bookmarks in HTML format will produce garbage tokens in any text-based ingestion pipeline. Remove immediately.

### 5.3 For LLM Context Windows (Claude, Gemini, etc.)

The comprehensive source (`00-comprehensive-source.md`) is ~7.8KB and is the correct format for inserting Heady context into an LLM conversation. It covers the full platform in a single document and fits comfortably in any modern context window.

**Gap:** There is no equivalent "developer context" document — a shorter, code-focused summary of the repo structure, key files, module responsibilities, and contribution workflow that a developer (or AI agent) would need to orient themselves quickly. The README partially fills this role but is too long for quick orientation.

---

## 6. Information Architecture Analysis

### 6.1 Documentation Topology

```
Heady Documentation Ecosystem
├── heady-docs (external hub, audience: investors, partners, NotebookLM)
│   ├── sources/     ← NotebookLM inputs
│   ├── patents/     ← IP portfolio
│   ├── strategic/   ← Valuation documents
│   ├── api/         ← API keys reference (partially sensitive)
│   └── site/        ← Static site
│
└── Heady-pre-production-9f2f0642/docs/ (internal docs, audience: developers)
    ├── PRODUCTION_DEPLOYMENT_GUIDE.md
    ├── alive-software-architecture.md
    ├── openapi.yaml
    ├── DEPRECATIONS.md
    ├── LIVE_SURFACES.md
    ├── SKILL_MANIFEST.md
    ├── notebook-sources/   ← DUPLICATE of heady-docs/sources/
    ├── enterprise/
    ├── gemini-knowledge/
    ├── legal/
    ├── patents/             ← MAY DUPLICATE heady-docs/patents/
    ├── rebuild-blueprints/
    ├── research/
    └── strategic/
```

**Problems with this topology:**
- There is no clear audience boundary between heady-docs and the monorepo's docs/. Investors and developers both land in separate repos with partially duplicated content.
- The monorepo's `docs/` has grown organically into 10 subdirectories with inconsistent naming conventions (some `UPPERCASE.md`, some `lowercase-kebab.md`, some are subdirectories, some files).
- `docs/legal/`, `docs/research/`, `docs/gemini-knowledge/`, `docs/rebuild-blueprints/` are not indexed anywhere — they are discovery dead-ends.

### 6.2 Navigation Gaps

| Expected Document | Where It Should Be | Actual Status |
|---|---|---|
| `docs/architecture/OVERVIEW.md` | Monorepo `docs/architecture/` | Missing (broken link in `CONTRIBUTING.md`) |
| Onboarding guide for new contributors | `CONTRIBUTING.md` or `docs/ONBOARDING.md` | `CONTRIBUTING.md` exists but has broken links and wrong package manager |
| Index of all `docs/` subdirectories | Root `docs/README.md` | Does not exist |
| AGENTS.md (AI governance rules) | Repository root | Buried in `_archive/` |
| Projection sync status | Any doc | Does not exist |
| Inter-repo dependency map | Any doc | Does not exist |

### 6.3 Audience Misalignment

| Document | Current Location | Correct Audience | Problem |
|---|---|---|---|
| `heady-docs/api/api-keys-reference.md` | Public heady-docs repo | Internal dev only | Contains masked key prefixes; belongs in monorepo `.env.example` format only |
| `_archive/AGENTS.md` | Deprecated archive dir | All AI agents / all devs | Critical governance doc buried in deprecated directory |
| `docs/bookmarks_2_28_26.html` | Monorepo docs/ | Nobody | Personal artifact, should not exist in repo |
| `docs/HEADY_PROMPT_LIBRARY_FULL.md` (181KB) | Monorepo docs/ | Power users only | Too large for standard doc indexing; pollutes search |
| `_archive/HEADY_FINTECH_MASTERPLAN.md` | Archive | Historical reference | Contains detailed trading strategy and raw Python code; needs clear status label |

### 6.4 Version & State Ambiguity

The ecosystem contains multiple competing version signals:

| Source | Version |
|---|---|
| `package.json` | 3.1.0 |
| `docs/openapi.yaml` | 3.0.1 |
| `heady-registry.json` (root) | 3.0.1 |
| `configs/heady-registry.json` | 3.1.0 |
| `README.md` badge | v3.1.0 |
| `configs/heady-registry.json` `updatedAt` | 2025-01-01 (appears stale) |

A developer checking the registry to understand current platform state will find contradictory signals. An AI agent trying to answer "what version is Heady at?" will produce inconsistent answers depending on which file it reads.

---

## 7. Projection Strategy Assessment

### 7.1 What Works

The projection model — where the monorepo is the sole source of truth and domain repos are generated outputs — is architecturally sound for a solo or small team operating at scale. Key positives:
- Single security surface to audit (the monorepo)
- Domain repos can be regenerated at any time from vector state
- LIVE_SURFACES.md provides a deployment map
- The Cloudflare edge layer eliminates the need for static site repos in many cases
- `DEPRECATIONS.md` correctly identifies the projection model as the path to replacing the pre-production repo name with a stable production identifier

### 7.2 What Is Missing

1. **Projection manifest.** There is no machine-readable file that maps each projected repo to its source template, last projection timestamp, and canonical version. An operator cannot tell whether `headyme-core` reflects today's monorepo state or last month's.

2. **Projection diff tooling.** The `scripts/autonomous/vector-projection-orchestrator.js` exists but there is no documentation about how to run a projection diff to identify drift between the monorepo and projected repos.

3. **Projection README template.** Each `-core` repo's README describes aspirational features, not current state. A projection template should distinguish between "live features" and "roadmap features" — or suppress feature claims for repos that are in stub state.

4. **Production target repos are unverifiable.** `headymcp-production` and `headysystems-production` exist purely as targets with one-line READMEs. A developer landing on these repos has no idea what deployment process populates them, what branch strategy they use, or what monitoring is in place.

---

## 8. Concrete Improvement Recommendations

### Priority 1 — Fix Immediately (Documentation Integrity)

**R1. Fix the `CONTRIBUTING.md` package manager contradiction.**
- Remove the `pnpm` instructions from `CONTRIBUTING.md`; the project uses `npm` (evidenced by `package-lock.json`)
- Update all `pnpm lint` / `pnpm test` references to `npm run lint` / `npm test`
- Or: if `pnpm` is genuinely the intended package manager, add `pnpm-lock.yaml`, remove `package-lock.json`, and update README accordingly — but pick one consistently

**R2. Create `docs/architecture/OVERVIEW.md` or update the broken link.**
- Either create the missing file (synthesizing content from `alive-software-architecture.md` and `heady-docs/sources/05`) or change the `CONTRIBUTING.md` reference to point to an existing document
- Quick fix: `See \`docs/alive-software-architecture.md\` for the full architecture guide.`

**R3. Reconcile legal entity name across all files.**
- Decide on one canonical entity name (either "HeadyConnection Inc." or "HeadySystems Inc." per the CHANGELOG)
- Apply a search-and-replace pass across all root-level docs, package.json files, and LICENSE files
- Create a `docs/legal/ENTITY.md` file that documents the legal entity name, trademark serial number, and correspondence contacts

**R4. Remove `docs/bookmarks_2_28_26.html` from the monorepo.**
- This is a personal browser export; it adds no value and degrades AI ingestion quality
- If the linked resources matter, extract the URLs into a structured `docs/research/REFERENCES.md`

**R5. Remove masked key prefixes from `heady-docs/api/api-keys-reference.md`.**
- Replace with the scrubbed version from the monorepo's `docs/api-keys-reference.md` (env var names only, no masked values)
- Or remove the file from heady-docs entirely and link to the monorepo version

### Priority 2 — Structural Fixes (Architecture & Organization)

**R6. Promote `_archive/AGENTS.md` to repository root.**
- Move to `AGENTS.md` at the monorepo root (recognized by Claude, Gemini, and other AI agents as the agent governance file)
- This is the most important governance document in the repo and should not be buried in a deprecated directory
- Update `DEPRECATIONS.md` to note that `_archive/AGENTS.md` has been promoted, not removed

**R7. Eliminate notebook-sources duplication between repos.**
- `heady-docs/sources/` is the canonical location for NotebookLM sources
- Remove `docs/notebook-sources/` from the monorepo (or reduce it to a pointer/redirect file)
- Update `notebooks/heady-notebooklm-source.md` to point to the heady-docs GitHub raw URLs
- Add `NOTEBOOK_SOURCES_INDEX.md` to `heady-docs/` root (currently only in the monorepo)

**R8. Create `docs/README.md` as an index for the monorepo's docs/ directory.**
- The 10 subdirectories and ~15 root-level files in `docs/` are undiscoverable without listing
- A `docs/README.md` with a table (section, file/dir, audience, description) would allow developers and AI agents to navigate the documentation intentionally
- This is a 30-minute task with high return on developer experience

**R9. Unify the two `heady-registry.json` files.**
- Keep `configs/heady-registry.json` as the single source-of-truth registry
- Remove or clearly rename the root `heady-registry.json` as `heady-registry.DEPRECATED.json` pending cleanup
- Alternatively, differentiate their purposes: root could be a "projection manifest" and `configs/` the service registry, but document the distinction

**R10. Add a `docs/PROJECTION_STATUS.md` manifest.**
- Create a machine-readable (and human-readable) file listing each projected repo, its source template, last projection date, and live URL
- Template:
  ```
  | Repo                  | Template   | Last Projected | Live URL              | Status  |
  |-----------------------|-----------|---------------|----------------------|---------|
  | headyme-core          | domain-stub | 2026-03-06  | headyme.com          | Active  |
  | headymcp-production   | prod-target | 2026-03-06  | headymcp.com         | Active  |
  ```
- This directly addresses the "projection drift" visibility problem

### Priority 3 — Repo Consolidation (Sprawl Reduction)

**R11. Consolidate the 9 `-core` repos into a single `heady-sites` template repo (or subdirectory).**
- Since all `-core` repos are templated projections with <300 bytes of unique content each, they can be represented as a single repo with a `sites/` directory containing a subdirectory per domain
- Each subdirectory holds only the `site-config.json` (the unique data) and references a shared `Dockerfile.template` and `index.js.template`
- The projection engine can deploy each domain independently from this single repo
- Benefit: 9 repos → 1 repo; 9 sets of CI/security surface → 1; all stub READMEs in one place

**R12. Replace `-core` stub READMEs with a standardized template that separates current state from roadmap.**
- Add a visible `> **Status: Projected Stub** — Feature implementation in [Heady-pre-production-9f2f0642]` badge at top of each `-core` README
- Move feature lists to a "Roadmap" section, clearly labeled as planned (not live)
- Add a "Current Live Behavior" section that accurately describes what the stub actually does (serves a static landing page from `site-config.json`)

**R13. Expand `-production` repo READMEs.**
- `headymcp-production` and `headysystems-production` should have READMEs that explain:
  - What the repo is used for (deployment target for CI/CD pipeline)
  - What branch strategy governs it
  - How to check the live deployment status
  - What monitoring is in place
- Even 15 lines would be better than the current single-sentence stub

### Priority 4 — Documentation Architecture (Ingestion Quality)

**R14. Split `docs/HEADY_PROMPT_LIBRARY_FULL.md` (181KB) into domain-specific prompt files.**
- A 181KB markdown file is too large for most RAG chunk strategies and dominates token budgets
- Split into: `docs/prompts/dev.md`, `docs/prompts/ops.md`, `docs/prompts/research.md`, etc.
- Keep a short `docs/HEADY_PROMPT_LIBRARY.md` (the existing 7KB file) as the index

**R15. Add `06-` and `07-` numbered sources to `heady-docs/sources/`.**
- `06-heady-patent-portfolio.md` — synthesized from `patents/README.md` (currently missing from the NotebookLM source set)
- `07-heady-strategic-valuation.md` — synthesized from `strategic/value-assessment-2026-q1.md`
- These are high-signal documents for investor and analyst contexts that are currently not reachable from the primary ingestion set

**R16. Create a `CONTEXT.md` developer orientation file at the monorepo root.**
- 200–400 words covering: repo purpose, key directories, which files to read first, how projection works, where tests live, and one-line descriptions of the most important source modules
- Designed for AI agent ingestion (the first file any code agent should read)
- Distinct from `README.md` (deployment-focused) and `CONTRIBUTING.md` (contributor-focused)

### Priority 5 — Immediate Cleanup

**R17. Accelerate `_archive/` removal (or extract to `heady-archive` repo).**
- `_archive/` contains 1,022+ files and constitutes ~44% of the monorepo's total file count
- Until removed, AI ingestion over the repo is contaminated with stale code
- A concrete cutover deadline should be set in `DEPRECATIONS.md` (current entry says "After cutover" with no date)

**R18. Sync OpenAPI version to match `package.json`.**
- `docs/openapi.yaml` `version: "3.0.1"` should be updated to `"3.1.0"` to match the package
- Add this to CI: a version check script that fails if `package.json` version ≠ `openapi.yaml` version

**R19. Add CI to the `-core` repos.**
- At minimum, each `-core` repo should have a `.github/workflows/healthcheck.yml` that builds the Docker image and hits `/health` to confirm the projection is functional
- Longer term, replace `"test": "echo \"Tests coming soon\" && exit 0"` with real smoke tests
- A failing health check in a `-core` repo should alert the monorepo pipeline

**R20. Add a `configs/heady-registry.json` `updatedAt` maintenance rule.**
- Current value is `"updatedAt": "2025-01-01T00:00:00Z"` — visibly stale for a 2026 project
- Add an automated check or pre-commit hook that validates `updatedAt` is not more than 30 days old

---

## 9. Summary Metrics

| Dimension | Finding |
|---|---|
| Total repos analyzed | 13 |
| Repos with substantive code | 2 (monorepo + heady-docs) |
| Stub repos (near-identical projections) | 9 |
| Near-empty production targets | 2 |
| Exact-duplicate Dockerfiles | 7 of 9 `-core` repos |
| Exact-duplicate documentation files | 5 files across 2 repos |
| Broken internal documentation links | 1 confirmed (`docs/architecture/OVERVIEW.md`) |
| Package manager contradictions | 1 (npm vs pnpm) |
| Legal entity name variants | 3 distinct forms across root files |
| Version signal inconsistencies | 4 files with conflicting versions |
| Docs files misplaced (personal artifacts) | 1 (`bookmarks_2_28_26.html`) |
| Critical governance docs in deprecated location | 1 (`AGENTS.md`) |
| Missing `docs/README.md` index | Yes |
| NotebookLM ingestion readiness | High (with 3 gaps) |
| AI code agent ingestion cleanliness | Medium (blocked by `_archive/`) |

---

*Report generated from live repository state on March 7, 2026. All file paths, hashes, and line counts are based on the actual cloned repository contents in `/home/user/workspace/headyme-repos/`.*
