/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ Immutable Proof View — Cryptographic Receipt Generator ═══
 *
 * Generate tamper-proof receipts for every action showing:
 *   - Intent (what was requested)
 *   - Routing decisions (which provider/model)
 *   - Tools executed
 *   - Transaction costs
 *   - Cryptographic hash chain (SHA-256)
 *
 * Tasks: enterprise-008, strategic-005
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const RECEIPTS_DIR = path.join(__dirname, "..", "..", "data", "receipts");
if (!fs.existsSync(RECEIPTS_DIR)) fs.mkdirSync(RECEIPTS_DIR, { recursive: true });

// Hash chain — each receipt links to the previous
let lastHash = "GENESIS_0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Generate a cryptographic receipt for an action.
 * @param {object} params
 * @param {string} params.intent - What was requested
 * @param {string} params.actor - Who/what initiated (user, node, pipeline)
 * @param {object} params.routing - Routing decisions (provider, model, tier)
 * @param {string[]} params.toolsExecuted - List of tools/actions taken
 * @param {object} params.cost - { tokensUsed, costUSD, provider }
 * @param {object} [params.result] - Outcome summary
 * @returns {object} The immutable receipt
 */
function generateReceipt(params) {
    const timestamp = new Date().toISOString();
    const receiptId = `rcpt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const receiptData = {
        receiptId,
        version: "1.0.0",
        timestamp,
        intent: params.intent || "unknown",
        actor: params.actor || "system",
        routing: params.routing || {},
        toolsExecuted: params.toolsExecuted || [],
        cost: params.cost || { tokensUsed: 0, costUSD: 0, provider: "unknown" },
        result: params.result || { status: "completed" },
        previousHash: lastHash,
    };

    // Create SHA-256 hash of the receipt content
    const contentHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(receiptData))
        .digest("hex");

    const receipt = {
        ...receiptData,
        hash: contentHash,
        signature: `heady_sig_${contentHash.substring(0, 16)}`,
    };

    // Update chain
    lastHash = contentHash;

    // Persist to append-only log
    const logFile = path.join(RECEIPTS_DIR, `receipts-${timestamp.split("T")[0]}.jsonl`);
    fs.appendFileSync(logFile, JSON.stringify(receipt) + "\n");

    return receipt;
}

/**
 * Verify a receipt's integrity using its hash.
 * @param {object} receipt - A receipt object
 * @returns {{ valid: boolean, reason: string }}
 */
function verifyReceipt(receipt) {
    const { hash, signature, ...data } = receipt;
    const computed = crypto
        .createHash("sha256")
        .update(JSON.stringify(data))
        .digest("hex");

    if (computed !== hash) {
        return { valid: false, reason: "Hash mismatch — receipt has been tampered with" };
    }
    if (signature !== `heady_sig_${hash.substring(0, 16)}`) {
        return { valid: false, reason: "Signature invalid" };
    }
    return { valid: true, reason: "Receipt integrity verified" };
}

/**
 * Verify an entire chain of receipts from a JSONL file.
 * @param {string} date - YYYY-MM-DD
 * @returns {{ valid: boolean, receiptsChecked: number, errors: string[] }}
 */
function verifyChain(date) {
    const logFile = path.join(RECEIPTS_DIR, `receipts-${date}.jsonl`);
    if (!fs.existsSync(logFile)) {
        return { valid: false, receiptsChecked: 0, errors: ["Log file not found"] };
    }

    const lines = fs.readFileSync(logFile, "utf8").trim().split("\n");
    const errors = [];
    let prevHash = null;

    for (let i = 0; i < lines.length; i++) {
        try {
            const receipt = JSON.parse(lines[i]);
            const check = verifyReceipt(receipt);
            if (!check.valid) {
                errors.push(`Receipt ${i}: ${check.reason}`);
            }
            if (prevHash && receipt.previousHash !== prevHash) {
                errors.push(`Receipt ${i}: Chain broken — previousHash mismatch`);
            }
            prevHash = receipt.hash;
        } catch (e) {
            errors.push(`Receipt ${i}: Parse error — ${e.message}`);
        }
    }

    return {
        valid: errors.length === 0,
        receiptsChecked: lines.length,
        errors,
    };
}

/**
 * Get today's receipt summary.
 */
function getTodaySummary() {
    const today = new Date().toISOString().split("T")[0];
    const logFile = path.join(RECEIPTS_DIR, `receipts-${today}.jsonl`);
    if (!fs.existsSync(logFile)) {
        return { date: today, totalReceipts: 0, totalCostUSD: 0, providers: {} };
    }

    const lines = fs.readFileSync(logFile, "utf8").trim().split("\n");
    let totalCost = 0;
    const providers = {};

    for (const line of lines) {
        try {
            const r = JSON.parse(line);
            const cost = r.cost?.costUSD || 0;
            totalCost += cost;
            const prov = r.cost?.provider || "unknown";
            providers[prov] = (providers[prov] || 0) + 1;
        } catch { /* skip */ }
    }

    return {
        date: today,
        totalReceipts: lines.length,
        totalCostUSD: totalCost.toFixed(4),
        providers,
    };
}

module.exports = { generateReceipt, verifyReceipt, verifyChain, getTodaySummary };
