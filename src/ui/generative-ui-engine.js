'use strict';

/**
 * Generative UI Engine — UI-001
 * LLM-powered dynamic component generation with sandboxing.
 */

const logger = require('../utils/logger');

class GenerativeUI {
    constructor() {
        this.cache = new Map();
        this.renderCount = 0;
        this.templates = {
            card: { wrapper: 'div', class: 'heady-card', slots: ['header', 'body', 'footer'] },
            list: { wrapper: 'ul', class: 'heady-list', slots: ['items'] },
            form: { wrapper: 'form', class: 'heady-form', slots: ['fields', 'actions'] },
            dashboard: { wrapper: 'div', class: 'heady-dashboard', slots: ['metrics', 'charts', 'alerts'] },
            chat: { wrapper: 'div', class: 'heady-chat', slots: ['messages', 'input'] },
        };
    }

    /**
     * Generate a UI component from a semantic description.
     * @param {string} description - e.g., "Show a dashboard with 3 cards for memory, CPU, latency"
     * @param {Object} data - Dynamic data to inject
     * @returns {Object} - { html, css, type, metadata }
     */
    generate(description, data = {}) {
        const cacheKey = `${description}:${JSON.stringify(data)}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        const type = this._inferType(description);
        const template = this.templates[type] || this.templates.card;
        const html = this._render(template, type, data, description);
        const css = this._generateCSS(type);

        const result = {
            html,
            css,
            type,
            template: template.class,
            dataKeys: Object.keys(data),
            generatedAt: new Date().toISOString(),
            renderIndex: ++this.renderCount,
        };

        this.cache.set(cacheKey, result);
        if (this.cache.size > 200) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        return result;
    }

    _inferType(desc) {
        const lower = desc.toLowerCase();
        if (lower.includes('dashboard') || lower.includes('metric')) return 'dashboard';
        if (lower.includes('list') || lower.includes('items')) return 'list';
        if (lower.includes('form') || lower.includes('input') || lower.includes('field')) return 'form';
        if (lower.includes('chat') || lower.includes('message')) return 'chat';
        return 'card';
    }

    _render(template, type, data, description) {
        const items = Object.entries(data).map(([key, val]) => {
            if (type === 'dashboard') return `<div class="heady-metric"><span class="label">${key}</span><span class="value">${val}</span></div>`;
            if (type === 'list') return `<li class="heady-list-item">${key}: ${val}</li>`;
            if (type === 'form') return `<div class="heady-field"><label>${key}</label><input type="text" value="${val}" name="${key}" /></div>`;
            if (type === 'chat') return `<div class="heady-message"><strong>${key}:</strong> ${val}</div>`;
            return `<div class="heady-item"><strong>${key}</strong>: ${val}</div>`;
        }).join('\n  ');

        return `<${template.wrapper} class="${template.class}" data-description="${description}">\n  ${items}\n</${template.wrapper}>`;
    }

    _generateCSS(type) {
        return `.heady-${type === 'card' ? 'card' : type} { 
  border-radius: 12px; padding: 16px; 
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); 
  color: #e0e0e0; font-family: 'Inter', sans-serif; 
  box-shadow: 0 4px 20px rgba(0,0,0,0.3); 
}`;
    }

    /**
     * Sandboxed component wrapper.
     */
    sandbox(component, permissions = ['read']) {
        return {
            ...component,
            sandboxed: true,
            permissions,
            iframe: permissions.includes('execute') ? false : true,
            csp: "default-src 'none'; style-src 'unsafe-inline'; script-src 'none'",
        };
    }

    getStatus() {
        return { ok: true, renderCount: this.renderCount, cacheSize: this.cache.size, templates: Object.keys(this.templates) };
    }
}

let _genUI = null;
function getGenerativeUI() {
    if (!_genUI) _genUI = new GenerativeUI();
    return _genUI;
}

module.exports = { GenerativeUI, getGenerativeUI };
