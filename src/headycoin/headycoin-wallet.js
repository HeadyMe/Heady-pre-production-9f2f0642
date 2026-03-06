/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ HeadyCoin Wallet Manager ═══
 *
 * Creates and manages HDY wallets. Each wallet has a unique
 * address (hdy_ prefix), balance, and transaction history.
 *
 * System wallets:
 *   TREASURY     — Pre-mined allocation for ecosystem bootstrap
 *   STAKING_POOL — Holds staked tokens
 *   BURN_ADDRESS — Tokens sent here are permanently destroyed
 *
 * Heady AI Node: ATLAS
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const WALLETS_FILE = path.join(DATA_DIR, "headycoin-wallets.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ─── SYSTEM WALLET ADDRESSES ────────────────────────────────────────
const SYSTEM_WALLETS = Object.freeze({
    TREASURY: "hdy_treasury_0000000000000000",
    STAKING_POOL: "hdy_staking_0000000000000000",
    BURN_ADDRESS: "hdy_burn_000000000000000000",
});

/**
 * Load wallets from disk.
 * @returns {object} Map of address → wallet data
 */
function loadWallets() {
    try {
        if (!fs.existsSync(WALLETS_FILE)) return {};
        return JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8"));
    } catch {
        return {};
    }
}

/**
 * Persist wallets to disk.
 * @param {object} wallets
 */
function saveWallets(wallets) {
    fs.writeFileSync(WALLETS_FILE, JSON.stringify(wallets, null, 2));
}

/**
 * Initialize system wallets if they don't exist.
 * @returns {object} wallets map
 */
function initSystemWallets() {
    const wallets = loadWallets();
    const now = new Date().toISOString();

    for (const [name, address] of Object.entries(SYSTEM_WALLETS)) {
        if (!wallets[address]) {
            wallets[address] = {
                address,
                label: name,
                balance: 0,
                created: now,
                type: "system",
                transactionCount: 0,
            };
        }
    }

    saveWallets(wallets);
    return wallets;
}

/**
 * Generate a unique wallet address.
 * @param {string} prefix - Optional prefix after 'hdy_'
 * @returns {string} Address like hdy_usr_a1b2c3d4e5f6g7h8
 */
function generateAddress(prefix = "usr") {
    const rand = crypto.randomBytes(8).toString("hex");
    return `hdy_${prefix}_${rand}`;
}

/**
 * Create a new wallet.
 * @param {object} options
 * @param {string} options.label - Human-readable label
 * @param {string} options.owner - Owner identifier (userId, email, etc.)
 * @param {string} options.prefix - Address prefix (default: 'usr')
 * @returns {object} The created wallet
 */
function createWallet({ label = "User Wallet", owner = "anonymous", prefix = "usr" } = {}) {
    const wallets = loadWallets();
    const address = generateAddress(prefix);

    const wallet = {
        address,
        label,
        owner,
        balance: 0,
        created: new Date().toISOString(),
        type: "user",
        transactionCount: 0,
    };

    wallets[address] = wallet;
    saveWallets(wallets);
    return wallet;
}

/**
 * Get wallet by address.
 * @param {string} address
 * @returns {object|null}
 */
function getWallet(address) {
    const wallets = loadWallets();
    return wallets[address] || null;
}

/**
 * Update a wallet's balance.
 * @param {string} address
 * @param {number} delta - Amount to add (positive) or subtract (negative)
 * @returns {object} Updated wallet
 */
function updateBalance(address, delta) {
    const wallets = loadWallets();
    if (!wallets[address]) {
        throw new Error(`Wallet not found: ${address}`);
    }
    wallets[address].balance += delta;
    wallets[address].transactionCount++;
    wallets[address].lastActivity = new Date().toISOString();
    saveWallets(wallets);
    return wallets[address];
}

/**
 * Get balance for a wallet.
 * @param {string} address
 * @returns {number}
 */
function getBalance(address) {
    const wallet = getWallet(address);
    return wallet ? wallet.balance : 0;
}

/**
 * List all wallets.
 * @param {object} filter - Optional filter { type: 'user'|'system' }
 * @returns {object[]}
 */
function listWallets(filter = {}) {
    const wallets = loadWallets();
    let list = Object.values(wallets);
    if (filter.type) {
        list = list.filter((w) => w.type === filter.type);
    }
    return list.sort((a, b) => b.balance - a.balance);
}

/**
 * Check if wallet exists.
 * @param {string} address
 * @returns {boolean}
 */
function walletExists(address) {
    const wallets = loadWallets();
    return !!wallets[address];
}

module.exports = {
    SYSTEM_WALLETS,
    WALLETS_FILE,
    loadWallets,
    saveWallets,
    initSystemWallets,
    generateAddress,
    createWallet,
    getWallet,
    updateBalance,
    getBalance,
    listWallets,
    walletExists,
};
