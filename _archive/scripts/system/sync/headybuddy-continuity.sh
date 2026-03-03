# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash

# HeadyBuddy Cross-Device Continuity System
# Enables seamless following across devices

set -e

MESH_NETWORK="192.168.100.0/24"
SESSION_PORT=8080
SYNC_INTERVAL=5

echo "Starting HeadyBuddy Cross-Device Continuity..."

# Install required tools
sudo apt install -y xdotool python3-avahi python3-dbus 2>/dev/null || true

# Create device discovery service
cat > /tmp/device-discovery.py << 'EOF'
#!/usr/bin/env python3
import avahi
import dbus
import json
import time
from threading import Thread

class DeviceDiscovery:
    def __init__(self):
        self.bus = dbus.SystemBus()
        self.server = dbus.Interface(self.bus.get_object(avahi.DBUS_NAME, '/'), 'org.freedesktop.Avahi.Server')
        self.devices = {}
        
    def browse_services(self):
        browser = dbus.Interface(self.bus.get_object(avahi.DBUS_NAME, self.server.ServiceBrowserNew(avahi.IF_UNSPEC, avahi.PROTO_UNSPEC, '_http._tcp', 'local', dbus.UInt32(0))), 'org.freedesktop.Avahi.ServiceBrowser')
        browser.connect_to_signal('ItemNew', self.new_service)
        browser.connect_to_signal('ItemRemove', self.remove_service)
        
    def new_service(self, interface, protocol, name, stype, domain, flags):
        resolver = dbus.Interface(self.bus.get_object(avahi.DBUS_NAME, self.server.ResolveService(interface, protocol, name, stype, domain, avahi.PROTO_UNSPEC, dbus.UInt32(0))), 'org.freedesktop.Avahi.ServiceResolver')
        resolver.connect_to_signal('Found', self.found_service)
        
    def found_service(self, interface, protocol, name, stype, domain, host, aprotocol, address, port, txt, flags):
        if 'HeadyBuddy' in name:
            self.devices[name] = {'host': host, 'address': address, 'port': port}
            print(f"Found HeadyBuddy device: {name} at {address}:{port}")
            
    def remove_service(self, interface, protocol, name, stype, domain, flags):
        if name in self.devices:
            del self.devices[name]
            print(f"Removed device: {name}")
            
    def get_devices(self):
        return self.devices

if __name__ == '__main__':
    discovery = DeviceDiscovery()
    discovery.browse_services()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping device discovery...")
EOF

chmod +x /tmp/device-discovery.py

# Create session synchronization service
cat > /tmp/session-sync.py << 'EOF'
#!/usr/bin/env python3
import json
import time
import requests
import subprocess
from datetime import datetime

class SessionSync:
    def __init__(self, device_id="primary"):
        self.device_id = device_id
        self.session_data = {}
        
    def capture_current_session(self):
        try:
            # Get active window
            active_window = subprocess.check_output(['xdotool', 'getwindowname', 'getwindowfocus'], stderr=subprocess.DEVNULL).decode().strip()
        except:
            active_window = "unknown"
            
        try:
            # Get current directory
            cwd = subprocess.check_output(['pwd']).decode().strip()
        except:
            cwd = "unknown"
            
        try:
            # Get git branch
            git_branch = subprocess.check_output(['git', 'branch', '--show-current'], stderr=subprocess.DEVNULL).decode().strip()
        except:
            git_branch = "no-git"
            
        try:
            # Get open files
            open_files = subprocess.check_output(['ls', '-la'], stderr=subprocess.DEVNULL).decode()
            open_files = '\n'.join([line for line in open_files.split('\n') if any(ext in line for ext in ['.py', '.js', '.ts', '.md', '.txt', '.json'])])[:500]
        except:
            open_files = ""
            
        self.session_data = {
            'timestamp': datetime.now().isoformat(),
            'device_id': self.device_id,
            'active_window': active_window,
            'cwd': cwd,
            'git_branch': git_branch,
            'open_files': open_files,
            'hostname': subprocess.check_output(['hostname']).decode().strip()
        }
        
        return self.session_data
        
    def sync_to_device(self, target_address, port=8080):
        try:
            url = f"http://{target_address}:{port}/session"
            response = requests.post(url, json=self.session_data, timeout=2)
            return response.status_code == 200
        except:
            return False
            
    def start_sync_loop(self, target_devices):
        while True:
            session = self.capture_current_session()
            print(f"Syncing session: {session['active_window']} in {session['cwd']}")
            
            for device in target_devices:
                self.sync_to_device(device['address'], device['port'])
                
            time.sleep(30)  # Sync every 30 seconds

if __name__ == '__main__':
    sync = SessionSync()
    print("Session sync started...")
    sync.start_sync_loop([])
EOF

chmod +x /tmp/session-sync.py

# Create unified continuity launcher
cat > /usr/local/bin/headybuddy-continuity << 'EOF'
#!/bin/bash

# HeadyBuddy Continuity Launcher
SESSION_DIR="/tmp/headybuddy-sessions"
MESH_IP="192.168.100.1"

mkdir -p "$SESSION_DIR"

case "$1" in
    start)
        echo "Starting HeadyBuddy continuity services..."
        
        # Start device discovery
        python3 /tmp/device-discovery.py &
        DISCOVERY_PID=$!
        
        # Start session sync
        python3 /tmp/session-sync.py &
        SYNC_PID=$!
        
        # Start HTTP server for session data
        cd "$SESSION_DIR"
        python3 -m http.server 8080 --bind 0.0.0.0 &
        HTTP_PID=$!
        
        # Save PIDs for management
        echo $DISCOVERY_PID > /tmp/headybuddy-discovery.pid
        echo $SYNC_PID > /tmp/headybuddy-sync.pid
        echo $HTTP_PID > /tmp/headybuddy-http.pid
        
        echo "HeadyBuddy continuity started"
        echo "Device discovery: running"
        echo "Session sync: running" 
        echo "HTTP server: http://$MESH_IP:8080"
        ;;
        
    stop)
        echo "Stopping HeadyBuddy continuity..."
        
        for pidfile in /tmp/headybuddy-*.pid; do
            if [ -f "$pidfile" ]; then
                kill $(cat "$pidfile") 2>/dev/null || true
                rm "$pidfile"
            fi
        done
        
        echo "HeadyBuddy continuity stopped"
        ;;
        
    status)
        echo "HeadyBuddy Continuity Status:"
        for service in discovery sync http; do
            pidfile="/tmp/headybuddy-${service}.pid"
            if [ -f "$pidfile" ] && kill -0 $(cat "$pidfile") 2>/dev/null; then
                echo "  $service: running (PID: $(cat $pidfile))"
            else
                echo "  $service: stopped"
            fi
        done
        ;;
        
    *)
        echo "Usage: $0 {start|stop|status}"
        exit 1
        ;;
esac
EOF

chmod +x /usr/local/bin/headybuddy-continuity

echo "HeadyBuddy Cross-Device Continuity installed!"
echo "Commands:"
echo "  headybuddy-continuity start  - Start all services"
echo "  headybuddy-continuity stop   - Stop all services" 
echo "  headybuddy-continuity status - Check status"

# Enable firewall for continuity services
sudo ufw allow in on mesh0 to any port 8080 proto tcp
sudo ufw allow in on mesh0 to any port 5353 proto udp

echo "Firewall configured for continuity services"
