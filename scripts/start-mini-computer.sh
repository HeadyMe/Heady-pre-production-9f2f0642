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
# ║  FILE: start-mini-computer.sh                                   ║
# ║  UPDATED: 20260218-211102                                            ║
# ╚══════════════════════════════════════════════════════════════════╝

# ✅ SCANNED: 20260218-211102
# 🔍 INSPECTED: All content reviewed
# 🏷️  BRANDED: Heady Systems branding applied
# 📊 STATUS: Fully compliant with HCFP Full Auto Mode

#!/bin/bash

# HeadySystems Mini Computer Services Starter

echo "🚀 Starting HeadySystems services on mini computer..."

# Check if mini computer is accessible
if ! ping -c 1 heady-mini.local >/dev/null 2>&1; then
    echo "❌ Mini computer not reachable at heady-mini.local"
    echo "🔧 Check network connection and hostname"
    exit 1
fi

echo "✅ Mini computer reachable"

# Start database services
echo "📊 Starting databases..."
docker-compose -f docker-compose.mini-computer.yml up -d postgres redis

# Wait for databases
echo "⏳ Waiting for databases to be ready..."
sleep 10

# Start API service
echo "🔌 Starting API service..."
docker-compose -f docker-compose.mini-computer.yml up -d api

# Start web service
echo "🌐 Starting web service..."
docker-compose -f docker-compose.mini-computer.yml up -d web

# Start CMS (Drupal)
echo "📋 Starting CMS (Drupal)..."
docker-compose -f docker-compose.mini-computer.yml up -d cms

echo "✅ All services started!"
echo "🌐 Web: http://heady-mini.local:3000"
echo "🔌 API: http://heady-mini.local:3300"
echo "📋 CMS: http://heady-mini.local:8080"
echo "📊 Health: http://heady-mini.local:3300/health"
