# HeadyCoin Architecture

> **Symbol**: HDY · **Max Supply**: 21,000,000 · **Decimals**: 8  
> **Mining**: Proof-of-Inference · **Anchoring**: EVM via Merkle Root  
> **Status**: v1.0.0 · March 2026

---

## Overview

HeadyCoin (HDY) is the utility token of the Heady AI ecosystem. Tokens are mined through **Proof-of-Inference** — every verified AI action (chat, battle, creative generation, trade thesis) mints HDY to the acting wallet. The supply follows a Bitcoin-inspired **halving schedule** with a hard cap of 21M tokens.

```
 Cognitive-Telemetry              HeadyCoin Engine                   EVM Chain
┌─────────────────┐          ┌───────────────────┐          ┌──────────────────┐
│  AI Action       │ ──SHA──▶ │  Proof-of-Inference │ ──mint─▶ │  Wallet Balance   │
│  (sha256 hash)   │          │  Reward Calculator  │          │  + Ledger Entry   │
└─────────────────┘          └───────┬───────────┘          └──────┬───────────┘
                                     │                             │
                              ┌──────▼──────┐               ┌─────▼────────┐
                              │ Merkle Tree  │ ──root hash──▶│ web3-ledger  │
                              │ Aggregator   │               │ anchor.js    │
                              └─────────────┘               └──────────────┘
```

---

## Tokenomics

| Parameter | Value |
|---|---|
| **Name** | HeadyCoin |
| **Symbol** | HDY |
| **Max Supply** | 21,000,000 |
| **Genesis Allocation** | 2,100,000 (10% → TREASURY) |
| **Halving Interval** | Every 2.1M minted tokens |
| **Smallest Unit** | 1 heady = 0.00000001 HDY |

### Halving Schedule

| Era | Total Minted | Mining Multiplier |
|---|---|---|
| 0 | 0 – 2.1M | 1.00× |
| 1 | 2.1M – 4.2M | 0.50× |
| 2 | 4.2M – 6.3M | 0.25× |
| 3 | 6.3M – 8.4M | 0.125× |
| ... | ... | halves each era |

---

## Mining Rewards (Proof-of-Inference)

Each cognitive telemetry action type earns a base reward (modified by halving):

| Action Type | Base Reward (HDY) |
|---|---|
| CHAT_COMPLETION | 0.01 |
| MCP_CALL | 0.02 |
| TASK_DECOMPOSITION | 0.03 |
| CREATIVE_REMIX | 0.05 |
| CREATIVE_GENERATE / MODEL_GENERATION | 0.10 |
| PIPELINE_EXECUTION | 0.15 |
| ARCHITECTURE_UPDATE | 0.20 |
| BATTLE_EVALUATE | 0.25 |
| BATTLE_VALIDATE / SIMS_SIMULATE | 0.50 |
| TRADE_THESIS | 0.75 |
| BATTLE_ARENA | 1.00 |

---

## Staking Tiers

| Tier | Lock Period | APY | Min Stake |
|---|---|---|---|
| SHORT | 30 days | 5% | 10 HDY |
| MEDIUM | 90 days | 10% | 50 HDY |
| LONG | 365 days | 15% | 100 HDY |

---

## System Wallets

| Wallet | Address | Purpose |
|---|---|---|
| **TREASURY** | `hdy_treasury_0000000000000000` | Pre-mined genesis allocation |
| **STAKING_POOL** | `hdy_staking_0000000000000000` | Holds locked staked tokens |
| **BURN_ADDRESS** | `hdy_burn_000000000000000000` | Permanently destroyed tokens |

---

## Ledger Architecture

Append-only JSONL at `data/headycoin-ledger.jsonl`. Each transaction contains:

```json
{
  "txId": "tx_1709420000_a1b2c3d4",
  "type": "TRANSFER",
  "from": "hdy_usr_...",
  "to": "hdy_usr_...",
  "amount": 100,
  "timestamp": "2026-03-02T...",
  "prevHash": "<hash of previous transaction>",
  "metadata": {},
  "hash": "<SHA-256 of this entry>"
}
```

- **Hash chain**: Each entry's `prevHash` links to the prior entry's `hash`
- **Genesis**: First entry links to `0×64` genesis hash
- **Verifiable**: `verifyChain()` validates entire chain integrity

---

## Merkle Tree Anchoring

Transactions are batched into a Merkle tree. The root hash is anchored to EVM (Base/Arbitrum) via `web3-ledger-anchor.js`:

1. Collect unanchored transaction hashes
2. Build binary Merkle tree (SHA-256 pair hashing)
3. Submit root to smart contract (`anchorHash()`)
4. Record anchoring event with EVM tx hash

**Inclusion proofs**: Any individual transaction can prove its membership in an anchored batch via a Merkle proof path.

---

## API Reference

All endpoints are under `/api/headycoin/`.

### Token Info

| Method | Endpoint | Description |
|---|---|---|
| GET | `/info` | Supply, cap, circulating, halving era |
| GET | `/mining-rewards` | Current reward table with halving |

### Wallets

| Method | Endpoint | Description |
|---|---|---|
| POST | `/wallet/create` | Create new wallet |
| GET | `/wallet/:address` | Wallet balance + stakes |
| GET | `/wallets` | List all wallets |

### Transactions

| Method | Endpoint | Description |
|---|---|---|
| POST | `/transfer` | Transfer HDY between wallets |
| POST | `/burn` | Burn tokens permanently |

### Staking

| Method | Endpoint | Description |
|---|---|---|
| POST | `/stake` | Stake HDY tokens |
| POST | `/unstake` | Unstake after lock expiry |
| GET | `/staking/:address` | Active stakes for wallet |
| GET | `/staking-stats` | Pool statistics |

### Ledger

| Method | Endpoint | Description |
|---|---|---|
| GET | `/ledger` | Recent transactions |
| GET | `/ledger/stats` | Ledger statistics |
| GET | `/ledger/verify` | Chain integrity check |

### Merkle & Anchoring

| Method | Endpoint | Description |
|---|---|---|
| GET | `/merkle/root` | Build Merkle root from unanchored txs |
| POST | `/merkle/verify` | Verify inclusion proof |
| POST | `/anchor` | Anchor Merkle root to EVM |
| GET | `/merkle/stats` | Anchoring statistics |
| GET | `/merkle/history` | All anchored roots |

---

## Files

| File | Purpose |
|---|---|
| `src/headycoin/headycoin-core.js` | Token engine (mint, burn, transfer, mining) |
| `src/headycoin/headycoin-wallet.js` | Wallet creation and management |
| `src/headycoin/headycoin-ledger.js` | Immutable hash-chained transaction ledger |
| `src/headycoin/headycoin-staking.js` | Staking tiers and reward calculation |
| `src/headycoin/headycoin-merkle.js` | Merkle tree for EVM batch anchoring |
| `src/headycoin/index.js` | Module barrel file |
| `src/routes/headycoin.js` | REST API endpoints |
| `data/headycoin-ledger.jsonl` | Transaction log |
| `data/headycoin-wallets.json` | Wallet state |
| `data/headycoin-stakes.json` | Staking records |
| `data/headycoin-merkle-roots.json` | Anchored Merkle roots |
