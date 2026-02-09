#!/usr/bin/env bash
# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: headybuddy/docker/startup.sh                                                    ║
# ║  LAYER: headybuddy                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
# ╔═══════════════════════════════════════════════════════════════╗
# ║  HEADY SYSTEMS — Desktop VNC Startup Script                    ║
# ╚═══════════════════════════════════════════════════════════════╝

set -e

export USER="${USER:-heady}"
export HOME="/home/${USER}"
export DISPLAY="${DISPLAY:-:1}"

# ─── Clean stale VNC locks ────────────────────────────────────────
rm -f /tmp/.X1-lock /tmp/.X11-unix/X1 2>/dev/null || true

# ─── Start VNC server ─────────────────────────────────────────────
echo "[HeadyDesktop] Starting VNC server on ${DISPLAY} at ${VNC_RESOLUTION:-1920x1080}..."
su - "${USER}" -c "vncserver ${DISPLAY} \
  -geometry ${VNC_RESOLUTION:-1920x1080} \
  -depth ${VNC_DEPTH:-24} \
  -SecurityTypes VncAuth \
  -internal.headyio.com no"

echo "[HeadyDesktop] VNC server running. noVNC on port ${NOVNC_PORT:-6080}."
echo "[HeadyDesktop] HeadyBuddy overlay will autostart with the desktop session."
echo "[HeadyDesktop] HeadyAutoIDE available on desktop."
echo ""
echo "  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗"
echo "  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝"
echo "  ███████║█████╗  ███████║██║  ██║ ╚████╔╝ "
echo "  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝  "
echo "  ██║  ██║███████╗██║  ██║██████╔╝   ██║   "
echo "  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝   "
echo ""
echo "  ∞ Desktop ready — open http://internal.headyio.com:${NOVNC_PORT:-6080}"
echo ""

# Keep container alive
tail -f /dev/null
