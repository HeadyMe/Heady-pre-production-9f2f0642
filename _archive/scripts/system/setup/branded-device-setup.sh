# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash

# Branded Device ID Setup for HeadyBuddy Sync Network
# Creates human-readable, branded device identifiers

set -e

echo "Setting up branded device IDs for HeadyBuddy network..."

# Define branded device configurations
declare -A DEVICES=(
    ["primary"]="HeadyBuddy-Primary"
    ["laptop"]="HeadyBuddy-Laptop" 
    ["desktop"]="HeadyBuddy-Desktop"
    ["tablet"]="HeadyBuddy-Tablet"
    ["phone"]="HeadyBuddy-Phone"
    ["server"]="HeadyBuddy-Server"
    ["dev"]="HeadyBuddy-Dev"
    ["work"]="HeadyBuddy-Work"
)

# Function to generate branded device ID
generate_branded_id() {
    local device_name="$1"
    local hostname="$2"
    
    # Create a deterministic but branded-looking ID
    local seed="${device_name}-${hostname}-$(date +%Y%m%d)"
    local hash=$(echo -n "$seed" | sha256sum | cut -c1-32)
    
    # Format as Syncthing-style ID with branded prefix
    local branded_id="HEADY-${hash:0:7}-${hash:7:7}-${hash:14:7}-${hash:21:7}-${hash:28:4}"
    
    echo "$branded_id"
}

# Get current hostname
CURRENT_HOST=$(hostname)
CURRENT_DEVICE="primary"

# Generate branded ID for this device
BRANDED_ID=$(generate_branded_id "$CURRENT_DEVICE" "$CURRENT_HOST")

echo "Current device branded ID: $BRANDED_ID"

# Update Syncthing configuration with branded ID
cat > ~/.config/syncthing/config.xml << EOF
<configuration version="35">
    <gui enabled="true" address="0.0.0.0:8384" user="headyme" password="\$2a\$12\$abcdefghijklmnopqrstuv" theme="dark" insecureSkipHostcheck="true"/>
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
    <device id="$BRANDED_ID" name="HeadyBuddy Primary" compression="metadata">
        <address>tcp://192.168.100.1:22000</address>
        <address>quic://192.168.100.1:22000</address>
    </device>
</configuration>
EOF

# Create device registry for easy management
cat > ~/.config/syncthing/device-registry.json << EOF
{
    "network_name": "HeadyBuddy Sync Network",
    "created": "$(date -Iseconds)",
    "devices": {
EOF

# Add all predefined devices to registry
first=true
for device_key in "${!DEVICES[@]}"; do
    device_name="${DEVICES[$device_key]}"
    device_id=$(generate_branded_id "$device_key" "$device_name")
    
    if [ "$first" = true ]; then
        first=false
    else
        echo "," >> ~/.config/syncthing/device-registry.json
    fi
    
    cat >> ~/.config/syncthing/device-registry.json << EOF
        "$device_key": {
            "name": "$device_name",
            "id": "$device_id",
            "type": "$device_key",
            "status": "pending"
        }
EOF
done

cat >> ~/.config/syncthing/device-registry.json << EOF
    },
    "folders": {
        "CascadeProjects": {
            "path": "/home/headyme/CascadeProjects",
            "devices": ["primary", "laptop", "desktop", "dev"],
            "auto_accept": true
        },
        "Documents": {
            "path": "/home/headyme/Documents", 
            "devices": ["primary", "laptop", "tablet", "phone"],
            "auto_accept": true
        },
        "Config": {
            "path": "/home/headyme/.config",
            "devices": ["primary", "laptop", "desktop"],
            "auto_accept": true
        },
        "UserData": {
            "path": "/home/headyme/.local/share",
            "devices": ["primary", "laptop", "desktop"],
            "auto_accept": true
        }
    }
}
EOF

# Create device setup script for other devices
cat > ~/setup-new-device.sh << 'EOF'
#!/bin/bash

# Setup script for adding new devices to HeadyBuddy network

if [ $# -eq 0 ]; then
    echo "Usage: $0 <device-type>"
    echo "Device types: primary, laptop, desktop, tablet, phone, server, dev, work"
    exit 1
fi

DEVICE_TYPE="$1"
DEVICE_NAME="HeadyBuddy-${DEVICE_TYPE^}"

echo "Setting up $DEVICE_NAME on this device..."

# Install Syncthing if not present
if ! command -v syncthing &> /dev/null; then
    echo "Installing Syncthing..."
    sudo apt update && sudo apt install -y syncthing
fi

# Generate device ID
HOSTNAME=$(hostname)
SEED="${DEVICE_TYPE}-${HOSTNAME}-$(date +%Y%m%d)"
HASH=$(echo -n "$SEED" | sha256sum | cut -c1-32)
DEVICE_ID="HEADY-${HASH:0:7}-${HASH:7:7}-${HASH:14:7}-${HASH:21:7}-${HASH:28:4}"

echo "Device ID: $DEVICE_ID"

# Create basic config
mkdir -p ~/.config/syncthing
cat > ~/.config/syncthing/config.xml << CONFIG
<configuration version="35">
    <gui enabled="true" address="0.0.0.0:8384" theme="dark"/>
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
    <device id="$DEVICE_ID" name="$DEVICE_NAME" compression="metadata">
        <address>dynamic</address>
    </device>
</configuration>
CONFIG

# Enable and start Syncthing
systemctl --user enable syncthing
systemctl --user restart syncthing

echo ""
echo "✅ $DEVICE_NAME setup complete!"
echo "Device ID: $DEVICE_ID"
echo "Web GUI: http://localhost:8384"
echo ""
echo "Next steps:"
echo "1. Connect to HeadyBuddySync WiFi network"
echo "2. Open http://192.168.100.1:8384 on primary device"
echo "3. Add this device ID: $DEVICE_ID"
echo "4. Select folders to sync"
EOF

chmod +x ~/setup-new-device.sh

# Update continuity service with branded IDs
cat > /tmp/branded-continuity.py << 'EOF'
#!/usr/bin/env python3
import json
import time
import requests
import subprocess
from datetime import datetime

class BrandedSessionSync:
    def __init__(self, device_type="primary"):
        self.device_type = device_type
        self.device_name = f"HeadyBuddy-{device_type.title()}"
        self.session_data = {}
        
    def capture_current_session(self):
        try:
            active_window = subprocess.check_output(['xdotool', 'getwindowname', 'getwindowfocus'], stderr=subprocess.DEVNULL).decode().strip()
        except:
            active_window = "unknown"
            
        try:
            cwd = subprocess.check_output(['pwd']).decode().strip()
        except:
            cwd = "unknown"
            
        try:
            git_branch = subprocess.check_output(['git', 'branch', '--show-current'], stderr=subprocess.DEVNULL).decode().strip()
        except:
            git_branch = "no-git"
            
        self.session_data = {
            'timestamp': datetime.now().isoformat(),
            'device_name': self.device_name,
            'device_type': self.device_type,
            'active_window': active_window,
            'cwd': cwd,
            'git_branch': git_branch,
            'hostname': subprocess.check_output(['hostname']).decode().strip(),
            'network': 'HeadyBuddy Sync Network'
        }
        
        return self.session_data
        
    def start_sync_loop(self):
        while True:
            session = self.capture_current_session()
            print(f"[{self.device_name}] Session: {session['active_window']} in {session['cwd']}")
            time.sleep(30)

if __name__ == '__main__':
    import sys
    device_type = sys.argv[1] if len(sys.argv) > 1 else "primary"
    sync = BrandedSessionSync(device_type)
    print(f"Starting {sync.device_name} session sync...")
    sync.start_sync_loop()
EOF

chmod +x /tmp/branded-continuity.py

# Restart services with new configuration
systemctl --user restart syncthing
sleep 3

echo ""
echo "🎯 Branded Device Setup Complete!"
echo ""
echo "Primary Device ID: $BRANDED_ID"
echo "Device Name: HeadyBuddy Primary"
echo ""
echo "Device Registry Created: ~/.config/syncthing/device-registry.json"
echo ""
echo "To add new devices:"
echo "1. Copy ~/setup-new-device.sh to new device"
echo "2. Run: ./setup-new-device.sh <device-type>"
echo "3. Connect devices and add IDs in Syncthing GUI"
echo ""
echo "Available device types: primary, laptop, desktop, tablet, phone, server, dev, work"
