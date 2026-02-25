<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# 📚 HeadyBuddy Sync Network - Comprehensive Guide

## 🏗️ Architecture Overview

### System Components
```
┌─────────────────┐    WiFi Hotspot    ┌─────────────────┐
│  Primary Device │◄──────────────────►│   Other Devices │
│  (This System)  │                    │  (Laptop/Phone) │
└─────────────────┘                    └─────────────────┘
         │                                     │
         ├─ Syncthing (File Sync)              ├─ Syncthing Client
         ├─ Session Continuity Service         ├─ Session Client  
         ├─ mDNS Discovery                      ├─ mDNS Client
         ├─ HTTP API Server                    ├─ HTTP Client
         └─ DHCP Server                        └─ WiFi Client
```

### Network Topology
- **WiFi Network**: HeadyBuddySync (192.168.100.0/24)
- **Gateway**: 192.168.100.1 (Primary device)
- **DHCP Range**: 192.168.100.50-150
- **Sync Ports**: 22000 (TCP/UDP), 21027 (UDP)
- **API Port**: 8080 (HTTP)

---

## 🔧 Installation & Setup

### Prerequisites
- Linux system with WiFi capability
- sudo/administrator access
- 2GB+ free disk space

### Step 1: System Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y syncthing hostapd dnsmasq wireless-tools \
    net-tools bridge-utils python3-avahi xdotool python3-dbus

# Enable services
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon
```

### Step 2: Network Configuration
```bash
# Run mesh network setup
chmod +x ./mesh-network-setup.sh
sudo ./mesh-network-setup.sh

# If mesh mode fails, use hotspot
chmod +x ./alternative-mesh-setup.sh
sudo ./alternative-mesh-setup.sh
```

### Step 3: Branded Device Setup
```bash
# Configure branded device IDs
chmod +x ./branded-device-setup.sh
./branded-device-setup.sh
```

### Step 4: Start Services
```bash
# Start Syncthing
systemctl --user enable syncthing
systemctl --user start syncthing

# Start continuity services
headybuddy-continuity start
```

---

## 📱 Device Management

### Adding New Devices

#### Automated Setup (Recommended)
```bash
# 1. Copy setup script to new device
scp ~/setup-new-device.sh user@new-device:/home/user/

# 2. Execute setup remotely
ssh user@new-device "chmod +x setup-new-device.sh && ./setup-new-device.sh laptop"

# 3. Get device ID from output
# Device ID: HEADY-5ec81fb-829adc4-8360e38-72e57e5-c7d1
```

#### Manual Setup
1. **Install Syncthing**:
   - Linux: `sudo apt install syncthing`
   - Android: Install from F-Droid/Play Store
   - iOS: Install from App Store
   - macOS: Download from syncthing.net
   - Windows: Download from syncthing.net

2. **Connect to Network**:
   - WiFi: HeadyBuddySync
   - Password: headybuddy2026

3. **Configure Device**:
   - Open Syncthing GUI
   - Go to Actions → Show Device ID
   - Copy the ID

4. **Add to Primary**:
   - Open http://192.168.100.1:8384
   - Click "Add Remote Device"
   - Enter device ID
   - Set device name
   - Select folders to share

### Device Types & Use Cases

| Device Type | ID Pattern | Typical Use | Sync Folders |
|-------------|------------|-------------|--------------|
| **primary** | HEADY-6173... | Main workstation | All folders |
| **laptop** | HEADY-5ec8... | Portable work | Code, Documents, Config |
| **desktop** | HEADY-8cf0... | Office workstation | Code, Documents, Config |
| **phone** | HEADY-5bda... | Mobile device | Documents only |
| **tablet** | HEADY-2eee... | Tablet device | Documents, Media |
| **server** | HEADY-3216... | Server/VM | Code, Config |
| **dev** | HEADY-9097... | Development env | Code, Config |
| **work** | HEADY-f22c... | Work device | Code, Documents |

---

## 📁 File Synchronization

### Folder Configuration

#### Default Folders
```json
{
    "CascadeProjects": {
        "path": "/home/headyme/CascadeProjects",
        "devices": ["primary", "laptop", "desktop", "dev"],
        "auto_accept": true,
        "versioning": "trashcan"
    },
    "Documents": {
        "path": "/home/headyme/Documents", 
        "devices": ["primary", "laptop", "tablet", "phone"],
        "auto_accept": true,
        "versioning": "trashcan"
    },
    "Config": {
        "path": "/home/headyme/.config",
        "devices": ["primary", "laptop", "desktop"],
        "auto_accept": true,
        "versioning": "trashcan"
    }
}
```

#### Adding Custom Folders
```bash
# Method 1: Via GUI
# 1. Open Syncthing
# 2. Click "Add Folder"
# 3. Configure path and devices

# Method 2: Via config
cat >> ~/.config/syncthing/device-registry.json << EOF
    "CustomFolder": {
        "path": "/path/to/folder",
        "devices": ["primary", "laptop"],
        "auto_accept": true
    }
EOF
```

### Sync Performance Optimization

#### Network Settings
```bash
# Unlimited LAN bandwidth
# Already configured in setup

# Check current settings
curl -s https://api.headysystems.com/rest/system/config | jq '.options'
```

#### File Exclusions
Create `.stignore` in folders to exclude files:
```
# Temporary files
*.tmp
*.swp
*.swo
.DS_Store
Thumbs.db

# Build artifacts
node_modules/
build/
dist/
target/

# Large media files
*.mp4
*.avi
*.mov
```

---

## 🔄 Session Continuity

### How It Works
The session continuity system captures and shares:
- Current working directory
- Active window/application
- Git branch status
- Recent file activity
- Device hostname and type

### Session Data Structure
```json
{
    "timestamp": "2026-02-17T10:51:42-07:00",
    "device_name": "HeadyBuddy-Primary",
    "device_type": "primary",
    "active_window": "Terminal - nvim",
    "cwd": "/home/headyme/CascadeProjects",
    "git_branch": "main",
    "open_files": ["app.py", "config.json"],
    "hostname": "headyme-pc",
    "network": "HeadyBuddy Sync Network"
}
```

### Accessing Session Data
```bash
# Via HTTP API
curl http://192.168.100.1:8080/current-session.json

# Via local file
cat /tmp/headybuddy-sessions/current-session.json

# Real-time monitoring
watch -n 5 'curl -s http://192.168.100.1:8080/current-session.json | jq'
```

### Custom Session Scripts
```bash
# Create custom session capture
cat > ~/.config/headybuddy/custom-session.sh << 'EOF'
#!/bin/bash
# Custom session data capture

echo "{
    \"timestamp\": \"$(date -Iseconds)\",
    \"battery\": $(acpi -b | grep -o '[0-9]*%' | tr -d '%'),
    \"memory\": $(free -m | awk 'NR==2{printf "%.0f", $3*100/$2}'),
    \"cpu\": $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | tr -d '%us,'),
    \"network\": \"$(iwgetid -r)\"
}"
EOF

chmod +x ~/.config/headybuddy/custom-session.sh
```

---

## 🔍 Device Discovery

### mDNS Services
The system uses Avahi/mDNS for automatic device discovery:

```bash
# Browse for HeadyBuddy devices
avahi-browse --resolve _http._tcp

# Check local services
avahi-browse --all-local

# Publish custom service
avahi-publish-service HeadyBuddy-Primary _http._tcp 8080
```

### Network Scanning
```bash
# Scan mesh network
nmap -sn 192.168.100.0/24

# Check active devices
arp -a | grep 192.168.100

# Find Syncthing devices
netstat -tlnp | grep 22000
```

---

## 🛠️ Advanced Configuration

### Firewall Rules
```bash
# Essential ports for sync network
sudo ufw allow in on wlp3s0 to any port 22000 proto tcp    # Syncthing
sudo ufw allow in on wlp3s0 to any port 22000 proto udp    # Syncthing QUIC
sudo ufw allow in on wlp3s0 to any port 21027 proto udp    # Local discovery
sudo ufw allow in on wlp3s0 to any port 8080 proto tcp    # Session API
sudo ufw allow in on wlp3s0 to any port 53 proto udp      # DNS
sudo ufw allow in on wlp3s0 to any port 67 proto udp      # DHCP
```

### Performance Tuning
```bash
# Increase file watcher limits
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Optimize network buffers
echo 'net.core.rmem_max = 16777216' | sudo tee -a /etc/sysctl.conf
echo 'net.core.wmem_max = 16777216' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Backup & Recovery
```bash
# Backup Syncthing configuration
tar -czf syncthing-backup-$(date +%Y%m%d).tar.gz ~/.config/syncthing/

# Export device registry
cp ~/.config/syncthing/device-registry.json ~/device-registry-backup.json

# Restore from backup
tar -xzf syncthing-backup-YYYYMMDD.tar.gz -C ~/
systemctl --user restart syncthing
```

---

## 🔧 Troubleshooting Guide

### Common Issues

#### Network Connection Issues
```bash
# Check hotspot status
sudo systemctl status hostapd
sudo systemctl status dnsmasq

# Verify IP configuration
ip addr show wlp3s0
ping 192.168.100.1

# Restart network services
sudo systemctl restart hostapd
sudo systemctl restart dnsmasq
```

#### Syncthing Not Connecting
```bash
# Check Syncthing status
systemctl --user status syncthing

# View logs
journalctl --user -u syncthing -f

# Restart service
systemctl --user restart syncthing

# Check configuration
syncthing --paths
```

#### Device Discovery Problems
```bash
# Check Avahi status
sudo systemctl status avahi-daemon

# Restart mDNS
sudo systemctl restart avahi-daemon

# Test local discovery
avahi-browse --all-local
```

#### Session Sync Issues
```bash
# Check continuity services
headybuddy-continuity status

# Restart services
headybuddy-continuity stop
headybuddy-continuity start

# Check session data
ls -la /tmp/headybuddy-sessions/
```

### Performance Issues

#### Slow Sync Speeds
```bash
# Check network utilization
iftop -i wlp3s0

# Monitor Syncthing activity
curl -s https://api.headysystems.com/rest/system/status | jq

# Check disk I/O
iotop -o
```

#### High CPU Usage
```bash
# Monitor processes
top -p $(pgrep syncthing)

# Check file watching
find /home/headyme -name ".stfolder" -exec ls -la {} \;

# Reduce scan frequency if needed
# Edit Syncthing config: rescanIntervalS
```

---

## 📊 Monitoring & Analytics

### System Monitoring
```bash
# Create monitoring dashboard
cat > ~/headybuddy-monitor.sh << 'EOF'
#!/bin/bash

echo "🔍 HeadyBuddy Network Monitor"
echo "============================="

# Network status
echo "📡 Network Status:"
ip addr show wlp3s0 | grep "inet " | awk '{print "  IP: " $2}'
iwgetid -r | awk '{print "  WiFi: " $0}'

# Connected devices
echo ""
echo "📱 Connected Devices:"
arp -a | grep 192.168.100 | wc -l | awk '{print "  Count: " $1}'

# Syncthing status
echo ""
echo "🔄 Sync Status:"
systemctl --user is-active syncthing | awk '{print "  Syncthing: " $1}'
curl -s https://api.headysystems.com/rest/system/status | jq -r '.globalBytes' | awk '{printf "  Total Synced: %.2f GB\n", $1/1073741824}'

# Session continuity
echo ""
echo "🎯 Session Continuity:"
headybuddy-continuity status | grep running | wc -l | awk '{print "  Active Services: " $1}'
EOF

chmod +x ~/headybuddy-monitor.sh
```

### Log Analysis
```bash
# Syncthing activity log
journalctl --user -u syncthing --since "1 hour ago" | grep -E "(Connection|Folder|Device)"

# Network connection log
sudo journalctl -u hostapd --since "1 hour ago"

# Session sync activity
tail -f /tmp/headybuddy-sessions/current-session.json
```

---

## 🚀 Best Practices

### Security
- Use WPA2 encryption on hotspot
- Keep device IDs private
- Regular backup of configurations
- Monitor connected devices

### Performance
- Use SSD storage for better sync speed
- Exclude large media files from sync
- Regular cleanup of old versions
- Monitor network bandwidth

### Maintenance
- Weekly restart of services
- Monthly configuration backup
- Quarterly device audit
- Annual system update

### Usage Tips
- Start with essential folders only
- Gradually add more devices
- Monitor storage usage
- Test disaster recovery

---

## 📞 Support & Resources

### Getting Help
- Check logs: `journalctl --user -u syncthing`
- Status check: `headybuddy-continuity status`
- Network test: `ping 192.168.100.1`

### Configuration Files
- Syncthing: `~/.config/syncthing/config.xml`
- Device Registry: `~/.config/syncthing/device-registry.json`
- Network: `/etc/hostapd/hostapd.conf`
- DHCP: `/etc/dnsmasq.d/headybuddy.conf`

### Useful Commands
```bash
# Quick status overview
~/headybuddy-monitor.sh

# Device list
cat ~/.config/syncthing/device-registry.json | jq '.devices'

# Network scan
nmap -sn 192.168.100.0/24

# Service restart
sudo ./alternative-mesh-setup.sh && headybuddy-continuity restart
```

---

## 🎉 Conclusion

Your HeadyBuddy Sync Network provides:
- ✅ **Real-time synchronization** across all devices
- ✅ **Cross-device continuity** for seamless workflow
- ✅ **Branded device IDs** for easy management
- ✅ **Automatic discovery** and connection
- ✅ **Privacy-focused** local-only operation
- ✅ **High performance** with unlimited bandwidth

You now have a comprehensive, professional-grade synchronization system that keeps all your devices in perfect harmony! 🚀
