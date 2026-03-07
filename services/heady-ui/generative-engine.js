/**
 * ═══════════════════════════════════════════════════════════════
 * UI-001: Generative UI Engine
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * ═══════════════════════════════════════════════════════════════
 *
 * AI-powered component generation from natural language descriptions.
 * Uses LLM to produce HTML/CSS/JS components on demand.
 */

'use strict';

class GenerativeUIEngine {
    constructor(options = {}) {
        this.componentCache = new Map();
        this.templates = new Map();
        this.generationHistory = [];
        this._registerTemplates();
    }

    /**
     * Generate a UI component from a natural language description
     */
    async generate(description, options = {}) {
        const cacheKey = this._hash(description);

        if (this.componentCache.has(cacheKey)) {
            return { ...this.componentCache.get(cacheKey), cached: true };
        }

        const componentType = this._classifyComponent(description);
        const template = this.templates.get(componentType);

        if (!template) {
            return { error: `Unknown component type: ${componentType}`, description };
        }

        const component = template.generate(description, options);
        component.id = `gen-${cacheKey.substring(0, 8)}`;
        component.type = componentType;
        component.timestamp = new Date().toISOString();

        this.componentCache.set(cacheKey, component);
        this.generationHistory.push({ description, type: componentType, id: component.id });

        return component;
    }

    /**
     * Classify what type of component is being requested
     */
    _classifyComponent(description) {
        const desc = description.toLowerCase();
        if (desc.includes('chart') || desc.includes('graph') || desc.includes('visualization')) return 'chart';
        if (desc.includes('form') || desc.includes('input') || desc.includes('submit')) return 'form';
        if (desc.includes('card') || desc.includes('panel') || desc.includes('tile')) return 'card';
        if (desc.includes('table') || desc.includes('list') || desc.includes('grid')) return 'table';
        if (desc.includes('nav') || desc.includes('menu') || desc.includes('sidebar')) return 'navigation';
        if (desc.includes('dashboard') || desc.includes('metrics') || desc.includes('status')) return 'dashboard';
        if (desc.includes('modal') || desc.includes('dialog') || desc.includes('popup')) return 'modal';
        if (desc.includes('button') || desc.includes('action') || desc.includes('cta')) return 'button';
        return 'generic';
    }

    _registerTemplates() {
        this.templates.set('card', {
            generate: (desc, opts) => ({
                html: `<div class="heady-card ${opts.theme || 'dark'}" id="${opts.id || 'card'}">
  <div class="heady-card-header">
    <h3>${this._extractTitle(desc)}</h3>
    <span class="heady-badge">AI Generated</span>
  </div>
  <div class="heady-card-body">
    <p>${desc}</p>
  </div>
  <div class="heady-card-footer">
    <button class="heady-btn heady-btn-primary">Action</button>
  </div>
</div>`,
                css: `.heady-card { background: var(--heady-surface, #1a1a2e); border-radius: 12px; padding: 24px; border: 1px solid rgba(255,255,255,0.1); transition: transform 0.2s; }
.heady-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
.heady-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.heady-card-header h3 { color: var(--heady-text, #e0e0e0); margin: 0; }
.heady-badge { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 4px 12px; border-radius: 20px; font-size: 12px; color: white; }
.heady-card-body { color: var(--heady-text-secondary, #a0a0a0); line-height: 1.6; }
.heady-card-footer { margin-top: 16px; display: flex; gap: 8px; }
.heady-btn { padding: 8px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; transition: all 0.2s; }
.heady-btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; }
.heady-btn-primary:hover { transform: scale(1.05); }`,
                js: '',
            }),
        });

        this.templates.set('dashboard', {
            generate: (desc, opts) => ({
                html: `<div class="heady-dashboard" id="${opts.id || 'dashboard'}">
  <div class="heady-dashboard-header">
    <h2>Dashboard</h2>
    <span class="heady-live-indicator">● Live</span>
  </div>
  <div class="heady-metrics-grid">
    <div class="heady-metric-card">
      <span class="heady-metric-label">Active Agents</span>
      <span class="heady-metric-value" id="metric-agents">20</span>
    </div>
    <div class="heady-metric-card">
      <span class="heady-metric-label">Tasks/min</span>
      <span class="heady-metric-value" id="metric-tasks">135</span>
    </div>
    <div class="heady-metric-card">
      <span class="heady-metric-label">Uptime</span>
      <span class="heady-metric-value" id="metric-uptime">99.9%</span>
    </div>
    <div class="heady-metric-card">
      <span class="heady-metric-label">Memory</span>
      <span class="heady-metric-value" id="metric-memory">64%</span>
    </div>
  </div>
</div>`,
                css: `.heady-dashboard { background: var(--heady-bg, #0f0f23); padding: 32px; border-radius: 16px; }
.heady-dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.heady-dashboard-header h2 { color: white; margin: 0; }
.heady-live-indicator { color: #22c55e; font-size: 14px; animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
.heady-metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
.heady-metric-card { background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.08); }
.heady-metric-label { display: block; color: #94a3b8; font-size: 13px; margin-bottom: 8px; }
.heady-metric-value { display: block; font-size: 32px; font-weight: 700; color: white; background: linear-gradient(135deg, #6366f1, #22d3ee); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }`,
                js: '',
            }),
        });

        this.templates.set('form', {
            generate: (desc, opts) => ({
                html: `<form class="heady-form" id="${opts.id || 'form'}">
  <div class="heady-form-group">
    <label>Input</label>
    <input type="text" placeholder="Enter value..." class="heady-input" />
  </div>
  <button type="submit" class="heady-btn heady-btn-primary">Submit</button>
</form>`,
                css: `.heady-form { max-width: 480px; } .heady-form-group { margin-bottom: 16px; }
.heady-form-group label { display: block; color: #e0e0e0; margin-bottom: 6px; font-size: 14px; }
.heady-input { width: 100%; padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: white; font-size: 14px; outline: none; transition: border 0.2s; }
.heady-input:focus { border-color: #6366f1; }`,
                js: '',
            }),
        });

        ['table', 'navigation', 'modal', 'button', 'chart', 'generic'].forEach(type => {
            if (!this.templates.has(type)) {
                this.templates.set(type, {
                    generate: (desc, opts) => ({
                        html: `<div class="heady-${type}" id="${opts.id || type}"><p>${desc}</p></div>`,
                        css: `.heady-${type} { padding: 16px; border-radius: 8px; background: #1a1a2e; color: #e0e0e0; }`,
                        js: '',
                    }),
                });
            }
        });
    }

    _extractTitle(desc) {
        const words = desc.split(/\s+/).slice(0, 4);
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    _hash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        return Math.abs(hash).toString(36);
    }
}

if (require.main === module) {
    const engine = new GenerativeUIEngine();

    console.log('═══ Generative UI Engine ═══\n');

    Promise.all([
        engine.generate('agent status dashboard with live metrics'),
        engine.generate('create a card showing system health'),
        engine.generate('user login form with email and password'),
    ]).then(results => {
        results.forEach(r => {
            console.log(`${r.type}: ${r.id} (${r.html.length} chars HTML, ${r.css.length} chars CSS)`);
        });
        console.log(`\nCache: ${engine.componentCache.size} components`);
        console.log('✅ Generative UI Engine operational');
    });
}

module.exports = { GenerativeUIEngine };
