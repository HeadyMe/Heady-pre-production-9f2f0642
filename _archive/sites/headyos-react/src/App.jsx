/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './layouts/Layout';
import Dashboard from './pages/Dashboard';
import FleetManager from './pages/FleetManager';
import NetworkTunnels from './pages/NetworkTunnels';
import SecurityPanel from './pages/SecurityPanel';
import BillingPanel from './pages/BillingPanel';
import PackageBuilder from './pages/PackageBuilder';
import IpCompliance from './pages/IpCompliance';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="fleet" element={<FleetManager />} />
          <Route path="builder" element={<PackageBuilder />} />
          <Route path="telemetry" element={<NetworkTunnels />} />
          <Route path="security" element={<SecurityPanel />} />
          <Route path="billing" element={<BillingPanel />} />
          <Route path="ip" element={<IpCompliance />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}