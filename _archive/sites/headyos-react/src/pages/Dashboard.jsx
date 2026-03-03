/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
import React from 'react';
import StatusWidget from '../components/StatusWidget';

export default function Dashboard() {
    return (
        <div className="fade-in-up">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Command Center</h1>
                    <p className="text-slate-400">Real-time telemetry and system orchestration.</p>
                </div>
                <button className="btn-primary">Generate Report</button>
            </div>

            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <StatusWidget />
                <div className="glass-panel p-6">
                    <div className="text-slate-400 text-sm mb-2 font-medium">Active Assistants</div>
                    <div className="text-3xl font-bold">12 <span className="text-sm text-slate-500 font-normal">/ 12</span></div>
                    <div className="text-xs text-emerald-400 mt-2">100% Availability</div>
                </div>
                <div className="glass-panel p-6">
                    <div className="text-slate-400 text-sm mb-2 font-medium">Edge Cache Hit Rate</div>
                    <div className="text-3xl font-bold text-blue-400">94.2%</div>
                    <div className="text-xs text-blue-400 mt-2">Predictive Warming Active</div>
                </div>
                <div className="glass-panel p-6">
                    <div className="text-slate-400 text-sm mb-2 font-medium">Active Sessions</div>
                    <div className="text-3xl font-bold">8,241</div>
                    <div className="text-xs text-slate-500 mt-2">Global Routing</div>
                </div>
            </div>

            {/* Main Charts/Activity Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-panel p-6 h-96 flex flex-col">
                    <h3 className="text-lg font-semibold mb-6">Service Group Load Distribution</h3>
                    <div className="flex-1 flex items-center justify-center border border-white/5 rounded-lg bg-deep/50">
                        <span className="text-slate-500 text-sm italic">Live chart visualization hooks here</span>
                    </div>
                </div>
                <div className="glass-panel p-6 h-96 flex flex-col">
                    <h3 className="text-lg font-semibold mb-4">Conductor Activity</h3>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="flex items-start gap-3 text-sm pb-4 border-b border-white/5 last:border-0">
                                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5"></div>
                                <div>
                                    <div className="text-slate-200">Scale event triggered</div>
                                    <div className="text-slate-500 text-xs">Reasoning group scaled up (+1 replica)</div>
                                </div>
                                <div className="ml-auto text-xs text-slate-600">2m ago</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
