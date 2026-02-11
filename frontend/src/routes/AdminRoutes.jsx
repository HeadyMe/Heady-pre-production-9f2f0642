import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { MCPDashboard } from '../components/Admin/MCPDashboard';

export const AdminRoutes = () => (
  <Routes>
    <Route path="mcp" element={<MCPDashboard />} />
  </Routes>
);
