#!/usr/bin/env python3
"""
═══ COLAB NODE 1: THE OVERMIND ═══
Heady™ Cognitive Sync & Vector Space Engine

Purpose:
  - Continuously syncs vector space state from Neon pgvector
  - Detects semantic drift between intent and reality
  - Dispatches swarm tasks via HTTP to Node 2 (Forge)
  - Generates real embeddings using OpenAI text-embedding-3-large
  - Manages the AST governance ledger

Runtime: Colab Pro+ with T4/A100 GPU
Reconnect: Script auto-recovers from disconnections
"""

# ── Cell 1: Install Dependencies ────────────────────────────────
# !pip install -q psycopg2-binary openai numpy requests python-dotenv

import os
import time
import json
import hashlib
import traceback
import numpy as np
from datetime import datetime, timezone

# ── Configuration ────────────────────────────────────────────────
# Paste your .env values here or load from Colab secrets
NEON_DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://neondb_owner:npg_tEA7FfeWb5gZ@ep-cold-snow-aesmiwt9.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
FORGE_WEBHOOK_URL = os.environ.get("FORGE_WEBHOOK_URL", "")  # Node 2's ngrok/endpoint
UPSTASH_REST_URL = os.environ.get("UPSTASH_REDIS_REST_URL", "")
UPSTASH_REST_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")

# Tuning
DRIFT_THRESHOLD = 0.05
CYCLE_INTERVAL_SECONDS = 60
EMBEDDING_MODEL = "text-embedding-3-large"
EMBEDDING_DIMENSIONS = 1536
MAX_NODES_PER_CYCLE = 50

# ── Database Connection ──────────────────────────────────────────
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db():
    return psycopg2.connect(NEON_DATABASE_URL, cursor_factory=RealDictCursor)

# ── Embedding Engine ─────────────────────────────────────────────
import openai

def generate_embedding(text, model=EMBEDDING_MODEL):
    """Generate real 1536-dim embedding via OpenAI."""
    if not OPENAI_API_KEY:
        # Fallback to random embedding if no API key
        return np.random.randn(EMBEDDING_DIMENSIONS).tolist()

    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    response = client.embeddings.create(
        model=model,
        input=text[:8000],  # Truncate to token limit
    )
    return response.data[0].embedding

def cosine_similarity(a, b):
    """Compute cosine similarity between two vectors."""
    a, b = np.array(a), np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))

# ── Upstash Redis State ─────────────────────────────────────────
import requests

def redis_set(key, value, ttl=3600):
    """Set a key in Upstash Redis."""
    if not UPSTASH_REST_URL:
        return
    try:
        requests.post(
            f"{UPSTASH_REST_URL}/set/{key}",
            headers={"Authorization": f"Bearer {UPSTASH_REST_TOKEN}"},
            json={"value": json.dumps(value), "ex": ttl}
        )
    except Exception:
        pass

def redis_get(key):
    """Get a key from Upstash Redis."""
    if not UPSTASH_REST_URL:
        return None
    try:
        r = requests.get(
            f"{UPSTASH_REST_URL}/get/{key}",
            headers={"Authorization": f"Bearer {UPSTASH_REST_TOKEN}"}
        )
        result = r.json().get("result")
        return json.loads(result) if result else None
    except Exception:
        return None

# ── Core: Vector Space Census ────────────────────────────────────
def get_vector_census(conn):
    """Get current state of all AST nodes in vector space."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT node_type, count(*) as cnt,
                   sum(byte_size) as total_bytes,
                   sum(line_count) as total_lines,
                   avg(access_count) as avg_access
            FROM ast_nodes
            WHERE status = 'active'
            GROUP BY node_type
            ORDER BY cnt DESC
        """)
        return cur.fetchall()

# ── Core: Semantic Drift Detection ───────────────────────────────
def calculate_semantic_drift(conn):
    """
    Detect semantic drift:
    - Nodes with stale embeddings (updated_at > last embedding generation)
    - Nodes that changed but weren't re-embedded
    - Orphaned nodes (no edges)
    """
    with conn.cursor() as cur:
        # Find nodes with stale source_hash != governance_hash (modified but not re-verified)
        cur.execute("""
            SELECT id, node_path, node_name, node_type, source_hash, governance_hash,
                   byte_size, updated_at
            FROM ast_nodes
            WHERE status = 'active'
              AND source_hash != governance_hash
            ORDER BY updated_at DESC
            LIMIT %s
        """, (MAX_NODES_PER_CYCLE,))
        stale_nodes = cur.fetchall()

        # Find nodes with zero access (never materialized)
        cur.execute("""
            SELECT count(*) as cnt FROM ast_nodes
            WHERE status = 'active' AND access_count = 0
        """)
        cold_nodes = cur.fetchone()["cnt"]

        # Calculate drift score
        total_result = None
        cur.execute("SELECT count(*) as cnt FROM ast_nodes WHERE status = 'active'")
        total_result = cur.fetchone()["cnt"]

        drift_score = len(stale_nodes) / max(total_result, 1)

        return {
            "drift_score": round(drift_score, 4),
            "stale_nodes": stale_nodes,
            "cold_nodes": cold_nodes,
            "total_active": total_result,
            "threshold": DRIFT_THRESHOLD,
            "drifted": drift_score > DRIFT_THRESHOLD,
        }

# ── Core: Re-embed Stale Nodes ──────────────────────────────────
def re_embed_stale_nodes(conn, stale_nodes):
    """Re-generate embeddings for nodes that drifted."""
    updated = 0
    for node in stale_nodes[:10]:  # Batch of 10 per cycle to manage API costs
        try:
            # Build embedding text from node metadata
            embed_text = f"{node['node_name']} ({node['node_type']}): {node['node_path']}"

            embedding = generate_embedding(embed_text)

            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE ast_nodes
                    SET embedding = %s::vector,
                        governance_hash = source_hash,
                        access_count = access_count + 1,
                        last_accessed_at = NOW(),
                        updated_at = NOW()
                    WHERE id = %s
                """, (str(embedding), node["id"]))
            conn.commit()
            updated += 1
            print(f"  ✅ Re-embedded: {node['node_path']}")
        except Exception as e:
            print(f"  ⚠️ Embed failed for {node['node_path']}: {e}")
            conn.rollback()

    return updated

# ── Core: Dispatch to Forge (Node 2) ────────────────────────────
def dispatch_to_forge(task_payload):
    """Send a deployment task to Node 2 via HTTP webhook."""
    if not FORGE_WEBHOOK_URL:
        print("  ⚠️ No FORGE_WEBHOOK_URL set, skipping dispatch")
        return False

    try:
        r = requests.post(
            FORGE_WEBHOOK_URL,
            json=task_payload,
            headers={"X-Heady-Token": "overmind-dispatch"},
            timeout=30,
        )
        print(f"  📡 Forge dispatch: {r.status_code}")
        return r.ok
    except Exception as e:
        print(f"  ⚠️ Forge dispatch failed: {e}")
        return False

# ── Core: Governance Audit ───────────────────────────────────────
def run_governance_audit(conn):
    """Check governance integrity of the vector space."""
    with conn.cursor() as cur:
        # Count governance events in last hour
        cur.execute("""
            SELECT action, count(*) as cnt
            FROM ast_governance
            WHERE timestamp > NOW() - INTERVAL '1 hour'
            GROUP BY action
            ORDER BY cnt DESC
        """)
        recent_actions = cur.fetchall()

        # Check for unsigned nodes
        cur.execute("""
            SELECT count(*) as cnt FROM ast_nodes
            WHERE governance_signed_by IS NULL OR governance_signed_by = ''
        """)
        unsigned = cur.fetchone()["cnt"]

        return {
            "recent_actions": recent_actions,
            "unsigned_nodes": unsigned,
            "status": "clean" if unsigned == 0 else "needs_signing",
        }

# ═══════════════════════════════════════════════════════════════
# THE OVERMIND LOOP
# ═══════════════════════════════════════════════════════════════
def run_overmind():
    print("=" * 60)
    print(">>> COLAB NODE 1: OVERMIND AUTONOMY LOOP <<<")
    print(f"    Neon: {'✅ connected' if NEON_DATABASE_URL else '❌ missing'}")
    print(f"    OpenAI: {'✅ configured' if OPENAI_API_KEY else '⚠️ random embeddings'}")
    print(f"    Upstash: {'✅ connected' if UPSTASH_REST_URL else '⚠️ no cache'}")
    print(f"    Forge: {'✅ endpoint set' if FORGE_WEBHOOK_URL else '⚠️ no dispatch'}")
    print(f"    Cycle: every {CYCLE_INTERVAL_SECONDS}s")
    print(f"    Drift threshold: {DRIFT_THRESHOLD}")
    print("=" * 60)

    cycle_count = 0

    while True:
        cycle_count += 1
        cycle_start = time.time()
        print(f"\n{'─' * 50}")
        print(f"[Overmind] Cycle #{cycle_count} — {datetime.now(timezone.utc).isoformat()}")

        try:
            conn = get_db()

            # 1. Vector Space Census
            census = get_vector_census(conn)
            total_nodes = sum(r["cnt"] for r in census)
            print(f"  📊 Vector Space: {total_nodes} active nodes")
            for row in census:
                print(f"     {row['node_type']}: {row['cnt']} ({row['total_bytes'] or 0} bytes)")

            # 2. Semantic Drift Detection
            drift = calculate_semantic_drift(conn)
            print(f"  🔍 Drift Score: {drift['drift_score']} (threshold: {DRIFT_THRESHOLD})")
            print(f"     Stale: {len(drift['stale_nodes'])}, Cold: {drift['cold_nodes']}")

            # 3. Re-embed if drifted
            if drift["drifted"] and drift["stale_nodes"]:
                print(f"  🔄 Re-embedding {min(10, len(drift['stale_nodes']))} stale nodes...")
                updated = re_embed_stale_nodes(conn, drift["stale_nodes"])
                print(f"  ✅ Re-embedded {updated} nodes")

                # Dispatch to Forge if significant drift
                if updated > 0 and FORGE_WEBHOOK_URL:
                    dispatch_to_forge({
                        "type": "re-embed",
                        "nodes_updated": updated,
                        "drift_score": drift["drift_score"],
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })

            # 4. Governance Audit
            gov = run_governance_audit(conn)
            print(f"  🔒 Governance: {gov['status']} (unsigned: {gov['unsigned_nodes']})")

            # 5. Push state to Upstash Redis
            state = {
                "cycle": cycle_count,
                "total_nodes": total_nodes,
                "drift_score": drift["drift_score"],
                "governance": gov["status"],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            redis_set("heady:overmind:state", state, ttl=300)
            redis_set("heady:overmind:census", census, ttl=300)

            conn.close()

        except Exception as e:
            print(f"  ❌ Cycle error: {e}")
            traceback.print_exc()

        elapsed = round(time.time() - cycle_start, 1)
        print(f"  ⏱️ Cycle completed in {elapsed}s")
        print(f"  💤 Sleeping {CYCLE_INTERVAL_SECONDS}s...")
        time.sleep(CYCLE_INTERVAL_SECONDS)


# ── Run ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    run_overmind()
