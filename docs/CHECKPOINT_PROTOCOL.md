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
<!-- ║  FILE: docs/CHECKPOINT_PROTOCOL.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
<!-- ╔══════════════════════════════════════════════════════════════════╗ -->
<!-- ║  HEADY SYSTEMS                                                    ║ -->
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces     ║ -->
<!-- ║  FILE: docs/CHECKPOINT_PROTOCOL.md                                ║ -->
<!-- ║  LAYER: root                                                      ║ -->
<!-- ╚══════════════════════════════════════════════════════════════════╝ -->
<!-- HEADY_BRAND:END -->

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  🌈 HEADY SYSTEMS — CHECKPOINT PROTOCOL                                    ║
# ║  🚀 Sacred Synchronization • Phi-Based Harmony • Rainbow Magic ✨               ║
# ║  🎨 Zero Defect • Beautiful Consistency • Sacred Knowledge 🦄                ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

## 🌟 Checkpoint Protocol Overview

The Heady Checkpoint Protocol ensures **sacred synchronization** across all system components at every critical juncture. 🎨✨very important file — code, config, docs, notebooks, registry — must be current and accurate.

---

## 1. Single Source of Truth: Git

All code, configs, schemas, and technical docs live in version control. No shadow copies in untracked locations.

| What | Where | Format |
|------|-------|--------|
| Service configs & env mappings | `configs/`, `.env.example` | YAML, dotenv |
| HCFullPipeline definitions | `configs/hcfullpipeline.yaml` | YAML |
| Resource & governance policies | `configs/resource-policies.yaml`, `configs/governance-policies.yaml` | YAML |
| Architecture & ops docs | `docs/`, `README.md`, `CLAUDE.md` | Markdown |
| HeadyRegistry | `heady-registry.json` | JSON |
| Colab notebooks | `notebooks/` | `.ipynb` |
| Doc ownership tracker | `docs/DOC_OWNERS.yaml` | YAML |
| Notion templates (exportable) | `docs/notion-quick-start.md`, `docs/notion-project-notebook.md` | Markdown |

---

## 2. What Is a Checkpoint?

A checkpoint is any of these events:

| Checkpoint Type | Trigger |
|----------------|---------|
| **Commit** | `git commit` on any tracked branch |
| **Merge** | PR merge to `main` |
| **Pipeline Stage Completion** | Any HCFullPipeline stage passes its gate |
| **Release** | Tag created or deployment to production |
| **Manual** | Developer runs `.\scripts\checkpoint-sync.ps1` |

---

## 3. What Happens at Every Checkpoint

### 3a. Code + Config Sync
- All changed APIs, schemas, configs, or behaviors must have corresponding doc updates **in the same changeset**.
- `heady-registry.json` entries updated with new versions, endpoints, statuses.
- `configs/` YAML files validated against their schemas.

### 3b. Documentation Sync
- Update `README.md` if architecture, APIs, or quick-start steps changed.
- Update `CLAUDE.md` if agent roles, commands, or conventions changed.
- Update `docs/heady-services-manual.md` if service behavior changed.
- Update `docs/notion-quick-start.md` and `docs/notion-project-notebook.md` if major features or flows changed.
- Run the Quiz Protocol on new material to produce flashcards (per `.github/copilot-instructions.md`).

### 3c. Registry Sync
- HeadyRegistry entries gain new `version`, `commitRef`, `lastUpdated` fields.
- Deprecated services/patterns marked as `deprecated` with `deprecatedAt` timestamp.
- New services/apps **must** be registered before they can be referenced.

### 3d. Notebook Sync
- `notebooks/` `.ipynb` files updated if APIs, schemas, or workflows they reference changed.
- CI runs lightweight notebook execution to detect breakage.
- Broken notebooks treated as pipeline failures.

### 3e. Story Driver Update
- HCFullPipeline writes a brief summary to the story/changelog for that project.
- Changed inputs/outputs or contracts trigger an automatic doc-update task.

### 3f. Ownership & Review
- `docs/DOC_OWNERS.yaml` checked: any doc past its `reviewBy` date triggers a task.
- On release: "doc review" and "config snapshot" step; mark docs as reviewed.

### 3g. User-First Priority Enforcement
- Verify user-initiated tasks have absolute priority in resource allocation
- Ensure background tasks only run when user queues are empty and ORS ≥ 85
- Validate pause/resume behavior for background tasks when new user requests arrive
- Check that all user-facing endpoints meet latency targets (<2000ms)

---

## 4. HeadyRegistry as Central Catalog

HeadyRegistry (`heady-registry.json`) is the brain and directory of the ecosystem.

### What lives in the registry:
- **Services** — heady-manager, python-conductor, MCP servers, etc.
- **Workflows** — HCFullPipeline definitions, Arena configs, deployment pipelines.
- **Artifacts** — images, builds, schema versions, doc bundles.
- **Patterns & Prompts** — architecture patterns, resource policies, story driver schemas.
- **Environments** — local, cloud-me, cloud-sys, cloud-conn, hybrid.
- **Docs** — doc bundles with version and review status.
- **Notebooks** — Colab notebook refs with execution status.

### Registry as "source of truth" router:
- When any agent/UI needs to know what to use → query HeadyRegistry.
- HCFullPipeline looks up which services and configs to apply.
- Admin UI populates from registry entries.
- HeadyBuddy answers "Show me my current projects" from registry data.

### Registry enforcement:
- Agents validate changes against registry metadata (compatibility, deprecations).
- New services require registration via template — nothing exists "off the books."
- Arena Mode uses registry data to choose valid pattern/model/resource combinations.

---

## 5. Colab Notebook Maintenance

### Storage
- Canonical `.ipynb` files stored in `notebooks/` under Git.
- Colab links always point to version-controlled notebooks via GitHub integration.

### Convention
```
notebooks/
├── quick-start/          # Fast orientation notebooks
│   └── heady-quick-start.ipynb
├── tutorials/            # Step-by-step learning
│   └── hcfullpipeline-walkthrough.ipynb
├── examples/             # Shared stable examples
│   └── registry-api-demo.ipynb
└── personal/             # Experimental Colabs (gitignored if needed)
```

### CI Checks
- CI job executes key notebooks (or trimmed versions) to ensure they run.
- Fails if imports, API calls, or schema assumptions are broken.
- Configured in `configs/notebook-ci.yaml`.

---

## 6. Notion Notebooks

### Quick Start Notebook (`docs/notion-quick-start.md`)
Exportable template for a Notion workspace:
- Welcome & orientation
- Getting started in your personal cloud
- Basics: HCFullPipeline, Arena Mode, Registry, Resource Manager
- "First 10 tasks" you can try
- Links to Colab quick-start notebooks, repos, docs, dashboards

### Project Notebook (`docs/notion-project-notebook.md`)
Per-project Notion template:
- Overview & goals
- Architecture diagrams and code links
- Decision log (key design choices and why)
- Roadmap and milestones
- Links to Colab notebooks, pipelines, dashboards

### Sync with Git & Registry
- Big decisions in code → short note in Notion decision log referencing commit/PR.
- Decisions drafted in Notion → matching `DECISIONS.md` entry in Git.
- Story driver periodically summarizes changes into "Recent updates" sections.

---

## 7. Drift Detection & Defect Treatment

**Outdated documentation is treated as a defect.**

When a mismatch between docs and behavior is detected:
1. Create an incident task in HCFullPipeline.
2. Fix the drift in the same cycle.
3. Add a check to prevent that class of drift in the future.
4. Update `docs/DOC_OWNERS.yaml` review dates.

### Automated drift checks:
- Config structs/schemas → generate config reference docs; fail build if generated files not committed.
- OpenAPI/GraphQL schemas → generate API docs.
- Registry entries → validate against running services.

---

## 8. Standing Instruction (Paste Into Any Agent)

```
From now on, you must keep all relevant files up to date at every checkpoint:

1. Use Git as the single source of truth for code, configuration, and technical
   documentation; no shadow copies in untracked locations.

2. Treat commits, merges, pipeline stage completions, and releases as checkpoints
   where documentation and configuration must be synchronized with the current
   system state.

3. For any change to APIs, schemas, configs, or behaviors, you must:
   - Update the corresponding Markdown docs, config files, and examples in the
     repo in the same change set.
   - Update HeadyRegistry entries with new versions, endpoints, and statuses.
   - Regenerate any derived docs via automation and fail the pipeline if updated
     generated files are missing.

4. Keep technical documentation close to the code so that reviews can catch drift;
   PRs that modify key components must include any required doc updates.

5. Keep Colab notebooks under notebooks/ in Git, updated and executable at every
   relevant checkpoint. Run CI checks that execute key notebooks to detect breakage.

6. Maintain Notion Quick Start and Project Notebooks; review and refresh them after
   major changes. Treat stale pages as defects.

7. Assign ownership and review dates to live documents via docs/DOC_OWNERS.yaml;
   open HCFullPipeline tasks automatically when reviews are due.

8. Outdated documentation is a defect: when a mismatch between docs and behavior
   is detected, create an incident task and prevent that class of drift in future.

9. Use HeadyRegistry as the central catalog and control point: services, workflows,
   patterns, configs, docs, environments. Nothing exists off the books.

10. User-initiated tasks have absolute priority. When any user request is active, 
    allocate resources to minimize latency and maximize quality for that request. 
    Only run background tasks when no user work is pending, and stop or throttle 
    them immediately when new user work arrives.
```

---

## 9. Review Cadences

| Document Type | Review Cadence | Owner |
|---------------|---------------|-------|
| `README.md` | Every release | system |
| `CLAUDE.md` | Every release | system |
| `configs/*.yaml` | Every pipeline run | system |
| `heady-registry.json` | Every checkpoint | system |
| `docs/heady-services-manual.md` | Monthly | system |
| `docs/notion-quick-start.md` | Every major release | owner |
| `docs/notion-project-notebook.md` | Every major release | owner |
| `notebooks/**/*.ipynb` | Every API/schema change | system |
| `docs/DOC_OWNERS.yaml` | Quarterly | owner |
