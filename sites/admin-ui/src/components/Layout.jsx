import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Server, Globe, Waypoints, Palette, Users, ScrollText,
    Settings, Menu, X, ChevronRight, Network, ClipboardList, Hexagon, Sparkles, Boxes
} from 'lucide-react';

const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'core' },
    { to: '/services', icon: Server, label: 'Services', section: 'core' },
    { to: '/routing', icon: Network, label: 'Routing', section: 'core' },
    { to: '/domains', icon: Globe, label: 'Domains', section: 'core' },
    { to: '/tunnels', icon: Waypoints, label: 'Tunnels', section: 'core' },
    { to: '/ai', icon: Sparkles, label: 'AI Studio', section: 'apps', badge: 'ULTRA' },
    { to: '/app-lab', icon: Boxes, label: 'App Lab', section: 'apps', badge: 'NEW' },
    { to: '/tasks', icon: ClipboardList, label: 'Task Manager', section: 'apps' },
    { to: '/design', icon: Palette, label: 'Design Config', section: 'apps' },
    { to: '/users', icon: Users, label: 'Users', section: 'admin' },
    { to: '/logs', icon: ScrollText, label: 'Logs', section: 'admin' },
    { to: '/settings', icon: Settings, label: 'Settings', section: 'admin' },
];

const SECTION_LABELS = { core: 'Infrastructure', apps: 'Applications', admin: 'Admin' };

function SacredHexLogo({ size = 32 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
            <polygon points="20,2 36,11 36,29 20,38 4,29 4,11"
                fill="none" stroke="url(#g1)" strokeWidth="1.5" />
            <polygon points="20,8 30,14 30,26 20,32 10,26 10,14"
                fill="none" stroke="url(#g2)" strokeWidth="1" opacity="0.6" />
            <circle cx="20" cy="20" r="4" fill="url(#g1)" />
            <line x1="20" y1="2" x2="20" y2="8" stroke="url(#g1)" strokeWidth="1" opacity="0.5" />
            <line x1="20" y1="32" x2="20" y2="38" stroke="url(#g1)" strokeWidth="1" opacity="0.5" />
            <line x1="4" y1="11" x2="10" y2="14" stroke="url(#g1)" strokeWidth="1" opacity="0.5" />
            <line x1="36" y1="11" x2="30" y2="14" stroke="url(#g1)" strokeWidth="1" opacity="0.5" />
            <line x1="4" y1="29" x2="10" y2="26" stroke="url(#g1)" strokeWidth="1" opacity="0.5" />
            <line x1="36" y1="29" x2="30" y2="26" stroke="url(#g1)" strokeWidth="1" opacity="0.5" />
            <defs>
                <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
                <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
            </defs>
        </svg>
    );
}

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [hcfpHealth, setHcfpHealth] = useState(null);
    const location = useLocation();
    const currentPage = location.pathname.split('/').filter(Boolean)[0] || 'dashboard';

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const res = await fetch('/api/auto-success/status');
                const data = await res.json();
                const score = data.running ? (data.successRate ? parseInt(data.successRate) : 100) : 0;
                setHcfpHealth({
                    score,
                    color: score > 80 ? '#10b981' : score > 50 ? '#f59e0b' : '#ef4444',
                    label: data.running ? 'HCFP Active' : 'Offline',
                    mode: data.mode || 'auto',
                    subsystems: Object.keys(data.categories || {}),
                });
            } catch {
                setHcfpHealth({ score: null, color: '#6b7280', label: 'Connecting…', subsystems: [] });
            }
        };
        fetchHealth();
        const iv = setInterval(fetchHealth, 15000);
        return () => clearInterval(iv);
    }, []);

    const sections = Object.entries(SECTION_LABELS);

    return (
        <div className="flex min-h-screen bg-[#060a18]">
            {/* ── Sidebar ── */}
            <aside
                className={`fixed top-0 left-0 h-screen z-30 flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-16'}`}
                style={{
                    background: 'linear-gradient(180deg, rgba(10,15,30,0.98) 0%, rgba(15,10,40,0.95) 100%)',
                    borderRight: '1px solid rgba(139,92,246,0.15)',
                }}
            >
                <div className="h-16 flex items-center justify-between px-4">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <SacredHexLogo size={28} />
                        {sidebarOpen && <span className="text-sm font-semibold text-violet-200 whitespace-nowrap tracking-wide">Heady Admin</span>}
                    </div>
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-1.5 rounded-lg hover:bg-slate-800/60 text-violet-300 transition-colors"
                    >
                        {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                    </button>
                </div>

                <nav className="flex-1 py-4 overflow-y-auto">
                    {sections.map(([key, label]) => {
                        const items = navItems.filter(n => n.section === key);
                        return (
                            <div key={key} className="mb-4">
                                {sidebarOpen && (
                                    <p className="px-5 mb-1 text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">{label}</p>
                                )}
                                {items.map(item => {
                                    const Icon = item.icon;
                                    return (
                                        <NavLink
                                            key={item.to}
                                            to={item.to}
                                            className={({ isActive }) =>
                                                `flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm transition-all duration-200 group
                        ${isActive
                                                    ? 'bg-violet-900/30 text-violet-200 border-l-2 border-violet-400'
                                                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200 border-l-2 border-transparent'}`
                                            }
                                        >
                                            <Icon className="w-4 h-4 shrink-0" />
                                            {sidebarOpen && (
                                                <>
                                                    <span className="flex-1">{item.label}</span>
                                                    {item.badge && (
                                                        <span className={`text-[0.55rem] font-bold px-1.5 py-0.5 rounded-full ${item.badge === 'NEW' ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/40'
                                                            : item.badge === 'ULTRA' ? 'bg-violet-900/50 text-violet-300 border border-violet-700/40'
                                                                : 'bg-slate-800 text-slate-400'
                                                            }`}>
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </NavLink>
                                    );
                                })}
                            </div>
                        );
                    })}
                </nav>

                {sidebarOpen && hcfpHealth && (
                    <div className="px-4 pb-4">
                        <div className="rounded-lg p-3" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: hcfpHealth.color }} />
                                <span className="text-xs font-medium text-violet-300">HCFP Engine</span>
                            </div>
                            <div className="text-lg font-bold tabular-nums" style={{ color: hcfpHealth.color }}>
                                {hcfpHealth.score ?? '—'}%
                            </div>
                        </div>
                        <p className="text-[0.6rem] text-slate-600 mt-2 text-center">
                            v2.0.0 · {hcfpHealth?.subsystems?.length || '…'} subsystems · φ-weighted
                        </p>
                    </div>
                )}
            </aside>

            {/* ── Main Content ── */}
            <div className={`flex-1 ${sidebarOpen ? 'ml-64' : 'ml-16'} transition-all duration-300 min-h-screen`}>
                {/* Top Bar */}
                <header
                    className="h-16 flex items-center justify-between px-6 sticky top-0 z-20"
                    style={{
                        background: 'rgba(10,15,30,0.92)',
                        backdropFilter: 'blur(12px)',
                        borderBottom: '1px solid rgba(139,92,246,0.2)',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                    }}
                >
                    <div className="flex items-center gap-2 text-sm">
                        <span style={{ color: 'rgba(148,163,184,0.5)' }}>Heady Admin</span>
                        <ChevronRight className="w-4 h-4" style={{ color: 'rgba(139,92,246,0.4)' }} />
                        <span className="font-medium capitalize" style={{ color: '#c4b5fd' }}>
                            {currentPage === 'routing' ? 'Routing' :
                                currentPage === 'tasks' ? 'Task Manager' :
                                    currentPage === 'ai' ? 'AI Studio' :
                                        currentPage === 'app-lab' ? 'App Lab' :
                                            currentPage.charAt(0).toUpperCase() + currentPage.slice(1)}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        {hcfpHealth && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                                style={{ background: `${hcfpHealth.color || '#10b981'}15`, border: `1px solid ${hcfpHealth.color || '#10b981'}30` }}>
                                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: hcfpHealth.color || '#10b981' }} />
                                <span className="text-xs font-bold tabular-nums" style={{ color: hcfpHealth.color || '#6ee7b7' }}>
                                    {hcfpHealth.score ?? '—'}%
                                </span>
                                <span className="text-xs font-medium" style={{ color: `${hcfpHealth.color || '#6ee7b7'}cc` }}>
                                    {hcfpHealth.label || hcfpHealth.mode || 'Connecting…'}
                                </span>
                            </div>
                        )}
                        <div className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: '1px solid rgba(255,215,0,0.3)' }}>
                            <Hexagon className="w-4 h-4 text-yellow-300" />
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
