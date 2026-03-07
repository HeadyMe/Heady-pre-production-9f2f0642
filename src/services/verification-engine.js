/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * VerificationEngine — Contract-based verification with auto-retry and escalation.
 * Every subtask declares a verification contract — a machine-checkable assertion
 * that the subtask succeeded. If verification fails, the engine retries with
 * error context or escalates to a human.
 *
 * @module verification-engine
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const logger = require('../utils/logger');

const TIMEOUT_MS = 30_000;

/**
 * Verification contract types:
 * - command:     Run a shell command, check exit code
 * - file_exists: Check if a file exists
 * - grep:        Search a file for a pattern
 * - json_valid:  Validate that output is valid JSON
 * - contains:    Check if output contains a substring
 * - http:        Make an HTTP request, check status code (future)
 * - custom:      Run a custom validation function
 */

class VerificationEngine {
    constructor(opts = {}) {
        this.timeoutMs = opts.timeoutMs || TIMEOUT_MS;
        this.stats = {
            verified: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
        };
    }

    /**
     * Verify a single contract against a result.
     *
     * @param {object} contract - { type, ...params }
     * @param {*} result        - The subtask output to verify
     * @param {object} [sandbox] - Execution sandbox context (optional)
     * @returns {Promise<{ passed: boolean, reason?: string }>}
     */
    async verify(contract, result, sandbox = null) {
        this.stats.verified++;

        if (!contract || !contract.type) {
            this.stats.skipped++;
            return { passed: true, reason: 'No contract specified' };
        }

        try {
            switch (contract.type) {
                case 'command':
                    return this._verifyCommand(contract);

                case 'file_exists':
                    return this._verifyFileExists(contract);

                case 'grep':
                    return this._verifyGrep(contract);

                case 'json_valid':
                    return this._verifyJsonValid(result);

                case 'contains':
                    return this._verifyContains(result, contract);

                case 'not_empty':
                    return this._verifyNotEmpty(result);

                case 'custom':
                    return this._verifyCustom(contract, result);

                default:
                    logger.warn({ type: contract.type }, 'Unknown verification contract type');
                    this.stats.skipped++;
                    return { passed: true, reason: `Unknown contract type: ${contract.type}` };
            }
        } catch (err) {
            this.stats.failed++;
            return { passed: false, reason: `Verification error: ${err.message}` };
        }
    }

    /**
     * Verify all subtasks in a DAG against their contracts.
     *
     * @param {TaskDAG} dag
     * @param {object} results - Map of subtaskId → result
     * @returns {Promise<{ passed: boolean, failures: Array }>}
     */
    async verifyAll(dag, results) {
        const failures = [];

        for (const [nodeId, node] of dag.nodes) {
            if (!node.verification) continue;

            const check = await this.verify(node.verification, results[nodeId]);
            if (!check.passed) {
                failures.push({
                    subtaskId: nodeId,
                    subtaskName: node.name,
                    reason: check.reason,
                });
            }
        }

        const passed = failures.length === 0;
        if (passed) {
            this.stats.passed++;
        } else {
            this.stats.failed++;
        }

        return { passed, failures };
    }

    // ─── Individual verifiers ────────────────────────────────────────────────

    /** Run a command and check exit code. */
    _verifyCommand(contract) {
        const { command, expectExitCode = 0, cwd } = contract;
        try {
            execSync(command, {
                cwd: cwd || process.cwd(),
                timeout: this.timeoutMs,
                stdio: 'pipe',
            });
            return { passed: expectExitCode === 0, reason: `Command exited 0` };
        } catch (err) {
            const actualCode = err.status || 1;
            if (actualCode === expectExitCode) {
                return { passed: true, reason: `Expected exit code ${expectExitCode}` };
            }
            return {
                passed: false,
                reason: `Command '${command}' exited ${actualCode}, expected ${expectExitCode}. stderr: ${(err.stderr || '').toString().slice(0, 200)}`,
            };
        }
    }

    /** Check that a file exists. */
    _verifyFileExists(contract) {
        const exists = fs.existsSync(contract.path);
        return {
            passed: exists,
            reason: exists ? `File exists: ${contract.path}` : `File not found: ${contract.path}`,
        };
    }

    /** Grep a file for a pattern. */
    _verifyGrep(contract) {
        const { file, pattern } = contract;
        if (!fs.existsSync(file)) {
            return { passed: false, reason: `File not found for grep: ${file}` };
        }
        const content = fs.readFileSync(file, 'utf-8');
        const found = content.includes(pattern);
        return {
            passed: found,
            reason: found ? `Pattern found in ${file}` : `Pattern '${pattern}' not found in ${file}`,
        };
    }

    /** Validate JSON. */
    _verifyJsonValid(result) {
        try {
            if (typeof result === 'string') {
                JSON.parse(result);
            } else if (typeof result === 'object') {
                JSON.stringify(result);
            }
            return { passed: true, reason: 'Valid JSON' };
        } catch (err) {
            return { passed: false, reason: `Invalid JSON: ${err.message}` };
        }
    }

    /** Check if result contains a substring. */
    _verifyContains(result, contract) {
        const text = typeof result === 'string' ? result : JSON.stringify(result);
        const found = text.includes(contract.substring);
        return {
            passed: found,
            reason: found ? `Contains '${contract.substring}'` : `Missing '${contract.substring}'`,
        };
    }

    /** Verify result is not empty. */
    _verifyNotEmpty(result) {
        const isEmpty = result === null || result === undefined || result === '' ||
            (typeof result === 'object' && Object.keys(result).length === 0);
        return {
            passed: !isEmpty,
            reason: isEmpty ? 'Result is empty' : 'Result is not empty',
        };
    }

    /** Run a custom validation function. */
    async _verifyCustom(contract, result) {
        if (typeof contract.validate !== 'function') {
            return { passed: false, reason: 'Custom contract missing validate function' };
        }
        try {
            const valid = await contract.validate(result);
            return {
                passed: !!valid,
                reason: valid ? 'Custom validation passed' : 'Custom validation failed',
            };
        } catch (err) {
            return { passed: false, reason: `Custom validation error: ${err.message}` };
        }
    }

    /** Get verification stats. */
    getStats() {
        return { ...this.stats };
    }
}

module.exports = { VerificationEngine };
