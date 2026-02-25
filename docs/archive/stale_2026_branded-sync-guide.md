<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# 🎯 HeadyBuddy Branded Device IDs

## Your New Branded Network

Your sync network now uses human-readable, branded device IDs instead of random strings!

### **Primary Device**
- **Name**: HeadyBuddy Primary  
- **ID**: `HEADY-6173818-5421911-e48cf7d-80c688d-1b48`
- **Status**: ✅ Active

### **Available Device Types**

| Device Type | Name | ID | Use Case |
|-------------|------|----|----------|
| **laptop** | HeadyBuddy-Laptop | `HEADY-5ec81fb-829adc4-8360e38-72e57e5-c7d1` | Main laptop |
| **desktop** | HeadyBuddy-Desktop | `HEADY-8cf0108-b4c268b-c0d0197-cde9dc8-1901` | Desktop workstation |
| **tablet** | HeadyBuddy-Tablet | `HEADY-2eee5e1-362a5e0-b7838f6-5b8fd1c-850b` | Tablet device |
| **phone** | HeadyBuddy-Phone | `HEADY-5bdacd5-4b360f2-8007a35-af270dc-2fa8` | Mobile phone |
| **server** | HeadyBuddy-Server | `HEADY-32160e2-2f3a867-35238bd-364bd3c-42f7` | Server/VM |
| **dev** | HeadyBuddy-Dev | `HEADY-9097a52-fea5da7-d9bf346-0da5ed2-e55d` | Development environment |
| **work** | HeadyBuddy-Work | `HEADY-f22cd07-5ce78c8-66ae6bb-7f8c471-66be` | Work device |

## 🚀 Adding New Devices

### Easy Setup Process
1. **Copy setup script** to new device:
   ```bash
   scp ~/setup-new-device.sh user@new-device:/home/user/
   ```

2. **Run setup** on new device:
   ```bash
   ./setup-new-device.sh laptop
   # Replace 'laptop' with appropriate device type
   ```

3. **Connect devices** in Syncthing:
   - Open `https://api.headysystems.com` on primary device
   - Click "Add Remote Device"
   - Enter the new device's branded ID
   - Select folders to sync

### Example: Adding a Laptop
```bash
# On the new laptop
./setup-new-device.sh laptop

# Output:
# Device ID: HEADY-5ec81fb-829adc4-8360e38-72e57e5-c7d1
# Device Name: HeadyBuddy-Laptop
# Web GUI: https://api.headysystems.com
```

## 📁 Folder Sync Configuration

### Predefined Sync Groups

| Folder | Path | Devices | Auto-Accept |
|--------|------|---------|-------------|
| **CascadeProjects** | `/home/headyme/CascadeProjects` | primary, laptop, desktop, dev | ✅ |
| **Documents** | `/home/headyme/Documents` | primary, laptop, tablet, phone | ✅ |
| **Config** | `/home/headyme/.config` | primary, laptop, desktop | ✅ |
| **UserData** | `/home/headyme/.local/share` | primary, laptop, desktop | ✅ |

### Custom Folder Setup
Add new folders to `~/.config/syncthing/device-registry.json`:
```json
"NewFolder": {
    "path": "/path/to/folder",
    "devices": ["primary", "laptop"],
    "auto_accept": true
}
```

## 🔄 Session Continuity with Branding

### Enhanced Session Tracking
Each device now broadcasts with branded names:
- **Device Name**: HeadyBuddy-{Type}
- **Network**: HeadyBuddy Sync Network
- **Session Data**: Enhanced with device type information

### Session API
```bash
curl http://192.168.100.1:8080/current-session.json
```

Response:
```json
{
    "timestamp": "2026-02-17T10:51:42-07:00",
    "device_name": "HeadyBuddy-Primary",
    "device_type": "primary", 
    "active_window": "Terminal",
    "cwd": "/home/headyme/CascadeProjects",
    "git_branch": "main",
    "hostname": "headyme-pc",
    "network": "HeadyBuddy Sync Network"
}
```

## 🎨 Benefits of Branded IDs

### ✅ **Human Readable**
- Easy to identify devices at a glance
- No more confusing random strings
- Clear device purpose (laptop, phone, etc.)

### ✅ **Consistent Naming**
- All devices follow `HEADY-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX` format
- Predictable and professional
- Easy to script and automate

### ✅ **Network Organization**
- Clear device hierarchy
- Easy to manage multiple devices
- Better debugging and troubleshooting

### ✅ **Security**
- Still cryptographically unique
- Deterministic generation
- No privacy concerns

## 🔧 Management Commands

### Check Device Registry
```bash
cat ~/.config/syncthing/device-registry.json
```

### List All Device IDs
```bash
grep -E '"id":' ~/.config/syncthing/device-registry.json | cut -d'"' -f4
```

### Update Device Name
```bash
# Edit the registry and restart Syncthing
systemctl --user restart syncthing
```

## 📱 Mobile Device Setup

### Android/iOS
1. Install Syncthing from app store
2. Connect to HeadyBuddySync WiFi
3. Add device ID manually (e.g., `HEADY-5bdacd5-4b360f2-8007a35-af270dc-2fa8`)
4. Select folders to sync

### Quick Mobile Setup
```bash
# Generate mobile device ID
./setup-new-device.sh phone
# Then enter the ID in mobile Syncthing app
```

## 🎯 Next Steps

1. **Start the network**:
   ```bash
   sudo ./alternative-mesh-setup.sh
   headybuddy-continuity start
   ```

2. **Add your devices** using the branded IDs above

3. **Configure folders** based on your workflow

4. **Enjoy seamless sync** across all your HeadyBuddy devices!

Your branded HeadyBuddy sync network is ready for action! 🚀
