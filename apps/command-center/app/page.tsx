export default function CommandCenterPage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white">
            <div className="max-w-6xl mx-auto px-6 py-16">
                <header className="text-center mb-16">
                    <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-cyan-400">
                        Heady Command Center
                    </h1>
                    <p className="text-xl text-slate-400 mt-4">
                        headyme.com — Your AI Platform Dashboard
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatusCard title="Vector Memory" value="Active" icon="🧠" />
                    <StatusCard title="Bee Swarm" value="24 Domains" icon="🐝" />
                    <StatusCard title="MCP Tools" value="31 Active" icon="🔧" />
                    <StatusCard title="Pipeline" value="12 Stages" icon="⚡" />
                    <StatusCard title="Health" value="All Green" icon="💚" />
                    <StatusCard title="Uptime" value="99.99%" icon="📊" />
                </div>
            </div>
        </main>
    );
}

function StatusCard({ title, value, icon }: { title: string; value: string; icon: string }) {
    return (
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 hover:border-violet-500/50 transition-all">
            <div className="text-3xl mb-3">{icon}</div>
            <h3 className="text-sm text-slate-400 uppercase tracking-wider">{title}</h3>
            <p className="text-2xl font-semibold mt-1">{value}</p>
        </div>
    );
}
