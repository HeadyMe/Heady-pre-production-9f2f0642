#!/bin/bash

# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: deploy-ultimate-heady.sh                                   ║
# ║  UPDATED: 20260218-211102                                            ║
# ╚══════════════════════════════════════════════════════════════════╝

# ✅ SCANNED: 20260218-211102
# 🔍 INSPECTED: All content reviewed
# 🏷️  BRANDED: Heady Systems branding applied
# 📊 STATUS: Fully compliant with HCFP Full Auto Mode

#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# 🚀 ULTIMATE HEADY DEPLOYMENT: Socratic + Multi-LLM + All Nodes
# ═══════════════════════════════════════════════════════════════
# Ryzen 9 + 32GB RAM optimized deployment

set -e

echo "🧠 ULTIMATE HEADY DEPLOYMENT: Socratic + Multi-LLM + All Nodes"
echo "=============================================================="
echo "Hardware: Ryzen 9 + 32GB RAM"
echo "Features: Socratic questioning, Multi-LLM orchestration, All 20+ nodes"
echo ""

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
npm install @anthropic-ai/sdk @google/generative-ai openai node-fetch

# Step 2: Install Ollama models (if not already installed)
echo "🤖 Installing Ollama models..."
if command -v ollama &> /dev/null; then
    echo "Ollama is installed, pulling models..."
    ollama pull llama3.2:8b
    ollama pull codellama:13b
    ollama pull mistral:7b
    ollama pull nomic-embed-text
else
    echo "⚠️  Ollama not found. Please install Ollama first:"
    echo "curl -fsSL https://ollama.ai/install.sh | sh"
    exit 1
fi

# Step 3: Verify node files exist
echo "🔍 Verifying Socratic and Multi-LLM nodes..."
if [ ! -f "src/nodes/socrates.js" ]; then
    echo "❌ SOCRATES node not found"
    exit 1
fi

if [ ! -f "src/nodes/conductor.js" ]; then
    echo "❌ CONDUCTOR node not found"
    exit 1
fi

if [ ! -f "src/orchestration/all-node-orchestrator.js" ]; then
    echo "❌ All-Node Orchestrator not found"
    exit 1
fi

# Step 4: Create environment configuration
echo "⚙️  Creating environment configuration..."
cat > .env.ultimate << 'EOF'
# ===== HEADY CORE =====
PORT=3310
NODE_ENV=production
DATABASE_URL=postgresql://heady:${DB_PASSWORD}@db.headysystems.com:5432/heady
HEADY_API_KEY=${HEADY_SECRET_API_KEY}

# ===== SOCRATIC MODE =====
SOCRATIC_MODE=true
SOCRATIC_MIN_QUESTIONS=2
SOCRATIC_MAX_QUESTIONS=5

# ===== ALL AI PROVIDERS =====
# OpenAI
OPENAI_API_KEY=${OPENAI_KEY}

# Anthropic (Claude)
ANTHROPIC_API_KEY=${ANTHROPIC_KEY}

# Google (Gemini)
GOOGLE_API_KEY=${GOOGLE_AI_KEY}

# Goose
GOOSE_API_URL=https://api.goose.ai/v1
GOOSE_API_KEY=${GOOSE_KEY}

# Yandex
YANDEX_API_KEY=${YANDEX_KEY}
YANDEX_FOLDER_ID=${YANDEX_FOLDER}

# Hugging Face
HF_TOKEN=${HEADY_HF_TOKEN}

# Ollama (Local)
OLLAMA_URL=https://ollama.headysystems.com

# ===== CONDUCTOR ORCHESTRATION =====
CONDUCTOR_DEFAULT_STRATEGY=consensus
CONDUCTOR_AUTO_SELECT_PROVIDERS=true
CONDUCTOR_FALLBACK_CHAIN=claude,gemini,ollama

# ===== NODE ACTIVATION (ALL NODES) =====
JULES_ENABLED=true
OBSERVER_ENABLED=true
BUILDER_ENABLED=true
ATLAS_ENABLED=true
PYTHIA_ENABLED=true
MURPHY_ENABLED=true
SASHA_ENABLED=true
SENTINEL_ENABLED=true
SCOUT_ENABLED=true
MUSE_ENABLED=true
CIPHER_ENABLED=true
SOPHIA_ENABLED=true
JANITOR_ENABLED=true
BRIDGE_ENABLED=true
NOVA_ENABLED=true
OCULUS_ENABLED=true
LENS_ENABLED=true
MEMORY_ENABLED=true
BRAIN_ENABLED=true
CONDUCTOR_ENABLED=true
SOCRATES_ENABLED=true

# ===== RYZEN 9 OPTIMIZATIONS =====
NODE_OPTIONS=--max-old-space-size=8192
UV_THREADPOOL_SIZE=8
OLLAMA_NUM_THREADS=8
EOF

echo "✅ Environment configuration created"
echo "⚠️  Please edit .env.ultimate with your actual API keys"

# Step 5: Initialize all nodes
echo "🔄 Initializing all nodes..."
curl -X POST http://manager.headyme.com/api/all-nodes/initialize \
  -H "Content-Type: application/json" \
  -d '{}' 2>/dev/null || echo "⚠️  Manager not running - will initialize on startup"

# Step 6: Start enhanced Heady Manager
echo "🎯 Starting Heady Manager with Socratic + Multi-LLM..."
if [ -f "docker-compose.performance.yml" ]; then
    echo "🐳 Using Docker Compose performance configuration"
    docker-compose -f docker-compose.performance.yml up -d
else
    echo "🔧 Starting Node.js service directly"
    NODE_ENV=production npm start
fi

# Step 7: Health check
echo "🏥 Running health check..."
sleep 5

# Check if manager is running
if curl -sf http://manager.headyme.com/api/health > /dev/null 2>&1; then
    echo "✅ Heady Manager is healthy"
    
    # Check Socratic endpoint
    if curl -sf http://manager.headyme.com/api/socratic/status > /dev/null 2>&1; then
        echo "✅ SOCRATES node is active"
    else
        echo "⚠️  SOCRATES node may need initialization"
    fi
    
    # Check Conductor endpoint
    if curl -sf http://manager.headyme.com/api/conductor/status > /dev/null 2>&1; then
        echo "✅ CONDUCTOR node is active"
    else
        echo "⚠️  CONDUCTOR node may need initialization"
    fi
    
    # Check All-Nodes endpoint
    if curl -sf http://manager.headyme.com/api/all-nodes/status > /dev/null 2>&1; then
        echo "✅ All-Node Orchestrator is active"
    else
        echo "⚠️  All-Node Orchestrator may need initialization"
    fi
    
else
    echo "❌ Heady Manager is not responding"
    echo "Please check logs and try again"
    exit 1
fi

echo ""
echo "✅ ULTIMATE HEADY DEPLOYMENT COMPLETE!"
echo ""
echo "🧠 Test Socratic interaction:"
echo "curl -X POST http://manager.headyme.com/api/socratic/question \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"request\": \"Deploy my app to production\"}'"
echo ""
echo "🎼 Test multi-LLM consensus:"
echo "curl -X POST http://manager.headyme.com/api/conductor/orchestrate \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"task\": \"Explain quantum computing\", \"strategy\": \"consensus\"}'"
echo ""
echo "🔗 Test all-node collaboration:"
echo "curl -X POST http://manager.headyme.com/api/all-nodes/process \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"request\": \"Analyze my codebase for security issues\"}'"
echo ""
echo "📊 Check system status:"
echo "curl http://manager.headyme.com/api/health"
echo ""
echo "🎯 Your Ryzen 9 + 32GB RAM system is now running the complete Heady AI orchestra!"
