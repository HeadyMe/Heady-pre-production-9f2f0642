# Heady™ 3-Node Colab Pro+ Quick Start

## Setup (All Nodes)

In each Colab notebook, run these setup cells first:

```python
# Cell 1: Install dependencies
!pip install -q psycopg2-binary openai numpy requests python-dotenv

# Cell 2: Set environment variables
import os
os.environ["DATABASE_URL"] = "postgresql://neondb_owner:npg_tEA7FfeWb5gZ@ep-cold-snow-aesmiwt9.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"
os.environ["OPENAI_API_KEY"] = "sk-proj-..."        # Your OpenAI key
os.environ["UPSTASH_REDIS_REST_URL"] = "https://..."  # Upstash REST URL
os.environ["UPSTASH_REDIS_REST_TOKEN"] = "..."         # Upstash token
```

## Node 1: The Overmind (Tab 1)

```python
# Cell 3: Clone and run
!git clone https://github.com/HeadyMe/Heady-pre-production-9f2f0642.git heady 2>/dev/null || true
%run heady/colab/node1_overmind.py
```

**What it does:** Monitors pgvector every 60s, detects semantic drift, re-embeds stale AST nodes, dispatches tasks to Node 2.

## Node 2: The Forge (Tab 2)

```python
# Additional Cell: Install Flask + ngrok
!pip install -q flask pyngrok

# Cell 3: Clone and run
!git clone https://github.com/HeadyMe/Heady-pre-production-9f2f0642.git heady 2>/dev/null || true

# Expose webhook via ngrok
from pyngrok import ngrok
public_url = ngrok.connect(5000)
print(f"🔗 Forge webhook URL: {public_url}")
print(f"   Set this as FORGE_WEBHOOK_URL in Node 1")

import os
os.environ["GITHUB_TOKEN"] = "ghp_..."  # Your GitHub PAT
os.environ["GITHUB_REPO"] = "HeadyMe/Heady-pre-production-9f2f0642"

%run heady/colab/node2_forge.py
```

**What it does:** Runs Flask webhook server, syncs GitHub↔pgvector, compiles AST bundles, purges Cloudflare edge cache.

## Node 3: The Edge (Tab 3)

```python
# Additional Cell: Install market libs
!pip install -q pandas

# Cell 3: Clone and run
!git clone https://github.com/HeadyMe/Heady-pre-production-9f2f0642.git heady 2>/dev/null || true
%run heady/colab/node3_edge.py
```

**What it does:** Fetches crypto/equity prices every 30s, generates momentum signals, embeds market state vectors, tracks portfolio P&L.

## Architecture

```
Node 1 (Overmind)  ──dispatch──→  Node 2 (Forge)  ──push──→  Cloudflare Edge
      ↕                                ↕                           ↕
   pgvector ←────── sync ──────→  GitHub Repo  ←──── pull ──→  User browser
      ↕
Node 3 (Edge)  ──── market data ──→  pgvector
```
