/*
 * HeadyAI-IDE — AI-Powered Development Environment
 * Micro-frontend for HeadyWeb Universal Shell
 */
const APP_CONFIG = {
  id: 'heady-ide',
  title: 'HeadyAI-IDE',
  desc: 'AI-Powered Development Environment',
  icon: '💻',
  color: '#3b82f6',
  version: '3.2.0'
};

function createApp(container, props = {}) {
  const root = document.createElement('div');
  root.className = 'mfe-root mfe-heady-ide';
  root.style.cssText = 'min-height:100vh;background:linear-gradient(135deg, #1e3a5f, #1e40af);color:#fff;font-family:Inter,system-ui,sans-serif;';

  root.innerHTML = `
    <style>
      .mfe-heady-ide { padding: 0; margin: 0; }
      .mfe-heady-ide .mfe-header { padding: 1.5rem 2rem; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between; backdrop-filter: blur(20px); background: rgba(0,0,0,0.3); }
      .mfe-heady-ide .mfe-header h1 { font-size: 1.4rem; font-weight: 600; margin: 0; display: flex; align-items: center; gap: 0.75rem; }
      .mfe-heady-ide .mfe-header .mfe-badge { font-size: 0.65rem; background: #3b82f633; color: #3b82f6; padding: 0.25rem 0.75rem; border-radius: 999px; border: 1px solid #3b82f644; }
      .mfe-heady-ide .mfe-body { padding: 2rem; max-width: 1200px; margin: 0 auto; }
      .mfe-heady-ide .mfe-desc { color: rgba(255,255,255,0.6); font-size: 0.85rem; margin: 0; }

      /* App-specific styles */
      .ag-scene { position: relative; height: 400px; background: radial-gradient(ellipse at center, rgba(99,102,241,0.2), transparent); border-radius: 1rem; overflow: hidden; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: center; }
      .ag-scene canvas { width: 100%; height: 100%; }
      .ag-overlay { text-align: center; }
      .ag-overlay h2 { font-size: 1.8rem; margin-bottom: 0.5rem; }
      .ag-stats { display: flex; gap: 2rem; justify-content: center; margin-top: 1rem; }
      .ag-stats span { background: rgba(255,255,255,0.1); padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.85rem; }

      .landing-hero { text-align: center; padding: 4rem 2rem; }
      .landing-hero h1 { font-size: 3.5rem; margin-bottom: 0.5rem; }
      .landing-hero p { font-size: 1.2rem; color: rgba(255,255,255,0.8); }
      .landing-sub { font-size: 0.9rem !important; color: rgba(255,255,255,0.5) !important; margin-top: 0.5rem; }
      .landing-apps { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; margin-top: 2rem; }
      .app-chip { background: rgba(255,255,255,0.1); padding: 0.4rem 1rem; border-radius: 999px; font-size: 0.8rem; border: 1px solid rgba(255,255,255,0.15); transition: all 0.2s; cursor: pointer; }
      .app-chip:hover { background: rgba(255,255,255,0.2); transform: translateY(-2px); }

      .ide-layout { display: grid; grid-template-columns: 220px 1fr; min-height: 500px; border-radius: 1rem; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
      .ide-sidebar { background: rgba(0,0,0,0.4); padding: 1rem; border-right: 1px solid rgba(255,255,255,0.1); }
      .ide-tree { font-family: monospace; font-size: 0.8rem; color: rgba(255,255,255,0.7); line-height: 1.8; }
      .ide-editor { background: rgba(0,0,0,0.3); }
      .ide-tabs { display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
      .ide-tabs span { padding: 0.6rem 1.2rem; font-size: 0.75rem; color: rgba(255,255,255,0.5); cursor: pointer; border-bottom: 2px solid transparent; }
      .ide-tabs span.active { color: #fff; border-color: #3b82f6; background: rgba(255,255,255,0.05); }
      .ide-code { padding: 1.5rem; font-size: 0.8rem; line-height: 1.6; color: #a5f3fc; margin: 0; }

      .swarm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
      .bee-card { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem; padding: 1.2rem; display: flex; flex-direction: column; gap: 0.5rem; transition: all 0.2s; }
      .bee-card:hover { border-color: #3b82f655; transform: translateY(-2px); }
      .bee-status { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
      .bee-status.active { background: #4ade80; box-shadow: 0 0 8px #4ade80; }
      .bee-status.idle { background: #6b7280; }
      .bee-tasks { font-size: 0.75rem; color: rgba(255,255,255,0.5); }

      .gov-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
      .gov-card { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem; padding: 1.5rem; text-align: center; transition: all 0.2s; }
      .gov-card:hover { border-color: #3b82f655; }
      .gov-card h3 { font-size: 0.85rem; color: rgba(255,255,255,0.6); margin: 0 0 0.5rem; font-weight: 400; }
      .gov-stat { font-size: 2rem; font-weight: 600; color: #3b82f6; }

      .proj-grid { display: flex; flex-direction: column; gap: 1rem; }
      .proj-target { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.75rem; padding: 1rem 1.5rem; display: flex; align-items: center; gap: 1rem; }
      .proj-dot { width: 10px; height: 10px; border-radius: 50%; }
      .proj-dot.synced { background: #4ade80; box-shadow: 0 0 8px #4ade80; }
      .proj-dot.source { background: #818cf8; box-shadow: 0 0 8px #818cf8; }
      .proj-lag { margin-left: auto; font-family: monospace; font-size: 0.8rem; color: rgba(255,255,255,0.5); }
      .proj-log { background: rgba(0,0,0,0.4); border-radius: 0.75rem; padding: 1rem 1.5rem; font-family: monospace; font-size: 0.75rem; line-height: 1.8; color: rgba(255,255,255,0.7); margin-top: 0.5rem; }

      .vec-layout { display: flex; flex-direction: column; gap: 1rem; }
      .vec-search { display: flex; align-items: center; gap: 1rem; }
      .vec-input { flex: 1; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 0.75rem; padding: 0.75rem 1.2rem; color: #fff; font-size: 0.9rem; outline: none; }
      .vec-input:focus { border-color: #3b82f6; }
      .vec-count { font-size: 0.8rem; color: rgba(255,255,255,0.5); white-space: nowrap; }
      .vec-results { display: flex; flex-direction: column; gap: 0.5rem; }
      .vec-item { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 0.75rem; padding: 0.8rem 1.2rem; display: flex; align-items: center; gap: 1rem; transition: all 0.2s; cursor: pointer; }
      .vec-item:hover { border-color: #3b82f644; background: rgba(0,0,0,0.5); }
      .vec-dist { font-family: monospace; font-size: 0.8rem; color: #3b82f6; min-width: 3rem; }
      .vec-text { flex: 1; font-size: 0.85rem; }
      .vec-dim { font-size: 0.7rem; color: rgba(255,255,255,0.4); }
    </style>
    <div class="mfe-header">
      <h1>💻 ${APP_CONFIG.title}</h1>
      <div style="display:flex;align-items:center;gap:1rem;">
        <span class="mfe-badge">v${APP_CONFIG.version}</span>
        <p class="mfe-desc">${APP_CONFIG.desc}</p>
      </div>
    </div>
    <div class="mfe-body">
      <div class="ide-layout"><div class="ide-sidebar"><div class="ide-tree">📁 src/<br>  📁 services/<br>  📁 bees/<br>  📁 shell/<br>  📄 heady-manager.js</div></div>
      <div class="ide-editor"><div class="ide-tabs"><span class="active">heady-manager.js</span><span>llm-router.js</span></div>
      <pre class="ide-code"><code>// Heady Manager v3.2
const { orchestrate } = require('./services');
module.exports = { boot: () => orchestrate() };</code></pre></div></div>
    </div>
  `;

  container.innerHTML = '';
  container.appendChild(root);

  // Announce mount
  console.log('[MFE:heady-ide] Mounted v' + APP_CONFIG.version);
  return { unmount: () => { root.remove(); } };
}

// Exports for Module Federation
if (typeof module !== 'undefined') module.exports = { default: createApp, createApp, APP_CONFIG };
if (typeof window !== 'undefined') window.__HEADY_MFE_HEADY_IDE = createApp;
