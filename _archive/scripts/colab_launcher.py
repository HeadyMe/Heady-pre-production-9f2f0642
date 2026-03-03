#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════
🐝 Heady GPU Runtime — Colab Launcher
═══════════════════════════════════════════════════════════════════

Run this script in a Colab notebook cell to start the full Heady
system on GPU with all 3 accounts wired.

Usage in Colab:
    !python3 /content/heady/scripts/colab_launcher.py

Or paste into a cell:
    %run /content/heady/scripts/colab_launcher.py
"""

import os
import sys
import subprocess
import json
import time
import threading

# ═══════════════════════════════════════════════════════════════════
# CONFIGURATION — All 3 Heady Accounts
# ═══════════════════════════════════════════════════════════════════

HEADY_ACCOUNTS = {
    "HeadySystems": {
        "org": "HeadySystems",
        "domain": "headysystems.com",
        "hf_space": "HeadySystems/heady-gpu-runtime",
        "role": "Core infrastructure, system operations, GPU compute",
    },
    "HeadyConnection": {
        "org": "HeadyConnection",
        "domain": "headyconnection.com",
        "hf_space": "HeadyConnection/heady-connection-hub",
        "role": "Cross-device sync, communication layer, connection hub",
    },
    "HeadyMe": {
        "org": "HeadyMe",
        "domain": "headyme.com",
        "hf_space": "HeadyMe/heady-personal",
        "role": "Personal AI, user-facing, Buddy agent, chat interface",
    },
}

HEADY_DOMAINS = [
    "headyme.com",
    "headyconnection.com",
    "headyai.com",
    "headysystems.com",
    "headymcp.com",
]

# ═══════════════════════════════════════════════════════════════════
# GPU DETECTION
# ═══════════════════════════════════════════════════════════════════

def detect_gpu():
    """Detect available GPU and its capabilities."""
    try:
        import torch
        if torch.cuda.is_available():
            props = torch.cuda.get_device_properties(0)
            return {
                "available": True,
                "name": props.name,
                "total_mem_gb": round(props.total_mem / 1024**3, 1),
                "compute_capability": f"{props.major}.{props.minor}",
                "device": "cuda",
            }
    except ImportError:
        pass
    return {"available": False, "device": "cpu"}


# ═══════════════════════════════════════════════════════════════════
# SETUP & INSTALL
# ═══════════════════════════════════════════════════════════════════

def setup_environment():
    """Install all dependencies for GPU-accelerated Heady."""
    print("🐝 ═══ Heady GPU Runtime Setup ═══")
    print()

    # 1. GPU Status
    gpu = detect_gpu()
    if gpu["available"]:
        print(f"✅ GPU: {gpu['name']} ({gpu['total_mem_gb']} GB, compute {gpu['compute_capability']})")
    else:
        print("⚠ No GPU detected — using CPU (slower embeddings)")
    print()

    # 2. Node.js
    node_check = subprocess.run(["node", "-v"], capture_output=True, text=True)
    if node_check.returncode != 0:
        print("📦 Installing Node.js 22...")
        subprocess.run(
            "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs",
            shell=True, capture_output=True,
        )
    print(f"✅ Node.js {subprocess.run(['node', '-v'], capture_output=True, text=True).stdout.strip()}")

    # 3. Clone/update Heady
    heady_dir = "/content/heady"
    if not os.path.exists(heady_dir):
        print("📦 Cloning Heady...")
        subprocess.run(
            f"git clone https://github.com/HeadyMe/Heady-pre-production-9f2f0642.git {heady_dir}",
            shell=True, capture_output=True,
        )
    else:
        print("📦 Updating Heady...")
        subprocess.run("git pull", shell=True, capture_output=True, cwd=heady_dir)
    print(f"✅ Heady codebase at {heady_dir}")

    # 4. npm install
    print("📦 Installing npm dependencies...")
    subprocess.run("npm install --production", shell=True, capture_output=True, cwd=heady_dir)
    print("✅ npm dependencies installed")

    # 5. Python GPU packages
    print("📦 Installing GPU embedding packages...")
    subprocess.run(
        "pip install -q sentence-transformers torch",
        shell=True, capture_output=True,
    )
    print("✅ sentence-transformers + torch installed")

    # 6. ngrok for external access
    subprocess.run("pip install -q pyngrok", shell=True, capture_output=True)
    subprocess.run("npm install @ngrok/ngrok 2>/dev/null", shell=True, capture_output=True, cwd=heady_dir)

    print()
    print("🐝 ═══ Setup Complete ═══")
    return gpu


# ═══════════════════════════════════════════════════════════════════
# GPU EMBEDDING SERVER
# ═══════════════════════════════════════════════════════════════════

def start_embedding_server():
    """Start the GPU embedding server in a background thread."""
    def run_server():
        subprocess.run(
            [sys.executable, "scripts/gpu_embedding_server.py"],
            cwd="/content/heady",
        )

    thread = threading.Thread(target=run_server, daemon=True)
    thread.start()
    time.sleep(5)  # Wait for model to load

    # Verify it's running
    import urllib.request
    try:
        resp = urllib.request.urlopen("http://localhost:9384/health", timeout=5)
        data = json.loads(resp.read())
        print(f"✅ GPU Embedding Server: {data.get('device', '?')} | {data.get('model', '?')}")
        return True
    except Exception as e:
        print(f"⚠ Embedding server not ready: {e}")
        return False


# ═══════════════════════════════════════════════════════════════════
# HEADY MANAGER — GPU MODE
# ═══════════════════════════════════════════════════════════════════

def start_heady_manager(ngrok_token=None):
    """Start heady-manager in GPU mode with all 3 accounts wired."""
    heady_dir = "/content/heady"

    # Environment for GPU mode
    env = os.environ.copy()
    env.update({
        "NODE_ENV": "production",
        "PORT": "8080",
        "HEADY_GPU": "true",
        "HEADY_EMBEDDING_URL": "http://localhost:9384",
        "HEADY_EMBEDDING_BATCH": "64",
        # Wire all 3 accounts
        "HEADY_ACCOUNT_SYSTEMS": "HeadySystems",
        "HEADY_ACCOUNT_CONNECTION": "HeadyConnection",
        "HEADY_ACCOUNT_ME": "HeadyMe",
        # Domains
        "HEADY_DOMAINS": ",".join(HEADY_DOMAINS),
        # HuggingFace Spaces
        "HF_SPACE_SYSTEMS": HEADY_ACCOUNTS["HeadySystems"]["hf_space"],
        "HF_SPACE_CONNECTION": HEADY_ACCOUNTS["HeadyConnection"]["hf_space"],
        "HF_SPACE_ME": HEADY_ACCOUNTS["HeadyMe"]["hf_space"],
    })

    # Add secrets from Colab if available
    try:
        from google.colab import userdata
        secrets = [
            "HF_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
            "GOOGLE_AI_API_KEY", "PERPLEXITY_API_KEY", "MISTRAL_API_KEY",
            "DEEPSEEK_API_KEY", "GROQ_API_KEY", "CLOUDFLARE_API_TOKEN",
            "NGROK_TOKEN",
        ]
        for s in secrets:
            try:
                val = userdata.get(s)
                if val:
                    env[s] = val
                    print(f"  🔑 {s}: loaded from Colab secrets")
            except Exception:
                pass

        if not ngrok_token:
            try:
                ngrok_token = userdata.get("NGROK_TOKEN")
            except Exception:
                pass
    except ImportError:
        print("  ⚠ Not running in Colab — secrets not auto-loaded")

    if ngrok_token:
        env["NGROK_TOKEN"] = ngrok_token

    # Start heady-manager
    print()
    print("🐝 Starting Heady Manager (GPU Mode)...")
    print(f"   Accounts: {', '.join(HEADY_ACCOUNTS.keys())}")
    print(f"   Domains: {', '.join(HEADY_DOMAINS)}")
    print()

    process = subprocess.Popen(
        ["node", "heady-manager.js"],
        cwd=heady_dir,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    # Stream output for 10 seconds to show boot sequence
    import select
    start = time.time()
    while time.time() - start < 10:
        if process.stdout.readable():
            line = process.stdout.readline()
            if line:
                print(line.decode().rstrip())
        time.sleep(0.1)

    # Setup ngrok tunnel
    public_url = None
    if ngrok_token:
        try:
            from pyngrok import ngrok as pyngrok
            pyngrok.set_auth_token(ngrok_token)
            tunnel = pyngrok.connect(8080, "http")
            public_url = tunnel.public_url
            print(f"\n🌐 Heady is LIVE at: {public_url}")
            print(f"   Deep Research: {public_url}/api/buddy/deep-research")
            print(f"   Device Sync:   {public_url}/ws/sync")
            print(f"   Health:        {public_url}/api/pulse")
        except Exception as e:
            print(f"⚠ ngrok tunnel failed: {e}")

    print()
    print("═══════════════════════════════════════════════════════════")
    print("🐝 Heady GPU Runtime — ACTIVE")
    print(f"   Local:  http://localhost:8080")
    if public_url:
        print(f"   Public: {public_url}")
    print(f"   GPU:    {'CUDA' if detect_gpu()['available'] else 'CPU'}")
    print(f"   Accounts: HeadySystems + HeadyConnection + HeadyMe")
    print("═══════════════════════════════════════════════════════════")

    return process, public_url


# ═══════════════════════════════════════════════════════════════════
# DEEP RESEARCH — Direct GPU Call
# ═══════════════════════════════════════════════════════════════════

def deep_research(query, base_url="http://localhost:8080"):
    """Run deep research through the local GPU-powered Heady instance."""
    import urllib.request

    payload = json.dumps({
        "message": f"[DEEP RESEARCH] {query}",
        "model": "auto",
        "no_cache": True,
    }).encode()

    req = urllib.request.Request(
        f"{base_url}/api/brain/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
    )

    try:
        resp = urllib.request.urlopen(req, timeout=120)
        data = json.loads(resp.read())
        return data
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ═══════════════════════════════════════════════════════════════════
# MAIN — Full Boot Sequence
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("🐝 ═══════════════════════════════════════════════════════")
    print("🐝  HEADY GPU RUNTIME — Sacred Geometry :: Organic Systems")
    print("🐝  Accounts: HeadySystems + HeadyConnection + HeadyMe")
    print("🐝 ═══════════════════════════════════════════════════════")
    print()

    # 1. Setup
    gpu = setup_environment()
    print()

    # 2. Start GPU embedding server
    print("🧠 Starting GPU Embedding Server...")
    start_embedding_server()
    print()

    # 3. Start Heady Manager
    process, url = start_heady_manager()

    # 4. Keep running
    print("\n💡 Use deep_research('your query') to run deep research")
    print("💡 Or call the API directly at the URL above")
    print("💡 Press Ctrl+C or interrupt the cell to stop\n")

    try:
        process.wait()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down Heady GPU Runtime...")
        process.terminate()
