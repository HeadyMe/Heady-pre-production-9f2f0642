/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/agents/headyjules-code-agent.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * HeadyJules Code Agent
 *
 * Integrates HeadyJules Code (HeadyNexus CLI) as a Supervisor agent in HCFullPipeline.
 * Registered with the Supervisor for code-generation, analysis, refactoring,
 * architecture, and debugging tasks.
 *
 * ROUTING: All AI traffic proxied through HeadyGateway (heady-hive-sdk).
 *
 * USAGE:
 *   - Supervisor routes code-related tasks to this agent.
 *   - Agent spawns `headyjules` CLI process with structured prompts.
 *   - Returns structured results for aggregation.
 *
 * REQUIREMENTS:
 *   - `headyjules` CLI installed and authenticated (HEADY_NEXUS_KEY in env)
 *   - Or fallback to HeadyNexus HTTP API via @heady/networking
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const AGENT_ID = "headyjules-code";
const AGENT_SKILLS = [
  "code-generation",
  "code-analysis",
  "refactoring",
  "architecture",
  "debugging",
  "concept-extraction",
  "documentation",
  "unit-testing",
  "integration-testing",
  "e2e-testing",
  "test-coverage",
  "api-design",
  "rest-endpoint",
  "graphql-schema",
  "websocket-handler",
  "database-schema",
  "migration-gen",
  "query-optimize",
  "orm-model",
  "auth-implement",
  "jwt-session",
  "rbac-policy",
  "oauth-flow",
  "error-handling",
  "logging-strategy",
  "monitoring-hook",
  "perf-profile",
  "memory-leak-detect",
  "concurrency-fix",
  "race-condition",
  "design-pattern",
  "solid-principle",
  "dependency-inject",
  "event-driven",
  "microservice-decompose",
  "monolith-refactor",
  "ci-config",
  "github-actions",
  "docker-compose",
  "env-config",
  "dependency-update",
  "security-patch",
  "code-review",
  "pr-summary",
  "type-safety",
  "schema-validate",
];

const PROJECT_ROOT = path.join(__dirname, "..", "..");
const DEFAULT_TIMEOUT_MS = 120000;

class ClaudeCodeAgent {
  constructor(options = {}) {
    this.id = AGENT_ID;
    this.skills = AGENT_SKILLS;
    this.projectRoot = options.projectRoot || PROJECT_ROOT;
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.claudeBin = options.claudeBin || "headyjules";
    this.model = options.model || "sonnet";
    this.history = [];
    this.totalTokens = 0;
    this.totalCost = 0;
  }

  describe() {
    return `HeadyJules Code Agent: AI-powered code generation, analysis, refactoring, architecture review, and debugging via HeadyJules CLI. Skills: ${this.skills.join(", ")}`;
  }

  /**
   * Handle a task routed by the Supervisor.
   *
   * @param {Object} input
   * @param {Object} input.request - The SupervisorRequest
   * @param {Object} input.metadata - Plan metadata
   * @returns {Object} Structured result
   */
  async handle(input) {
    const { request, metadata } = input;
    const taskType = request.taskType || request.type || "general";
    const startTime = Date.now();

    try {
      const prompt = this._buildPrompt(request, metadata);
      const result = await this._executeClaudeCode(prompt, request);

      const entry = {
        taskType,
        requestId: request.id,
        success: true,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
      this.history.push(entry);

      return {
        agentId: this.id,
        taskType,
        status: "completed",
        output: result.output,
        files: result.files || [],
        suggestions: result.suggestions || [],
        durationMs: entry.durationMs,
      };
    } catch (error) {
      const entry = {
        taskType,
        requestId: request.id,
        success: false,
        error: error.message,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
      this.history.push(entry);

      return {
        agentId: this.id,
        taskType,
        status: "failed",
        error: error.message,
        durationMs: entry.durationMs,
      };
    }
  }

  /**
   * Build a structured prompt for HeadyJules Code based on task type.
   * Utilizes the Universal Heady Prompt Architecture.
   */
  _buildPrompt(request, metadata) {
    const contextDetails = [
      `project: HeadyMonorepo (HCFullPipeline)`,
      `stage: ${metadata?.requestType || "unknown"}`,
      `run_id: ${request.runId || request.id || "N/A"}`,
      `target: ${request.target || "unspecified"}`
    ].join('\\n');

    const baseArchitecture = (roleAndGoal, steps, output, constraints) => {
      return [
        `<ROLE_AND_GOAL>\\n${roleAndGoal}\\n</ROLE_AND_GOAL>`,
        `<CONTEXT>\\n${contextDetails}\\n${request.description || request.prompt || ""}\\n</CONTEXT>`,
        `<STEPS>\\n${steps}\\n</STEPS>`,
        `<CONSTRAINTS>\\nNo unverified parallel threads.\\nEnsure all commits map to Master Architecture.\\nFollow HEADY_BRAND header convention.\\nUse CommonJS require.\\n${constraints}\\n</CONSTRAINTS>`,
        `<OUTPUT>\\nUse structured markdown/dynamic tables for visual output.\\n${output}\\n</OUTPUT>`,
        `<FEW_SHOT_EXAMPLES>\\n[See internal repository patterns for Heady Swarm node creation and HCFP routing standards]\\n</FEW_SHOT_EXAMPLES>`,
        `<RECAP>\\nConfirm understanding of strict telemetry, formatting, and specific task requirements before proceeding.\\n</RECAP>`
      ].join('\\n\\n');
    };

    switch (request.taskType) {
      case "code-generation":
        return baseArchitecture(
          "Master Coding Agent: Generate robust, enterprise-grade production software.",
          "1. Analyze requirements recursively.\\n2. Perform sequential code audits.\\n3. Generate implementation mapped to master architecture.",
          "Write production-quality code. Provide a markdown summary of added features.",
          "Only use allowed toolsets. Must be strictly typed."
        ) + `\\n\\nPrompt: ${request.prompt || ""}`;

      case "code-analysis":
        return baseArchitecture(
          "Master Code Auditor: Analyze quality, performance, and architecture.",
          "1. Scan required files sequentially.\\n2. Cross-reference patterns.\\n3. Identify severe vulnerabilities or complexity.",
          "Structured findings with severity, location, and recommendations.",
          "Focus on: " + (request.focus || "general quality, security, performance")
        ) + `\\n\\nPrompt: ${request.prompt || ""}`;

      case "refactoring":
        return baseArchitecture(
          "Master Refactoring Agent: Restructure existing code without modifying external behavior.",
          "1. Establish pre-refactor state.\\n2. Apply AST-aware modifications.\\n3. Validate internal logic correctness.",
          "Refactored code and an impact summary table.",
          "No functional changes unless explicitly requested. Preserve all existing tests. Goal: " + (request.goal || "improve clarity")
        ) + `\\n\\nPrompt: ${request.prompt || ""}`;

      default:
        return baseArchitecture(
          "Heady Swarm Node: Execute general AI operations.",
          "1. Parse the request.\\n2. Decompose necessary steps.\\n3. Execute optimally.",
          "Result of operations.",
          "None specific."
        ) + `\\n\\nTask: ${request.taskType || "general"}\\nPrompt: ${request.prompt || ""}`;
    }
  }

  /**
   * Execute HeadyJules Code CLI with the given prompt.
   * Falls back to SDK gateway if CLI is not available.
   */
  async _executeClaudeCode(prompt, request) {
    // Try CLI first
    if (await this._isClaudeCliAvailable()) {
      return this._runClaudeCli(prompt, request);
    }

    // Fallback: return structured acknowledgment
    return this._fallbackExecution(prompt, request);
  }

  /**
   * Check if `headyjules` CLI is available on PATH.
   */
  async _isClaudeCliAvailable() {
    return new Promise((resolve) => {
      const proc = spawn(this.claudeBin, ["--version"], {
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 5000,
        shell: true,
      });
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }

  /**
   * Run HeadyJules CLI in non-interactive mode with a prompt.
   */
  _runClaudeCli(prompt, request) {
    return new Promise((resolve, reject) => {
      const args = [
        "--print",           // Non-interactive, print output
        "--model", this.model,
        "--output-format", "json",
      ];

      // Add allowlisted tools if task needs file operations
      if (request.taskType === "code-generation" || request.taskType === "refactoring") {
        args.push("--allowedTools", "Edit,Write,Read");
      }

      const proc = spawn(this.claudeBin, args, {
        cwd: this.projectRoot,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
        shell: true,
      });

      let stdout = "";
      let stderr = "";

      const timeout = setTimeout(() => {
        proc.kill("SIGTERM");
        reject(new Error(`HeadyJules Code timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      proc.stdout.on("data", (data) => { stdout += data.toString(); });
      proc.stderr.on("data", (data) => { stderr += data.toString(); });

      // Send prompt via stdin
      proc.stdin.write(prompt);
      proc.stdin.end();

      proc.on("close", (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`HeadyJules Code exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const parsed = JSON.parse(stdout);
          resolve({
            output: parsed.result || parsed.content || stdout,
            files: parsed.files_modified || [],
            suggestions: parsed.suggestions || [],
            tokensUsed: parsed.usage?.total_tokens || 0,
            cost: parsed.cost || 0,
          });
        } catch {
          // If not JSON, return raw output
          resolve({
            output: stdout.trim(),
            files: [],
            suggestions: [],
          });
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start HeadyJules Code: ${err.message}`));
      });
    });
  }

  /**
   * Fallback when CLI is not available — route through SDK gateway for real AI response.
   */
  _fallbackExecution(prompt, request) {
    return (async () => {
      try {
        const path = require("path");
        const HeadyGateway = require(path.join(__dirname, "..", "..", "heady-hive-sdk", "lib", "gateway"));
        const { createProviders } = require(path.join(__dirname, "..", "..", "heady-hive-sdk", "lib", "providers"));
        const gateway = new HeadyGateway({ cacheTTL: 300000 });
        const providers = createProviders(process.env);
        for (const p of providers) gateway.registerProvider(p);

        const result = await gateway.chat(prompt, {
          system: `You are a senior software engineer working on the Heady ecosystem. Task type: ${request.taskType || "general"}.`,
        });
        if (result.ok) {
          return {
            output: result.response,
            files: [],
            suggestions: [],
            fallback: false,
            engine: result.engine,
          };
        }
      } catch { /* gateway unavailable */ }

      // Absolute fallback
      return {
        output: [
          `[HeadyJules Code Agent — Gateway Fallback]`,
          `Task Type: ${request.taskType || "general"}`,
          `Target: ${request.target || "N/A"}`,
          `Description: ${request.description || request.prompt || "N/A"}`,
        ].join("\n"),
        files: [],
        suggestions: [],
        fallback: true,
      };
    })();
  }

  /**
   * Get agent status for monitoring.
   */
  getStatus() {
    return {
      id: this.id,
      skills: this.skills,
      model: this.model,
      history: this.history.slice(-10),
      totalInvocations: this.history.length,
      successRate: this.history.length > 0
        ? this.history.filter((h) => h.success).length / this.history.length
        : 1,
    };
  }
}

module.exports = { ClaudeCodeAgent, AGENT_ID, AGENT_SKILLS };
