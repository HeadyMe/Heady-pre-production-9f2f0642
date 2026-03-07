/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ Heady Code Governance — Auth Gate ═══
 *
 * Enforces that ALL codebase modifications pass through Heady's
 * auth schema. No third-party gateway (Antigravity, Cursor, etc.)
 * may modify code unless explicitly approved by the owner.
 *
 * Integrates with:
 *   - configs/code-governance.yaml (approved devs & agents)
 *   - src/security/rbac-vendor.js (temporary execution tokens)
 *   - .husky/pre-commit (commit-time enforcement)
 *
 * Heady AI Nodes: CONDUCTOR, MAESTRO
 */

const fs = require("fs");
const path = require("path");
const yaml = require('../core/heady-yaml');
const crypto = require("crypto");
const logger = require("../utils/logger");

const GOVERNANCE_CONFIG = path.join(__dirname, "../../configs/code-governance.yaml");
const AUDIT_LOG = path.join(__dirname, "../../data/code-governance-audit.jsonl");

// Ensure audit log dir exists
const auditDir = path.dirname(AUDIT_LOG);
try { if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true }); } catch { }

// ──────────────────────────────────────────────────────────────────
// Load governance config
// ──────────────────────────────────────────────────────────────────
let _config = null;
let _configHash = null;

function loadConfig() {
    try {
        const raw = fs.readFileSync(GOVERNANCE_CONFIG, "utf8");
        const newHash = crypto.createHash("sha256").update(raw).digest("hex").substring(0, 12);
        if (newHash !== _configHash) {
            _config = yaml.load(raw);
            _configHash = newHash;
            logger.logSystem(`  ∞ CodeGovernance: Config loaded (hash: ${_configHash})`);
        }
    } catch (err) {
        logger.error(`  ✗ CodeGovernance: Failed to load config: ${err.message}`);
        // Fail closed — if config can't load, deny everything
        _config = { approved_developers: [], approved_agents: [], blocked_gateways: [], auth_gate: { block_unknown_emails: true } };
    }
    return _config;
}

// ──────────────────────────────────────────────────────────────────
// Audit logging
// ──────────────────────────────────────────────────────────────────
function audit(entry) {
    try {
        const line = JSON.stringify({
            ...entry,
            ts: new Date().toISOString(),
            configHash: _configHash,
        });
        fs.appendFileSync(AUDIT_LOG, line + "\n");
    } catch { }
}

// ──────────────────────────────────────────────────────────────────
// Authorization checks
// ──────────────────────────────────────────────────────────────────

/**
 * Check if a developer email is approved.
 * @param {string} email - Git committer email
 * @returns {{ approved: boolean, identity: object|null, reason: string }}
 */
function checkDeveloper(email) {
    const config = loadConfig();
    if (!email) return { approved: false, identity: null, reason: "No email provided" };

    const normalizedEmail = email.toLowerCase().trim();

    // Check approved developers
    for (const dev of config.approved_developers || []) {
        const gitEmails = (dev.git_emails || [dev.email]).map(e => e.toLowerCase());
        if (gitEmails.includes(normalizedEmail)) {
            audit({ action: "DEVELOPER_APPROVED", email: normalizedEmail, devId: dev.id, type: dev.type });
            return { approved: true, identity: dev, reason: `Approved developer: ${dev.id}` };
        }
    }

    audit({ action: "DEVELOPER_DENIED", email: normalizedEmail, reason: "Not in approved list" });
    return { approved: false, identity: null, reason: `Email '${normalizedEmail}' not in approved developers list` };
}

/**
 * Check if an agent/gateway is approved.
 * @param {string} agentId - Agent identifier (e.g., "antigravity", "heady-brain")
 * @returns {{ approved: boolean, identity: object|null, reason: string }}
 */
function checkAgent(agentId) {
    const config = loadConfig();
    if (!agentId) return { approved: false, identity: null, reason: "No agent ID provided" };

    const normalizedId = agentId.toLowerCase().trim();

    // Check blocked gateways FIRST (deny-first policy)
    for (const blocked of config.blocked_gateways || []) {
        if (blocked.id.toLowerCase() === normalizedId) {
            audit({
                action: "AGENT_BLOCKED",
                agentId: normalizedId,
                vendor: blocked.vendor,
                reason: blocked.reason,
            });
            return {
                approved: false,
                identity: blocked,
                reason: `BLOCKED: ${blocked.reason}. Owner must explicitly approve with: "approve ${blocked.id} as dev connection"`,
            };
        }
    }

    // Check approved agents
    for (const agent of config.approved_agents || []) {
        if (agent.id.toLowerCase() === normalizedId) {
            audit({ action: "AGENT_APPROVED", agentId: normalizedId, type: agent.type });
            return { approved: true, identity: agent, reason: `Approved agent: ${agent.id}` };
        }
    }

    // Unknown agent — blocked by default
    audit({ action: "AGENT_UNKNOWN_BLOCKED", agentId: normalizedId });
    return { approved: false, identity: null, reason: `Unknown agent '${normalizedId}' — not in approved list. Owner must approve.` };
}

/**
 * Check if a file path is in the protected paths list.
 * @param {string} filePath - Relative file path
 * @returns {boolean}
 */
function isProtectedPath(filePath) {
    const config = loadConfig();
    const protectedPaths = config.auth_gate?.protected_paths || [];

    for (const pattern of protectedPaths) {
        if (pattern.includes("*")) {
            // Glob match
            const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
            if (regex.test(filePath)) return true;
        } else {
            if (filePath === pattern) return true;
        }
    }
    return false;
}

/**
 * Full authorization gate for a code change request.
 * @param {object} opts
 * @param {string} opts.email - Git committer email
 * @param {string} [opts.agentId] - Agent identifier (if agent-initiated)
 * @param {string[]} [opts.files] - Files being changed
 * @param {string} [opts.devToken] - HEADY_DEV_TOKEN for agent auth
 * @returns {{ authorized: boolean, reason: string, protectedFiles: string[] }}
 */
function authorize(opts = {}) {
    const config = loadConfig();
    const result = { authorized: false, reason: "", protectedFiles: [] };

    // 1. If agent-initiated, check agent approval
    if (opts.agentId) {
        const agentCheck = checkAgent(opts.agentId);
        if (!agentCheck.approved) {
            result.reason = agentCheck.reason;
            audit({ action: "AUTH_GATE_DENIED", ...opts, step: "agent-check", reason: agentCheck.reason });
            return result;
        }

        // Agent also needs a valid dev token
        if (config.auth_gate?.require_dev_token && !opts.devToken) {
            result.reason = "Agent must provide HEADY_DEV_TOKEN for code changes";
            audit({ action: "AUTH_GATE_DENIED", ...opts, step: "dev-token-missing" });
            return result;
        }
    }

    // 2. Check developer email
    const devCheck = checkDeveloper(opts.email);
    if (!devCheck.approved && !opts.agentId) {
        result.reason = devCheck.reason;
        audit({ action: "AUTH_GATE_DENIED", ...opts, step: "developer-check", reason: devCheck.reason });
        return result;
    }

    // 3. Check protected files
    if (opts.files && opts.files.length > 0) {
        const protectedHits = opts.files.filter(f => isProtectedPath(f));
        if (protectedHits.length > 0) {
            const identity = devCheck.identity || {};
            // Only owners can modify protected files
            if (identity.type !== "owner") {
                result.protectedFiles = protectedHits;
                result.reason = `Protected files require owner-level approval: ${protectedHits.join(", ")}`;
                audit({ action: "AUTH_GATE_DENIED", ...opts, step: "protected-files", protectedFiles: protectedHits });
                return result;
            }
        }
    }

    // 4. Check max files per commit
    const maxFiles = config.auth_gate?.max_files_per_commit || 50;
    if (opts.files && opts.files.length > maxFiles) {
        result.reason = `Too many files changed (${opts.files.length} > ${maxFiles}). Requires manual review.`;
        audit({ action: "AUTH_GATE_DENIED", ...opts, step: "max-files", fileCount: opts.files.length });
        return result;
    }

    // All gates passed
    result.authorized = true;
    result.reason = opts.agentId
        ? `Agent '${opts.agentId}' authorized via Heady auth schema`
        : `Developer '${opts.email}' authorized`;

    audit({ action: "AUTH_GATE_APPROVED", ...opts });
    return result;
}

/**
 * Approve a third-party agent (moves from blocked to approved).
 * Only callable by owner.
 * @param {string} agentId - Agent to approve
 * @param {string} approverEmail - Must be owner
 * @param {string[]} permissions - Granted permissions
 */
function approveAgent(agentId, approverEmail, permissions = ["read", "write"]) {
    const config = loadConfig();

    // Verify approver is owner
    const approver = checkDeveloper(approverEmail);
    if (!approver.approved || approver.identity?.type !== "owner") {
        audit({ action: "APPROVE_AGENT_DENIED", agentId, approverEmail, reason: "Not an owner" });
        return { ok: false, reason: "Only owners can approve agents" };
    }

    // Remove from blocked list
    const blockedIdx = (config.blocked_gateways || []).findIndex(b => b.id.toLowerCase() === agentId.toLowerCase());
    const blockedEntry = blockedIdx >= 0 ? config.blocked_gateways.splice(blockedIdx, 1)[0] : null;

    // Add to approved agents
    const newAgent = {
        id: agentId.toLowerCase(),
        type: "approved-third-party",
        description: blockedEntry ? `${blockedEntry.vendor} — approved by owner` : `Third-party agent — approved by owner`,
        permissions,
        approved_by: approverEmail,
        approved_at: new Date().toISOString(),
    };

    config.approved_agents = config.approved_agents || [];
    config.approved_agents.push(newAgent);

    // Write back
    try {
        fs.writeFileSync(GOVERNANCE_CONFIG, yaml.dump(config, { lineWidth: 120, noRefs: true }));
        _configHash = null; // force reload
        audit({ action: "AGENT_APPROVED_BY_OWNER", agentId, approverEmail, permissions });
        return { ok: true, agent: newAgent };
    } catch (err) {
        return { ok: false, reason: `Failed to write config: ${err.message}` };
    }
}

/**
 * Revoke an agent's approval.
 * @param {string} agentId - Agent to revoke
 * @param {string} revokerEmail - Must be owner
 */
function revokeAgent(agentId, revokerEmail) {
    const config = loadConfig();

    const revoker = checkDeveloper(revokerEmail);
    if (!revoker.approved || revoker.identity?.type !== "owner") {
        return { ok: false, reason: "Only owners can revoke agents" };
    }

    const agentIdx = (config.approved_agents || []).findIndex(a => a.id.toLowerCase() === agentId.toLowerCase());
    if (agentIdx < 0) return { ok: false, reason: `Agent '${agentId}' not found in approved list` };

    const removed = config.approved_agents.splice(agentIdx, 1)[0];

    // Add back to blocked
    config.blocked_gateways = config.blocked_gateways || [];
    config.blocked_gateways.push({
        id: agentId.toLowerCase(),
        vendor: removed.description || "unknown",
        reason: `Revoked by ${revokerEmail} at ${new Date().toISOString()}`,
        can_be_approved: true,
        approval_method: "owner-explicit-command",
    });

    try {
        fs.writeFileSync(GOVERNANCE_CONFIG, yaml.dump(config, { lineWidth: 120, noRefs: true }));
        _configHash = null;
        audit({ action: "AGENT_REVOKED", agentId, revokerEmail });
        return { ok: true, revoked: removed };
    } catch (err) {
        return { ok: false, reason: `Failed to write config: ${err.message}` };
    }
}

// ──────────────────────────────────────────────────────────────────
// Patent Lock Zone Enforcement
// ──────────────────────────────────────────────────────────────────

/**
 * Check if a file is in a Patent Lock zone (RTP or new inventive step).
 * Patent Lock zones require owner-only access — even approved agents are blocked.
 * @param {string} filePath - Relative file path
 * @returns {{ locked: boolean, claim: object|null, reason: string }}
 */
function isPatentLocked(filePath) {
    const config = loadConfig();
    const patentLock = config.patent_lock;
    if (!patentLock) return { locked: false, claim: null, reason: "No patent_lock config" };

    // Check RTP-verified claims
    for (const claim of patentLock.rtp_verified || []) {
        for (const claimFile of claim.files || []) {
            if (filePath === claimFile || filePath.endsWith(claimFile)) {
                return {
                    locked: true,
                    claim,
                    reason: `PATENT LOCK: ${claim.id} "${claim.title}" — RTP verified ${claim.rtp_date}. Owner-only modification.`,
                };
            }
        }
    }

    // Check new inventive steps
    for (const step of patentLock.new_inventive_steps || []) {
        for (const stepFile of step.files || []) {
            if (filePath === stepFile || filePath.endsWith(stepFile)) {
                return {
                    locked: true,
                    claim: step,
                    reason: `PATENT LOCK: ${step.id} "${step.title}" — Filing ${step.filing_status}. Owner-only modification.`,
                };
            }
        }
    }

    return { locked: false, claim: null, reason: "Not in patent lock zone" };
}

/**
 * Generate a SHA-384 evidence snapshot of all patent-critical files.
 * Creates a hash manifest for RTP verification.
 * Can be called locally or from CI.
 * @returns {object} Evidence snapshot with per-file and composite hashes
 */
function generateEvidenceSnapshot() {
    const config = loadConfig();
    const patentLock = config.patent_lock;
    if (!patentLock) return { ok: false, reason: "No patent_lock config" };

    const projectRoot = path.join(__dirname, "../..");
    const allFiles = [];

    // Collect all patent-critical files
    for (const claim of [...(patentLock.rtp_verified || []), ...(patentLock.new_inventive_steps || [])]) {
        for (const f of claim.files || []) {
            if (!allFiles.includes(f)) allFiles.push(f);
        }
    }

    const hashes = {};
    const contents = [];

    for (const f of allFiles) {
        const fullPath = path.join(projectRoot, f);
        try {
            const data = fs.readFileSync(fullPath);
            hashes[f] = crypto.createHash("sha384").update(data).digest("hex");
            contents.push(data);
        } catch (err) {
            hashes[f] = `ERROR: ${err.message}`;
        }
    }

    // Composite hash of all patent files
    const compositeHash = crypto.createHash("sha384")
        .update(Buffer.concat(contents.filter(c => Buffer.isBuffer(c))))
        .digest("hex");

    const snapshot = {
        ok: true,
        timestamp: new Date().toISOString(),
        algorithm: "sha384",
        hashes,
        composite_hash: compositeHash,
        file_count: allFiles.length,
    };

    // Persist to evidence log
    const evidenceLog = path.join(projectRoot, patentLock.evidence_log || "data/patent-evidence.jsonl");
    try {
        const dir = path.dirname(evidenceLog);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(evidenceLog, JSON.stringify(snapshot) + "\n");
    } catch { }

    audit({ action: "PATENT_EVIDENCE_SNAPSHOT", composite: compositeHash, files: allFiles.length });
    return snapshot;
}

// ──────────────────────────────────────────────────────────────────
// Express routes for governance API
// ──────────────────────────────────────────────────────────────────
function registerRoutes(router) {
    // Check authorization
    router.post("/api/governance/authorize", (req, res) => {
        const result = authorize(req.body);
        res.json(result);
    });

    // Check developer
    router.get("/api/governance/check-dev", (req, res) => {
        const result = checkDeveloper(req.query.email);
        res.json(result);
    });

    // Check agent
    router.get("/api/governance/check-agent", (req, res) => {
        const result = checkAgent(req.query.agentId);
        res.json(result);
    });

    // Approve agent (owner only)
    router.post("/api/governance/approve-agent", (req, res) => {
        const { agentId, approverEmail, permissions } = req.body;
        const result = approveAgent(agentId, approverEmail, permissions);
        res.json(result);
    });

    // Revoke agent (owner only)
    router.post("/api/governance/revoke-agent", (req, res) => {
        const { agentId, revokerEmail } = req.body;
        const result = revokeAgent(agentId, revokerEmail);
        res.json(result);
    });

    // Patent lock check
    router.get("/api/governance/patent-check", (req, res) => {
        const result = isPatentLocked(req.query.file || "");
        res.json(result);
    });

    // Generate evidence snapshot
    router.post("/api/governance/evidence-snapshot", (req, res) => {
        const result = generateEvidenceSnapshot();
        res.json(result);
    });

    // List governance status
    router.get("/api/governance/status", (req, res) => {
        const config = loadConfig();
        res.json({
            ok: true,
            configHash: _configHash,
            approvedDevelopers: (config.approved_developers || []).map(d => ({ id: d.id, type: d.type })),
            approvedAgents: (config.approved_agents || []).map(a => ({ id: a.id, type: a.type })),
            blockedGateways: (config.blocked_gateways || []).map(b => ({ id: b.id, vendor: b.vendor })),
            enforcement: config.enforcement,
            protectedPaths: config.auth_gate?.protected_paths || [],
            patentLock: config.patent_lock ? {
                rtpClaims: (config.patent_lock.rtp_verified || []).length,
                newInventiveSteps: (config.patent_lock.new_inventive_steps || []).length,
                enforcement: config.patent_lock.enforcement,
            } : null,
        });
    });

    logger.logSystem("  ∞ CodeGovernance: Routes registered (authorize, check-dev, check-agent, approve, revoke, patent-check, evidence-snapshot, status)");
}

module.exports = {
    authorize,
    checkDeveloper,
    checkAgent,
    isProtectedPath,
    isPatentLocked,
    generateEvidenceSnapshot,
    approveAgent,
    revokeAgent,
    registerRoutes,
    loadConfig,
};

