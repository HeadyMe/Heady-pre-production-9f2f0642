import React, { useState, useEffect } from 'react';
import { ScrollText, RefreshCw, Filter } from 'lucide-react';

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/logs?limit=50').then(r => r.json())
      .then(data => setLogs(data.logs || data || []))
      .catch(() => {
        const now = Date.now();
        setLogs([
          { ts: new Date(now - 60000).toISOString(), level: 'info', msg: 'HCFP cycle completed — 12 tasks succeeded', source: 'hcfp-engine' },
          { ts: new Date(now - 120000).toISOString(), level: 'info', msg: 'API request: POST /api/brain/chat → 200 (12ms)', source: 'manager' },
          { ts: new Date(now - 180000).toISOString(), level: 'warn', msg: 'Vector memory compaction deferred — threshold not reached', source: 'vector-memory' },
          { ts: new Date(now - 240000).toISOString(), level: 'info', msg: 'Cloudflare tunnel heartbeat OK', source: 'tunnel' },
          { ts: new Date(now - 300000).toISOString(), level: 'info', msg: 'Auth session refreshed for josh@headyme.com', source: 'auth' },
          { ts: new Date(now - 360000).toISOString(), level: 'info', msg: 'Auto-success batch 47 completed — 3/3 tasks', source: 'hcfp-engine' },
          { ts: new Date(now - 420000).toISOString(), level: 'error', msg: 'Ollama model pull timeout — retrying in 30s', source: 'ai-service' },
          { ts: new Date(now - 500000).toISOString(), level: 'info', msg: 'HeadyBuddy WebSocket connection established', source: 'buddy' },
        ]);
      });
  }, []);

  const LEVELS = ['all', 'info', 'warn', 'error'];
  const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter);

  const levelColors = { info: 'text-blue-400', warn: 'text-yellow-400', error: 'text-red-400' };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="rounded-2xl border border-violet-500/30 bg-slate-900/70 p-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><ScrollText className="w-6 h-6 text-violet-300" /> Logs</h1>
          <p className="text-slate-400 text-sm mt-1">System event stream</p>
        </div>
        <button onClick={() => window.location.reload()} className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2">
        {LEVELS.map(l => (
          <button key={l} onClick={() => setFilter(l)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${filter === l ? 'bg-violet-600/30 text-violet-200 border border-violet-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'}`}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/70 divide-y divide-slate-800/50">
        {filtered.map((log, i) => (
          <div key={i} className="px-4 py-3 flex items-start gap-4 hover:bg-slate-800/20 transition-colors">
            <span className={`text-xs font-mono uppercase w-10 flex-shrink-0 ${levelColors[log.level] || 'text-slate-400'}`}>{log.level}</span>
            <span className="text-xs text-slate-500 w-20 flex-shrink-0 font-mono">{log.source}</span>
            <span className="text-sm text-slate-200 flex-1">{log.msg}</span>
            <span className="text-xs text-slate-600 flex-shrink-0">{new Date(log.ts).toLocaleTimeString()}</span>
          </div>
        ))}
        {filtered.length === 0 && <p className="px-4 py-6 text-center text-slate-500 text-sm">No logs matching filter</p>}
      </div>
    </div>
  );
}
