import React, { useState } from 'react';
import { Settings as SettingsIcon, Save, Key, Globe, Cpu, Shield } from 'lucide-react';

export default function Settings() {
  const [config, setConfig] = useState({
    apiEndpoint: 'https://manager.headysystems.com',
    hcfpInterval: 60000,
    batchSize: 3,
    autoSuccessEnabled: true,
    vectorMemoryPath: './data/vector-memory',
    logLevel: 'info',
    corsOrigins: '*.headyme.com, *.headysystems.com, *.headybuddy.org',
    maxTokenBudget: 1000000,
  });

  const update = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

  const saveSettings = () => {
    fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
      .then(() => alert('Settings saved'))
      .catch(() => alert('Saved locally (API not connected)'));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="rounded-2xl border border-violet-500/30 bg-slate-900/70 p-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><SettingsIcon className="w-6 h-6 text-violet-300" /> Settings</h1>
          <p className="text-slate-400 text-sm mt-1">System configuration</p>
        </div>
        <button onClick={saveSettings} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-500 transition-colors">
          <Save className="w-4 h-4" /> Save
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Globe className="w-5 h-5 text-blue-400" /> API & Network</h2>
          <label className="block text-sm text-slate-300">Manager Endpoint
            <input value={config.apiEndpoint} onChange={e => update('apiEndpoint', e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-sm text-white focus:outline-none focus:border-violet-500" />
          </label>
          <label className="block text-sm text-slate-300">CORS Origins
            <input value={config.corsOrigins} onChange={e => update('corsOrigins', e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-sm text-white focus:outline-none focus:border-violet-500" />
          </label>
          <label className="block text-sm text-slate-300">Log Level
            <select value={config.logLevel} onChange={e => update('logLevel', e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-sm text-white focus:outline-none focus:border-violet-500">
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
            </select>
          </label>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Cpu className="w-5 h-5 text-emerald-400" /> HCFP Pipeline</h2>
          <label className="block text-sm text-slate-300">Pipeline Interval (ms)
            <input type="number" value={config.hcfpInterval} onChange={e => update('hcfpInterval', Number(e.target.value))}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-sm text-white focus:outline-none focus:border-violet-500" />
          </label>
          <label className="block text-sm text-slate-300">Batch Size
            <input type="number" min="1" max="10" value={config.batchSize} onChange={e => update('batchSize', Number(e.target.value))}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-sm text-white focus:outline-none focus:border-violet-500" />
          </label>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Auto-Success Enabled</span>
            <button onClick={() => update('autoSuccessEnabled', !config.autoSuccessEnabled)}
              className={`w-10 h-5 rounded-full transition-colors relative ${config.autoSuccessEnabled ? 'bg-violet-600' : 'bg-slate-700'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.autoSuccessEnabled ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Shield className="w-5 h-5 text-yellow-400" /> Memory & Budget</h2>
          <label className="block text-sm text-slate-300">Vector Memory Path
            <input value={config.vectorMemoryPath} onChange={e => update('vectorMemoryPath', e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-sm text-white font-mono focus:outline-none focus:border-violet-500" />
          </label>
          <label className="block text-sm text-slate-300">Max Token Budget
            <input type="number" value={config.maxTokenBudget} onChange={e => update('maxTokenBudget', Number(e.target.value))}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 p-2 text-sm text-white focus:outline-none focus:border-violet-500" />
          </label>
        </div>
      </div>
    </div>
  );
}
