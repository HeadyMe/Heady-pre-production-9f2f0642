/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
import React from 'react';

const SITES = [
    { name: 'HeadySystems Prod', url: 'https://headysystems.com', tunnel: 'Active (Port 443)', traffic: '12K req/hr', health: '100%' },
    { name: 'HeadyBuddy Internal', url: 'localhost:8080', tunnel: 'Active (Mesh Proxy)', traffic: '850 req/hr', health: '99.9%' },
    { name: 'HeadyAPI Gateway', url: 'https://api.headysystems.com', tunnel: 'Active (PQC Encrypted)', traffic: '45K req/hr', health: '100%' },
    { name: 'Heady Docs', url: 'https://docs.headysystems.com', tunnel: 'Active (Edge Cached)', traffic: '2.1K req/hr', health: '100%' },
    { name: 'HF Space Sync', url: 'https://headyhub.co/spaces/headyme/...', tunnel: 'WebHook Mirror', traffic: '--', health: 'Synced' },
];

export default function NetworkTunnels() {
    return (
        <div className="fade-in-up">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Network Topology & Tunnels</h1>
                    <p className="text-slate-400">Direct mesh-tunnels into the internals of all 22 Heady properties.</p>
                </div>
                <button className="btn-primary flex items-center gap-2">
                    <span>+</span> New Tunnel
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {SITES.map((site, i) => (
                    <div key={i} className="glass-panel p-6 group hover:border-blue-500/30 transition-all cursor-pointer relative overflow-hidden">
                        {/* Hover Glow Effect */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/0 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors duration-500 pointer-events-none"></div>

                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-200 group-hover:text-blue-400 transition-colors">{site.name}</h3>
                                <a href={site.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:text-blue-400 font-mono mt-1 inline-block truncate max-w-[200px]">
                                    {site.url}
                                </a>
                            </div>
                            <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/20 text-emerald-400 text-xs font-bold shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                {site.health}
                            </div>
                        </div>

                        <div className="space-y-3 mt-6 border-t border-white/5 pt-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Tunnel Status</span>
                                <span className="text-slate-300 font-medium">{site.tunnel}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Live Traffic</span>
                                <span className="text-slate-300 font-mono">{site.traffic}</span>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                            <button className="flex-1 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-colors text-sm font-medium">Config Sync</button>
                            <button className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors text-sm font-medium border border-white/5">Restart</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
