<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# 📋 HeadyBuddy Device Cheatsheet

## 🎯 One-Liner Commands

### Start Everything
```bash
sudo ./alternative-mesh-setup.sh && headybuddy-continuity start
```

### Quick Status Check
```bash
headybuddy-continuity status && echo "WiFi: $(iwgetid -r)" && echo "IP: $(ip route get 1 | awk '{print $7}' | head -1)"
```

### Add New Device
```bash
./setup-new-device.sh laptop && echo "Device ID ready for pairing"
```

---

## 📱 Device IDs Quick Reference

| Device | ID | Command |
|--------|----|---------|
| **Primary** | `HEADY-6173818-5421911-e48cf7d-80c688d-1b48` | Already configured |
| **Laptop** | `HEADY-5ec81fb-829adc4-8360e38-72e57e5-c7d1` | `./setup-new-device.sh laptop` |
| **Desktop** | `HEADY-8cf0108-b4c268b-c0d0197-cde9dc8-1901` | `./setup-new-device.sh desktop` |
| **Phone** | `HEADY-5bdacd5-4b360f2-8007a35-af270dc-2fa8` | `./setup-new-device.sh phone` |
| **Tablet** | `HEADY-2eee5e1-362a5e0-b7838f6-5b8fd1c-850b` | `./setup-new-device.sh tablet` |

---

## 🔧 Service Management

### All Services Status
```bash
echo "=== Network ===" && sudo systemctl status hostapd --no-pager -l && echo "=== Sync ===" && systemctl --user status syncthing --no-pager -l && echo "=== Continuity ===" && headybuddy-continuity status
```

### Restart All Services
```bash
sudo systemctl restart hostapd && systemctl --user restart syncthing && headybuddy-continuity restart
```

### Check Logs (Last 50 lines)
```bash
journalctl --user -u syncthing -n 50 && echo "---" && sudo journalctl -u hostapd -n 50
```

---

## 📁 Folder Sync Commands

### Add New Folder to Sync
```bash
# Via Syncthing API
curl -X POST -H "X-API-Key: $(grep apiKey ~/.config/syncthing/config.xml | cut -d'"' -f4)" \
  -H "Content-Type: application/json" \
  -d '{"folder":{"id":"new-folder","path":"/path/to/folder","devices":[{"deviceID":"HEADY-6173818-5421911-e48cf7d-80c688d-1b48"}]}}' \
  https://api.headysystems.com/rest/config/folders
```

### List Current Folders
```bash
curl -s https://api.headysystems.com/rest/config/folders | jq -r '.[].id'
```

### Check Sync Progress
```bash
curl -s https://api.headysystems.com/rest/system/status | jq '.globalBytes'
```

---

## 🌐 Network Commands

### Check Connected Devices
```bash
nmap -sn 192.168.100.0/24 | grep "Nmap scan report"
```

### Test Network Connectivity
```bash
ping -c 3 192.168.100.1 && echo "✅ Network OK" || echo "❌ Network Issue"
```

### Check WiFi Status
```bash
iwconfig wlp3s0 | grep -E "(ESSID|Frequency|Bit Rate)"
```

### Restart Network Only
```bash
sudo ./alternative-mesh-setup.sh
```

---

## 🔄 Session Continuity

### Get Current Session
```bash
curl -s http://192.168.100.1:8080/current-session.json | jq
```

### Monitor Session Changes
```bash
watch -n 10 'curl -s http://192.168.100.1:8080/current-session.json | jq -r ".device_name + \" - \" + .cwd"'
```

### Test Session API
```bash
curl -f http://192.168.100.1:8080/current-session.json && echo "✅ Session API working" || echo "❌ Session API down"
```

---

## 🛠️ Troubleshooting Quick Fixes

### Syncthing Not Connecting
```bash
systemctl --user restart syncthing && sleep 5 && curl -s https://api.headysystems.com/rest/system/ping
```

### WiFi Hotspot Issues
```bash
sudo systemctl restart hostapd && sudo systemctl restart dnsmasq && sleep 3 && ip addr show wlp3s0
```

### Device Discovery Problems
```bash
sudo systemctl restart avahi-daemon && avahi-browse --all-local
```

### General Reset
```bash
headybuddy-continuity stop && sudo ./alternative-mesh-setup.sh && headybuddy-continuity start
```

---

## 📊 Monitoring Commands

### Real-time Network Monitor
```bash
watch -n 2 'iftop -i wlp3s0 -t -s 2'
```

### Sync Progress Monitor
```bash
watch -n 5 'curl -s https://api.headysystems.com/rest/system/status | jq "{completed: .globalBytes, total: .globalBytes + .needBytes, percent: (.globalBytes / (.globalBytes + .needBytes) * 100) | round}"'
```

### Device List Monitor
```bash
watch -n 10 'arp -a | grep 192.168.100 | wc -l | echo "Connected devices: $(cat)"'
```

---

## 🎯 Emergency Commands

### Full System Reset
```bash
headybuddy-continuity stop && sudo systemctl stop hostapd dnsmasq && systemctl --user stop syncthing && sleep 2 && sudo systemctl start hostapd dnsmasq && systemctl --user start syncthing && headybuddy-continuity start
```

### Backup Everything
```bash
tar -czf headybuddy-backup-$(date +%Y%m%d-%H%M%S).tar.gz ~/.config/syncthing/ ~/setup-new-device.sh ~/branded-device-setup.sh ~/alternative-mesh-setup.sh
```

### Kill All Services
```bash
headybuddy-continuity stop && sudo systemctl stop hostapd dnsmasq && systemctl --user stop syncthing && pkill -f syncthing
```

---

## 📱 Mobile Setup Quick

### Android
```bash
# Termux commands
pkg install syncthing
syncthing --generate-key
# Then add device ID in GUI
```

### iOS
1. Install Syncthing from App Store
2. Connect to HeadyBuddySync WiFi
3. Add device ID manually
4. Enable folders

---

## 🔐 Security Quick Checks

### Check Firewall Status
```bash
sudo ufw status verbose | grep -E "(22000|21027|8080)"
```

### Check Connected Devices
```bash
arp -a | grep 192.168.100 | awk '{print $2}' | sed 's/[()]//g' | while read ip; do echo "Device: $ip - $(nmap -sn $ip | grep "Nmap scan report")"; done
```

### Verify Encryption
```bash
curl -s https://api.headysystems.com/rest/system/config | jq '.options | {localAnnounceEnabled, globalAnnounceEnabled, relaysEnabled}'
```

---

## 🚀 Performance Boosts

### Optimize File Watching
```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
```

### Clear Syncthing Cache
```bash
systemctl --user stop syncthing && rm -rf ~/.cache/syncthing && systemctl --user start syncthing
```

### Force Full Rescan
```bash
curl -X POST https://api.headysystems.com/rest/db/scan?folder=*
```

---

## 📋 Quick Reference Card

### Start: `sudo ./alternative-mesh-setup.sh && headybuddy-continuity start`
### Stop: `headybuddy-continuity stop && sudo systemctl stop hostapd dnsmasq`
### Status: `headybuddy-continuity status`
### GUI: https://api.headysystems.com
### API: http://192.168.100.1:8080
### WiFi: HeadyBuddySync / headybuddy2026

---

## 🎯 Essential Files

| File | Purpose |
|------|---------|
| `~/.config/syncthing/config.xml` | Syncthing configuration |
| `~/.config/syncthing/device-registry.json` | Device registry |
| `/etc/hostapd/hostapd.conf` | WiFi hotspot config |
| `/etc/dnsmasq.d/headybuddy.conf` | DHCP config |
| `~/setup-new-device.sh` | Device setup script |
| `/usr/local/bin/headybuddy-continuity` | Continuity service |

---

**🚀 Your HeadyBuddy Sync Network is ready!** 🎯
