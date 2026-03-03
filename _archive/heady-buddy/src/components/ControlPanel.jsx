import React from 'react';
import { Monitor, Code, Activity, History, Zap, Play, CheckCircle, AlertCircle } from 'lucide-react';

const ControlPanel = ({ preferences, recentProjects, onLaunchArenaMode, onAddProject }) => {
  const handleLaunchAdminIDE = () => {
    const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3300' : `https://api.${window.location.hostname.replace('buddy.', '')}`;
    window.open(`${baseUrl}/admin`, '_blank');
  };

  const handleLaunchIDEOnly = () => {
    const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3300' : `https://api.${window.location.hostname.replace('buddy.', '')}`;
    window.open(`${baseUrl}/ide`, '_blank');
  };

  const handleCheckMetrics = () => {
    const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3300' : `https://api.${window.location.hostname.replace('buddy.', '')}`;
    window.open(`${baseUrl}/api/resources/health`, '_blank');
  };

  const handleRunPipeline = () => {
    const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3300' : `https://api.${window.location.hostname.replace('buddy.', '')}`;
    fetch(`${baseUrl}/api/pipeline/run`, { method: 'POST' })
      .then(response => response.json())
      .then(data => console.log('Pipeline started:', data))
      .catch(error => console.error('Failed to start pipeline:', error));
  };

  return (
    <div className="p-8 bg-white h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Heady Buddy Control Panel</h2>
          <p className="text-gray-600">Launch and manage your Heady ecosystem</p>
        </div>

        {/* Primary Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Monitor className="w-8 h-8" />
              <h3 className="text-xl font-semibold">Admin + IDE</h3>
            </div>
            <p className="mb-4 text-blue-100">
              Full cockpit: Admin UI with embedded IDE surface
            </p>
            <button
              onClick={handleLaunchAdminIDE}
              className="w-full bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              Launch Admin + IDE
            </button>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Code className="w-8 h-8" />
              <h3 className="text-xl font-semibold">IDE Only</h3>
            </div>
            <p className="mb-4 text-green-100">
              Direct IDE experience with Heady services integrated
            </p>
            <button
              onClick={handleLaunchIDEOnly}
              className="w-full bg-white text-green-600 px-4 py-2 rounded-lg font-semibold hover:bg-green-50 transition-colors"
            >
              Launch IDE Only
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-50 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => {
                const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3300' : `https://api.${window.location.hostname.replace('buddy.', '')}`;
                window.open(`${baseUrl}/api/arena/status`, '_blank');
              }}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
            >
              <Zap className="w-6 h-6 text-purple-600" />
              <span className="text-sm text-gray-700">Arena Status</span>
            </button>
            <button
              onClick={handleCheckMetrics}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
            >
              <Activity className="w-6 h-6 text-blue-600" />
              <span className="text-sm text-gray-700">Check Metrics</span>
            </button>
            <button
              onClick={handleRunPipeline}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
            >
              <Play className="w-6 h-6 text-green-600" />
              <span className="text-sm text-gray-700">Run Pipeline</span>
            </button>
            <button
              onClick={onLaunchArenaMode}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
            >
              <History className="w-6 h-6 text-orange-600" />
              <span className="text-sm text-gray-700">Arena Mode</span>
            </button>
          </div>
        </div>

        {/* Current Project */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Project</h3>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">Heady Arena Mode Implementation</div>
              <div className="text-sm text-gray-500">Last activity: 2 minutes ago</div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm text-green-600">Active</span>
            </div>
          </div>
        </div>

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Projects</h3>
            <div className="space-y-3">
              {recentProjects.map((project, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div>
                    <div className="font-medium text-gray-900">{project.name}</div>
                    <div className="text-sm text-gray-500">{project.path}</div>
                  </div>
                  <div className="text-sm text-gray-400">
                    {new Date(project.lastOpened).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* System Status */}
        <div className="mt-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1">System Status</h3>
              <p className="text-indigo-100">All Heady services operational</p>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6" />
              <span className="font-semibold">OPTIMAL</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
