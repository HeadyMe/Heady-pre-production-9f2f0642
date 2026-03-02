import React from 'react';
import { Globe, ExternalLink, CheckCircle } from 'lucide-react';

const DOMAINS = [
    { domain: 'headyme.com', role: 'Personal Dashboard', registrar: 'Cloudflare', dns: 'Cloudflare', ssl: true, active: true },
    { domain: 'headysystems.com', role: 'System Infrastructure', registrar: 'Cloudflare', dns: 'Cloudflare', ssl: true, active: true },
    { domain: 'headyconnection.org', role: 'Community & Nonprofit', registrar: 'Cloudflare', dns: 'Cloudflare', ssl: true, active: true },
    { domain: 'headymcp.com', role: 'Developer Hub', registrar: 'Cloudflare', dns: 'Cloudflare', ssl: true, active: true },
    { domain: 'headyio.com', role: 'AI Brain Umbrella', registrar: 'Cloudflare', dns: 'Cloudflare', ssl: true, active: true },
    { domain: 'headybuddy.org', role: 'Personal AI Assistant', registrar: 'Cloudflare', dns: 'Cloudflare', ssl: true, active: true },
    { domain: 'headyweb.com', role: 'Web App Shell', registrar: 'Cloudflare', dns: 'Cloudflare', ssl: true, active: true },
    { domain: 'headyide.com', role: 'IDE Integrations', registrar: 'Cloudflare', dns: 'Cloudflare', ssl: true, active: true },
    { domain: '1ime1.com', role: 'Instant Everything', registrar: 'Cloudflare', dns: 'Cloudflare', ssl: true, active: true },
];

export default function Domains() {
    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="rounded-2xl border border-violet-500/30 bg-slate-900/70 p-5">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Globe className="w-6 h-6 text-violet-300" /> Domains</h1>
                <p className="text-slate-400 text-sm mt-1">{DOMAINS.length} domains registered · all on Cloudflare DNS</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {DOMAINS.map(d => (
                    <div key={d.domain} className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 hover:border-slate-600 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                            <a href={`https://${d.domain}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-white hover:text-violet-300 flex items-center gap-1.5">
                                {d.domain} <ExternalLink className="w-3 h-3" />
                            </a>
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                        </div>
                        <p className="text-xs text-slate-400 mb-2">{d.role}</p>
                        <div className="flex gap-2 text-xs">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">{d.registrar}</span>
                            {d.ssl && <span className="px-2 py-0.5 rounded bg-emerald-900/30 text-emerald-400">SSL</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
