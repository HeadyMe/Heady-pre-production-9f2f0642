import React, { useState } from 'react';
import { Activity, CheckCircle, AlertCircle, XCircle, RefreshCw, Zap, Shield, Database } from 'lucide-react';

const SystemHealth = ({ health, onRefresh }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'optimal':
      case 'healthy':
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
      case 'degraded':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'error':
      case 'offline':
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'optimal':
      case 'healthy':
      case 'running':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error':
      case 'offline':
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const mockServices = [
    { name: 'HeadyManager', status: health?.status || 'OPTIMAL', endpoint: window.location.hostname === 'localhost' ? 'localhost:3300' : `api.${window.location.hostname.replace('buddy.', '')}` },
    { name: 'Monte Carlo', status: 'running', endpoint: window.location.hostname === 'localhost' ? 'localhost:3300/api/monte-carlo' : `api.${window.location.hostname.replace('buddy.', '')}/api/monte-carlo` },
    { name: 'Pattern Engine', status: 'running', endpoint: window.location.hostname === 'localhost' ? 'localhost:3300/api/patterns' : `api.${window.location.hostname.replace('buddy.', '')}/api/patterns` },
    { name: 'Vector Storage', status: 'healthy', endpoint: window.location.hostname === 'localhost' ? 'localhost:6333' : `vector.${window.location.hostname.replace('buddy.', '')}` },
    { name: 'LiteLLM Proxy', status: 'healthy', endpoint: window.location.hostname === 'localhost' ? 'localhost:4000' : `llm.${window.location.hostname.replace('buddy.', '')}` },
    { name: 'Arena Mode', status: 'ready', endpoint: window.location.hostname === 'localhost' ? 'localhost:3300/api/arena' : `api.${window.location.hostname.replace('buddy.', '')}/api/arena` },
    { name: 'Memory System', status: 'running', endpoint: window.location.hostname === 'localhost' ? 'localhost:3300/api/memory' : `api.${window.location.hostname.replace('buddy.', '')}/api/memory` },
    { name: 'Risk Analysis', status: 'active', endpoint: window.location.hostname === 'localhost' ? 'localhost:3300/api/risk' : `api.${window.location.hostname.replace('buddy.', '')}/api/risk` }
  ];

  const mockMetrics = {
    uptime: '2h 34m',
    requests: 1247,
    errors: 3,
    avgResponse: '142ms',
    cpu: '42%',
    memory: '67%',
    disk: '23%'
  };

  return (
    <div className="p-8 bg-gray-50 h-full overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">System Health</h2>
            <p className="text-gray-600">Real-time monitoring of all Heady services</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Overall Status */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {getStatusIcon(health?.status)}
                <div>
                  <h3 className="text-xl font-semibold">Overall System Status</h3>
                  <p className="text-gray-600">
                    {health?.status || 'Checking...'} • Last checked: {new Date().toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(health?.status)}`}>
                {health?.status?.toUpperCase() || 'CHECKING'}
              </span>
            </div>
          </div>
        </div>

        {/* Service Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {mockServices.map((service, index) => (
            <div key={index} className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">{service.name}</h4>
                {getStatusIcon(service.status)}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(service.status)}`}>
                    {service.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Endpoint</span>
                  <span className="text-xs text-gray-500 font-mono">{service.endpoint}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* System Metrics */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-xl font-semibold mb-6">System Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-600">Uptime</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{mockMetrics.uptime}</div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600">Requests</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{mockMetrics.requests}</div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-gray-600">Errors</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{mockMetrics.errors}</div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-gray-600">Avg Response</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{mockMetrics.avgResponse}</div>
            </div>
          </div>
        </div>

        {/* Resource Usage */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-xl font-semibold mb-6">Resource Usage</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">CPU Usage</span>
                <span className="text-sm font-medium">{mockMetrics.cpu}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: mockMetrics.cpu }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Memory Usage</span>
                <span className="text-sm font-medium">{mockMetrics.memory}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: mockMetrics.memory }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Disk Usage</span>
                <span className="text-sm font-medium">{mockMetrics.disk}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-yellow-600 h-2 rounded-full"
                  style={{ width: mockMetrics.disk }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Database Status */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <Database className="w-6 h-6 text-indigo-600" />
            <h3 className="text-xl font-semibold">Database & Storage</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Vector Database</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Qdrant Status</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">HEALTHY</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Collections</span>
                  <span className="text-sm font-medium">3</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Vectors Stored</span>
                  <span className="text-sm font-medium">1.2M</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-3">PostgreSQL</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Connection Status</span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">ACTIVE</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Database Size</span>
                  <span className="text-sm font-medium">2.4 GB</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Active Connections</span>
                  <span className="text-sm font-medium">8/20</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealth;
