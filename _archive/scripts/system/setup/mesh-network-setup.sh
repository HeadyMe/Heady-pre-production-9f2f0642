# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash

# Mesh Network Setup Script
# Creates a wireless mesh network for real-time device synchronization

set -e

MESH_SSID="HeadyMesh"
MESH_CHANNEL=6
MESH_FREQ=2437

echo "Setting up mesh network: $MESH_SSID"

# Load required kernel modules
sudo modprobe mac80211_hwsim 2>/dev/null || echo "mac80211_hwsim not available, using existing hardware"

# Create mesh interface
sudo iw phy phy0 interface add mesh0 type mp
if [ $? -ne 0 ]; then
    echo "Failed to create mesh interface, trying alternative method..."
    sudo iw dev wlp3s0 interface add mesh0 type mp
fi

# Configure mesh interface
sudo ip link set mesh0 up
sudo iw dev mesh0 set channel $MESH_CHANNEL
sudo iw dev mesh0 mesh join $MESH_SSID

# Assign IP address to mesh interface
sudo ip addr add 192.168.100.1/24 dev mesh0

# Start DHCP server for mesh network
sudo systemctl stop dnsmasq 2>/dev/null || true
cat <<EOF | sudo tee /etc/dnsmasq.d/mesh.conf
interface=mesh0
dhcp-range=192.168.100.50,192.168.100.150,12h
dhcp-option=option:dns-server,192.168.100.1
server=8.8.8.8
server=1.1.1.1
EOF

sudo systemctl start dnsmasq

# Enable IP forwarding for internet sharing
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf

# Set up NAT if internet sharing is needed
sudo iptables -t nat -A POSTROUTING -o wlp3s0 -j MASQUERADE 2>/dev/null || true

echo "Mesh network setup complete!"
echo "Mesh SSID: $MESH_SSID"
echo "Mesh IP: 192.168.100.1"
echo "Other devices should connect to mesh and will get IPs 192.168.100.50-150"

# Enable mDNS for device discovery
sudo systemctl restart avahi-daemon

echo "mDNS service enabled for device discovery"
