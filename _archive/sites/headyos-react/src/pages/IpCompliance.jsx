/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
import React from 'react';

export default function IpCompliance() {
    return (
        <div className="fade-in-up">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">IP Compliance</h1>
                    <p className="text-slate-400">Trade secret classification, digital fingerprinting, and asset heatmap.</p>
                </div>
                <button className="btn-primary">Export Audit Log</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="glass-panel p-6">
                    <div className="text-slate-400 text-sm mb-2 font-medium">Classified Assets</div>
                    <div className="text-3xl font-bold">14,291</div>
                    <div className="text-xs text-emerald-400 mt-2">↑ 124 this week</div>
                </div>
                <div className="glass-panel p-6">
                    <div className="text-slate-400 text-sm mb-2 font-medium">Digital Fingerprints</div>
                    <div className="text-3xl font-bold text-purple-400">100%</div>
                    <div className="text-xs text-purple-400 mt-2">Active Enforcement</div>
                </div>
                <div className="glass-panel p-6">
                    <div className="text-slate-400 text-sm mb-2 font-medium">Open Source Conflicts</div>
                    <div className="text-3xl font-bold text-emerald-400">0</div>
                    <div className="text-xs text-emerald-500 mt-2">Clean Bill of Health</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-panel p-6 min-h-[400px] flex flex-col">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <span className="text-blue-400">🛡️</span> Asset Protection Matrix
                    </h3>
                    <div className="flex-1 border border-white/5 rounded-lg bg-slate-900/50 p-4">
                        <div className="space-y-4">
                            {['Heady Engine Core', 'Quantum Telemetry', 'Agentic Workflows', 'Neural Layout Protocol'].map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 rounded-md bg-white/5 hover:bg-white/10 transition-colors">
                                    <span className="font-medium text-slate-200">{item}</span>
                                    <div className="flex gap-3">
                                        <span className="px-2 py-1 text-[10px] uppercase font-bold text-emerald-400 bg-emerald-400/10 rounded">Protected</span>
                                        <span className="px-2 py-1 text-[10px] uppercase font-bold text-blue-400 bg-blue-400/10 rounded">WASM obfuscated</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6 min-h-[400px] flex flex-col">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <span className="text-purple-400">📡</span> Real-time Violation Scans
                    </h3>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                        {[
                            { event: 'GitHub Repo Scan', time: 'Just now', status: 'Clean' },
                            { event: 'NPM Dependency Audit', time: '10m ago', status: 'Clean' },
                            { event: 'Code Copyleft Check', time: '1h ago', status: 'Clean' },
                            { event: 'API Key Leak Check', time: '2h ago', status: 'Clean' }
                        ].map((item, idx) => (
                            <div key={idx} className="flex items-start gap-4 pb-4 border-b border-white/5 last:border-0 hover:translate-x-1 transition-transform cursor-default">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 animate-pulse"></div>
                                <div>
                                    <div className="text-slate-200">{item.event}</div>
                                    <div className="text-slate-500 text-xs">Automated routine check</div>
                                </div>
                                <div className="ml-auto text-right">
                                    <div className="text-xs text-slate-400">{item.time}</div>
                                    <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-semibold">{item.status}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
