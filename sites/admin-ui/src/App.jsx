import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import Routing from './pages/Routing';
import Domains from './pages/Domains';
import Tunnels from './pages/Tunnels';
import Tasks from './pages/Tasks';
import DesignConfig from './pages/DesignConfig';
import Users from './pages/Users';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import AIStudio from './pages/AIStudio';
import AppCreationLab from './pages/AppCreationLab';

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="services" element={<Services />} />
                <Route path="routing" element={<Routing />} />
                <Route path="domains" element={<Domains />} />
                <Route path="tunnels" element={<Tunnels />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="design" element={<DesignConfig />} />
                <Route path="users" element={<Users />} />
                <Route path="logs" element={<Logs />} />
                <Route path="settings" element={<Settings />} />
                <Route path="ai" element={<AIStudio />} />
                <Route path="app-lab" element={<AppCreationLab />} />
            </Route>
        </Routes>
    );
}
