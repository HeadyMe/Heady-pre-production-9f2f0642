<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# ✅ HeadyBuddy Setup Checklist

## 🚀 Pre-Setup Checklist

### System Requirements
- [ ] Linux system with WiFi capability
- [ ] sudo/administrator access  
- [ ] 2GB+ free disk space
- [ ] Internet connection for package installation

### Required Packages
- [ ] syncthing
- [ ] hostapd
- [ ] dnsmasq  
- [ ] wireless-tools
- [ ] python3-avahi
- [ ] xdotool
- [ ] python3-dbus

---

## 🔧 Installation Steps

### 1. System Preparation
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y syncthing hostapd dnsmasq wireless-tools python3-avahi xdotool python3-dbus
```

- [ ] Packages installed successfully
- [ ] System updated

### 2. Network Configuration
```bash
sudo ./alternative-mesh-setup.sh
```

- [ ] WiFi hotspot created
- [ ] IP address assigned (192.168.100.1)
- [ ] DHCP server running
- [ ] Firewall rules configured

### 3. Branded Device Setup
```bash
./branded-device-setup.sh
```

- [ ] Device registry created
- [ ] Branded IDs generated
- [ ] Syncthing configured
- [ ] Primary device ID: `HEADY-6173818-5421911-e48cf7d-80c688d-1b48`

### 4. Service Startup
```bash
systemctl --user enable syncthing
systemctl --user start syncthing
headybuddy-continuity start
```

- [ ] Syncthing running
- [ ] Continuity services active
- [ ] mDNS discovery enabled

---

## 🌐 Network Verification

### WiFi Hotspot Check
- [ ] Network name: `HeadyBuddySync`
- [ ] Password: `headybuddy2026`
- [ ] Gateway IP: `192.168.100.1`
- [ ] DHCP range: `192.168.100.50-150`

### Connectivity Tests
```bash
# Test local connectivity
ping -c 3 192.168.100.1

# Test Syncthing
curl -s https://api.headysystems.com/rest/system/ping

# Test session API
curl -f http://192.168.100.1:8080/current-session.json
```

- [ ] Local ping successful
- [ ] Syncthing responding
- [ ] Session API accessible

---

## 📱 Device Setup Verification

### Primary Device
- [ ] Device ID: `HEADY-6173818-5421911-e48cf7d-80c688d-1b48`
- [ ] Name: HeadyBuddy Primary
- [ ] Syncthing GUI: https://api.headysystems.com
- [ ] All folders configured

### Additional Devices (as added)
- [ ] Laptop: `HEADY-5ec81fb-829adc4-8360e38-72e57e5-c7d1`
- [ ] Desktop: `HEADY-8cf0108-b4c268b-c0d0197-cde9dc8-1901`
- [ ] Phone: `HEADY-5bdacd5-4b360f2-8007a35-af270dc-2fa8`
- [ ] Tablet: `HEADY-2eee5e1-362a5e0-b7838f6-5b8fd1c-850b`

---

## 📁 Folder Configuration

### Default Folders
- [ ] **CascadeProjects** → primary, laptop, desktop, dev
- [ ] **Documents** → primary, laptop, tablet, phone  
- [ ] **Config** → primary, laptop, desktop
- [ ] **UserData** → primary, laptop, desktop

### Folder Verification
```bash
# Check folder paths
ls -la /home/headyme/CascadeProjects
ls -la /home/headyme/Documents  
ls -la /home/headyme/.config
ls -la /home/headyme/.local/share
```

- [ ] All folder paths exist
- [ ] .stfolder markers present
- [ ] Permissions correct

---

## 🔄 Service Status Check

### System Services
```bash
sudo systemctl status hostapd --no-pager
sudo systemctl status dnsmasq --no-pager  
sudo systemctl status avahi-daemon --no-pager
```

- [ ] hostapd running (WiFi hotspot)
- [ ] dnsmasq running (DHCP/DNS)
- [ ] avahi-daemon running (mDNS)

### User Services
```bash
systemctl --user status syncthing --no-pager
headybuddy-continuity status
```

- [ ] syncthing running
- [ ] discovery service running
- [ ] session sync running
- [ ] HTTP server running

---

## 🔍 Functionality Tests

### File Synchronization Test
1. [ ] Create test file in CascadeProjects
2. [ ] Wait 10 seconds
3. [ ] Verify file appears on connected device
4. [ ] Delete test file
5. [ ] Verify deletion syncs

### Session Continuity Test
```bash
# Test session capture
curl -s http://192.168.100.1:8080/current-session.json | jq

# Test device discovery
avahi-browse --resolve _http._tcp
```

- [ ] Session data captured correctly
- [ ] Device discovery working
- [ ] JSON response valid

### Network Discovery Test
```bash
# Scan for devices
nmap -sn 192.168.100.0/24

# Check ARP table
arp -a | grep 192.168.100
```

- [ ] Network scanning works
- [ ] Connected devices visible
- [ ] IP assignments correct

---

## 🛡️ Security Verification

### Firewall Configuration
```bash
sudo ufw status verbose | grep -E "(22000|21027|8080)"
```

- [ ] Port 22000 (TCP/UDP) open for Syncthing
- [ ] Port 21027 (UDP) open for discovery  
- [ ] Port 8080 (TCP) open for session API
- [ ] WiFi encryption enabled (WPA2)

### Encryption Check
```bash
# Check Syncthing encryption
curl -s https://api.headysystems.com/rest/system/config | jq '.options | {localAnnounceEnabled, globalAnnounceEnabled, relaysEnabled}'
```

- [ ] Local discovery enabled
- [ ] Global discovery disabled (privacy)
- [ ] Relays disabled (local-only)

---

## 📊 Performance Verification

### Network Performance
```bash
# Test bandwidth
iperf3 -c 192.168.100.50  # Run on connected device

# Check latency
ping -c 10 192.168.100.50
```

- [ ] Bandwidth > 50 Mbps
- [ ] Latency < 10ms

### Sync Performance
```bash
# Monitor sync speed
watch -n 2 'curl -s https://api.headysystems.com/rest/system/status | jq ".globalBytes"'
```

- [ ] Files sync within seconds
- [ ] No excessive CPU usage
- [ ] Memory usage reasonable

---

## 📋 Final Verification

### Documentation Review
- [ ] README.md reviewed
- [ ] QUICKSTART.md reviewed  
- [ ] DEVICE-CHEATSHEET.md reviewed
- [ ] COMPREHENSIVE-GUIDE.md reviewed

### Backup Configuration
```bash
# Create backup
tar -czf headybuddy-setup-backup-$(date +%Y%m%d).tar.gz \
  ~/.config/syncthing/ \
  ~/setup-new-device.sh \
  ~/branded-device-setup.sh \
  ~/alternative-mesh-setup.sh
```

- [ ] Configuration backed up
- [ ] Scripts backed up
- [ ] Device registry saved

---

## ✅ Completion Checklist

### Ready to Use
- [ ] All services running
- [ ] Network accessible
- [ ] Devices can connect
- [ ] File synchronization working
- [ ] Session continuity active
- [ ] Security configured

### User Training
- [ ] Basic commands learned
- [ ] Device addition process understood
- [ ] Troubleshooting steps known
- [ ] Backup procedure documented

### Ongoing Maintenance
- [ ] Weekly service restart scheduled
- [ ] Monthly backup planned
- [ ] Quarterly device audit scheduled
- [ ] Annual system update planned

---

## 🎯 Success Criteria

### ✅ **System is Ready When:**
- WiFi hotspot "HeadyBuddySync" is active
- Syncthing GUI accessible at https://api.headysystems.com
- Session API responding at http://192.168.100.1:8080
- At least one additional device can connect
- Files sync between devices within 10 seconds
- Session data updates automatically

### ✅ **User Can:**
- Add new devices with one command
- Access all synced folders
- Monitor system status
- Troubleshoot common issues
- Backup/restore configuration

---

## 🚀 Go Live!

**If all checkboxes above are marked, your HeadyBuddy Sync Network is ready for production use!**

### Next Steps:
1. [ ] Add your first additional device
2. [ ] Test file synchronization
3. [ ] Configure additional folders as needed
4. [ ] Set up mobile devices
5. [ ] Enjoy seamless cross-device productivity!

---

**🎉 Congratulations! Your HeadyBuddy Sync Network is fully configured and ready to use!** 🚀
