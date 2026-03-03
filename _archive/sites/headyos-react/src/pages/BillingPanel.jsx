/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
import React from 'react';

export default function BillingPanel() {
    return (
        <div className="fade-in-up">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Billing & Gateway Configurations</h1>
                    <p className="text-slate-400">Manage Stripe subscription tiers, Firebase auth bridges, and user quotas.</p>
                </div>
                <button className="btn-primary">Sync with Stripe</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 border-blue-500/20">
                    <h3 className="font-bold text-xl mb-2 text-slate-200">Pro Tier</h3>
                    <div className="text-3xl font-bold text-gradient mb-4">$20<span className="text-lg text-slate-500 font-medium">/mo</span></div>
                    <ul className="text-sm text-slate-400 space-y-2 mb-6">
                        <li>✓ Unlimited HeadyBrain Invokes</li>
                        <li>✓ HeadyBuddy Mobile Sync</li>
                        <li>✓ Basic predictive caching</li>
                    </ul>
                    <button className="w-full py-2 bg-white/5 hover:bg-white/10 rounded transition-colors border border-white/10">Edit Plan</button>
                </div>

                <div className="glass-panel p-6 border-purple-500/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 px-3 py-1 bg-purple-500 text-white text-[10px] font-bold tracking-wider rounded-bl-lg">POPULAR</div>
                    <h3 className="font-bold text-xl mb-2 text-slate-200">Enterprise</h3>
                    <div className="text-3xl font-bold text-gradient mb-4">$99<span className="text-lg text-slate-500 font-medium">/mo</span></div>
                    <ul className="text-sm text-slate-400 space-y-2 mb-6">
                        <li>✓ Edge GPU Multimodal (Uncapped)</li>
                        <li>✓ PQC Handshake Access API</li>
                        <li>✓ Priority Vector Zone Routing</li>
                    </ul>
                    <button className="w-full py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded transition-colors border border-purple-500/30">Edit Plan</button>
                </div>

                <div className="glass-panel p-6 flex flex-col justify-center items-center text-center opacity-60">
                    <div className="text-4xl mb-2">➕</div>
                    <div className="font-medium text-slate-300">Create Custom Plan</div>
                    <div className="text-xs text-slate-500 mt-1">Define Stripe price ID</div>
                </div>
            </div>
        </div>
    );
}
