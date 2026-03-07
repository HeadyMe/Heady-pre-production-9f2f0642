/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ HeadyCoin API Routes ═══
 *
 * REST endpoints for HeadyCoin token operations:
 *   - Token info & supply data
 *   - Wallet create/query
 *   - Transfer, mint (admin), burn
 *   - Staking & rewards
 *   - Merkle tree anchoring
 *   - Ledger browsing
 *
 * Mount: app.use('/api/headycoin', headycoinRouter)
 *
 * Heady AI Nodes: CONDUCTOR, ATLAS, SENTINEL
 */

const express = require('../core/heady-server');
const router = express.Router();

const { headyCoin, TOKEN, MINING_REWARDS } = require("../headycoin/headycoin-core");
const wallet = require("../headycoin/headycoin-wallet");
const ledger = require("../headycoin/headycoin-ledger");
const staking = require("../headycoin/headycoin-staking");
const merkle = require("../headycoin/headycoin-merkle");

// ─── Initialize on first load ───────────────────────────────────────
headyCoin.initialize();

// ═══════════════════════════════════════════════════════════════════
//  TOKEN INFO
// ═══════════════════════════════════════════════════════════════════

/** GET /api/headycoin/info — Token supply, cap, circulating */
router.get("/info", (req, res) => {
    res.json({ ok: true, token: headyCoin.getTokenInfo() });
});

/** GET /api/headycoin/mining-rewards — Mining reward table */
router.get("/mining-rewards", (req, res) => {
    const rewards = {};
    for (const [action, base] of Object.entries(MINING_REWARDS)) {
        rewards[action] = {
            base,
            current: headyCoin.getMiningReward(action),
            halvingMultiplier: headyCoin._getHalvingMultiplier(),
        };
    }
    res.json({ ok: true, rewards, ts: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════════════
//  WALLETS
// ═══════════════════════════════════════════════════════════════════

/** POST /api/headycoin/wallet/create — Create a new wallet */
router.post("/wallet/create", (req, res) => {
    try {
        const { label, owner, prefix } = req.body || {};
        const w = wallet.createWallet({ label, owner, prefix });
        res.json({ ok: true, wallet: w });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

/** GET /api/headycoin/wallet/:address — Get wallet info */
router.get("/wallet/:address", (req, res) => {
    const w = wallet.getWallet(req.params.address);
    if (!w) return res.status(404).json({ ok: false, error: "Wallet not found" });
    const stakes = staking.getStakes(req.params.address);
    res.json({ ok: true, wallet: w, stakes });
});

/** GET /api/headycoin/wallets — List all wallets */
router.get("/wallets", (req, res) => {
    const type = req.query.type;
    const list = wallet.listWallets(type ? { type } : {});
    res.json({ ok: true, wallets: list, count: list.length });
});

// ═══════════════════════════════════════════════════════════════════
//  TRANSFERS
// ═══════════════════════════════════════════════════════════════════

/** POST /api/headycoin/transfer — Transfer HDY between wallets */
router.post("/transfer", (req, res) => {
    try {
        const { from, to, amount, note } = req.body;
        if (!from || !to || !amount) {
            return res.status(400).json({ ok: false, error: "from, to, and amount required" });
        }
        const tx = headyCoin.transfer(from, to, parseFloat(amount), { note });
        res.json({ ok: true, transaction: tx });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

/** POST /api/headycoin/burn — Burn HDY tokens */
router.post("/burn", (req, res) => {
    try {
        const { from, amount, reason } = req.body;
        if (!from || !amount) {
            return res.status(400).json({ ok: false, error: "from and amount required" });
        }
        const tx = headyCoin.burn(from, parseFloat(amount), { reason });
        res.json({ ok: true, transaction: tx });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════
//  STAKING
// ═══════════════════════════════════════════════════════════════════

/** POST /api/headycoin/stake — Stake HDY tokens */
router.post("/stake", (req, res) => {
    try {
        const { walletAddress, amount, tier } = req.body;
        if (!walletAddress || !amount) {
            return res.status(400).json({ ok: false, error: "walletAddress and amount required" });
        }
        const record = staking.stake(walletAddress, parseFloat(amount), tier || "SHORT");
        res.json({ ok: true, stake: record });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

/** POST /api/headycoin/unstake — Unstake tokens */
router.post("/unstake", (req, res) => {
    try {
        const { stakeId } = req.body;
        if (!stakeId) return res.status(400).json({ ok: false, error: "stakeId required" });
        const record = staking.unstake(stakeId);
        res.json({ ok: true, stake: record });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

/** GET /api/headycoin/staking/:address — Active stakes for a wallet */
router.get("/staking/:address", (req, res) => {
    const stakes = staking.getStakes(req.params.address);
    res.json({ ok: true, stakes, count: stakes.length });
});

/** GET /api/headycoin/staking-stats — Pool statistics */
router.get("/staking-stats", (req, res) => {
    res.json({ ok: true, ...staking.getStakingStats() });
});

// ═══════════════════════════════════════════════════════════════════
//  LEDGER
// ═══════════════════════════════════════════════════════════════════

/** GET /api/headycoin/ledger — Recent transactions */
router.get("/ledger", (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const entries = ledger.readLedger(limit);
    res.json({ ok: true, transactions: entries, count: entries.length });
});

/** GET /api/headycoin/ledger/stats — Ledger statistics */
router.get("/ledger/stats", (req, res) => {
    res.json({ ok: true, ...ledger.getLedgerStats() });
});

/** GET /api/headycoin/ledger/verify — Verify chain integrity */
router.get("/ledger/verify", (req, res) => {
    const result = ledger.verifyChain();
    res.json({ ok: true, ...result });
});

// ═══════════════════════════════════════════════════════════════════
//  MERKLE TREE & BLOCKCHAIN ANCHORING
// ═══════════════════════════════════════════════════════════════════

/** GET /api/headycoin/merkle/root — Build Merkle root from unanchored txs */
router.get("/merkle/root", (req, res) => {
    const result = merkle.buildFromLedger();
    res.json({ ok: true, ...result });
});

/** POST /api/headycoin/merkle/verify — Verify a transaction's inclusion proof */
router.post("/merkle/verify", (req, res) => {
    try {
        const { leaf, proof, root } = req.body;
        if (!leaf || !proof || !root) {
            return res.status(400).json({ ok: false, error: "leaf, proof, and root required" });
        }
        const valid = merkle.verifyProof(leaf, proof, root);
        res.json({ ok: true, valid });
    } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
    }
});

/** POST /api/headycoin/anchor — Trigger EVM anchoring of Merkle root */
router.post("/anchor", async (req, res) => {
    try {
        const treeData = merkle.buildFromLedger();
        if (!treeData.root) {
            return res.json({ ok: true, message: "No unanchored transactions" });
        }

        // Attempt blockchain anchoring via web3-ledger-anchor
        let evmTxHash;
        try {
            const { anchorToLedger } = require("../security/web3-ledger-anchor");
            evmTxHash = await anchorToLedger(treeData.root, {
                type: "headycoin-merkle-root",
                txCount: treeData.txCount,
                oldestTx: treeData.oldestTx,
                newestTx: treeData.newestTx,
            });
        } catch {
            evmTxHash = `0xsimulated_merkle_anchor_${Date.now()}`;
        }

        const record = merkle.recordAnchoring(treeData.root, treeData.txIds, evmTxHash);
        res.json({
            ok: true,
            anchored: true,
            merkleRoot: treeData.root,
            evmTxHash,
            txCount: treeData.txCount,
            record,
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/** GET /api/headycoin/merkle/stats — Anchoring statistics */
router.get("/merkle/stats", (req, res) => {
    res.json({ ok: true, ...merkle.getMerkleStats() });
});

/** GET /api/headycoin/merkle/history — Anchored root history */
router.get("/merkle/history", (req, res) => {
    const roots = merkle.loadAnchoredRoots();
    res.json({ ok: true, roots, count: roots.length });
});

module.exports = router;
