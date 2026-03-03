# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash

# Alternative Mesh Network Setup using WiFi Direct/Hotspot
# Creates a local network for device synchronization when mesh mode isn't supported

set -e

HOTSPOT_SSID="HeadyBuddySync"
HOTSPOT_PASS="headybuddy2026"
HOTSPOT_IP="192.168.100.1"

echo "Setting up WiFi Hotspot for device sync..."

# Stop conflicting services
sudo systemctl stop hostapd 2>/dev/null || true
sudo systemctl stop dnsmasq 2>/dev/null || true

# Create hotspot configuration
sudo mkdir -p /etc/hostapd
cat << EOF | sudo tee /etc/hostapd/hostapd.conf
interface=wlp3s0
driver=nl80211
ssid=$HOTSPOT_SSID
hw_mode=g
channel=6
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=$HOTSPOT_PASS
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
EOF

# Configure DHCP server
sudo mkdir -p /etc/dnsmasq.d
cat << EOF | sudo tee /etc/dnsmasq.d/headybuddy.conf
interface=wlp3s0
dhcp-range=192.168.100.50,192.168.100.150,12h
dhcp-option=option:dns-server,192.168.100.1
server=8.8.8.8
server=1.1.1.1
listen-address=192.168.100.1
bind-interfaces
EOF

# Configure network interface
sudo ip addr add $HOTSPOT_IP/24 dev wlp3s0 2>/dev/null || true

# Enable IP forwarding
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -w net.ipv4.ip_forward=1

# Set up NAT for internet sharing
sudo iptables -t nat -A POSTROUTING -o eno1 -j MASQUERADE 2>/dev/null || true
sudo iptables -t nat -A POSTROUTING -o enp1s0 -j MASQUERADE 2>/dev/null || true

# Start services
sudo systemctl unmask hostapd
sudo systemctl enable hostapd
sudo systemctl start hostapd

sudo systemctl restart dnsmasq

echo "WiFi Hotspot setup complete!"
echo "SSID: $HOTSPOT_SSID"
echo "Password: $HOTSPOT_PASS"
echo "Gateway IP: $HOTSPOT_IP"
echo "DHCP Range: 192.168.100.50-150"

# Test connectivity
sleep 5
if ping -c 1 $HOTSPOT_IP >/dev/null 2>&1; then
    echo "✓ Hotspot is working"
else
    echo "✗ Hotspot setup failed - check hardware support"
fi

# Enable firewall rules
sudo ufw allow in on wlp3s0 to any port 22000 proto tcp
sudo ufw allow in on wlp3s0 to any port 21027 proto udp
sudo ufw allow in on wlp3s0 to any port 8080 proto tcp
sudo ufw allow in on wlp3s0 to any port 53 proto udp
sudo ufw allow in on wlp3s0 to any port 67 proto udp

echo "Firewall configured for hotspot services"
