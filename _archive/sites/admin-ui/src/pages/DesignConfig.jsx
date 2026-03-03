import React, { useState } from 'react';
import { Palette, Eye } from 'lucide-react';

const TOKENS = {
  colors: {
    primary: '#7c3aed', secondary: '#6366f1', accent: '#fbbf24',
    background: '#060a18', surface: '#0f172a', border: 'rgba(139,92,246,0.15)',
    text: '#e2e8f0', textMuted: '#94a3b8', success: '#10b981', error: '#ef4444',
  },
  fonts: { heading: 'Inter, sans-serif', body: 'Inter, sans-serif', mono: 'JetBrains Mono, monospace' },
  radii: { sm: '0.5rem', md: '0.75rem', lg: '1rem', xl: '1.5rem' },
  spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem' },
};

export default function DesignConfig() {
  const [tokens, setTokens] = useState(TOKENS);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="rounded-2xl border border-violet-500/30 bg-slate-900/70 p-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Palette className="w-6 h-6 text-violet-300" /> Design Config</h1>
        <p className="text-slate-400 text-sm mt-1">Sacred Geometry design tokens and theme configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Color Palette</h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(tokens.colors).map(([name, value]) => (
              <div key={name} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg border border-slate-700" style={{ background: value }} />
                <div>
                  <p className="text-xs text-white">{name}</p>
                  <p className="text-xs text-slate-500 font-mono">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Typography</h2>
          <div className="space-y-4">
            {Object.entries(tokens.fonts).map(([name, value]) => (
              <div key={name}>
                <p className="text-xs text-slate-400 mb-1">{name}</p>
                <p className="text-lg text-white" style={{ fontFamily: value }}>{value}</p>
              </div>
            ))}
          </div>
          <h2 className="text-lg font-semibold text-white mt-6 mb-4">Border Radii</h2>
          <div className="flex gap-3">
            {Object.entries(tokens.radii).map(([name, value]) => (
              <div key={name} className="text-center">
                <div className="w-12 h-12 border border-violet-500/40 bg-violet-900/20" style={{ borderRadius: value }} />
                <p className="text-xs text-slate-400 mt-1">{name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><Eye className="w-5 h-5" /> Preview</h2>
        <div className="rounded-xl p-6" style={{ background: tokens.colors.background, border: `1px solid ${tokens.colors.border}` }}>
          <h3 style={{ color: tokens.colors.primary, fontFamily: tokens.fonts.heading }} className="text-xl font-bold mb-2">Sacred Geometry Intelligence</h3>
          <p style={{ color: tokens.colors.textMuted, fontFamily: tokens.fonts.body }} className="text-sm mb-4">Organic systems · Breathing interfaces · φ-weighted algorithms</p>
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-lg text-sm text-white" style={{ background: tokens.colors.primary }}>Primary Action</button>
            <button className="px-4 py-2 rounded-lg text-sm" style={{ background: 'transparent', border: `1px solid ${tokens.colors.border}`, color: tokens.colors.text }}>Secondary</button>
          </div>
        </div>
      </div>
    </div>
  );
}
