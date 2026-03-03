/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
import React from 'react';

export default function SecurityPanel() {
    return (
        <div className="fade-in-up">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Security, PQC & Audits</h1>
                    <p className="text-slate-400">Manage Post-Quantum Cryptography keys, zero-trust policies, and API rate limits.</p>
                </div>
                <button className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-lg transition-colors border border-rose-500/20 font-medium">Force Key Rotation</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-panel p-6 border-emerald-500/20">
                    <h3 className="font-semibold text-lg flex items-center gap-2 mb-6">
                        <span className="text-emerald-400">🛡️</span> Active Defense Systems
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-white/5 rounded border border-white/5">
                            <div>
                                <div className="font-medium text-slate-200">ML-KEM Key Encapsulation</div>
                                <div className="text-xs text-slate-500 mt-1">Hybrid X25519 Fallback</div>
                            </div>
                            <div className="text-emerald-400 text-sm font-bold">ACTIVE</div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-white/5 rounded border border-white/5">
                            <div>
                                <div className="font-medium text-slate-200">ML-DSA Signatures</div>
                                <div className="text-xs text-slate-500 mt-1">Hybrid Ed25519 Handshake</div>
                            </div>
                            <div className="text-emerald-400 text-sm font-bold">ACTIVE</div>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-white/5 rounded border border-white/5">
                            <div>
                                <div className="font-medium text-slate-200">Heady Rate Limiter</div>
                                <div className="text-xs text-slate-500 mt-1">Redis-backed scrape protection</div>
                            </div>
                            <div className="text-blue-400 text-sm font-bold">ARMED</div>
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6">
                    <h3 className="font-semibold text-lg mb-4">Security Audit Log</h3>
                    <div className="text-xs text-slate-500 font-mono space-y-2 h-64 overflow-y-auto">
                        <div>[2026-02-24T18:42Z] ✓ Handshake verified (SHA3-256)</div>
                        <div>[2026-02-24T18:11Z] ✓ PQC Auto-Rotation successful</div>
                        <div>[2026-02-24T17:55Z] ⚠ Rate limit triggered (IP: 104.22.x.x)</div>
                        <div>[2026-02-24T12:00Z] ✓ mTLS cert issued to Edge Proxy</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
