# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
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
