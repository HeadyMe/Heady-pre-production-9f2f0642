/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ HeadyCoin Immutable Transaction Ledger ═══
 *
 * Append-only JSONL ledger with SHA-256 hash chaining.
 * Every transaction links to the previous via prevHash,
 * forming a tamper-evident blockchain-style chain.
 *
 * Heady AI Node: SENTINEL
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const LEDGER_FILE = path.join(DATA_DIR, "headycoin-ledger.jsonl");
const GENESIS_HASH = "0".repeat(64);

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/**
 * Transaction types in the HeadyCoin system.
 */
const TX_TYPES = Object.freeze({
    MINT: "MINT",
    BURN: "BURN",
    TRANSFER: "TRANSFER",
    STAKE: "STAKE",
    UNSTAKE: "UNSTAKE",
    REWARD: "REWARD",
    GENESIS: "GENESIS",
});

/**
 * Generate SHA-256 hash for a transaction payload.
 * @param {object} payload
 * @returns {string} 64-char hex hash
 */
function hashTransaction(payload) {
    const canonical = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Get the hash of the last transaction in the ledger.
 * Returns GENESIS_HASH if ledger is empty.
 * @returns {string}
 */
function getLastHash() {
    try {
        if (!fs.existsSync(LEDGER_FILE)) return GENESIS_HASH;
        const content = fs.readFileSync(LEDGER_FILE, "utf8").trim();
        if (!content) return GENESIS_HASH;
        const lines = content.split("\n").filter(Boolean);
        if (lines.length === 0) return GENESIS_HASH;
        const last = JSON.parse(lines[lines.length - 1]);
        return last.hash || GENESIS_HASH;
    } catch {
        return GENESIS_HASH;
    }
}

/**
 * Record a transaction to the immutable ledger.
 *
 * @param {string} type - One of TX_TYPES
 * @param {string} from - Source wallet address
 * @param {string} to - Destination wallet address
 * @param {number} amount - Amount of HDY
 * @param {object} metadata - Additional context
 * @returns {object} The complete ledger entry with hash
 */
function recordTransaction(type, from, to, amount, metadata = {}) {
    const prevHash = getLastHash();
    const txId = `tx_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const payload = {
        txId,
        type,
        from,
        to,
        amount,
        timestamp: new Date().toISOString(),
        prevHash,
        metadata,
    };

    const hash = hashTransaction(payload);
    const entry = { ...payload, hash };

    // Append to ledger (fire and forget for hot path, sync for critical)
    try {
        fs.appendFileSync(LEDGER_FILE, JSON.stringify(entry) + "\n");
    } catch (err) {
        // Fallback async
        fs.appendFile(LEDGER_FILE, JSON.stringify(entry) + "\n", () => { });
    }

    return entry;
}

/**
 * Read recent ledger entries.
 * @param {number} limit - Max entries to return (default 50)
 * @returns {object[]} Array of ledger entries, newest first
 */
function readLedger(limit = 50) {
    try {
        if (!fs.existsSync(LEDGER_FILE)) return [];
        const lines = fs.readFileSync(LEDGER_FILE, "utf8").trim().split("\n").filter(Boolean);
        return lines
            .slice(-limit)
            .reverse()
            .map((line) => {
                try { return JSON.parse(line); } catch { return null; }
            })
            .filter(Boolean);
    } catch {
        return [];
    }
}

/**
 * Read ALL ledger entries in order (for chain verification).
 * @returns {object[]}
 */
function readFullLedger() {
    try {
        if (!fs.existsSync(LEDGER_FILE)) return [];
        const lines = fs.readFileSync(LEDGER_FILE, "utf8").trim().split("\n").filter(Boolean);
        return lines.map((line) => {
            try { return JSON.parse(line); } catch { return null; }
        }).filter(Boolean);
    } catch {
        return [];
    }
}

/**
 * Verify chain integrity — ensure every transaction's prevHash
 * matches the hash of the prior entry.
 *
 * @returns {{ valid: boolean, entries: number, errors: string[] }}
 */
function verifyChain() {
    const entries = readFullLedger();
    const errors = [];

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        // Verify prevHash linkage
        if (i === 0) {
            if (entry.prevHash !== GENESIS_HASH) {
                errors.push(`Entry 0 (${entry.txId}): prevHash should be genesis hash`);
            }
        } else {
            const prev = entries[i - 1];
            if (entry.prevHash !== prev.hash) {
                errors.push(`Entry ${i} (${entry.txId}): prevHash mismatch. Expected ${prev.hash}, got ${entry.prevHash}`);
            }
        }

        // Verify hash integrity
        const { hash, ...payload } = entry;
        const computed = hashTransaction(payload);
        if (computed !== hash) {
            errors.push(`Entry ${i} (${entry.txId}): hash tampered. Expected ${computed}, got ${hash}`);
        }
    }

    return { valid: errors.length === 0, entries: entries.length, errors };
}

/**
 * Get ledger statistics.
 * @returns {object}
 */
function getLedgerStats() {
    const entries = readFullLedger();
    const byType = {};
    let totalVolume = 0;

    for (const e of entries) {
        byType[e.type] = (byType[e.type] || 0) + 1;
        if (e.type !== "GENESIS") totalVolume += e.amount || 0;
    }

    return {
        totalTransactions: entries.length,
        byType,
        totalVolume,
        chainIntegrity: verifyChain().valid,
        firstTx: entries[0]?.timestamp || null,
        lastTx: entries[entries.length - 1]?.timestamp || null,
    };
}

module.exports = {
    TX_TYPES,
    GENESIS_HASH,
    LEDGER_FILE,
    hashTransaction,
    getLastHash,
    recordTransaction,
    readLedger,
    readFullLedger,
    verifyChain,
    getLedgerStats,
};
