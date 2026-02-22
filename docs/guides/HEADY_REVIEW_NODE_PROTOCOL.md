<!-- ╔══════════════════════════════════════════════════════════════════╗ -->
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║ -->
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║ -->
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║ -->
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║ -->
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║ -->
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║ -->
<!-- ║                                                                  ║ -->
<!-- ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║ -->
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║ -->
<!-- ║  FILE: HEADY_REVIEW_NODE_PROTOCOL.md                                   ║ -->
<!-- ║  UPDATED: 20260218-211102                                            ║ -->
<!-- ╚══════════════════════════════════════════════════════════════════╝ -->

# ✅ SCANNED: 20260218-211102
# 🔍 INSPECTED: All content reviewed
# 🏷️  BRANDED: Heady Systems branding applied
# 📊 STATUS: Fully compliant with HCFP Full Auto Mode

# Heady Comprehensive Review Node Protocol

## Overview
This protocol provides an extensive question set for AI coding agents to systematically analyze, validate, and optimize the Heady project across all components, ensuring robust connectivity, optimal performance, and proper tool utilization.

## 1. Per-File Structural Sanity

### Identity and Role
For each file F, the node must ask:
- What is the primary purpose of this file F (config, code, script, doc, registry, notebook, infra)?
- Which subsystem(s) does F belong to (manager, pipeline engine, AI nodes, MCP servers, scripts, infra, docs)?
- Is this purpose clearly reflected in the filename, path, and header comments?
- Does the file have proper ownership documentation in DOCOWNERS.yaml?

### Syntax and Format Validation
- Is the file syntactically valid for its type (YAML, JSON, JS, TS, Python, MD, PS1, etc.)?
- Are there any schema or typing violations (e.g., config keys missing, wrong types, unknown fields)?
- Does the file conform to the repo's style and formatting conventions (lint rules, Prettier/Black, branding header)?
- Are all required imports and dependencies present and correctly versioned?

### Dead or Duplicate Content Analysis
- Is any code, config, or doc in F unused, duplicated elsewhere, or superseded by newer files?
- If yes, should F be removed, archived, or clearly marked as legacy?
- Are there overlapping responsibilities between F and other files that should be refactored into a single source of truth?
- Does this file implement functionality that should be abstracted into reusable components?

### Security and Governance Hygiene
- Does F contain hardcoded secrets, tokens, passwords, or keys that should be moved to Secret Service or environment variables?
- Are there any insecure defaults (e.g., NODE_ENV=development in production, open CORS, weak rate limits)?
- Does F expose internal URLs, ports, or IPs that should be abstracted behind config or service discovery?
- Does F comply with governance-policies.yaml access control requirements?

## 2. Connectivity and Dependency Wiring

### Dependency Reference Validation
- Does F reference other files, services, or components by name (e.g., heady-manager.js, srchcpipeline.js, configs/hcfullpipeline.yaml, AI node IDs, MCP servers)?
- For each reference, does the target actually exist, with the expected path, API shape, and version?
- Are there dangling references to removed or renamed components?
- Are version constraints consistent across all references?

### Pipeline and Stage Wiring
- If F participates in HCFullPipeline (stages, stop rules, checkpoints), are all referenced stages declared in hcfullpipeline.yaml and reachable via the DAG?
- Are stage dependencies acyclic and producing a valid topological order?
- Do stop rules in F align with global stop rules and ORS thresholds (no conflicting criteria)?
- Are checkpoint protocols properly implemented and testable?

### Node and Agent Connectivity
- If F defines or uses an AI node (e.g., PYTHIA, JULES, claude-code), is that node registered in the registry and visible via /api/nodes?
- Are activation/deactivation flows correct (API endpoints, scripts, and configs all agree on IDs and modes)?
- Are Supervisor–agent routing rules consistent with service-catalog.yaml and code-level routing logic?
- Are node health checks and readiness probes implemented and functional?

### External Integration Consistency
- For each external service (Render, Postgres, Cloudflare, MCP servers, external APIs), are endpoints, auth methods, and timeouts configured consistently across all files?
- Are circuit breakers, retry policies, and rate limits correctly bound to those endpoints, with no missing protections?
- Do external integrations have proper fallback and degradation modes?

## 3. Correctness of Behavior and Invariants

### Core System Invariants
- Does F respect determinism requirements (same configs + deps ⇒ same plan graph and routing decisions)?
- Does F obey the Stop Rule: "build aggressively when healthy, repair first when not"; does it avoid triggering new builds when ORS is low or critical errors exist?
- Does F maintain the contract of its exposed API (inputs, outputs, error codes, idempotency)?
- Are atomic operations and transaction boundaries properly defined?

### Error Handling and Resilience
- When failures occur, does F fail loudly and observably (logs, metrics, health checks) rather than silently?
- Are retries, fallbacks, and circuit breakers implemented where specified in resource-policies.yaml or pipeline policies?
- Does F avoid infinite loops, unbounded retries, or concurrency explosions?
- Are error budgets and SLOs properly defined and monitored?

### Data Integrity and Schema Compliance
- Does F read and write data consistent with data-schema.yaml and relevant schema definitions (types, ranges, required fields)?
- Are migrations or schema changes reflected in notebooks, docs, and other data consumers?
- Does F avoid data corruption on partial failures (e.g., uses transactions, two-phase updates, or compensating actions where needed)?
- Are data validation and sanitization properly implemented?

### Governance and Access Control
- Does F enforce access control, domains, and change policies required by governance-policies.yaml (e.g., who can trigger rebuilds, deploy, or modify critical configs)?
- Does F log governance-relevant events (e.g., production mode activation, pipeline archive, sensitive data access)?
- Are audit trails and compliance requirements met?

## 4. Performance, Scaling, and Optimality

### Algorithmic Efficiency Analysis
- Are there obvious performance bottlenecks in the code (quadratic loops over large data, unnecessary blocking I/O, unindexed queries)?
- Could we replace any polling with event-driven hooks or callbacks?
- Is caching correctly applied, respecting cache TTLs and invalidation rules (e.g., config-hash-keyed caching, 1-hour TTL)?
- Are data structures and algorithms optimal for the expected scale?

### Concurrency and Resource Management
- Are worker pool sizes, semaphore limits, and concurrency settings set to safe and efficient defaults per environment?
- Do heavy tasks run in appropriate pools (Hot/Warm/Cold) with correct priorities and backpressure?
- Are there CPU or memory "hotspots" that should be offloaded to specialized nodes or separated services?
- Are race conditions and deadlocks properly prevented?

### Cost Awareness and Optimization
- Does F align with cost budgets and rate limits defined in resource-policies.yaml (e.g., avoiding unnecessary external API calls, batching where possible)?
- Does this file introduce any new recurring costs (cloud services, API usage) without updating the cost governance rules or documentation?
- Are there opportunities for cost optimization without sacrificing functionality?
- Is resource usage properly monitored and attributed?

### ORS-Aware Behavior
- Does F adapt its behavior based on Operational Readiness Score (ORS), e.g., scaling down work or blocking new builds when ORS < 70?
- Does F correctly contribute to ORS by exposing accurate health probes, error budgets, and config hash alignment signals?
- Are ORS thresholds and responses properly configured?

## 5. Documentation, Registry, and Drift Management

### Documentation Alignment and Freshness
- Does F have corresponding documentation in docs/* or system prompts that accurately describe its current behavior, inputs, outputs, and failure modes?
- Are any examples, curl commands, or screenshots in the docs still valid (endpoints, ports, response shapes)?
- If behavior has changed, has CHECKPOINTPROTOCOL.md been followed to update docs, doc owners, and freshness metadata?
- Are API contracts and interfaces properly documented?

### Registry and Catalog Consistency
- Is F represented in heady-registry.json or relevant registries (components, workflows, AI nodes, docs, notebooks, patterns)?
- Are version numbers, endpoints, and statuses in the registry consistent with the actual file content and deployment environment?
- Are notebooks and examples referencing the correct APIs and schemas, and do they still execute cleanly in CI?
- Is the registry automatically updated when components change?

### Drift Detection and Remediation
- Does F participate in config hash alignment and drift detection protocols; if so, are the hash inputs complete and stable?
- Are there known mismatches between repo state, deployed state, and documentation that should trigger incidents or repairs?
- When drift is found, does F have an associated script or pipeline step to auto-fix or guide remediation (e.g., checkpoint-sync.ps1, heady-sync.ps1)?
- Are drift detection thresholds and alerts properly configured?

### Ownership and Review Processes
- Is F listed in DOCOWNERS.yaml or equivalent ownership mapping, with clear maintainers and review cadence?
- Are there overdue reviews or stale owners that should be reassigned?
- Are review processes automated and enforced?

## 6. Safety, Robustness, and AI Agent Orchestration

### Agent Coordination and Routing
- If F belongs to the Supervisor, hc-brain, hc-checkpoint, or other meta-controllers, does it coordinate agents (builders, researchers, claude-code, observers) according to the described patterns?
- Are task routing decisions deterministic and logged, with seeds and configs captured for replay?
- Are failure modes for each agent well-defined, with clear escalation and fallback logic?
- Are agent communication protocols secure and reliable?

### Multi-Agent Transparency and Observability
- Does F support the Multi-Agent Transparency Policy (e.g., proving distinct models via observable behavior where required)?
- Are logs and traces sufficient to show which agent did what and why, without leaking secrets?
- Are agent decisions and reasoning processes properly auditable?
- Is there proper separation of concerns between agents?

### Safety Constraints and Guardrails
- Are safety constraints (e.g., allowed action domains, forbidden operations, sensitive data access) correctly enforced in this file's logic or configs?
- Does F integrate with the Imagination Engine, concept index, and IP registry only within allowed boundaries (public-domain patterns, licensed IP, etc.)?
- Are there checks to prevent "nuclear options" (archive-rebuild) from being triggered too easily or without human confirmation when required?
- Are ethical guidelines and safety protocols properly implemented?

### Incident Handling and Recovery
- When this file's functionality fails, does it create structured incidents or tasks rather than silently degrade?
- Does it provide enough context (config hashes, ORS state, pipeline stage, agent logs) to reproduce and debug the issue?
- Are incident response procedures automated and tested?
- Are post-incident reviews and improvements implemented?

## 7. Tool Usage and Provider Optimization

### Tool Inventory and Coverage
- Have we enumerated all registered AI nodes and tools from the registry and services manual (nodes like PYTHIA, JULES, OBSERVER, BUILDER, ATLAS, Story Driver, MCP servers, etc.)?
- For each registered node/tool, is there a clear description of its purpose, primary triggers, and typical workloads in the docs or registry?
- Are there any tools that appear only in documentation but have no corresponding code, config, or endpoint wired in?
- Are tool capabilities properly documented and discoverable?

### Claude and External Model Integration
- Is the Claude integration (MCP, Claude Code agent, or API key) configured in environment variables and MCP config, not just documented as "available"?
- Do we have any pipeline stages, nodes, or workflows that explicitly route tasks to Claude, or is Claude only mentioned but never used in routing logic?
- Are there tests or sample flows that prove Claude is invoked end-to-end (e.g., by calling a specific endpoint or node and seeing Anthropic usage)?
- Is there an ORS-aware rule that decides when to use Claude vs other models, or is Claude effectively idle even when it would be optimal to call it?

### Trigger Coverage Analysis
- For each tool/node (including Claude, HuggingFaceTool, AutoDoc, GapScanner, SecurityAudit, MCP servers, etc.), where in HCFullPipeline stages (Ingest, Plan, Execute, Recover, Self-Critique, Optimize) does this tool get invoked, if at all?
- Which concrete triggers exist: API endpoints (/api/...), node-management APIs (/api/nodes/:id/activate), CLI scripts, IDE integrations (MCP, Admin IDE), or HeadyBuddy UI actions?
- Are there tools that have no triggers from any channel (web, IDE, mobile, MCP, scripts), making them effectively unreachable in practice?
- Do any tools rely on manual activation that you never actually run (e.g., scripts you never call, nodes never activated via /api/nodes)?

### Utilization vs Design Intent Assessment
- For each critical or high priority component (HCBrain, HCSupervisor, HCCheckpoint, HeadyLens, Story Driver, HeadyAcademy tools, etc.), do we have metrics or logs that show real-world usage frequency?
- Are some tools over-used (e.g., the default LLM) while more specialized or paid tools (like Claude, SecurityAudit, GapScanner, HuggingFaceTool) almost never run?
- Do HeadySims planning and self-critique stages actually consider "which tool/model to call" as part of their plan choices, or do they always pick the same default?
- Are there any "paid" or higher-quality tools that are never selected due to conservative cost or missing configuration, even when they would materially improve outcomes?

### Configuration Completeness and Drift
- For each external tool provider (Claude, Hugging Face, Render MCP, others), are required keys (e.g., ANTHROPIC_API_KEY, HEADYAPIKEY, RENDERAPIKEY) present in .env / secrets and referenced in code and docs consistently?
- Do we have environment-specific configs where the tool is wired in staging but not in production (or vice versa), causing unexpected non-usage?
- Does the registry or docs claim "Claude / [tool] is integrated", but health checks, logs, or /api/systemstatus show it as inactive or never called?

### Observability and Usage Metrics
- Do we have per-tool usage metrics (call counts, latency, error rate, cost) exposed via HeadyLens, system status, or Admin API?
- Can we answer, for each tool, "how many times was this used in the last day/week, and from which workflows"?
- Are there alerts or reports when a configured tool (like Claude) has zero usage over a time window, indicating misconfiguration or missing wiring?
- Does the checkpoint or readiness evaluation include "tool coverage" or "unused critical capability" as a factor in ORS or incident generation?

### Actionability and Gap Closure
- For each under-used tool, what minimal change would cause it to be exercised in a safe, low-risk way (e.g., enable as an alternate plan in Plan stage, or as a self-critique helper)?
- Do we have A/B or multi-arm experiments in HeadySims planning that compare default tools vs Claude or others so we can justify subscriptions by impact?
- Is there a clear owner (DOCOWNERS / registry) responsible for periodically reviewing tool usage and pruning or re-wiring under-used tools?

## 8. Wealth Redistribution and Social Impact Integration

### User and Stakeholder Impact Assessment
- Does F introduce features or behaviors that affect different user groups; if so, how could these be tuned to maximize global happiness or equitable access?
- Are there mechanisms to prioritize nonprofit or high-impact workloads when resources are constrained?
- Are pricing and resource allocation models aligned with social impact goals?
- Does the component support accessibility and inclusivity requirements?

### Metrics and Observability for Impact
- Does F emit metrics that can be used to measure social impact (e.g., hours saved for nonprofits, successful grants assisted, critical bugs prevented)?
- Are these metrics wired into dashboards, alerting, or reporting tools referenced elsewhere in the repo?
- Are impact metrics properly attributed and tracked over time?
- Are there automated reports on social impact contributions?

### Redistribution and Access Mechanisms
- Does F interact with pricing, rate limiting, or resource allocation; if so, are there clear hooks by which you can implement sliding scales, credits, or priority for underserved communities?
- Are any such parameters centralized (so you can adjust them globally) rather than hardcoded?
- Are there mechanisms for community feedback and contribution?
- Is wealth redistribution properly audited and transparent?

## 9. Concrete Per-File Audit Prompts

### Standard Audit Checklist
For each file F, the node must answer:

1. **Structural Validity**: Is the file syntactically valid and formatted per repo standards? (yes/no, explain)
2. **Purpose Clarity**: Is the file's purpose clear and non-overlapping with other files? (yes/no, explain)
3. **Dependency Integrity**: Are all internal dependencies and references valid and consistent? (yes/no, list any broken links)
4. **Security Compliance**: Does the file comply with security and governance policies (no secrets, proper access control)? (yes/no, explain)
5. **Pipeline Invariants**: Does the file respect HCFullPipeline invariants and stop rules (no unsafe builds under low ORS)? (yes/no, explain)
6. **Performance Appropriateness**: Are performance and resource-use patterns appropriate, with no obvious bottlenecks? (yes/no, highlight hot spots)
7. **Documentation Alignment**: Are documentation and registries fully aligned with this file's behavior and interfaces? (yes/no, list mismatches)
8. **Safety Implementation**: Are safety, transparency, and multi-agent orchestration rules correctly implemented? (yes/no, list gaps)
9. **Social Impact Compatibility**: Does this file provide hooks or at least not block future changes toward wealth redistribution and social impact? (yes/no, explain)
10. **Tool Usage**: Does this file effectively utilize available tools (including Claude) or create unnecessary tool dependencies? (yes/no, explain)

### Priority Improvement Recommendations
If you had to change only 3 things in this file to make the system more robust and aligned, what would they be? (ranked list)

### Tool Usage Specific Questions
- Does this file reference any tools that are configured but never actually called?
- Are there opportunities to route specific tasks through Claude or other specialized tools?
- Is tool selection logic deterministic and observable?
- Are there missing tool integrations that would improve functionality?

## 10. Model Routing and Provider Optimization

### Global Model Routing Logic
- Where is the global "model routing" logic defined (e.g., which code or config decides when to use Claude vs HuggingFaceTool vs any default LLM)? Is this logic documented and testable?
- Does HCFullPipeline's Plan stage explicitly consider model choice as a decision variable (e.g., multiple candidate plans that differ only in which model is used)?
- Do we have any per-task or per-domain routing rules (e.g., Claude for code-heavy refactors, PYTHIA/HuggingFace for lightweight inference,.com models for low-stakes tasks), or is every request funneled through a single provider?
- Are cost, latency, and quality metrics for each model provider tracked and fed back into HeadySims plan selection so the system can "learn" to use your Claude subscription when it is actually better?
- Do we have feature flags or config toggles (by environment or tenant) that may be unintentionally disabling Claude or other paid providers in production?

### Channel-Level Tool Usage
- For each channel (HeadyBuddy widget, desktop overlay, Admin IDE, HTTP API, MCP/IDE integrations), which tools and nodes are actually reachable from that channel?
- Are there tools (including Claude flows) that are only reachable through a dev-only or admin-only surface (e.g., /api/adminassistant, specific MCP servers), meaning that your daily workflows never exercise them?
- Does HeadyBuddy expose UX hooks to invoke "higher-power" tools (Claude, advanced refactors, Story Driver) explicitly, or does it silently route everything through whatever is cheapest/fastest?
- Are the MCP servers wired in all IDEs where they are intended (PyCharm, Windsurf, VS Code, Claude desktop), or only documented but not actually configured on disk and tested?
- Can you trace a simple end-to-end scenario like "from Buddy widget message to Claude API call" and confirm each step (channel → pipeline → Supervisor → agent → provider) exists and is healthy?

## 11. Cross-Tool Composition and Synergies

### Tool Chaining and Workflows
- Do any workflows intentionally chain tools (e.g., Builder → Claude code review → JULES optimization → AutoDoc → Story Driver narrative) instead of calling a single model once?
- Are there common composite patterns (like "big refactor", "grant drafting", "regulatory analysis") encoded as reusable workflows that make explicit use of both generic LLMs and specialized tools?
- Does the Pattern Engine know about "tool combination patterns" and propose them when relevant, or does it only suggest individual actions?
- Are self-critique and optimization stages allowed to modify tool routing (e.g., "for this type of task, start with Claude instead of the default model") and record that change in configs/registry?

### Tool Usage Auditing Protocol
- For the last N days, list for each registered node/tool: usageCount, lastUsedAt, and top 3 workflows/channels using it. Are any critical tools at usageCount = 0?
- Is Claude (or any other paid provider) present in configs and secrets and visible in logs/metrics? If present in configs but absent in logs, raise a "configured but unused" warning.
- For each environment .com, cloud-sys, cloud-me, cloud-conn, hybrid), does the set of actually working tools match the set of configured tools in the registry?
- For tasks that are high-value (e.g., code rewrite, security audit, system design), what percentage used Claude vs other tools, and does this align with your intent and cost governance?

## 12. Cost Governance and ROI Tracking

### Paid Provider Management
- For each paid provider (Claude, cloud GPUs, premium APIs), do you track monthly spend and map it to concrete impact metrics (bugs fixed, hours saved, grants drafted, etc.)?
- Are there governance policies that automatically scale down or disable low-ROI tools, or at least surface "you pay for X but usage is effectively zero"?
- Do HeadySims planning and Self-Critique stages ever propose "route more of these tasks to Claude because quality/latency is better in this domain", or "route less to Claude because improvements are marginal"?
- Is there a documented "sunset or repurpose" path for tools that remain unused for a long period, including re-allocating saved budget toward social-impact workloads?

## 13. Incident Response and Tool-Specific Failures

### Tool Failure Detection
- Do health checks and readiness probes include checks that verify actual requests to each critical tool, not just TCP/HTTP connectivity (e.g., a synthetic Claude request at low frequency)?
- When a tool is misconfigured (e.g., Claude key missing, quota exhausted), does the system: raise a visible incident, temporarily route around it, and log that this is a degraded mode rather than silently behaving as if the tool never existed?
- Does checkpoint analysis consider "expected vs actual tool usage mix", e.g., noticing that Claude's share of tasks dropped from 30% to 0% after a refactor, and flag this as drift?

## Implementation Notes

This protocol should be implemented as:
1. **Automated Review Node**: An AI agent that systematically processes files using this checklist
2. **CI/CD Integration**: Automated checks that fail when critical questions are unanswered
3. **Manual Review Templates**: Structured review templates for human maintainers
4. **Dashboard Integration**: Visual representation of system health and tool usage
5. **Alerting System**: Automated alerts for critical failures or tool underutilization

The protocol should be versioned and updated as the Heady system evolves, with clear ownership and maintenance processes.
✅ SCANNED: 20260218-210803
