import React, { useState } from 'react';

export default function UniversalAuthModal({ onLogin }) {
    const [isOpen, setIsOpen] = useState(true);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="w-[450px] p-8 rounded-2xl border border-white/20 bg-slate-900/60 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                {/* Ambient Glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-[60px]" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/20 rounded-full blur-[60px]" />

                <div className="relative z-10 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.5)]">
                        <span className="text-2xl font-bold font-sans text-white">H</span>
                    </div>
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 mb-2">
                        Heady Universal Identity
                    </h2>
                    <p className="text-slate-400 text-sm mb-6">
                        Authenticate to sync your persistent 3D vector memory across the Heady edge.
                    </p>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            setIsOpen(false);
                            onLogin();
                        }}
                        className="flex flex-col gap-4 text-left"
                    >
                        <div>
                            <label className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1 block">Vector Protocol ID</label>
                            <input
                                type="text"
                                defaultValue="admin@headysystems.com"
                                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-1 block">Quantum Node Pass</label>
                            <input
                                type="password"
                                defaultValue="••••••••••••"
                                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            className="mt-4 w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-300 active:scale-95"
                        >
                            Establish Uplink & Sync Memory
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
