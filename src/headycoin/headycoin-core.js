/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ HeadyCoin Core Token Engine ═══
 *
 * HDY — The utility token of the Heady AI ecosystem.
 *
 * Symbol:   HDY
 * Decimals: 8 (smallest unit: 1 heady = 0.00000001 HDY)
 * Max Supply: 21,000,000 HDY
 *
 * Mining:   Proof-of-Inference — tokens minted for verified AI actions
 * Utility:  Swarm computation credits, tier upgrades, creative IP licensing
 * Anchoring: Merkle root batched to EVM via web3-ledger-anchor.js
 *
 * Heady AI Nodes: CONDUCTOR, ATLAS
 */

const EventEmitter = require("events");
const wallet = require("./headycoin-wallet");
const ledger = require("./headycoin-ledger");
const logger = require("../utils/logger");

// ─── TOKEN CONSTANTS ────────────────────────────────────────────────
const TOKEN = Object.freeze({
    name: "HeadyCoin",
    symbol: "HDY",
    decimals: 8,
    maxSupply: 21_000_000,            // 21M cap
    genesisAllocation: 2_100_000,     // 10% pre-mine to TREASURY
    miningRewardBase: 0.1,            // Base reward per Proof-of-Inference
    halvingInterval: 2_100_000,       // Halving every 2.1M minted tokens
    version: "1.0.0",
});

// ─── MINING REWARD TABLE ────────────────────────────────────────────
// Maps cognitive telemetry ACTION_TYPES to HDY reward multipliers
const MINING_REWARDS = Object.freeze({
    CHAT_COMPLETION: 0.01,
    BATTLE_VALIDATE: 0.50,
    BATTLE_ARENA: 1.00,
    BATTLE_EVALUATE: 0.25,
    CREATIVE_GENERATE: 0.10,
    CREATIVE_REMIX: 0.05,
    SIMS_SIMULATE: 0.50,
    MCP_CALL: 0.02,
    MODEL_GENERATION: 0.05,
    TRADE_THESIS: 0.75,
    ARCHITECTURE_UPDATE: 0.20,
    TASK_DECOMPOSITION: 0.03,
    PIPELINE_EXECUTION: 0.15,
});

class HeadyCoinEngine extends EventEmitter {
    constructor() {
        super();
        this.initialized = false;
        this.totalMinted = 0;
        this.totalBurned = 0;
    }

    /**
     * Initialize the HeadyCoin engine.
     * Creates system wallets and performs genesis mint if needed.
     */
    initialize() {
        if (this.initialized) return this.getTokenInfo();

        wallet.initSystemWallets();

        // Check if genesis has already occurred
        const treasury = wallet.getWallet(wallet.SYSTEM_WALLETS.TREASURY);
        const entries = ledger.readFullLedger();
        const hasGenesis = entries.some((e) => e.type === ledger.TX_TYPES.GENESIS);

        // Calculate total minted/burned from ledger
        for (const entry of entries) {
            if (entry.type === ledger.TX_TYPES.MINT || entry.type === ledger.TX_TYPES.GENESIS || entry.type === ledger.TX_TYPES.REWARD) {
                this.totalMinted += entry.amount || 0;
            }
            if (entry.type === ledger.TX_TYPES.BURN) {
                this.totalBurned += entry.amount || 0;
            }
        }

        // Genesis mint — one-time TREASURY allocation
        if (!hasGenesis) {
            logger.logSystem("🪙 [HeadyCoin] Performing genesis mint...");
            const amount = TOKEN.genesisAllocation;
            wallet.updateBalance(wallet.SYSTEM_WALLETS.TREASURY, amount);
            ledger.recordTransaction(
                ledger.TX_TYPES.GENESIS,
                "GENESIS",
                wallet.SYSTEM_WALLETS.TREASURY,
                amount,
                { note: "HeadyCoin genesis allocation — 10% of max supply to TREASURY" }
            );
            this.totalMinted = amount;
            logger.logSystem(`🪙 [HeadyCoin] Genesis complete. ${amount.toLocaleString()} HDY → TREASURY`);
        }

        this.initialized = true;
        this.emit("initialized", this.getTokenInfo());
        return this.getTokenInfo();
    }

    /**
     * Get current token information.
     * @returns {object}
     */
    getTokenInfo() {
        return {
            ...TOKEN,
            totalMinted: this.totalMinted,
            totalBurned: this.totalBurned,
            circulatingSupply: this.totalMinted - this.totalBurned,
            remainingMintable: TOKEN.maxSupply - this.totalMinted,
            halvingEra: Math.floor(this.totalMinted / TOKEN.halvingInterval),
            currentMiningMultiplier: this._getHalvingMultiplier(),
            initialized: this.initialized,
            ts: new Date().toISOString(),
        };
    }

    /**
     * Calculate current halving multiplier.
     * Reward halves every 2.1M tokens minted.
     * @returns {number}
     */
    _getHalvingMultiplier() {
        const era = Math.floor(this.totalMinted / TOKEN.halvingInterval);
        return Math.pow(0.5, era);
    }

    /**
     * Mint new HDY tokens. Respects supply cap.
     *
     * @param {string} toAddress - Destination wallet
     * @param {number} amount - HDY to mint
     * @param {object} metadata - Context (reason, actionType, etc.)
     * @returns {object} Transaction entry
     */
    mint(toAddress, amount, metadata = {}) {
        this._ensureInitialized();

        if (amount <= 0) throw new Error("Mint amount must be positive");
        if (this.totalMinted + amount > TOKEN.maxSupply) {
            const remaining = TOKEN.maxSupply - this.totalMinted;
            throw new Error(`Supply cap reached. Max mintable: ${remaining} HDY`);
        }
        if (!wallet.walletExists(toAddress)) {
            throw new Error(`Wallet not found: ${toAddress}`);
        }

        wallet.updateBalance(toAddress, amount);
        const tx = ledger.recordTransaction(
            ledger.TX_TYPES.MINT,
            "PROTOCOL",
            toAddress,
            amount,
            metadata
        );

        this.totalMinted += amount;
        this.emit("mint", { to: toAddress, amount, txId: tx.txId });
        return tx;
    }

    /**
     * Burn HDY tokens — permanently remove from circulation.
     *
     * @param {string} fromAddress - Source wallet
     * @param {number} amount - HDY to burn
     * @param {object} metadata
     * @returns {object} Transaction entry
     */
    burn(fromAddress, amount, metadata = {}) {
        this._ensureInitialized();

        if (amount <= 0) throw new Error("Burn amount must be positive");
        const balance = wallet.getBalance(fromAddress);
        if (balance < amount) {
            throw new Error(`Insufficient balance. Have: ${balance}, need: ${amount}`);
        }

        wallet.updateBalance(fromAddress, -amount);
        wallet.updateBalance(wallet.SYSTEM_WALLETS.BURN_ADDRESS, amount);
        const tx = ledger.recordTransaction(
            ledger.TX_TYPES.BURN,
            fromAddress,
            wallet.SYSTEM_WALLETS.BURN_ADDRESS,
            amount,
            metadata
        );

        this.totalBurned += amount;
        this.emit("burn", { from: fromAddress, amount, txId: tx.txId });
        return tx;
    }

    /**
     * Transfer HDY between wallets.
     *
     * @param {string} from - Source wallet address
     * @param {string} to - Destination wallet address
     * @param {number} amount - HDY to transfer
     * @param {object} metadata
     * @returns {object} Transaction entry
     */
    transfer(from, to, amount, metadata = {}) {
        this._ensureInitialized();

        if (amount <= 0) throw new Error("Transfer amount must be positive");
        if (from === to) throw new Error("Cannot transfer to self");
        if (!wallet.walletExists(from)) throw new Error(`Source wallet not found: ${from}`);
        if (!wallet.walletExists(to)) throw new Error(`Destination wallet not found: ${to}`);

        const balance = wallet.getBalance(from);
        if (balance < amount) {
            throw new Error(`Insufficient balance. Have: ${balance}, need: ${amount}`);
        }

        wallet.updateBalance(from, -amount);
        wallet.updateBalance(to, amount);
        const tx = ledger.recordTransaction(
            ledger.TX_TYPES.TRANSFER,
            from,
            to,
            amount,
            metadata
        );

        this.emit("transfer", { from, to, amount, txId: tx.txId });
        return tx;
    }

    /**
     * Mine HDY via Proof-of-Inference.
     * Called when cognitive-telemetry records a verified AI action.
     *
     * @param {string} toAddress - Miner's wallet
     * @param {string} actionType - One of ACTION_TYPES from cognitive-telemetry
     * @param {string} auditHash - SHA-256 hash from cognitive-telemetry
     * @returns {object|null} Transaction entry, or null if reward is 0
     */
    mineProofOfInference(toAddress, actionType, auditHash) {
        this._ensureInitialized();

        const baseReward = MINING_REWARDS[actionType] || 0.01;
        const halvingMultiplier = this._getHalvingMultiplier();
        const reward = parseFloat((baseReward * halvingMultiplier).toFixed(8));

        if (reward <= 0) return null;

        // Check supply cap
        if (this.totalMinted + reward > TOKEN.maxSupply) {
            return null; // Mining complete
        }

        try {
            return this.mint(toAddress, reward, {
                type: "proof-of-inference",
                actionType,
                auditHash,
                halvingEra: Math.floor(this.totalMinted / TOKEN.halvingInterval),
                halvingMultiplier,
            });
        } catch (err) {
            logger.error(`[HeadyCoin] Mining failed: ${err.message}`);
            return null;
        }
    }

    /**
     * Get the mining reward for a given action type at current halving era.
     * @param {string} actionType
     * @returns {number}
     */
    getMiningReward(actionType) {
        const base = MINING_REWARDS[actionType] || 0.01;
        return parseFloat((base * this._getHalvingMultiplier()).toFixed(8));
    }

    _ensureInitialized() {
        if (!this.initialized) {
            this.initialize();
        }
    }
}

// Singleton instance
const headyCoin = new HeadyCoinEngine();

module.exports = {
    headyCoin,
    HeadyCoinEngine,
    TOKEN,
    MINING_REWARDS,
};
