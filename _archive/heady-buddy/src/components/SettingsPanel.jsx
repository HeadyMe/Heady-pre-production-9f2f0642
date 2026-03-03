import React, { useState } from 'react';
import { Settings, Moon, Sun, Monitor, Zap, Shield, Bell } from 'lucide-react';

const SettingsPanel = ({ preferences, onSave }) => {
  const [localPreferences, setLocalPreferences] = useState(preferences);

  const handleChange = (key, value) => {
    const newPrefs = { ...localPreferences, [key]: value };
    setLocalPreferences(newPrefs);
  };

  const handleSave = () => {
    onSave(localPreferences);
  };

  return (
    <div className="p-8 bg-gray-50 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Settings</h2>
          <p className="text-gray-600">Configure your Heady Buddy preferences</p>
        </div>

        {/* Appearance */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Monitor className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-semibold">Appearance</h3>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Theme</label>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => handleChange('theme', 'light')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${localPreferences.theme === 'light'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <Sun className="w-6 h-6 text-yellow-500" />
                  <span className="text-sm font-medium">Light</span>
                </button>
                <button
                  onClick={() => handleChange('theme', 'dark')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${localPreferences.theme === 'dark'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <Moon className="w-6 h-6 text-gray-700" />
                  <span className="text-sm font-medium">Dark</span>
                </button>
                <button
                  onClick={() => handleChange('theme', 'system')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${localPreferences.theme === 'system'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <Monitor className="w-6 h-6 text-gray-500" />
                  <span className="text-sm font-medium">System</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Default Mode */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-6 h-6 text-purple-600" />
            <h3 className="text-xl font-semibold">Default Launch Mode</h3>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="defaultMode"
                value="admin-ide"
                checked={localPreferences.defaultMode === 'admin-ide'}
                onChange={(e) => handleChange('defaultMode', e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <div>
                <div className="font-medium">Admin + IDE</div>
                <div className="text-sm text-gray-500">Full control room with embedded development</div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="defaultMode"
                value="ide-only"
                checked={localPreferences.defaultMode === 'ide-only'}
                onChange={(e) => handleChange('defaultMode', e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <div>
                <div className="font-medium">IDE Only</div>
                <div className="text-sm text-gray-500">Focused development environment</div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="defaultMode"
                value="control-panel"
                checked={localPreferences.defaultMode === 'control-panel'}
                onChange={(e) => handleChange('defaultMode', e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <div>
                <div className="font-medium">Control Panel</div>
                <div className="text-sm text-gray-500">Quick access to all Heady services</div>
              </div>
            </label>
          </div>
        </div>

        {/* System Behavior */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-6 h-6 text-green-600" />
            <h3 className="text-xl font-semibold">System Behavior</h3>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-yellow-500" />
                <div>
                  <div className="font-medium">Auto-start with System</div>
                  <div className="text-sm text-gray-500">Launch Heady Buddy automatically on login</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={localPreferences.autoStart}
                onChange={(e) => handleChange('autoStart', e.target.checked)}
                className="w-4 h-4 text-blue-600"
              />
            </label>
            <label className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-blue-500" />
                <div>
                  <div className="font-medium">System Notifications</div>
                  <div className="text-sm text-gray-500">Receive alerts for important events</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={localPreferences.notifications !== false}
                onChange={(e) => handleChange('notifications', e.target.checked)}
                className="w-4 h-4 text-blue-600"
              />
            </label>
            <label className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-green-500" />
                <div>
                  <div className="font-medium">Security Mode</div>
                  <div className="text-sm text-gray-500">Enhanced security for sensitive operations</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={localPreferences.securityMode !== false}
                onChange={(e) => handleChange('securityMode', e.target.checked)}
                className="w-4 h-4 text-blue-600"
              />
            </label>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-6 h-6 text-orange-600" />
            <h3 className="text-xl font-semibold">Advanced</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Endpoint
              </label>
              <input
                type="url"
                value={localPreferences.apiEndpoint || (window.location.hostname === 'localhost' ? 'http://localhost:3300' : `https://api.${window.location.hostname.replace('buddy.', '')}`)}
                onChange={(e) => handleChange('apiEndpoint', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={window.location.hostname === 'localhost' ? 'http://localhost:3300' : `https://api.${window.location.hostname.replace('buddy.', '')}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Health Check Interval (seconds)
              </label>
              <input
                type="number"
                value={localPreferences.healthCheckInterval || 30}
                onChange={(e) => handleChange('healthCheckInterval', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="10"
                max="300"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
