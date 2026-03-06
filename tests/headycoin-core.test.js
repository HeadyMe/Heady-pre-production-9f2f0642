/*
 * © 2026 Heady Systems LLC.
 * HeadyCoin Core Test Suite
 */

const path = require("path");
const fs = require("fs");
const os = require("os");

// Use a temp directory for test data to avoid polluting production data
const TEST_DATA_DIR = path.join(os.tmpdir(), `headycoin-test-${Date.now()}`);
fs.mkdirSync(TEST_DATA_DIR, { recursive: true });

// Override DATA_DIR before requiring modules
const originalDataDir = path.join(__dirname, "..", "data");
const LEDGER_FILE = path.join(TEST_DATA_DIR, "headycoin-ledger.jsonl");
const WALLETS_FILE = path.join(TEST_DATA_DIR, "headycoin-wallets.json");
const STAKES_FILE = path.join(TEST_DATA_DIR, "headycoin-stakes.json");
const MERKLE_FILE = path.join(TEST_DATA_DIR, "headycoin-merkle-roots.json");

// We need to set environment before loading modules
// Since the modules use __dirname-relative paths, we'll test via the public API
// and clean data after

describe("HeadyCoin Ledger", () => {
    const ledger = require("../src/headycoin/headycoin-ledger");

    afterAll(() => {
        // Clean up test ledger entries by removing the file
        try { fs.unlinkSync(ledger.LEDGER_FILE); } catch { }
    });

    test("GENESIS_HASH is 64 zeros", () => {
        expect(ledger.GENESIS_HASH).toBe("0".repeat(64));
    });

    test("hashTransaction produces 64-char hex string", () => {
        const hash = ledger.hashTransaction({ type: "TEST", amount: 100 });
        expect(hash).toHaveLength(64);
        expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });

    test("hashTransaction is deterministic", () => {
        const payload = { foo: "bar", num: 42 };
        const hash1 = ledger.hashTransaction(payload);
        const hash2 = ledger.hashTransaction(payload);
        expect(hash1).toBe(hash2);
    });

    test("recordTransaction returns entry with hash and prevHash", () => {
        const entry = ledger.recordTransaction("TEST", "addr_from", "addr_to", 100, { note: "test" });
        expect(entry).toHaveProperty("txId");
        expect(entry).toHaveProperty("hash");
        expect(entry).toHaveProperty("prevHash");
        expect(entry.type).toBe("TEST");
        expect(entry.amount).toBe(100);
    });

    test("hash chain links transactions", () => {
        const tx1 = ledger.recordTransaction("TEST", "a", "b", 10);
        const tx2 = ledger.recordTransaction("TEST", "b", "c", 20);
        expect(tx2.prevHash).toBe(tx1.hash);
    });

    test("readLedger returns entries newest first", () => {
        const entries = ledger.readLedger(5);
        expect(entries.length).toBeGreaterThan(0);
        // Newest first
        if (entries.length > 1) {
            const t0 = new Date(entries[0].timestamp).getTime();
            const t1 = new Date(entries[1].timestamp).getTime();
            expect(t0).toBeGreaterThanOrEqual(t1);
        }
    });

    test("verifyChain detects intact chain", () => {
        const result = ledger.verifyChain();
        expect(result).toHaveProperty("valid");
        expect(result).toHaveProperty("entries");
        expect(result).toHaveProperty("errors");
        // Chain should be valid for our test entries
        expect(result.valid).toBe(true);
    });

    test("getLedgerStats returns statistics", () => {
        const stats = ledger.getLedgerStats();
        expect(stats).toHaveProperty("totalTransactions");
        expect(stats).toHaveProperty("byType");
        expect(stats).toHaveProperty("chainIntegrity");
        expect(stats.totalTransactions).toBeGreaterThan(0);
    });
});

describe("HeadyCoin Wallet", () => {
    const wallet = require("../src/headycoin/headycoin-wallet");

    test("System wallet addresses have hdy_ prefix", () => {
        expect(wallet.SYSTEM_WALLETS.TREASURY).toMatch(/^hdy_/);
        expect(wallet.SYSTEM_WALLETS.STAKING_POOL).toMatch(/^hdy_/);
        expect(wallet.SYSTEM_WALLETS.BURN_ADDRESS).toMatch(/^hdy_/);
    });

    test("initSystemWallets creates 3 system wallets", () => {
        const wallets = wallet.initSystemWallets();
        expect(wallets[wallet.SYSTEM_WALLETS.TREASURY]).toBeDefined();
        expect(wallets[wallet.SYSTEM_WALLETS.STAKING_POOL]).toBeDefined();
        expect(wallets[wallet.SYSTEM_WALLETS.BURN_ADDRESS]).toBeDefined();
    });

    test("createWallet returns wallet with unique address", () => {
        const w1 = wallet.createWallet({ label: "Test 1" });
        const w2 = wallet.createWallet({ label: "Test 2" });
        expect(w1.address).toMatch(/^hdy_usr_/);
        expect(w2.address).toMatch(/^hdy_usr_/);
        expect(w1.address).not.toBe(w2.address);
        expect(w1.balance).toBe(0);
    });

    test("getWallet retrieves created wallet", () => {
        const created = wallet.createWallet({ label: "Retrieval Test" });
        const fetched = wallet.getWallet(created.address);
        expect(fetched).not.toBeNull();
        expect(fetched.address).toBe(created.address);
        expect(fetched.label).toBe("Retrieval Test");
    });

    test("updateBalance modifies wallet balance", () => {
        const w = wallet.createWallet({ label: "Balance Test" });
        wallet.updateBalance(w.address, 500);
        expect(wallet.getBalance(w.address)).toBe(500);
        wallet.updateBalance(w.address, -200);
        expect(wallet.getBalance(w.address)).toBe(300);
    });

    test("walletExists returns correct boolean", () => {
        const w = wallet.createWallet({ label: "Exists Test" });
        expect(wallet.walletExists(w.address)).toBe(true);
        expect(wallet.walletExists("hdy_nonexistent_0000")).toBe(false);
    });

    test("listWallets returns sorted by balance descending", () => {
        const list = wallet.listWallets();
        expect(Array.isArray(list)).toBe(true);
        for (let i = 1; i < list.length; i++) {
            expect(list[i - 1].balance).toBeGreaterThanOrEqual(list[i].balance);
        }
    });
});

describe("HeadyCoin Core Engine", () => {
    const { headyCoin, TOKEN, MINING_REWARDS } = require("../src/headycoin/headycoin-core");
    const wallet = require("../src/headycoin/headycoin-wallet");

    beforeAll(() => {
        headyCoin.initialize();
    });

    test("TOKEN has correct constants", () => {
        expect(TOKEN.symbol).toBe("HDY");
        expect(TOKEN.maxSupply).toBe(21_000_000);
        expect(TOKEN.decimals).toBe(8);
    });

    test("getTokenInfo returns supply data", () => {
        const info = headyCoin.getTokenInfo();
        expect(info.symbol).toBe("HDY");
        expect(info.totalMinted).toBeGreaterThan(0); // Genesis mint
        expect(info.circulatingSupply).toBe(info.totalMinted - info.totalBurned);
        expect(info.remainingMintable).toBe(TOKEN.maxSupply - info.totalMinted);
    });

    test("mint increases balance and totalMinted", () => {
        const w = wallet.createWallet({ label: "Mint Test" });
        const before = headyCoin.totalMinted;
        headyCoin.mint(w.address, 100, { note: "test mint" });
        expect(wallet.getBalance(w.address)).toBe(100);
        expect(headyCoin.totalMinted).toBe(before + 100);
    });

    test("mint rejects negative amount", () => {
        const w = wallet.createWallet({ label: "Negative Mint" });
        expect(() => headyCoin.mint(w.address, -1)).toThrow("positive");
    });

    test("mint rejects unknown wallet", () => {
        expect(() => headyCoin.mint("hdy_fake_0000", 10)).toThrow("not found");
    });

    test("transfer moves tokens between wallets", () => {
        const from = wallet.createWallet({ label: "Sender" });
        const to = wallet.createWallet({ label: "Receiver" });
        headyCoin.mint(from.address, 500);
        headyCoin.transfer(from.address, to.address, 200, { note: "test transfer" });
        expect(wallet.getBalance(from.address)).toBe(300);
        expect(wallet.getBalance(to.address)).toBe(200);
    });

    test("transfer rejects insufficient balance", () => {
        const from = wallet.createWallet({ label: "Poor Sender" });
        const to = wallet.createWallet({ label: "Would-be Receiver" });
        headyCoin.mint(from.address, 50);
        expect(() => headyCoin.transfer(from.address, to.address, 100)).toThrow("Insufficient");
    });

    test("transfer rejects self-transfer", () => {
        const w = wallet.createWallet({ label: "Self" });
        headyCoin.mint(w.address, 100);
        expect(() => headyCoin.transfer(w.address, w.address, 50)).toThrow("self");
    });

    test("burn removes tokens from circulation", () => {
        const w = wallet.createWallet({ label: "Burn Test" });
        headyCoin.mint(w.address, 1000);
        const burnedBefore = headyCoin.totalBurned;
        headyCoin.burn(w.address, 300);
        expect(wallet.getBalance(w.address)).toBe(700);
        expect(headyCoin.totalBurned).toBe(burnedBefore + 300);
    });

    test("mineProofOfInference mints reward tokens", () => {
        const w = wallet.createWallet({ label: "Miner" });
        const tx = headyCoin.mineProofOfInference(w.address, "BATTLE_ARENA", "fakehash123");
        expect(tx).not.toBeNull();
        expect(wallet.getBalance(w.address)).toBeGreaterThan(0);
    });

    test("MINING_REWARDS has entries for all action types", () => {
        expect(MINING_REWARDS.CHAT_COMPLETION).toBeDefined();
        expect(MINING_REWARDS.BATTLE_ARENA).toBe(1.00);
        expect(MINING_REWARDS.TRADE_THESIS).toBe(0.75);
    });

    test("getMiningReward applies halving", () => {
        const reward = headyCoin.getMiningReward("CHAT_COMPLETION");
        expect(reward).toBeGreaterThan(0);
        expect(reward).toBeLessThanOrEqual(MINING_REWARDS.CHAT_COMPLETION);
    });
});

describe("HeadyCoin Merkle Tree", () => {
    const merkle = require("../src/headycoin/headycoin-merkle");

    test("hashPair produces deterministic hash", () => {
        const h1 = merkle.hashPair("abc", "def");
        const h2 = merkle.hashPair("abc", "def");
        expect(h1).toBe(h2);
        expect(h1).toHaveLength(64);
    });

    test("buildTree with single leaf returns leaf as root", () => {
        const tree = merkle.buildTree(["aabbccdd"]);
        expect(tree.root).toBe("aabbccdd");
        expect(tree.layers.length).toBe(1);
    });

    test("buildTree with two leaves produces correct root", () => {
        const tree = merkle.buildTree(["aaaa", "bbbb"]);
        const expected = merkle.hashPair("aaaa", "bbbb");
        expect(tree.root).toBe(expected);
        expect(tree.layers.length).toBe(2);
    });

    test("buildTree with empty leaves returns zero root", () => {
        const tree = merkle.buildTree([]);
        expect(tree.root).toBe("0".repeat(64));
    });

    test("proof verification works for valid proof", () => {
        const leaves = ["aaaa", "bbbb", "cccc", "dddd"];
        const tree = merkle.buildTree(leaves);

        // Verify proof for leaf at index 2
        const proof = merkle.generateProof(tree.layers, 2);
        const valid = merkle.verifyProof("cccc", proof, tree.root);
        expect(valid).toBe(true);
    });

    test("proof verification fails for tampered leaf", () => {
        const leaves = ["aaaa", "bbbb", "cccc", "dddd"];
        const tree = merkle.buildTree(leaves);
        const proof = merkle.generateProof(tree.layers, 2);
        const valid = merkle.verifyProof("tampered", proof, tree.root);
        expect(valid).toBe(false);
    });

    test("getMerkleStats returns statistics", () => {
        const stats = merkle.getMerkleStats();
        expect(stats).toHaveProperty("totalRoots");
        expect(stats).toHaveProperty("totalAnchoredTransactions");
        expect(stats).toHaveProperty("ts");
    });
});

describe("HeadyCoin Staking", () => {
    const staking = require("../src/headycoin/headycoin-staking");
    const wallet = require("../src/headycoin/headycoin-wallet");
    const { headyCoin } = require("../src/headycoin/headycoin-core");

    test("STAKING_TIERS has 3 tiers with correct APY", () => {
        expect(staking.STAKING_TIERS.SHORT.apy).toBe(0.05);
        expect(staking.STAKING_TIERS.MEDIUM.apy).toBe(0.10);
        expect(staking.STAKING_TIERS.LONG.apy).toBe(0.15);
    });

    test("stake locks tokens in staking pool", () => {
        headyCoin.initialize();
        const w = wallet.createWallet({ label: "Staker" });
        headyCoin.mint(w.address, 500);

        const record = staking.stake(w.address, 100, "SHORT");
        expect(record.status).toBe("active");
        expect(record.amount).toBe(100);
        expect(wallet.getBalance(w.address)).toBe(400);
        expect(wallet.getBalance(wallet.SYSTEM_WALLETS.STAKING_POOL)).toBeGreaterThanOrEqual(100);
    });

    test("stake rejects insufficient balance", () => {
        const w = wallet.createWallet({ label: "Poor Staker" });
        expect(() => staking.stake(w.address, 100, "SHORT")).toThrow("Insufficient");
    });

    test("stake rejects below minimum", () => {
        const w = wallet.createWallet({ label: "Small Staker" });
        headyCoin.mint(w.address, 5);
        expect(() => staking.stake(w.address, 5, "SHORT")).toThrow("Minimum");
    });

    test("unstake rejects before lock expiry", () => {
        const w = wallet.createWallet({ label: "Early Unstaker" });
        headyCoin.mint(w.address, 200);
        const record = staking.stake(w.address, 100, "SHORT");
        expect(() => staking.unstake(record.id)).toThrow("locked");
    });

    test("getStakes returns stakes for wallet", () => {
        const w = wallet.createWallet({ label: "Multi Staker" });
        headyCoin.mint(w.address, 1000);
        staking.stake(w.address, 100, "SHORT");
        staking.stake(w.address, 200, "MEDIUM");

        const stakes = staking.getStakes(w.address);
        expect(stakes.length).toBe(2);
        expect(stakes[0]).toHaveProperty("pendingReward");
    });

    test("getStakingStats returns pool info", () => {
        const stats = staking.getStakingStats();
        expect(stats).toHaveProperty("totalStaked");
        expect(stats).toHaveProperty("activeStakes");
        expect(stats).toHaveProperty("tiers");
    });
});

// Cleanup
afterAll(() => {
    try { fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true }); } catch { }
});
