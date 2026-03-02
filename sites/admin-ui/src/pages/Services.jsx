import React, { useState, useEffect } from 'react';
import { Server, RefreshCw, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';

const SERVICE_GROUPS = ['core', 'ai', 'infrastructure', 'integration', 'security', 'monitoring'];

export default function Services() {
    const [services, setServices] = useState([]);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetch('/api/registry/components').then(r => r.json())
            .then(data => setServices(data.components || []))
            .catch(() => {
                setServices([
                    { id: 'heady-manager', name: 'Heady Manager', status: 'active', serviceGroup: 'core', version: '2.0.0', layer: 'orchestration' },
                    { id: 'heady-brain', name: 'Heady Brain', status: 'active', serviceGroup: 'ai', version: '2.0.0', layer: 'intelligence' },
                    { id: 'heady-mcp', name: 'HeadyMCP Server', status: 'active', serviceGroup: 'integration', version: '1.0.0', layer: 'protocol' },
                    { id: 'heady-buddy', name: 'HeadyBuddy', status: 'active', serviceGroup: 'ai', version: '2.0.0', layer: 'assistant' },
                    { id: 'hcfp-engine', name: 'HCFP Engine', status: 'active', serviceGroup: 'core', version: '2.0.0', layer: 'pipeline' },
                    { id: 'vector-memory', name: 'Vector Memory', status: 'active', serviceGroup: 'infrastructure', version: '1.0.0', layer: 'storage' },
                    { id: 'auth-service', name: 'Auth Service', status: 'active', serviceGroup: 'security', version: '1.0.0', layer: 'auth' },
                    { id: 'cloudflare-tunnel', name: 'Cloudflare Tunnel', status: 'active', serviceGroup: 'infrastructure', version: '—', layer: 'network' },
                ]);
            });
    }, []);

    const filtered = filter === 'all' ? services : services.filter(s => s.serviceGroup === filter);
    const active = services.filter(s => s.status === 'active').length;

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="rounded-2xl border border-violet-500/30 bg-slate-900/70 p-5">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Server className="w-6 h-6 text-violet-300" /> Services
                </h1>
                <p className="text-slate-400 text-sm mt-1">{active}/{services.length} services active across {SERVICE_GROUPS.length} groups</p>
            </div>

            <div className="flex gap-2 flex-wrap">
                {['all', ...SERVICE_GROUPS].map(g => (
                    <button key={g} onClick={() => setFilter(g)}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${filter === g ? 'bg-violet-600/30 text-violet-200 border border-violet-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'}`}>
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(svc => (
                    <div key={svc.id} className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 hover:border-slate-600 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-white">{svc.name || svc.id}</h3>
                            {svc.status === 'active'
                                ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                                : <XCircle className="w-4 h-4 text-red-400" />}
                        </div>
                        <div className="space-y-1 text-xs text-slate-400">
                            <div className="flex justify-between"><span>Group</span><span className="text-slate-300">{svc.serviceGroup}</span></div>
                            <div className="flex justify-between"><span>Layer</span><span className="text-slate-300">{svc.layer || '—'}</span></div>
                            <div className="flex justify-between"><span>Version</span><span className="text-slate-300">{svc.version || '—'}</span></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
