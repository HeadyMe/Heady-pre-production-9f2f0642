/*
 * HeadyWeb — Central Portal Application
 * Renders all 11 Heady apps + 7 micro-frontend panels
 */

// ── App Registry ────────────────────────────────────────────────
const HEADY_APPS = [
    { id: 'admin', name: 'Heady Admin', desc: 'Operations console. System health, node orchestration, pipeline control.', icon: '⚡', href: 'https://admin.headysystems.com', port: 4401, color: '#34d399', bg: 'rgba(52,211,153,0.08)' },
    { id: 'ide', name: 'HeadyAI-IDE', desc: 'AI-powered development environment. Code-server with 20-node intelligence.', icon: '💻', href: 'https://ide.headysystems.com', port: 8443, color: '#60a5fa', bg: 'rgba(96,165,250,0.08)' },
    { id: 'buddy', name: 'HeadyBuddy', desc: 'Your AI Swarm Commander. Voice, chat, and HeadyBees task execution.', icon: '🤖', href: 'https://headybuddy.org', port: 4201, color: '#f472b6', bg: 'rgba(244,114,182,0.08)' },
    { id: 'manager', name: 'Heady Manager', desc: 'Backend API server. 20 nodes, HCFP pipeline, auto-success engine.', icon: '🧠', href: 'https://manager.headysystems.com', port: 4300, color: '#4ade80', bg: 'rgba(74,222,128,0.08)' },
    { id: 'mcp', name: 'HeadyMCP', desc: 'Model Context Protocol hub. Verified connectors, one-click deploy.', icon: '🔌', href: 'https://headymcp.com', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
    { id: 'io', name: 'HeadyIO', desc: 'Developer portal. REST API docs, Hive SDK, Arena Mode API.', icon: '📡', href: 'https://headyio.com', port: 4500, color: '#38bdf8', bg: 'rgba(56,189,248,0.08)' },
    { id: 'connection', name: 'HeadyConnection', desc: 'AI for nonprofit impact. Grant writing, impact analytics, Proof View.', icon: '🤝', href: 'https://headyconnection.org', port: 4600, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
    { id: 'instant', name: '1ime1', desc: 'Instant Everything. Generate, deploy, and iterate in seconds.', icon: '⚡', href: 'https://1ime1.com', color: '#fb923c', bg: 'rgba(251,146,60,0.08)' },
    { id: 'canvas', name: 'HeadyVinci Canvas', desc: 'Creative AI sandbox. Multi-model generation, remix, composition.', icon: '🎨', href: 'https://manager.headysystems.com/canvas', color: '#c084fc', bg: 'rgba(192,132,252,0.08)' },
    { id: 'systems', name: 'HeadySystems', desc: 'The Architecture of Intelligence. Self-healing infrastructure.', icon: '🏗️', href: 'https://headysystems.com', color: '#2dd4bf', bg: 'rgba(45,212,191,0.08)' },
    { id: 'me', name: 'HeadyMe', desc: 'Your AI Command Center. Cross-device memory, HCFP auto-planning.', icon: '👤', href: 'https://headyme.com', color: '#818cf8', bg: 'rgba(129,140,248,0.08)' },
];

const MICRO_FRONTENDS = [
    { id: 'antigravity', title: 'Antigravity', desc: '3D Vector Space Visualization', route: '/app/antigravity', status: 'active', icon: '🌀', color: '#818cf8' },
    { id: 'landing', title: 'Landing Page', desc: 'HeadyWeb Portal & Central Hub', route: '/', status: 'active', icon: '🐝', color: '#f59e0b' },
    { id: 'heady-ide', title: 'HeadyAI-IDE', desc: 'AI Development Environment', route: '/app/ide', status: 'active', icon: '💻', color: '#3b82f6' },
    { id: 'swarm-dashboard', title: 'Swarm Dashboard', desc: 'HeadyBees Real-Time Monitoring', route: '/app/swarm', status: 'active', icon: '🐝', color: '#f97316' },
    { id: 'governance-panel', title: 'Governance Panel', desc: 'Decentralized Governance Controls', route: '/app/governance', status: 'active', icon: '🏛️', color: '#8b5cf6' },
    { id: 'projection-monitor', title: 'Projection Monitor', desc: 'Sync & Projection Status', route: '/app/projections', status: 'active', icon: '📡', color: '#06b6d4' },
    { id: 'vector-explorer', title: 'Vector Explorer', desc: 'Browse & Search Vector Memory', route: '/app/vectors', status: 'active', icon: '🔮', color: '#ec4899' },
];

// ── Render ───────────────────────────────────────────────────────
function renderPortal() {
    const root = document.getElementById('heady-root');
    if (!root) return;

    root.innerHTML = `
    <div class="portal">
      <!-- Header -->
      <header class="portal-header">
        <div class="portal-logo">
          <span class="dot"></span>
          <h1>HeadyWeb</h1>
          <span class="version">v3.2.0</span>
        </div>
        <div class="portal-status">
          <span class="live-dot"></span>
          Central Portal
        </div>
      </header>

      <!-- Hero -->
      <section class="portal-hero">
        <h2>All Heady Apps & Micro-Frontends</h2>
        <p>Your central hub for the entire Heady ecosystem. Launch any app, explore any micro-frontend, monitor the pipeline — all from one place.</p>
      </section>

      <!-- Pipeline Banner -->
      <div class="pipeline-banner">
        <div class="pipeline-left">
          <div class="pipeline-icon">⚡</div>
          <div>
            <h3>HCFP Auto-Success Pipeline</h3>
            <p>Sacred Geometry Orchestration · 5-Phase Autonomous Projections</p>
          </div>
        </div>
        <div class="pipeline-stats">
          <div class="pipeline-stat">
            <div class="val" style="color:var(--accent-emerald)">11</div>
            <div class="label">Apps</div>
          </div>
          <div class="pipeline-stat">
            <div class="val" style="color:var(--accent-indigo)">7</div>
            <div class="label">MFEs</div>
          </div>
          <div class="pipeline-stat">
            <div class="val" style="color:var(--accent-amber)">20</div>
            <div class="label">AI Nodes</div>
          </div>
          <div class="pipeline-stat">
            <div class="val" style="color:var(--accent-purple)">100%</div>
            <div class="label">Success</div>
          </div>
        </div>
      </div>

      <!-- Apps Section -->
      <div class="section-label">🌐 Applications · 11 Deployed</div>
      <div class="app-grid">
        ${HEADY_APPS.map(app => `
          <a href="${app.href}" target="_blank" rel="noopener" class="app-card" data-app="${app.id}">
            <div class="app-card-top">
              <div class="app-icon" style="background:${app.bg};color:${app.color};">
                ${app.icon}
              </div>
              <div class="app-live" style="background:${app.color}; box-shadow: 0 0 6px ${app.color};" data-health="${app.id}"></div>
            </div>
            <h3>${app.name}</h3>
            <p>${app.desc}</p>
            ${app.port ? `<div class="app-port">:${app.port}</div>` : ''}
          </a>
        `).join('')}
      </div>

      <!-- Micro-Frontends Section -->
      <div class="section-label">🧩 Micro-Frontends · Module Federation</div>
      <div class="mfe-grid">
        ${MICRO_FRONTENDS.map(mfe => `
          <div class="mfe-card" data-mfe="${mfe.id}" onclick="loadMFE('${mfe.id}')">
            <span class="mfe-status ${mfe.status}">${mfe.status}</span>
            <h4>${mfe.icon} ${mfe.title}</h4>
            <p>${mfe.desc}</p>
            <div class="mfe-route">${mfe.route}</div>
          </div>
        `).join('')}
      </div>

      <!-- Footer -->
      <footer class="portal-footer">
        HeadyWeb · Central Portal · Sacred Geometry Architecture · © 2026 HeadySystems Inc.
      </footer>
    </div>

    <!-- MFE Modal Overlay -->
    <div id="mfe-overlay" style="display:none; position:fixed; inset:0; z-index:1000; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px);">
      <div style="position:absolute; top:1rem; right:1.5rem; cursor:pointer; font-size:1.5rem; color:rgba(255,255,255,0.5); z-index:1001;" onclick="closeMFE()">✕</div>
      <div id="mfe-container" style="width:100%; height:100%; overflow-y:auto;"></div>
    </div>
  `;
}

// ── MFE Loading ─────────────────────────────────────────────────
function loadMFE(mfeId) {
    const overlay = document.getElementById('mfe-overlay');
    const container = document.getElementById('mfe-container');

    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Try to load the micro-frontend's App.js
    const scriptPath = `../../remotes/${mfeId}/src/App.js`;

    // Use dynamic import or fallback to global
    const globalName = `__HEADY_MFE_${mfeId.replace(/-/g, '_').toUpperCase()}`;

    if (window[globalName]) {
        window[globalName](container);
    } else {
        // Load the script
        const script = document.createElement('script');
        script.src = scriptPath;
        script.onload = () => {
            if (window[globalName]) {
                window[globalName](container);
            } else {
                // Fallback: render info
                const mfe = MICRO_FRONTENDS.find(m => m.id === mfeId);
                container.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;color:#fff;font-family:Inter,system-ui,sans-serif;">
            <div>
              <div style="font-size:3rem;margin-bottom:1rem;">${mfe ? mfe.icon : '🧩'}</div>
              <h2 style="font-size:1.5rem;font-weight:300;margin-bottom:0.5rem;">${mfe ? mfe.title : mfeId}</h2>
              <p style="color:rgba(255,255,255,0.5);font-size:0.85rem;">${mfe ? mfe.desc : ''}</p>
              <p style="color:rgba(255,255,255,0.3);font-size:0.75rem;margin-top:1rem;">Micro-frontend loaded from remotes/${mfeId}/</p>
            </div>
          </div>
        `;
            }
        };
        script.onerror = () => {
            const mfe = MICRO_FRONTENDS.find(m => m.id === mfeId);
            container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;color:#fff;font-family:Inter,system-ui,sans-serif;">
          <div>
            <div style="font-size:3rem;margin-bottom:1rem;">${mfe ? mfe.icon : '🧩'}</div>
            <h2 style="font-size:1.5rem;font-weight:300;margin-bottom:0.5rem;">${mfe ? mfe.title : mfeId}</h2>
            <p style="color:rgba(255,255,255,0.5);font-size:0.85rem;">${mfe ? mfe.desc : ''}</p>
            <p style="color:var(--accent-amber);font-size:0.75rem;margin-top:1rem;">⚠️ Build required — run: cd remotes/${mfeId} && npm run build</p>
          </div>
        </div>
      `;
        };
        document.head.appendChild(script);
    }
}

function closeMFE() {
    const overlay = document.getElementById('mfe-overlay');
    const container = document.getElementById('mfe-container');
    overlay.style.display = 'none';
    container.innerHTML = '';
    document.body.style.overflow = '';
}

// Close on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMFE();
});

// ── Boot ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', renderPortal);
