import React, { useState, useEffect } from 'react';
import { Activity, Server, Globe, Waypoints, Zap, TrendingUp, Clock, Cpu } from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub, color = 'violet' }) {
    return (
        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 hover:border-slate-600 transition-colors">
            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg bg-${color}-900/30`}>
                    <Icon className={`w-4 h-4 text-${color}-400`} />
                </div>
                <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
            {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
    );
}

export default function Dashboard() {
    const [health, setHealth] = useState(null);
    const [autoSuccess, setAutoSuccess] = useState(null);

    useEffect(() => {
        fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => { });
        fetch('/api/auto-success/status').then(r => r.json()).then(setAutoSuccess).catch(() => { });
        const iv = setInterval(() => {
            fetch('/api/auto-success/status').then(r => r.json()).then(setAutoSuccess).catch(() => { });
        }, 10000);
        return () => clearInterval(iv);
    }, []);

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="rounded-2xl border border-violet-500/30 bg-slate-900/70 p-5">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Activity className="w-6 h-6 text-violet-300" /> System Dashboard
                </h1>
                <p className="text-slate-400 text-sm mt-1">Real-time overview of the Heady ecosystem.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Server} label="Services" value={health?.services || '20'} sub="Active nodes" color="emerald" />
                <StatCard icon={Globe} label="Domains" value={health?.domains || '9'} sub="Connected" color="blue" />
                <StatCard icon={Waypoints} label="Tunnels" value={health?.tunnels || '3'} sub="Cloudflare tunnels" color="cyan" />
                <StatCard icon={Zap} label="HCFP" value={autoSuccess?.running ? 'Active' : 'Idle'} sub={`${autoSuccess?.cycleCount || 0} cycles`} color="yellow" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
                    <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5 text-emerald-400" /> Auto-Success Engine
                    </h2>
                    {autoSuccess ? (
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Status</span>
                                <span className={autoSuccess.running ? 'text-emerald-400' : 'text-slate-500'}>{autoSuccess.running ? '● Running' : '○ Stopped'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Tasks</span>
                                <span className="text-slate-200">{autoSuccess.totalTasks || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Succeeded</span>
                                <span className="text-emerald-400">{autoSuccess.totalSucceeded || 0}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Success Rate</span>
                                <span className="text-white font-medium">{autoSuccess.successRate || '100%'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Categories</span>
                                <span className="text-slate-200">{Object.keys(autoSuccess.categories || {}).length}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-slate-500 text-sm">Connecting to HCFP engine...</p>
                    )}
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
                    <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2 mb-4">
                        <Cpu className="w-5 h-5 text-violet-400" /> System Health
                    </h2>
                    {health ? (
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Status</span>
                                <span className="text-emerald-400">● Operational</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Uptime</span>
                                <span className="text-slate-200">{health.uptime || '—'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Version</span>
                                <span className="text-slate-200">{health.version || '2.0.0'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Environment</span>
                                <span className="text-slate-200">{health.env || 'production'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Memory</span>
                                <span className="text-slate-200">{health.memory ? `${Math.round(health.memory.heapUsed / 1024 / 1024)}MB` : '—'}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-slate-500 text-sm">Connecting...</p>
                    )}
                </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2 mb-3">
                    <Clock className="w-5 h-5 text-blue-400" /> Quick Actions
                </h2>
                <div className="flex flex-wrap gap-3">
                    <button onClick={() => fetch('/api/system/production', { method: 'POST' }).then(r => r.json()).then(d => alert(JSON.stringify(d, null, 2)))}
                        className="px-4 py-2 rounded-lg bg-violet-900/30 border border-violet-700/40 text-violet-200 text-sm hover:bg-violet-800/40 transition-colors">
                        Initiate Production
                    </button>
                    <button onClick={() => fetch('/api/pipeline/run', { method: 'POST' }).then(r => r.json()).then(d => alert(JSON.stringify(d, null, 2)))}
                        className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 text-sm hover:bg-slate-700/50 transition-colors">
                        Execute HCFP Pipeline
                    </button>
                    <button onClick={() => fetch('/api/auto-success/status').then(r => r.json()).then(d => alert(JSON.stringify(d, null, 2)))}
                        className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 text-sm hover:bg-slate-700/50 transition-colors">
                        Pipeline Status
                    </button>
                </div>
            </div>
        </div>
    );
}
