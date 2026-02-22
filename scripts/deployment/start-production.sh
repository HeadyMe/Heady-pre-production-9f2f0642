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
# ║  FILE: start-production.sh                                   ║
# ║  UPDATED: 20260218-211102                                            ║
# ╚══════════════════════════════════════════════════════════════════╝

# ✅ SCANNED: 20260218-211102
# 🔍 INSPECTED: All content reviewed
# 🏷️  BRANDED: Heady Systems branding applied
# 📊 STATUS: Fully compliant with HCFP Full Auto Mode

#!/bin/bash

echo "🚀 Starting Heady Production Services"
echo "===================================="

# Start with Docker Compose
cd /home/headyme/CascadeProjects/Heady
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check production domains
echo "🌐 Checking production domains..."
curl -s https://headysystems.com/health || echo "❌ Main domain not responding"
curl -s https://manager.headysystems.com/api/health || echo "❌ Manager domain not responding"

echo "✅ Production services started"
echo "🌐 Access at: https://headysystems.com"
echo "🎛️ Manager at: https://manager.headysystems.com"
