#!/usr/bin/env python3
"""
═══ COLAB NODE 2: THE SYNAPSE & FORGE ═══
Heady™ Bidirectional Sync + Liquid Deployment

Purpose:
  - EXHALE: AST mutations in pgvector → unparse → git push to dev repo
  - INHALE: Dev repo commits → parse to AST → embed → pgvector update
  - COMPILE: Pull AST → in-memory bundle → push to Cloudflare edge
  - Processes deployment tasks from Overmind (Node 1)

Runtime: Colab Pro+ with T4 GPU (for fast compilation)
"""

# ── Cell 1: Install Dependencies ────────────────────────────────
# !pip install -q psycopg2-binary openai requests flask ngrok numpy

import os
import time
import json
import hashlib
import threading
import traceback
from datetime import datetime, timezone

# ── Configuration ────────────────────────────────────────────────
NEON_DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://neondb_owner:npg_tEA7FfeWb5gZ@ep-cold-snow-aesmiwt9.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "HeadyMe/Heady-pre-production-9f2f0642")
CLOUDFLARE_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
CLOUDFLARE_ZONE_ID = os.environ.get("CLOUDFLARE_ZONE_ID", "")
UPSTASH_REST_URL = os.environ.get("UPSTASH_REDIS_REST_URL", "")
UPSTASH_REST_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")

FORGE_PORT = 5000
COMPILE_CACHE = {}

# ── Database ─────────────────────────────────────────────────────
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db():
    return psycopg2.connect(NEON_DATABASE_URL, cursor_factory=RealDictCursor)

# ── GitHub API ───────────────────────────────────────────────────
import requests

def github_get_file(path, branch="main"):
    """Get file content from GitHub."""
    r = requests.get(
        f"https://api.github.com/repos/{GITHUB_REPO}/contents/{path}",
        headers={"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"},
        params={"ref": branch}
    )
    if r.ok:
        import base64
        data = r.json()
        return base64.b64decode(data["content"]).decode("utf-8"), data["sha"]
    return None, None

def github_push_file(path, content, message, sha=None, branch="main"):
    """Push a file to GitHub."""
    import base64
    payload = {
        "message": message,
        "content": base64.b64encode(content.encode()).decode(),
        "branch": branch,
    }
    if sha:
        payload["sha"] = sha

    r = requests.put(
        f"https://api.github.com/repos/{GITHUB_REPO}/contents/{path}",
        headers={"Authorization": f"token {GITHUB_TOKEN}"},
        json=payload,
    )
    return r.ok, r.json() if r.ok else r.text

def github_get_recent_commits(since_minutes=5):
    """Get commits from the last N minutes."""
    since = datetime.now(timezone.utc).isoformat()
    r = requests.get(
        f"https://api.github.com/repos/{GITHUB_REPO}/commits",
        headers={"Authorization": f"token {GITHUB_TOKEN}"},
        params={"per_page": 10}
    )
    return r.json() if r.ok else []

# ── EXHALE: pgvector → Dev Repo ─────────────────────────────────
def exhale(conn, node_ids=None):
    """Push AST mutations from pgvector to the dev repo."""
    with conn.cursor() as cur:
        if node_ids:
            cur.execute(
                "SELECT id, node_path, ast_json, source_hash FROM ast_nodes WHERE id = ANY(%s)",
                (node_ids,)
            )
        else:
            cur.execute("""
                SELECT id, node_path, ast_json, source_hash FROM ast_nodes
                WHERE status = 'active'
                  AND updated_at > NOW() - INTERVAL '5 minutes'
                ORDER BY updated_at DESC LIMIT 20
            """)
        nodes = cur.fetchall()

    if not nodes:
        return {"status": "no_mutations", "count": 0}

    pushed = 0
    for node in nodes:
        ast = node["ast_json"]
        source = ast.get("src", ast.get("source", json.dumps(ast, indent=2)))

        # Get existing SHA for update
        _, sha = github_get_file(node["node_path"])
        ok, _ = github_push_file(
            node["node_path"],
            source,
            f"[Liquid Exhale] {node['node_path']} — hash {node['source_hash'][:8]}",
            sha=sha,
        )
        if ok:
            pushed += 1
            print(f"  📤 Exhaled: {node['node_path']}")

            # Log to governance
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO ast_governance (node_id, action, actor, details)
                    VALUES (%s, 'exhale', 'colab-node-2', %s)
                """, (node["id"], json.dumps({"target": "github", "hash": node["source_hash"]})))
            conn.commit()

    return {"status": "complete", "pushed": pushed, "total": len(nodes)}

# ── INHALE: Dev Repo → pgvector ──────────────────────────────────
def inhale(conn, changed_files):
    """Parse changed files from dev repo into AST nodes in pgvector."""
    updated = 0
    for file_info in changed_files:
        path = file_info.get("filename", file_info.get("path", ""))
        if not path.endswith((".js", ".py", ".ts", ".jsx")):
            continue

        content, _ = github_get_file(path)
        if not content:
            continue

        source_hash = hashlib.sha256(content.encode()).hexdigest()
        node_name = os.path.basename(path).rsplit(".", 1)[0].replace("-", " ").title()
        node_type = "bee" if "/bees/" in path else "service" if "/services/" in path else "module"
        module_name = os.path.basename(path).rsplit(".", 1)[0]

        # Generate embedding
        import numpy as np
        if OPENAI_API_KEY:
            import openai
            client = openai.OpenAI(api_key=OPENAI_API_KEY)
            resp = client.embeddings.create(model="text-embedding-3-large", input=f"{node_name} ({node_type}): {path}")
            embedding = resp.data[0].embedding
        else:
            embedding = np.random.randn(1536).tolist()

        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO ast_nodes (node_path, node_name, node_type, module_name, ast_json, source_hash, governance_hash, embedding, line_count, byte_size)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s::vector, %s, %s)
                ON CONFLICT (node_path) DO UPDATE SET
                    ast_json = EXCLUDED.ast_json, source_hash = EXCLUDED.source_hash,
                    governance_hash = EXCLUDED.governance_hash, embedding = EXCLUDED.embedding,
                    line_count = EXCLUDED.line_count, byte_size = EXCLUDED.byte_size,
                    updated_at = NOW()
            """, (
                path, node_name, node_type, module_name,
                json.dumps({"src": content[:500]}), source_hash, source_hash,
                str(embedding), content.count("\n") + 1, len(content)
            ))
        conn.commit()
        updated += 1
        print(f"  📥 Inhaled: {path}")

    return {"status": "complete", "updated": updated}

# ── COMPILE: pgvector → Edge ─────────────────────────────────────
def compile_and_push(conn, target_domain=None):
    """Pull AST from pgvector, build manifest, push to edge cache."""
    with conn.cursor() as cur:
        if target_domain:
            cur.execute(
                "SELECT id, node_path, node_name, byte_size, source_hash FROM ast_nodes WHERE status = 'active' AND node_path LIKE %s",
                (f"%{target_domain}%",)
            )
        else:
            cur.execute("SELECT id, node_path, node_name, byte_size, source_hash FROM ast_nodes WHERE status = 'active' ORDER BY node_path")
        nodes = cur.fetchall()

    # Build compilation manifest
    manifest = {
        "compiled_at": datetime.now(timezone.utc).isoformat(),
        "target_domain": target_domain or "all",
        "modules": len(nodes),
        "total_bytes": sum(n["byte_size"] or 0 for n in nodes),
        "bundle_hash": hashlib.sha256(
            ":".join(n["source_hash"] for n in nodes).encode()
        ).hexdigest(),
        "node_paths": [n["node_path"] for n in nodes],
    }

    # Cache manifest
    COMPILE_CACHE[target_domain or "all"] = manifest

    # Push to Cloudflare Edge (purge cache)
    if CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID:
        try:
            r = requests.post(
                f"https://api.cloudflare.com/client/v4/zones/{CLOUDFLARE_ZONE_ID}/purge_cache",
                headers={"Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}"},
                json={"purge_everything": True}
            )
            manifest["edge_purge"] = r.ok
            print(f"  🌐 Edge cache purged: {r.ok}")
        except Exception as e:
            print(f"  ⚠️ Edge purge failed: {e}")

    # Push manifest to Upstash
    if UPSTASH_REST_URL:
        try:
            requests.post(
                f"{UPSTASH_REST_URL}/set/heady:compile:manifest",
                headers={"Authorization": f"Bearer {UPSTASH_REST_TOKEN}"},
                json={"value": json.dumps(manifest), "ex": 3600}
            )
        except Exception:
            pass

    print(f"  🔨 Compiled: {manifest['modules']} modules, {manifest['total_bytes']} bytes")
    return manifest

# ── Flask Webhook Server ─────────────────────────────────────────
from flask import Flask, request as flask_request, jsonify

app = Flask("heady-forge")

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "operational", "node": "forge", "cache_size": len(COMPILE_CACHE)})

@app.route("/webhook/overmind", methods=["POST"])
def overmind_webhook():
    """Receive tasks from the Overmind (Node 1)."""
    payload = flask_request.json
    print(f"\n[Forge] Task from Overmind: {payload.get('type', 'unknown')}")

    conn = get_db()
    try:
        task_type = payload.get("type", "")
        if task_type == "re-embed":
            result = compile_and_push(conn)
        elif task_type == "exhale":
            result = exhale(conn, payload.get("node_ids"))
        elif task_type == "compile":
            result = compile_and_push(conn, payload.get("target_domain"))
        else:
            result = {"status": "unknown_task", "type": task_type}
    except Exception as e:
        result = {"status": "error", "error": str(e)}
    finally:
        conn.close()

    return jsonify(result)

@app.route("/webhook/github", methods=["POST"])
def github_webhook():
    """Receive push webhooks from GitHub (Antigravity commits)."""
    payload = flask_request.json
    commits = payload.get("commits", [])
    if not commits:
        return jsonify({"status": "no_commits"})

    print(f"\n[Forge] GitHub push: {len(commits)} commits")
    conn = get_db()
    try:
        all_files = []
        for commit in commits:
            all_files.extend(commit.get("added", []) + commit.get("modified", []))
        changed_files = [{"path": f} for f in set(all_files)]
        result = inhale(conn, changed_files)

        # Auto-compile after inhale
        if result["updated"] > 0:
            compile_and_push(conn)
    except Exception as e:
        result = {"status": "error", "error": str(e)}
    finally:
        conn.close()

    return jsonify(result)

@app.route("/api/exhale", methods=["POST"])
def api_exhale():
    conn = get_db()
    try:
        result = exhale(conn)
    finally:
        conn.close()
    return jsonify(result)

@app.route("/api/compile", methods=["POST"])
def api_compile():
    conn = get_db()
    try:
        domain = flask_request.json.get("domain") if flask_request.json else None
        result = compile_and_push(conn, domain)
    finally:
        conn.close()
    return jsonify(result)

# ── Background Sync Loop ────────────────────────────────────────
def sync_loop():
    """Continuous background sync — checks for changes every 2 minutes."""
    while True:
        try:
            conn = get_db()

            # Check for recent Antigravity commits
            commits = github_get_recent_commits(since_minutes=2)
            if commits and isinstance(commits, list) and len(commits) > 0:
                latest = commits[0]
                last_checked = COMPILE_CACHE.get("_last_commit_sha")
                if latest.get("sha") != last_checked:
                    print(f"\n[Sync] New commit detected: {latest['sha'][:8]}")
                    COMPILE_CACHE["_last_commit_sha"] = latest["sha"]
                    # Get changed files from commit
                    r = requests.get(
                        latest["url"],
                        headers={"Authorization": f"token {GITHUB_TOKEN}"}
                    )
                    if r.ok:
                        files = r.json().get("files", [])
                        if files:
                            result = inhale(conn, files)
                            if result["updated"] > 0:
                                compile_and_push(conn)

            conn.close()
        except Exception as e:
            print(f"[Sync] Error: {e}")

        time.sleep(120)

# ═══════════════════════════════════════════════════════════════
# THE FORGE MAIN
# ═══════════════════════════════════════════════════════════════
def run_forge():
    print("=" * 60)
    print(">>> COLAB NODE 2: SYNAPSE & FORGE ENGAGED <<<")
    print(f"    Neon: {'✅' if NEON_DATABASE_URL else '❌'}")
    print(f"    GitHub: {'✅ ' + GITHUB_REPO if GITHUB_TOKEN else '⚠️ no token'}")
    print(f"    Cloudflare: {'✅' if CLOUDFLARE_API_TOKEN else '⚠️ no purge'}")
    print(f"    Webhook port: {FORGE_PORT}")
    print("=" * 60)

    # Start background sync thread
    sync_thread = threading.Thread(target=sync_loop, daemon=True)
    sync_thread.start()
    print("[Forge] Background sync loop started")

    # Initial compile
    try:
        conn = get_db()
        manifest = compile_and_push(conn)
        print(f"[Forge] Initial compile: {manifest['modules']} modules")
        conn.close()
    except Exception as e:
        print(f"[Forge] Initial compile failed: {e}")

    # Start Flask webhook server
    # In Colab, use ngrok to expose:
    # !pip install -q pyngrok
    # from pyngrok import ngrok
    # public_url = ngrok.connect(FORGE_PORT)
    # print(f"[Forge] Public webhook URL: {public_url}")
    app.run(host="0.0.0.0", port=FORGE_PORT, debug=False)


if __name__ == "__main__":
    run_forge()
