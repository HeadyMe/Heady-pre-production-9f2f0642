<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# 🚀 HeadyBuddy Sync Network - Quick Start Guide

## ⚡ 5-Minute Setup

### 1. Start the Network
```bash
# Start WiFi hotspot
sudo ./alternative-mesh-setup.sh

# Start sync services  
headybuddy-continuity start
```

### 2. Access Services
- **Syncthing GUI**: https://api.headysystems.com
- **Session API**: http://192.168.100.1:8080
- **Network Name**: HeadyBuddySync
- **WiFi Password**: headybuddy2026

### 3. Add Your First Device
```bash
# On new device
./setup-new-device.sh laptop
```

Then add the device ID in Syncthing GUI.

---

## 🎯 Essential Commands

### Network Management
```bash
# Start everything
sudo ./alternative-mesh-setup.sh && headybuddy-continuity start

# Check status
headybuddy-continuity status

# Stop services
headybuddy-continuity stop
```

### Device Management
```bash
# View all device IDs
cat ~/.config/syncthing/device-registry.json

# Add new device type
./setup-new-device.sh phone
```

### Syncthing
```bash
# Restart Syncthing
systemctl --user restart syncthing

# Check status
systemctl --user status syncthing
```

---

## 📱 Adding Devices Fast

### Method 1: Quick Setup Script
```bash
# Copy to new device
scp ~/setup-new-device.sh user@device:/home/user/

# Run on device
ssh user@device "./setup-new-device.sh laptop"
```

### Method 2: Manual Setup
1. Install Syncthing on device
2. Connect to HeadyBuddySync WiFi
3. Add device ID: `HEADY-5ec81fb-829adc4-8360e38-72e57e5-c7d1`
4. Select folders to sync

---

## 🔧 Troubleshooting

### Network Issues
```bash
# Check hotspot
sudo systemctl status hostapd

# Check IP
ip addr show wlp3s0

# Restart network
sudo ./alternative-mesh-setup.sh
```

### Sync Issues
```bash
# Restart sync services
headybuddy-continuity stop
headybuddy-continuity start

# Check Syncthing logs
journalctl --user -u syncthing
```

---

## 📁 Default Sync Folders

| Folder | Devices | Path |
|--------|---------|------|
| **Code** | primary, laptop, desktop, dev | `/home/headyme/CascadeProjects` |
| **Documents** | primary, laptop, tablet, phone | `/home/headyme/Documents` |
| **Config** | primary, laptop, desktop | `/home/headyme/.config` |

---

## 🎯 Device IDs Cheat Sheet

| Type | ID | Name |
|------|----|------|
| **Primary** | `HEADY-6173818-5421911-e48cf7d-80c688d-1b48` | HeadyBuddy Primary |
| **Laptop** | `HEADY-5ec81fb-829adc4-8360e38-72e57e5-c7d1` | HeadyBuddy Laptop |
| **Phone** | `HEADY-5bdacd5-4b360f2-8007a35-af270dc-2fa8` | HeadyBuddy Phone |
| **Tablet** | `HEADY-2eee5e1-362a5e0-b7838f6-5b8fd1c-850b` | HeadyBuddy Tablet |

---

## 🚀 You're Ready!

Your HeadyBuddy sync network is now running with:
- ✅ Real-time file synchronization
- ✅ Cross-device session continuity  
- ✅ Branded device IDs
- ✅ Automatic device discovery

**Next Steps**: Add your devices and start syncing!
