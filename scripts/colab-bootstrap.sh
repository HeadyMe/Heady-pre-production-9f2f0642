#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# 🐝 Heady Colab Bootstrap — GPU Runtime Setup
# Run this cell first in Colab to start Heady on GPU
# ═══════════════════════════════════════════════════════════════════

echo "🐝 Heady GPU Runtime — Bootstrapping..."

# Check GPU availability
python3 -c "import torch; print(f'✅ GPU: {torch.cuda.get_device_name(0)} ({torch.cuda.get_device_properties(0).total_mem / 1024**3:.1f} GB)')" 2>/dev/null || echo "⚠ No GPU detected — running on CPU"

# Install Node.js 22
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - 2>/dev/null
    sudo apt-get install -y nodejs 2>/dev/null
fi
echo "✅ Node.js $(node -v)"

# Clone Heady if not present
HEADY_DIR="/content/heady"
if [ ! -d "$HEADY_DIR" ]; then
    git clone https://github.com/HeadyMe/Heady-pre-production-9f2f0642.git "$HEADY_DIR" 2>/dev/null
fi
cd "$HEADY_DIR"

# Install dependencies
npm install --production 2>/dev/null

# Install GPU-specific packages
npm install @ngrok/ngrok 2>/dev/null || true

# Install Python GPU embedding server
pip install sentence-transformers torch --quiet 2>/dev/null

echo ""
echo "🐝 Heady GPU Runtime ready!"
echo "   Run the next cell to start the system."
