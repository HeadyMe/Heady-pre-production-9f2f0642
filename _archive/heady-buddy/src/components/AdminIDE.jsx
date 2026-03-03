import React from 'react';
import { Settings, Monitor, Activity, Zap, ExternalLink } from 'lucide-react';

const AdminIDE = () => {
  return (
    <div className="p-8 bg-gray-50 h-full overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Admin + IDE Mode</h2>
          <p className="text-gray-600">Full control room with embedded development environment</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Admin UI Panel */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <Settings className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-semibold">Admin Dashboard</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-gray-700">Service Status</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">All Online</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-gray-700">Active Nodes</span>
                <span className="font-semibold">26/26</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-gray-700">Arena Mode</span>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">Ready</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-gray-700">System Load</span>
                <span className="font-semibold">42%</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => {
                  const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3300' : `https://api.${window.location.hostname.replace('buddy.', '')}`;
                  window.open(`${baseUrl}/admin`, '_blank');
                }}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open Admin UI
              </button>
              <button
                onClick={() => {
                  const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3300' : `https://api.${window.location.hostname.replace('buddy.', '')}`;
                  window.open(`${baseUrl}/api/health`, '_blank');
                }}
                className="w-full flex items-center justify-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Activity className="w-4 h-4" />
                View Health Metrics
              </button>
            </div>
          </div>

          {/* IDE Panel */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <Monitor className="w-6 h-6 text-green-600" />
              <h3 className="text-xl font-semibold">Development Environment</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-gray-700">Current Workspace</span>
                <span className="font-semibold">Heady Arena Mode</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-gray-700">Active Files</span>
                <span className="font-semibold">12</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-gray-700">Git Branch</span>
                <span className="font-semibold">arena/candidate-A</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-gray-700">AI Assistants</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">Active</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => {
                  const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3300' : `https://api.${window.location.hostname.replace('buddy.', '')}`;
                  window.open(`${baseUrl}/ide`, '_blank');
                }}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open IDE
              </button>
              <button
                onClick={() => {
                  const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3300' : `https://api.${window.location.hostname.replace('buddy.', '')}`;
                  window.open(`${baseUrl}/api/arena/status`, '_blank');
                }}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Zap className="w-4 h-4" />
                Arena Status
              </button>
            </div>
          </div>
        </div>

        {/* Integration Info */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Seamless Integration</h3>
          <p className="text-gray-700 mb-4">
            Admin + IDE mode provides unified access to both system administration and development tools.
            Navigate seamlessly between configuration and coding without context switching.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Cross Navigation</h4>
              <p className="text-sm text-gray-600">Jump from Admin panels directly to relevant code</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Shared Context</h4>
              <p className="text-sm text-gray-600">Project and user context flows between both interfaces</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Real-time Sync</h4>
              <p className="text-sm text-gray-600">Changes in Admin UI reflect immediately in IDE</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminIDE;
