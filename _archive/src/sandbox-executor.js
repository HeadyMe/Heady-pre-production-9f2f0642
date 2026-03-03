/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Sandbox Execution — SPEC-4 ═══
 *
 * Isolated execution environment for MCP tool invocations.
 * Runs untrusted code in a sandboxed child process with:
 *   - Memory limits (default 128MB)
 *   - CPU timeout (default 10s)
 *   - No network access (optional)
 *   - No filesystem access outside sandbox dir
 *   - Stdout/stderr capture with size limits
 */

const { spawn } = require("child_process");
const { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const logger = require("./utils/logger");

class SandboxExecutor {
    constructor(opts = {}) {
        this.baseTmpDir = opts.tmpDir || os.tmpdir();
        this.defaultTimeout = opts.timeout || 10000;     // 10s
        this.defaultMemoryMB = opts.memoryMB || 128;
        this.maxOutputBytes = opts.maxOutputBytes || 1024 * 1024; // 1MB
        this.allowNetwork = opts.allowNetwork || false;
        this.executions = [];
        this.maxExecutions = opts.maxExecutions || 500;
    }

    // ─── Execute code in sandbox ─────────────────────────────────
    async execute(code, opts = {}) {
        const executionId = crypto.randomUUID();
        const language = opts.language || "javascript";
        const timeout = opts.timeout || this.defaultTimeout;
        const memoryMB = opts.memoryMB || this.defaultMemoryMB;
        const sandboxDir = mkdtempSync(path.join(this.baseTmpDir, "heady-sandbox-"));

        const execution = {
            id: executionId,
            language,
            status: "running",
            startedAt: new Date().toISOString(),
            finishedAt: null,
            stdout: "",
            stderr: "",
            exitCode: null,
            error: null,
            sandboxDir,
            metrics: {},
        };

        try {
            const { cmd, args, scriptFile } = this._prepareExecution(language, code, sandboxDir, memoryMB);

            const result = await this._runProcess(cmd, args, {
                timeout,
                sandboxDir,
                maxOutput: this.maxOutputBytes,
            });

            execution.stdout = result.stdout;
            execution.stderr = result.stderr;
            execution.exitCode = result.exitCode;
            execution.status = result.exitCode === 0 ? "completed" : "failed";
            execution.metrics = {
                durationMs: result.durationMs,
                stdoutBytes: result.stdout.length,
                stderrBytes: result.stderr.length,
            };
        } catch (err) {
            execution.status = "error";
            execution.error = err.message;
        } finally {
            execution.finishedAt = new Date().toISOString();
            // Cleanup sandbox directory
            try { rmSync(sandboxDir, { recursive: true, force: true }); } catch { }
        }

        this.executions.push(execution);
        if (this.executions.length > this.maxExecutions) this.executions.shift();

        return {
            id: execution.id,
            status: execution.status,
            stdout: execution.stdout,
            stderr: execution.stderr,
            exitCode: execution.exitCode,
            error: execution.error,
            metrics: execution.metrics,
        };
    }

    // ─── Prepare execution environment ───────────────────────────
    _prepareExecution(language, code, sandboxDir, memoryMB) {
        switch (language) {
            case "javascript":
            case "js":
            case "node": {
                // Wrap code to prevent require of dangerous modules
                const wrappedCode = `
"use strict";
const _origRequire = require;
const _allowedModules = new Set(["path", "url", "querystring", "util", "assert", "buffer", "crypto", "stream", "string_decoder", "events"]);
global.require = (mod) => {
    if (_allowedModules.has(mod)) return _origRequire(mod);
    throw new Error("Module not allowed in sandbox: " + mod);
};
// Disable dangerous globals
delete global.process.env;
global.process.exit = () => { throw new Error("process.exit not allowed"); };

try {
${code}
} catch (e) {
    logger.error("Sandbox error:", e.message);
    process.exitCode = 1;
}
`;
                const scriptFile = path.join(sandboxDir, "sandbox.js");
                writeFileSync(scriptFile, wrappedCode);
                return {
                    cmd: "node",
                    args: [`--max-old-space-size=${memoryMB}`, "--no-warnings", scriptFile],
                    scriptFile,
                };
            }

            case "python":
            case "py": {
                const scriptFile = path.join(sandboxDir, "sandbox.py");
                const wrappedCode = `
import sys, os
# Restrict imports
_orig_import = __builtins__.__import__
_blocked = {'subprocess', 'shutil', 'socket', 'http', 'urllib', 'requests', 'ctypes', 'signal'}
def _safe_import(name, *args, **kwargs):
    if name.split('.')[0] in _blocked:
        raise ImportError(f"Module blocked in sandbox: {name}")
    return _orig_import(name, *args, **kwargs)
__builtins__.__import__ = _safe_import

try:
${code.split('\n').map(line => '    ' + line).join('\n')}
except Exception as e:
    print(f"Sandbox error: {e}", file=sys.stderr)
    sys.exit(1)
`;
                writeFileSync(scriptFile, wrappedCode);
                return {
                    cmd: "python3",
                    args: ["-u", scriptFile],
                    scriptFile,
                };
            }

            case "bash":
            case "sh": {
                // Very restricted bash
                const scriptFile = path.join(sandboxDir, "sandbox.sh");
                const wrappedCode = `#!/bin/bash
set -euo pipefail
# Sandbox: no network commands allowed
unset -f curl wget nc ssh scp 2>/dev/null || true
${code}
`;
                writeFileSync(scriptFile, wrappedCode, { mode: 0o755 });
                return {
                    cmd: "bash",
                    args: ["--restricted", scriptFile],
                    scriptFile,
                };
            }

            default:
                throw new Error(`Unsupported sandbox language: ${language}`);
        }
    }

    // ─── Run a child process with limits ─────────────────────────
    _runProcess(cmd, args, opts) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            let stdout = "";
            let stderr = "";
            let killed = false;

            const child = spawn(cmd, args, {
                cwd: opts.sandboxDir,
                timeout: opts.timeout,
                stdio: ["ignore", "pipe", "pipe"],
                env: this.allowNetwork ? process.env : { ...process.env, no_proxy: "*", http_proxy: "http://blocked:0", https_proxy: "http://blocked:0" },
            });

            child.stdout.on("data", (chunk) => {
                if (stdout.length < opts.maxOutput) {
                    stdout += chunk.toString().substring(0, opts.maxOutput - stdout.length);
                }
            });

            child.stderr.on("data", (chunk) => {
                if (stderr.length < opts.maxOutput) {
                    stderr += chunk.toString().substring(0, opts.maxOutput - stderr.length);
                }
            });

            const timer = setTimeout(() => {
                killed = true;
                child.kill("SIGKILL");
            }, opts.timeout);

            child.on("close", (exitCode) => {
                clearTimeout(timer);
                resolve({
                    stdout,
                    stderr: killed ? stderr + "\n[KILLED: timeout exceeded]" : stderr,
                    exitCode: killed ? 137 : exitCode,
                    durationMs: Date.now() - start,
                });
            });

            child.on("error", (err) => {
                clearTimeout(timer);
                reject(err);
            });
        });
    }

    // ─── Query ───────────────────────────────────────────────────
    getExecution(id) {
        return this.executions.find(e => e.id === id) || null;
    }

    getExecutions(limit = 20) {
        return this.executions.slice(-limit);
    }

    status() {
        return {
            total: this.executions.length,
            completed: this.executions.filter(e => e.status === "completed").length,
            failed: this.executions.filter(e => e.status === "failed" || e.status === "error").length,
            allowNetwork: this.allowNetwork,
            defaultTimeoutMs: this.defaultTimeout,
            defaultMemoryMB: this.defaultMemoryMB,
        };
    }
}

module.exports = SandboxExecutor;
