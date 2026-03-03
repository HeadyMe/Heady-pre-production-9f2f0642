import React, { useState } from 'react';
import { Network, ArrowRight, Shield, Zap } from 'lucide-react';

const ROUTES = [
    { from: 'headyme.com', to: 'manager.headysystems.com', via: 'Cloudflare Tunnel', status: 'active', tls: true },
    { from: 'headybuddy.org', to: 'manager:4201', via: 'Cloudflare Tunnel', status: 'active', tls: true },
    { from: 'headymcp.com', to: 'manager:3301/mcp', via: 'Cloudflare Tunnel', status: 'active', tls: true },
    { from: 'headysystems.com', to: 'manager:3301', via: 'Cloudflare Tunnel', status: 'active', tls: true },
    { from: 'headyconnection.org', to: 'manager:4600', via: 'Cloudflare Tunnel', status: 'active', tls: true },
    { from: 'headyio.com', to: 'manager:4500', via: 'Cloudflare Tunnel', status: 'active', tls: true },
    { from: 'admin.headysystems.com', to: 'localhost:4401', via: 'Cloudflare Tunnel', status: 'active', tls: true },
    { from: '*.headyme.com', to: 'edge-worker', via: 'Cloudflare Workers', status: 'active', tls: true },
];

export default function Routing() {
    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="rounded-2xl border border-violet-500/30 bg-slate-900/70 p-5">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Network className="w-6 h-6 text-violet-300" /> Routing Table
                </h1>
                <p className="text-slate-400 text-sm mt-1">All traffic routes through Cloudflare → Heady Manager</p>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900/70 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                            <th className="text-left px-4 py-3">Source</th>
                            <th className="text-left px-4 py-3">Destination</th>
                            <th className="text-left px-4 py-3">Via</th>
                            <th className="text-left px-4 py-3">TLS</th>
                            <th className="text-left px-4 py-3">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ROUTES.map((r, i) => (
                            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                <td className="px-4 py-3 text-white font-mono text-xs">{r.from}</td>
                                <td className="px-4 py-3 text-slate-300 font-mono text-xs flex items-center gap-2">
                                    <ArrowRight className="w-3 h-3 text-slate-600" /> {r.to}
                                </td>
                                <td className="px-4 py-3 text-slate-400 text-xs">{r.via}</td>
                                <td className="px-4 py-3">{r.tls ? <Shield className="w-3.5 h-3.5 text-emerald-400" /> : <span className="text-slate-600">—</span>}</td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${r.status === 'active' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${r.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                        {r.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
