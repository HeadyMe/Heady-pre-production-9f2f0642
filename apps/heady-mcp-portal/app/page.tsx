export default function HeadyMCPPortalPage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-slate-900 text-white">
            <div className="max-w-4xl mx-auto px-6 py-16">
                <header className="text-center mb-16">
                    <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-pink-400">
                        Heady MCP
                    </h1>
                    <p className="text-xl text-slate-400 mt-4">
                        Model Context Protocol Hub — 31 Tools, Zero Stubs
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { cat: 'Memory', count: 5, icon: '🧠' },
                        { cat: 'Research', count: 4, icon: '🔍' },
                        { cat: 'Code', count: 4, icon: '💻' },
                        { cat: 'System', count: 4, icon: '⚙️' },
                        { cat: 'Analysis', count: 3, icon: '📊' },
                        { cat: 'Creative', count: 3, icon: '🎨' },
                        { cat: 'Pipeline', count: 3, icon: '⚡' },
                        { cat: 'Agents', count: 2, icon: '🤖' },
                        { cat: 'Trading', count: 2, icon: '📈' },
                        { cat: 'Deploy', count: 1, icon: '🚀' },
                    ].map(({ cat, count, icon }) => (
                        <div key={cat} className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4 flex items-center gap-4 hover:border-violet-500/50 transition-all">
                            <span className="text-2xl">{icon}</span>
                            <div>
                                <h3 className="font-semibold">{cat}</h3>
                                <p className="text-sm text-slate-400">{count} tools</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-12 text-center">
                    <code className="bg-white/10 px-4 py-2 rounded-lg text-sm text-violet-300">
                        POST /mcp/rpc — Streamable HTTP + SSE fallback
                    </code>
                </div>
            </div>
        </main>
    );
}
