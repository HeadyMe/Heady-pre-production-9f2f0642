/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
import React, { useEffect, useState } from 'react';

export default function StatusWidget() {
    const [status, setStatus] = useState('Loading...');

    // Simulated fetch to the PQC-secured status endpoint
    useEffect(() => {
        setTimeout(() => {
            setStatus('OPERATIONAL');
        }, 800);
    }, []);

    const isUp = status === 'OPERATIONAL';

    return (
        <div className="glass-panel p-6 relative overflow-hidden group border-emerald-500/20 hover:border-emerald-500/40">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors"></div>

            <div className="text-slate-400 text-sm mb-2 font-medium relative z-10">System Status</div>
            <div className={`text-3xl font-bold relative z-10 ${isUp ? 'text-emerald-400' : 'text-slate-300'}`}>
                {status}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 relative z-10">
                <div className={`w-1.5 h-1.5 rounded-full ${isUp ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></div>
                All core systems nominal
            </div >
        </div >
    );
}
