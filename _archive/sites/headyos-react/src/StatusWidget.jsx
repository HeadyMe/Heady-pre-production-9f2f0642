/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
import React, { useEffect, useState } from 'react';
export default function StatusWidget() {
  const [status, setStatus] = useState('Loading...');
  useEffect(() => {
    fetch('https://api.headysystems.com/v1/ops/status')
      .then(res => res.json())
      .then(data => setStatus(data.overall))
      .catch(() => setStatus('Offline'));
  }, []);
  return <div className="glass-panel p-4"><h3>Conductor Status</h3><p className="text-emerald">{status}</p></div>;
}