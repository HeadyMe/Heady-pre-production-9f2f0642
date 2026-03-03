/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import UniversalAuthModal from '../components/UniversalAuthModal';
import HeadyBuddyWidget from '../components/HeadyBuddyWidget';

export default function Layout() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    return (
        <div className="flex min-h-screen bg-deep text-slate-200 selection:bg-blue-500/30">
            {/* Universal Authentication Wrapper */}
            {!isAuthenticated && <UniversalAuthModal onLogin={() => setIsAuthenticated(true)} />}

            {/* Fixed Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <div className="flex-1 ml-64 flex flex-col h-screen">
                {/* Top Navbar */}
                <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-deep/50 backdrop-blur-sm sticky top-0 z-40">
                    <div className="flex items-center gap-4">
                        <div className="px-3 py-1 rounded bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20">
                            PRODUCTION LIVE
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="text-slate-400 hover:text-white transition-colors">🔔</button>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-sm font-bold shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                            {isAuthenticated ? 'A' : 'H'}
                        </div>
                    </div>
                </header>

                {/* Scrollable Page Content */}
                <main className="flex-1 overflow-y-auto p-8 relative">
                    {/* Subtle background glow */}
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none"></div>

                    <div className="relative z-10 max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* Global HeadyBuddy Widget (Unlocked post-auth) */}
            {isAuthenticated && <HeadyBuddyWidget />}
        </div>
    );
}
