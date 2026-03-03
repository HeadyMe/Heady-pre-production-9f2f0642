import React from 'react';
import { Waypoints, Shield, Activity } from 'lucide-react';

const TUNNELS = [
    { name: 'heady-main', id: 'cf-tunnel-main', status: 'active', routes: ['headyme.com', 'headysystems.com', 'manager.headysystems.com'], protocol: 'QUIC' },
    { name: 'heady-apps', id: 'cf-tunnel-apps', status: 'active', routes: ['headybuddy.org', 'headyconnection.org', 'headyio.com'], protocol: 'QUIC' },
    { name: 'heady-dev', id: 'cf-tunnel-dev', status: 'active', routes: ['admin.headysystems.com', 'ide.headysystems.com', 'headymcp.com'], protocol: 'QUIC' },
];

export default function Tunnels() {
    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="rounded-2xl border border-violet-500/30 bg-slate-900/70 p-5">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Waypoints className="w-6 h-6 text-violet-300" /> Cloudflare Tunnels</h1>
                <p className="text-slate-400 text-sm mt-1">{TUNNELS.length} tunnels · all traffic encrypted end-to-end</p>
            </div>
            <div className="space-y-4">
                {TUNNELS.map(t => (
                    <div key={t.id} className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <h3 className="text-white font-medium">{t.name}</h3>
                                <span className="text-xs text-slate-500 font-mono">{t.id}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs text-slate-400">{t.protocol}</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {t.routes.map(r => (
                                <span key={r} className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-slate-300 border border-slate-700">{r}</span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
