/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
import React, { useState, useEffect } from 'react';

const INITIAL_FLEET_STATE = [
    { id: 'asst_architect', name: 'Heady Architect', role: 'Systems Design', load: 45, status: 'Active', latency: '12ms' },
    { id: 'asst_security', name: 'Heady Sentinel', role: 'PQC Compliance', load: 82, status: 'Active', latency: '8ms' },
    { id: 'asst_coder', name: 'Heady Coder', role: 'Full-Stack Dev', load: 95, status: 'Scaling...', latency: '45ms' },
    { id: 'asst_data', name: 'Heady Analyst', role: 'Telemetry', load: 12, status: 'Idle', latency: '5ms' },
    { id: 'asst_vision', name: 'Heady Lens', role: 'Computer Vision', load: 0, status: 'Sleeping', latency: '--' }
];

export default function FleetManager() {
    const [fleet, setFleet] = useState(INITIAL_FLEET_STATE);

    return (
        <div className="fade-in-up">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Fleet Command Canvas</h1>
                    <p className="text-slate-400">Manage, scale, and configure the HeadyManager 12-node swarm.</p>
                </div>
                <div className="flex gap-4">
                    <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-white/10">Force Sync Models</button>
                    <button className="btn-primary">Deploy New Agent</button>
                </div>
            </div>

            <div className="glass-panel overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active Swarm Topology
                    </h3>
                    <div className="text-sm text-slate-400">Total VRAM Allocated: <span className="text-blue-400 font-mono">142 GB</span></div>
                </div>

                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/5 bg-black/20 text-slate-400 text-xs uppercase tracking-wider">
                            <th className="p-4 font-semibold">Node ID</th>
                            <th className="p-4 font-semibold">Designation</th>
                            <th className="p-4 font-semibold">Load / State</th>
                            <th className="p-4 font-semibold">Latency</th>
                            <th className="p-4 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {fleet.map((node) => (
                            <tr key={node.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                <td className="p-4 font-mono text-slate-300 text-sm">{node.id}</td>
                                <td className="p-4">
                                    <div className="font-medium text-white">{node.name}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">{node.role}</div>
                                </td>
                                <td className="p-4">
                                    <div className="w-48">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className={`font-medium ${node.load > 80 ? 'text-rose-400' : node.load > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                {node.status}
                                            </span>
                                            <span className="text-slate-400 font-mono">{node.load}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${node.load > 80 ? 'bg-rose-500' : node.load > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${node.load}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-emerald-400 font-mono text-sm">{node.latency}</td>
                                <td className="p-4 text-right">
                                    <button className="text-slate-400 hover:text-white px-3 py-1 bg-white/5 hover:bg-white/10 rounded transition-colors text-sm border border-white/5 opacity-0 group-hover:opacity-100">
                                        Configure
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div >
        </div >
    );
}
