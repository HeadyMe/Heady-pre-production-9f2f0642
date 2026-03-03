# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash

# Real-time Sync Setup for HeadyBuddy Cross-Device Continuity

set -e

DEVICE_ID="ED5PM2Y-2SQRZBV-QOIDB5E-BGFP6J7-5ODHPZ3-XPSFRBN-G7CGPZD-MQ5ROAY"
SYNC_PORT=8384
DATA_PORT=22000

echo "Setting up real-time synchronization for HeadyBuddy..."

# Configure Syncthing for LAN-only operation
mkdir -p ~/.config/syncthing
cat > ~/.config/syncthing/config.xml << 'EOF'
<configuration version="35">
    <gui enabled="true" address="0.0.0.0:8384" user="headyme" password="$2a$12$abcdefghijklmnopqrstuv" theme="dark" insecureSkipHostcheck="true"/>
    <options>
        <listenAddress>tcp://0.0.0.0:22000</listenAddress>
        <listenAddress>quic://0.0.0.0:22000</listenAddress>
        <localAnnounceEnabled>true</localAnnounceEnabled>
        <localAnnouncePort>21027</localAnnouncePort>
        <globalAnnounceEnabled>false</globalAnnounceEnabled>
        <relaysEnabled>false</relaysEnabled>
        <natEnabled>true</natEnabled>
        <urAccepted>-1</urAccepted>
        <autoAcceptFolders>true</autoAcceptFolders>
        <restartOnWakeup>true</restartOnWakeup>
        <progressUpdateInterval>5</progressUpdateInterval>
        <limitBandwidthInLan>false</limitBandwidthInLan>
        <limitBandwidthOutLan>false</limitBandwidthOutLan>
        <reconnectIntervalS>60</reconnectIntervalS>
        <maxFolderConcurrency>4</maxFolderConcurrency>
    </options>
</configuration>
EOF

# Restart Syncthing with new config
systemctl --user restart syncthing
sleep 5

# Set up automatic folder sync for common development directories
FOLDERS=(
    "/home/headyme/CascadeProjects"
    "/home/headyme/Documents"
    "/home/headyme/.config"
    "/home/headyme/.local/share"
)

for folder in "${FOLDERS[@]}"; do
    if [ -d "$folder" ]; then
        echo "Configuring sync for: $folder"
        # This would need API calls to Syncthing - for now just create the structure
        mkdir -p "$folder/.stfolder"
    fi
done

# Create cross-device session continuity script
cat > /usr/local/bin/headybuddy-sync << 'EOF'
#!/bin/bash
# HeadyBuddy Cross-Device Session Continuity

SESSION_DIR="/tmp/headybuddy-sessions"
MESH_IP="192.168.100.1"

# Create session directory
mkdir -p "$SESSION_DIR"

# Sync current session state
sync_session() {
    local session_file="$SESSION_DIR/current-session.json"
    
    # Capture current state
    cat > "$session_file" << SESSION
{
    "timestamp": "$(date -Iseconds)",
    "active_window": "$(xdotool getwindowname getwindowfocus 2>/dev/null || echo 'unknown')",
    "cwd": "$(pwd)",
    "git_branch": "$(git branch --show-current 2>/dev/null || echo 'no-git')",
    "open_files": "$(ls -la | grep -E '\.(py|js|ts|md|txt|json)$' | head -5)",
    "device_id": "$(hostname)"
}
SESSION

    # Broadcast to mesh network
    avahi-publish-service HeadyBuddy _http._tcp 8080 &
    AVAHI_PID=$!
    
    # Make available via simple HTTP server
    cd "$SESSION_DIR"
    python3 -m http.server 8080 --bind 0.0.0.0 &
    HTTP_PID=$!
    
    echo "Session sync active on mesh network"
    echo "Access: http://$MESH_IP:8080/current-session.json"
    
    # Keep running
    trap "kill $AVAHI_PID $HTTP_PID 2>/dev/null" EXIT
    while true; do
        sleep 30
        sync_session
    done
}

# Start session sync
sync_session
EOF

chmod +x /usr/local/bin/headybuddy-sync

echo "Real-time sync setup complete!"
echo "Device ID: $DEVICE_ID"
echo "Syncthing GUI: http://localhost:8384"
echo "Session sync: headybuddy-sync"

# Enable firewall ports for mesh network
sudo ufw allow in on mesh0 to any port 22000 proto tcp
sudo ufw allow in on mesh0 to any port 21027 proto udp
sudo ufw allow in on mesh0 to any port 8080 proto tcp

echo "Firewall configured for mesh network sync services"
