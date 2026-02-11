// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: headybuddy/src/components/CrossDeviceSync.jsx                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
import React, { useState, useEffect } from 'react';

export default function CrossDeviceSync({ userId }) {
  const [devices, setDevices] = useState([]);
  const [activeDevice, setActiveDevice] = useState(null);

  useEffect(() => {
    // Fetch user's devices from Heady API
    const fetchDevices = async () => {
      try {
        const response = await fetch(`http://api.heady.io:3300/api/users/${userId}/devices`);
        const data = await response.json();
        setDevices(data.devices);
        setActiveDevice(data.activeDevice);
      } catch (error) {
        console.error('Error fetching devices:', error);
      }
    };

    fetchDevices();
    const interval = setInterval(fetchDevices, 15000);
    return () => clearInterval(interval);
  }, [userId]);

  const switchDevice = async (deviceId) => {
    try {
      await fetch(`http://api.heady.io:3300/api/users/${userId}/active-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId })
      });
      setActiveDevice(deviceId);
    } catch (error) {
      console.error('Error switching device:', error);
    }
  };

  return (
    <div className="cross-device-sync">
      <h3>Connected Devices</h3>
      <ul>
        {devices.map(device => (
          <li key={device.id}>
            {device.name} ({device.type})
            {activeDevice === device.id && ' (Active)'}
            {activeDevice !== device.id && (
              <button onClick={() => switchDevice(device.id)}>Switch to</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
