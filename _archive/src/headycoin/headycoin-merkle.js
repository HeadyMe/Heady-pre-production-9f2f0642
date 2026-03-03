/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ HeadyCoin Merkle Tree ═══
 *
 * Aggregates transaction hashes into a Merkle tree for
 * batch anchoring to EVM blockchain via web3-ledger-anchor.js.
 *
 * Provides:
 *   - Merkle root computation from transaction hashes
 *   - Inclusion proof generation for individual transactions
 *   - Proof verification
 *   - Batch anchoring trigger
 *
 * Heady AI Node: SENTINEL
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const ledger = require("./headycoin-ledger");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const MERKLE_FILE = path.join(DATA_DIR, "headycoin-merkle-roots.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/**
 * Hash two nodes together (Merkle internal node).
 * @param {string} left
 * @param {string} right
 * @returns {string}
 */
function hashPair(left, right) {
    // Sort to ensure deterministic ordering
    const combined = left < right ? left + right : right + left;
    return crypto.createHash("sha256").update(combined).digest("hex");
}

/**
 * Build a Merkle tree from an array of leaf hashes.
 *
 * @param {string[]} leaves - Array of hex hash strings
 * @returns {{ root: string, layers: string[][], leaves: string[] }}
 */
function buildTree(leaves) {
    if (!leaves || leaves.length === 0) {
        return { root: "0".repeat(64), layers: [[]], leaves: [] };
    }

    // Duplicate last leaf if odd count (standard Merkle padding)
    let currentLayer = [...leaves];
    const layers = [currentLayer.slice()];

    while (currentLayer.length > 1) {
        const nextLayer = [];
        for (let i = 0; i < currentLayer.length; i += 2) {
            const left = currentLayer[i];
            const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left;
            nextLayer.push(hashPair(left, right));
        }
        layers.push(nextLayer.slice());
        currentLayer = nextLayer;
    }

    return {
        root: currentLayer[0],
        layers,
        leaves,
    };
}

/**
 * Generate an inclusion proof for a leaf at a given index.
 *
 * @param {string[][]} layers - Merkle tree layers
 * @param {number} leafIndex - Index of the leaf to prove
 * @returns {object[]} Array of { hash, direction } pairs
 */
function generateProof(layers, leafIndex) {
    const proof = [];
    let idx = leafIndex;

    for (let i = 0; i < layers.length - 1; i++) {
        const layer = layers[i];
        const isRight = idx % 2 === 1;
        const siblingIdx = isRight ? idx - 1 : idx + 1;

        if (siblingIdx < layer.length) {
            proof.push({
                hash: layer[siblingIdx],
                direction: isRight ? "left" : "right",
            });
        } else {
            // Odd node, paired with itself
            proof.push({
                hash: layer[idx],
                direction: isRight ? "left" : "right",
            });
        }

        idx = Math.floor(idx / 2);
    }

    return proof;
}

/**
 * Verify an inclusion proof.
 *
 * @param {string} leaf - The leaf hash to verify
 * @param {object[]} proof - Array of { hash, direction } pairs
 * @param {string} root - Expected Merkle root
 * @returns {boolean}
 */
function verifyProof(leaf, proof, root) {
    let computed = leaf;

    for (const step of proof) {
        if (step.direction === "left") {
            computed = hashPair(step.hash, computed);
        } else {
            computed = hashPair(computed, step.hash);
        }
    }

    return computed === root;
}

/**
 * Build Merkle tree from recent unanchored ledger transactions.
 *
 * @param {number} maxLeaves - Max transactions to include (default: 256)
 * @returns {object} Tree with root, proof-ready layers, and tx metadata
 */
function buildFromLedger(maxLeaves = 256) {
    const entries = ledger.readFullLedger();
    const anchored = loadAnchoredRoots();
    const anchoredTxIds = new Set();

    for (const root of anchored) {
        for (const txId of root.txIds || []) {
            anchoredTxIds.add(txId);
        }
    }

    // Filter to unanchored transactions
    const unanchored = entries.filter((e) => !anchoredTxIds.has(e.txId));
    const batch = unanchored.slice(0, maxLeaves);

    if (batch.length === 0) {
        return { root: null, tree: null, txCount: 0, message: "No unanchored transactions" };
    }

    const leaves = batch.map((e) => e.hash);
    const tree = buildTree(leaves);

    return {
        root: tree.root,
        tree,
        txCount: batch.length,
        txIds: batch.map((e) => e.txId),
        oldestTx: batch[0].timestamp,
        newestTx: batch[batch.length - 1].timestamp,
    };
}

/**
 * Load anchored Merkle roots.
 * @returns {object[]}
 */
function loadAnchoredRoots() {
    try {
        if (!fs.existsSync(MERKLE_FILE)) return [];
        return JSON.parse(fs.readFileSync(MERKLE_FILE, "utf8"));
    } catch {
        return [];
    }
}

/**
 * Record a Merkle root anchoring event.
 *
 * @param {string} merkleRoot
 * @param {string[]} txIds - Transaction IDs included
 * @param {string} evmTxHash - Blockchain transaction hash
 * @returns {object} Anchoring record
 */
function recordAnchoring(merkleRoot, txIds, evmTxHash) {
    const roots = loadAnchoredRoots();
    const record = {
        merkleRoot,
        txIds,
        txCount: txIds.length,
        evmTxHash,
        anchoredAt: new Date().toISOString(),
    };

    roots.push(record);
    fs.writeFileSync(MERKLE_FILE, JSON.stringify(roots, null, 2));
    return record;
}

/**
 * Get Merkle anchoring statistics.
 * @returns {object}
 */
function getMerkleStats() {
    const roots = loadAnchoredRoots();
    const totalAnchored = roots.reduce((sum, r) => sum + (r.txCount || 0), 0);

    return {
        totalRoots: roots.length,
        totalAnchoredTransactions: totalAnchored,
        latestRoot: roots.length > 0 ? roots[roots.length - 1] : null,
        ts: new Date().toISOString(),
    };
}

module.exports = {
    MERKLE_FILE,
    hashPair,
    buildTree,
    generateProof,
    verifyProof,
    buildFromLedger,
    recordAnchoring,
    loadAnchoredRoots,
    getMerkleStats,
};
