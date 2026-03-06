#!/usr/bin/env python3
"""
═══ COLAB NODE 3: THE EDGE ═══
Heady™ Real-Time Streams & Financial Autonomy

Purpose:
  - High-frequency market data ingestion (crypto + equities)
  - Real-time sentiment analysis on financial news
  - Portfolio vector embeddings for the Perfect Trader
  - Ableton SysEx bridge for music collaboration (when local)
  - Continuous backtesting against market vectors

Runtime: Colab Pro+ with T4/A100 GPU (for ML inference)
"""

# ── Cell 1: Install Dependencies ────────────────────────────────
# !pip install -q psycopg2-binary openai requests websockets numpy pandas ta

import os
import time
import json
import asyncio
import hashlib
import threading
import traceback
from datetime import datetime, timezone

import numpy as np

# ── Configuration ────────────────────────────────────────────────
NEON_DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://neondb_owner:npg_tEA7FfeWb5gZ@ep-cold-snow-aesmiwt9.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
UPSTASH_REST_URL = os.environ.get("UPSTASH_REDIS_REST_URL", "")
UPSTASH_REST_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")

# Market Data
ALPHA_VANTAGE_KEY = os.environ.get("ALPHA_VANTAGE_KEY", "")
CRYPTO_PAIRS = ["BTC-USD", "ETH-USD", "SOL-USD"]
EQUITY_SYMBOLS = ["GOOGL", "META", "NVDA", "MSFT", "AAPL"]
TICK_INTERVAL_SECONDS = 30

# Portfolio limits
MAX_POSITION_USD = 1000
RISK_TOLERANCE = 0.02  # 2% max drawdown per position

# ── Database ─────────────────────────────────────────────────────
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db():
    return psycopg2.connect(NEON_DATABASE_URL, cursor_factory=RealDictCursor)

def ensure_market_tables(conn):
    """Create market data tables if they don't exist."""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS market_ticks (
                id SERIAL PRIMARY KEY,
                symbol VARCHAR(20) NOT NULL,
                price NUMERIC(16,8) NOT NULL,
                volume NUMERIC(20,4) DEFAULT 0,
                source VARCHAR(50) DEFAULT 'coingecko',
                embedding VECTOR(1536),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_market_ticks_symbol ON market_ticks(symbol);
            CREATE INDEX IF NOT EXISTS idx_market_ticks_time ON market_ticks(created_at);

            CREATE TABLE IF NOT EXISTS market_signals (
                id SERIAL PRIMARY KEY,
                symbol VARCHAR(20) NOT NULL,
                signal_type VARCHAR(50) NOT NULL,
                confidence NUMERIC(5,4) NOT NULL,
                direction VARCHAR(10),
                details JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS portfolio_state (
                id SERIAL PRIMARY KEY,
                symbol VARCHAR(20) UNIQUE NOT NULL,
                position_usd NUMERIC(16,4) DEFAULT 0,
                entry_price NUMERIC(16,8),
                current_price NUMERIC(16,8),
                pnl_usd NUMERIC(16,4) DEFAULT 0,
                pnl_pct NUMERIC(8,4) DEFAULT 0,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
    conn.commit()
    print("  ✅ Market tables ready")

# ── Market Data Fetching ─────────────────────────────────────────
import requests

def fetch_crypto_prices():
    """Get current crypto prices from CoinGecko (free API)."""
    try:
        ids = {"BTC-USD": "bitcoin", "ETH-USD": "ethereum", "SOL-USD": "solana"}
        coin_ids = ",".join(ids.values())
        r = requests.get(
            f"https://api.coingecko.com/api/v3/simple/price?ids={coin_ids}&vs_currencies=usd&include_24hr_vol=true",
            timeout=10
        )
        if r.ok:
            data = r.json()
            result = {}
            for pair, coin_id in ids.items():
                if coin_id in data:
                    result[pair] = {
                        "price": data[coin_id]["usd"],
                        "volume_24h": data[coin_id].get("usd_24h_vol", 0),
                    }
            return result
    except Exception as e:
        print(f"  ⚠️ Crypto fetch error: {e}")
    return {}

def fetch_equity_quotes():
    """Get equity quotes (simplified — uses Alpha Vantage or mock)."""
    if not ALPHA_VANTAGE_KEY:
        # Mock data for testing
        return {s: {"price": 100 + np.random.randn() * 5, "volume": 1000000} for s in EQUITY_SYMBOLS}

    results = {}
    for symbol in EQUITY_SYMBOLS:
        try:
            r = requests.get(
                f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={symbol}&apikey={ALPHA_VANTAGE_KEY}",
                timeout=10
            )
            if r.ok:
                quote = r.json().get("Global Quote", {})
                results[symbol] = {
                    "price": float(quote.get("05. price", 0)),
                    "volume": float(quote.get("06. volume", 0)),
                }
        except Exception:
            pass
        time.sleep(0.5)  # Rate limit
    return results

# ── Market Embedding ─────────────────────────────────────────────
def embed_market_state(prices):
    """Create a vector embedding of the current market state."""
    # Build text representation
    text_parts = []
    for symbol, data in prices.items():
        text_parts.append(f"{symbol}: ${data['price']:.2f} vol={data.get('volume_24h', data.get('volume', 0)):.0f}")
    market_text = f"Market state at {datetime.now(timezone.utc).isoformat()}: " + ", ".join(text_parts)

    if OPENAI_API_KEY:
        import openai
        client = openai.OpenAI(api_key=OPENAI_API_KEY)
        resp = client.embeddings.create(model="text-embedding-3-large", input=market_text)
        return resp.data[0].embedding
    else:
        return np.random.randn(1536).tolist()

# ── Signal Generation ────────────────────────────────────────────
def analyze_signals(conn, symbol, current_price):
    """Simple momentum + mean-reversion signal generation."""
    with conn.cursor() as cur:
        # Get last 20 prices for this symbol
        cur.execute("""
            SELECT price FROM market_ticks
            WHERE symbol = %s
            ORDER BY created_at DESC LIMIT 20
        """, (symbol,))
        rows = cur.fetchall()

    if len(rows) < 5:
        return None  # Not enough data

    prices = [float(r["price"]) for r in rows]
    sma_5 = np.mean(prices[:5])
    sma_20 = np.mean(prices)
    volatility = np.std(prices) / np.mean(prices)

    # Momentum signal
    momentum = (current_price - sma_20) / sma_20

    # Generate signal
    if momentum > 0.02 and current_price > sma_5:
        signal = {"type": "momentum_buy", "confidence": min(abs(momentum) * 10, 0.95), "direction": "long"}
    elif momentum < -0.02 and current_price < sma_5:
        signal = {"type": "momentum_sell", "confidence": min(abs(momentum) * 10, 0.95), "direction": "short"}
    elif abs(momentum) < 0.005:
        signal = {"type": "mean_reversion", "confidence": 0.5, "direction": "neutral"}
    else:
        signal = None

    if signal:
        signal["details"] = {
            "sma_5": round(sma_5, 4),
            "sma_20": round(sma_20, 4),
            "momentum": round(momentum, 6),
            "volatility": round(volatility, 6),
        }

    return signal

# ── Tick Processing Loop ─────────────────────────────────────────
def process_tick_cycle(conn):
    """One cycle of market data processing."""
    # Fetch prices
    crypto = fetch_crypto_prices()
    equities = fetch_equity_quotes()
    all_prices = {**crypto, **equities}

    if not all_prices:
        print("  ⚠️ No price data received")
        return

    print(f"  📈 Ticks: {len(all_prices)} instruments")

    # Store ticks
    for symbol, data in all_prices.items():
        price = data["price"]
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO market_ticks (symbol, price, volume) VALUES (%s, %s, %s)",
                (symbol, price, data.get("volume_24h", data.get("volume", 0)))
            )
        conn.commit()

        # Generate signals
        signal = analyze_signals(conn, symbol, price)
        if signal and signal["confidence"] > 0.6:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO market_signals (symbol, signal_type, confidence, direction, details) VALUES (%s, %s, %s, %s, %s)",
                    (symbol, signal["type"], signal["confidence"], signal["direction"], json.dumps(signal.get("details", {})))
                )
            conn.commit()
            emoji = "🟢" if signal["direction"] == "long" else "🔴" if signal["direction"] == "short" else "⚪"
            print(f"     {emoji} {symbol}: {signal['type']} (conf={signal['confidence']:.2f})")

    # Embed market state (every 5th cycle to save API costs)
    cycle_count = int(time.time()) % 5
    if cycle_count == 0 and len(all_prices) > 0:
        embedding = embed_market_state(all_prices)
        # Store the composite market embedding
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO market_ticks (symbol, price, volume, embedding, source) VALUES (%s, 0, 0, %s::vector, 'composite')",
                ("MARKET_STATE", str(embedding))
            )
        conn.commit()
        print("  🧠 Market state embedded in vector space")

    # Push summary to Upstash
    if UPSTASH_REST_URL:
        summary = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "prices": {k: v["price"] for k, v in all_prices.items()},
            "signals_generated": sum(1 for s, d in all_prices.items() if analyze_signals(conn, s, d["price"])),
        }
        try:
            requests.post(
                f"{UPSTASH_REST_URL}/set/heady:edge:market",
                headers={"Authorization": f"Bearer {UPSTASH_REST_TOKEN}"},
                json={"value": json.dumps(summary), "ex": 300}
            )
        except Exception:
            pass

# ── Portfolio Tracker ────────────────────────────────────────────
def update_portfolio(conn, all_prices):
    """Update portfolio P&L based on current prices."""
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM portfolio_state")
        positions = cur.fetchall()

    for pos in positions:
        symbol = pos["symbol"]
        if symbol in all_prices:
            current = all_prices[symbol]["price"]
            entry = float(pos["entry_price"]) if pos["entry_price"] else current
            position_usd = float(pos["position_usd"]) if pos["position_usd"] else 0
            pnl_pct = (current - entry) / entry if entry > 0 else 0
            pnl_usd = position_usd * pnl_pct

            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE portfolio_state
                    SET current_price = %s, pnl_usd = %s, pnl_pct = %s, updated_at = NOW()
                    WHERE symbol = %s
                """, (current, round(pnl_usd, 4), round(pnl_pct, 4), symbol))
            conn.commit()

# ═══════════════════════════════════════════════════════════════
# THE EDGE MAIN LOOP
# ═══════════════════════════════════════════════════════════════
def run_edge():
    print("=" * 60)
    print(">>> COLAB NODE 3: EDGE STREAMS ENGAGED <<<")
    print(f"    Neon: {'✅' if NEON_DATABASE_URL else '❌'}")
    print(f"    OpenAI: {'✅' if OPENAI_API_KEY else '⚠️ random embeddings'}")
    print(f"    Crypto pairs: {CRYPTO_PAIRS}")
    print(f"    Equity symbols: {EQUITY_SYMBOLS}")
    print(f"    Tick interval: {TICK_INTERVAL_SECONDS}s")
    print("=" * 60)

    # Initialize
    conn = get_db()
    ensure_market_tables(conn)
    conn.close()

    cycle = 0
    while True:
        cycle += 1
        cycle_start = time.time()
        print(f"\n{'─' * 50}")
        print(f"[Edge] Tick Cycle #{cycle} — {datetime.now(timezone.utc).isoformat()}")

        try:
            conn = get_db()
            process_tick_cycle(conn)

            # Portfolio update every 5 cycles
            if cycle % 5 == 0:
                crypto = fetch_crypto_prices()
                equities = fetch_equity_quotes()
                update_portfolio(conn, {**crypto, **equities})

            # Cleanup old ticks (keep last 24h)
            if cycle % 100 == 0:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM market_ticks WHERE created_at < NOW() - INTERVAL '24 hours'")
                conn.commit()
                print("  🧹 Cleaned old ticks")

            conn.close()
        except Exception as e:
            print(f"  ❌ Tick error: {e}")
            traceback.print_exc()

        elapsed = round(time.time() - cycle_start, 1)
        print(f"  ⏱️ Cycle in {elapsed}s, sleeping {TICK_INTERVAL_SECONDS}s...")
        time.sleep(TICK_INTERVAL_SECONDS)


if __name__ == "__main__":
    run_edge()
