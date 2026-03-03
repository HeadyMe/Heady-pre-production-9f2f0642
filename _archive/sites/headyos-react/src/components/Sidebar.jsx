/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Sidebar() {
    const navItems = [
        { name: 'Command Center', path: '/', icon: '⬡' },
        { name: 'Fleet Manager', path: '/fleet', icon: '🤖' },
        { name: 'Package Builder', path: '/builder', icon: '📦' },
        { name: 'Security & PQC', path: '/security', icon: '🛡️' },
        { name: 'Edge Telemetry', path: '/telemetry', icon: '⚡' },
        { name: 'Billing & Tiers', path: '/billing', icon: '💳' },
        { name: 'IP Compliance', path: '/ip', icon: '⚖️' },
    ];

    return (
        <div className="w-64 h-screen fixed left-0 top-0 border-r border-white/10 bg-deep/80 backdrop-blur-xl flex flex-col pt-8 z-50">
            <div className="px-6 mb-10">
                <h2 className="text-2xl font-bold text-gradient tracking-tight">HeadyOS</h2>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-semibold">Admin Engine v1.0</p>
            </div>

            <nav className="flex-1 px-4 space-y-2">
                {navItems.map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `nav-item ${isActive ? 'active' : ''}`
                        }
                    >
                        <span className="text-xl w-6 text-center">{item.icon}</span>
                        <span className="font-medium text-sm">{item.name}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 mb-4 mx-4 glass-panel bg-emerald-500/5 border-emerald-500/20">
                <div className="text-xs text-emerald-400 font-semibold mb-1 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    PQC SECURED
                </div>
                <div className="text-[10px] text-slate-400">ML-KEM/ML-DSA Active</div>
            </div>
        </div >
    );
}
