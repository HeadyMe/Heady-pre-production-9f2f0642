#!/usr/bin/env node
/**
 * Mass Vertical Site Generator
 * Builds ALL Heady vertical landing pages from definitions
 * Run: node scripts/generate-all-verticals.js
 */
const fs = require('fs');
const path = require('path');

const SITES_DIR = '/home/headyme/sites';
const WIDGET_SRC = '/home/headyme/Heady/public/buddy-widget.js';

const VERTICALS = [
  // ── AI Nodes (heady.io subdomains) ──
  { id: 'heady-buddy-portal', domain: 'buddy.headyio.com', name: 'HeadyBuddy', icon: '🤝', color: '#06b6d4', tagline: 'Your Personal AI Companion', desc: 'Always-on AI assistant across all your devices. Browser extension, mobile widget, CLI, and Chrome new-tab integration.', features: ['Cross-device sync', 'Persistent memory', 'Voice dictation', 'Smart suggestions', 'Browser extension', 'Mobile widget'] },
  { id: 'heady-maestro', domain: 'maestro.headyio.com', name: 'HeadyMaestro', icon: '🎼', color: '#8b5cf6', tagline: 'The AI Orchestrator', desc: 'Intelligent multi-agent coordination powered by the proprietary Orchestrator-Promoter Protocol. Routes tasks to the right AI node, manages parallel workflows, and ensures optimal results.', features: ['Orchestrator Protocol', 'Parallel execution', 'Task decomposition', 'Priority scheduling', 'Load balancing', 'Auto-scaling'] },
  { id: 'heady-jules', domain: 'jules.headyio.com', name: 'HeadyJules', icon: '🧪', color: '#ec4899', tagline: 'Deep Reasoning Engine', desc: 'Advanced analytical thinking for complex problems. Extended context, chain-of-thought, and structured problem decomposition.', features: ['1M token context', 'Chain-of-thought', 'Background tasks', 'Code analysis', 'Auto-commit', 'Deep research'] },
  { id: 'heady-observer', domain: 'observer.headyio.com', name: 'HeadyObserver', icon: '👁️', color: '#f59e0b', tagline: 'System Intelligence Watcher', desc: 'Real-time system monitoring, anomaly detection, and predictive alerting across the entire Heady infrastructure.', features: ['Real-time monitoring', 'Anomaly detection', 'Predictive alerts', 'Resource tracking', 'Health dashboards', 'SLA enforcement'] },
  { id: 'heady-builder', domain: 'builder.headyio.com', name: 'HeadyBuilder', icon: '🏗️', color: '#22c55e', tagline: 'AI Code Generator', desc: 'Full-stack code generation with framework awareness. Powered by the proprietary HCFullPipeline architecture for deterministic scaffolding, refactoring, and code transformations.', features: ['HCFullPipeline Engine', 'Framework scaffolding', 'Refactoring', 'Code review', 'Test generation', 'Documentation'] },
  { id: 'heady-atlas', domain: 'atlas.headyio.com', name: 'HeadyAtlas', icon: '🗺️', color: '#3b82f6', tagline: 'Knowledge Navigator', desc: 'Navigate the entire knowledge graph. Semantic search, concept mapping, and intelligent information retrieval.', features: ['Semantic search', 'Knowledge graph', 'Concept mapping', 'Citation tracking', 'Cross-reference', 'Auto-indexing'] },
  { id: 'heady-pythia', domain: 'pythia.headyio.com', name: 'HeadyPythia', icon: '🔮', color: '#a855f7', tagline: 'Multimodal AI Oracle', desc: 'Vision, audio, and cross-modal inference. Image analysis, document understanding, and creative multimodal generation.', features: ['Image analysis', 'Video understanding', 'Document OCR', 'Creative generation', 'Audio processing', 'Cross-modal'] },
  { id: 'heady-montecarlo', domain: 'montecarlo.headyio.com', name: 'HeadyMonteCarlo', icon: '🎲', color: '#ef4444', tagline: 'Probabilistic Simulation Engine', desc: 'Monte Carlo simulation for decision-making under uncertainty. Risk assessment, scenario planning, and optimization.', features: ['Risk simulation', 'Scenario planning', 'A/B testing', 'Probability modeling', 'Decision trees', 'Cost optimization'] },
  { id: 'heady-patterns', domain: 'patterns.headyio.com', name: 'HeadyPatterns', icon: '🧬', color: '#14b8a6', tagline: 'Design Pattern Detective', desc: 'Deep code analysis and pattern recognition. Architecture review, anti-pattern detection, and best-practice enforcement.', features: ['Pattern detection', 'Architecture review', 'Anti-pattern alerts', 'Dependency analysis', 'Complexity scoring', 'Refactor suggestions'] },
  { id: 'heady-critique', domain: 'critique.headyio.com', name: 'HeadyCritique', icon: '📝', color: '#f97316', tagline: 'Quality Assurance AI', desc: 'Automated code review, QA testing, and quality enforcement. Catches bugs before they ship.', features: ['Code review', 'Bug detection', 'Test coverage', 'Performance audit', 'Security scan', 'Linting'] },
  { id: 'heady-imagine', domain: 'imagine.headyio.com', name: 'HeadyImagine', icon: '🎨', color: '#d946ef', tagline: 'Creative AI Studio', desc: 'AI-powered creative generation. Design assets, marketing materials, brand content, and visual storytelling.', features: ['Image generation', 'Design assets', 'Brand content', 'Visual storytelling', 'Style transfer', 'Layout design'] },
  { id: 'heady-stories', domain: 'stories.headyio.com', name: 'HeadyStories', icon: '📖', color: '#0ea5e9', tagline: 'Narrative Intelligence', desc: 'Long-form content generation, storytelling, and narrative design. Blog posts, documentation, and creative writing.', features: ['Long-form content', 'Blog generation', 'Doc writing', 'Creative fiction', 'Technical writing', 'SEO content'] },
  { id: 'heady-sentinel', domain: 'sentinel.headyio.com', name: 'HeadySentinel', icon: '🛡️', color: '#dc2626', tagline: 'Security Guardian', desc: 'Post-quantum cryptography, vulnerability scanning, and security compliance. Protects the entire Heady ecosystem.', features: ['PQC encryption', 'Vuln scanning', 'mTLS certs', 'IP classification', 'Rate limiting', 'Secret rotation'] },
  { id: 'heady-vinci', domain: 'vinci.headyio.com', name: 'HeadyVinci', icon: '🎯', color: '#7c3aed', tagline: 'Predictive Intelligence & Invention', desc: 'Advanced Imagination Engine architecture. Continuous learning, predictive modeling, and autonomous exploration of patentable concepts and fused architectures.', features: ['Imagination Engine', 'Patent Discovery', 'Demand forecasting', 'Auto-tuning', 'Pattern learning', 'Trend analysis'] },
  { id: 'heady-kinetics', domain: 'kinetics.headyio.com', name: 'HeadyKinetics', icon: '🧪', color: '#059669', tagline: 'Chemical Systems AI', desc: 'Proprietary chemical and physical systems modeling, leveraging IP from 50+ chemical system patents. Advanced process optimization, molecular dynamics, and reaction simulation.', features: ['Chemical Patent IP', 'Reaction Simulation', 'Process Optimization', 'Fluid Dynamics', 'Material Science', 'Scale-up Modeling'] },

  // ── Observability ──
  { id: 'heady-metrics', domain: 'metrics.headyio.com', name: 'HeadyMetrics', icon: '📊', color: '#06b6d4', tagline: 'Real-Time Metrics Dashboard', desc: 'Live performance metrics, request counts, latency percentiles, and resource utilization across all 20 AI nodes.', features: ['Live metrics', 'Latency P99', 'Request rates', 'Resource usage', 'Custom dashboards', 'Alert rules'] },
  { id: 'heady-logs', domain: 'logs.headyio.com', name: 'HeadyLogs', icon: '📋', color: '#84cc16', tagline: 'Centralized Log Intelligence', desc: 'Structured logging with semantic search. Full-text log search, pattern matching, and anomaly detection.', features: ['Structured logs', 'Full-text search', 'Pattern matching', 'Log correlation', 'Retention policies', 'Export'] },
  { id: 'heady-traces', domain: 'traces.headyio.com', name: 'HeadyTraces', icon: '🔬', color: '#f59e0b', tagline: 'Distributed Tracing', desc: 'End-to-end request tracing across the Heady mesh. Visualize request paths, identify bottlenecks, and optimize performance.', features: ['Request tracing', 'Flame graphs', 'Bottleneck detection', 'Span analysis', 'Service map', 'Latency breakdown'] },

  // ── Platform Apps ──
  { id: 'heady-desktop', domain: 'desktop.headyio.com', name: 'HeadyDesktop', icon: '🖥️', color: '#7c3aed', tagline: 'Desktop AI Companion', desc: 'Native desktop application with system tray integration, hotkey access, and OS-level AI assistance.', features: ['System tray', 'Global hotkey', 'Screen capture', 'File analysis', 'Clipboard AI', 'Offline mode'] },
  { id: 'heady-mobile', domain: 'mobile.headyio.com', name: 'HeadyMobile', icon: '📱', color: '#06b6d4', tagline: 'Mobile AI Assistant', desc: 'AI companion for iOS and Android. Voice commands, share sheet integration, and on-device inference.', features: ['Voice commands', 'Share sheet', 'Widget', 'Notifications', 'On-device AI', 'Cross-device sync'] },
  { id: 'heady-chrome', domain: 'chrome.headyio.com', name: 'HeadyChrome', icon: '🌐', color: '#22c55e', tagline: 'Chrome Extension', desc: 'AI-powered browser extension for Chrome. Page analysis, smart bookmarks, and inline AI assistance.', features: ['Page analysis', 'Smart bookmarks', 'Inline assist', 'Tab management', 'Reading mode', 'Web clipper'] },

  // ── IDE Integrations ──
  { id: 'heady-vscode', domain: 'vscode.headyio.com', name: 'HeadyVSCode', icon: '💻', color: '#3b82f6', tagline: 'VS Code AI Extension', desc: 'Deep IDE integration for Visual Studio Code. Inline completions, refactoring, test generation, and code explanation.', features: ['Inline completions', 'Refactoring', 'Test generation', 'Code explanation', 'Debug assist', 'Git integration'] },
  { id: 'heady-jetbrains', domain: 'jetbrains.headyio.com', name: 'HeadyJetBrains', icon: '🔧', color: '#f97316', tagline: 'JetBrains Plugin', desc: 'AI-powered plugin for IntelliJ, PyCharm, WebStorm, and all JetBrains IDEs. Deep framework awareness.', features: ['All JetBrains IDEs', 'Framework-aware', 'Intentions', 'Inspections', 'Live templates', 'Database assist'] },

  // ── Communication ──
  { id: 'heady-slack', domain: 'slack.headyio.com', name: 'HeadySlack', icon: '💬', color: '#e11d48', tagline: 'Slack AI Bot', desc: 'AI assistant in your Slack workspace. Summarize threads, answer questions, search knowledge, and automate workflows.', features: ['Thread summary', 'Q&A bot', 'Knowledge search', 'Workflow automation', 'Slash commands', 'Channel insights'] },
  { id: 'heady-github-integration', domain: 'github.headyio.com', name: 'HeadyGitHub', icon: '🐙', color: '#6e5494', tagline: 'GitHub AI Integration', desc: 'AI-powered code review, PR summaries, issue triage, and automated CI/CD optimization for GitHub repositories.', features: ['PR review', 'Issue triage', 'CI/CD optimization', 'Code quality', 'Security alerts', 'Release notes'] },
];

function generatePage(v) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${v.name} — ${v.tagline}</title>
<meta name="description" content="${v.desc}">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--brand:${v.color};--bg:#050510;--surface:#0d0d20;--surface2:#161630;--border:rgba(124,58,237,.15);--text:#e0e0ff;--dim:#6b7280}
body{background:var(--bg);color:var(--text);font-family:'Inter',system-ui,sans-serif;min-height:100vh}
a{color:var(--brand);text-decoration:none}
.hero{text-align:center;padding:80px 24px 60px;background:linear-gradient(180deg,rgba(${hexToRgb(v.color)},.08) 0%,transparent 100%)}
.hero .icon{font-size:4rem;margin-bottom:16px;display:block}
.hero h1{font-size:2.5rem;font-weight:700;background:linear-gradient(135deg,var(--brand),#e0e0ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px}
.hero .tagline{font-size:1.2rem;color:var(--dim);margin-bottom:24px}
.hero .desc{max-width:600px;margin:0 auto 32px;font-size:1rem;line-height:1.7;color:var(--text);opacity:.85}
.cta{display:inline-flex;align-items:center;gap:8px;padding:14px 32px;background:linear-gradient(135deg,var(--brand),#7c3aed);color:#fff;border-radius:12px;font-weight:600;font-size:1rem;transition:all .2s;border:none;cursor:pointer}
.cta:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(${hexToRgb(v.color)},.4)}
.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;max-width:900px;margin:0 auto;padding:0 24px 80px}
.feature{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;text-align:center;transition:all .2s}
.feature:hover{border-color:var(--brand);transform:translateY(-2px);box-shadow:0 4px 24px rgba(${hexToRgb(v.color)},.15)}
.feature h3{font-size:.9rem;font-weight:600;margin-bottom:4px}
.feature p{color:var(--dim);font-size:.8rem}
.nav{display:flex;justify-content:space-between;align-items:center;padding:16px 32px;border-bottom:1px solid var(--border)}
.nav .logo{font-weight:700;font-size:1.1rem;color:var(--text)}
.nav .links{display:flex;gap:16px}
.nav .links a{color:var(--dim);font-size:.85rem;padding:6px 12px;border-radius:6px;border:1px solid transparent;transition:all .2s}
.nav .links a:hover{color:var(--text);border-color:var(--border)}
footer{text-align:center;padding:32px;color:var(--dim);font-size:.75rem;border-top:1px solid var(--border)}
</style>
</head>
<body>
<nav class="nav">
  <div class="logo">${v.icon} ${v.name}</div>
  <div class="links">
    <a href="https://headysystems.com">HeadySystems</a>
    <a href="https://headyapi.com">API</a>
    <a href="https://headymcp.com">MCP</a>
  </div>
</nav>
<section class="hero">
  <span class="icon">${v.icon}</span>
  <h1>${v.name}</h1>
  <p class="tagline">${v.tagline}</p>
  <p class="desc">${v.desc}</p>
  
  <!-- REQUIRED EXPLANATION OF DATA HANDLING AND SERVICES -->
  <div style="background: rgba(124,58,237,0.15); border: 1px solid rgba(124,58,237,0.5); border-radius: 12px; padding: 24px; max-width: 800px; margin: 32px auto; text-align: left; line-height: 1.6;">
    <h3 style="color: #e0e0ff; margin-bottom: 12px; font-size: 1.1rem;">🧠 DEFAULT HANDLING OF DATA & INTELLIGENCE PROCESSING</h3>
    <p style="color: #a0a0c0; font-size: 0.95rem; margin-bottom: 16px;">
      <strong>Blatantly Obvious Note:</strong> All data handled by Heady is processed intelligently by default. 
      Heady evaluates your task and provides what it found as the <strong>best action in response</strong> via our patent-pending Sacred Geometry Architecture and Orchestrator-Promoter Protocol.
    </p>
    <p style="color: #a0a0c0; font-size: 0.95rem; margin-bottom: 16px;">
      You can trigger this by simply providing Heady with:<br>
      <code style="background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 4px; color: #06b6d4;">"stuff for heady to intelligently process"</code><br><br>
      Or by using the shortcut:<br>
      <code style="background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 4px; color: #7c3aed;">"heady's intelligence processing shortcut"</code>
    </p>
    <h4 style="color: #e0e0ff; margin-bottom: 8px; font-size: 1rem;">Available Specified Services</h4>
    <p style="color: #a0a0c0; font-size: 0.9rem;">
      While Heady intelligently routes everything by default, <em>if ever necessary</em>, you can bypass the default routing and use these specific services directly:
      <strong>HeadyBuddy, HeadyMaestro, HeadyJules, HeadyObserver, HeadyBuilder, HeadyAtlas, HeadyPythia, HeadyMonteCarlo, HeadyPatterns, HeadyCritique, HeadyImagine, HeadyStories, HeadySentinel, and HeadyVinci.</strong>
    </p>
  </div>

  <button class="cta" onclick="document.getElementById('heady-buddy-panel')?.classList.add('open')">Try ${v.name} →</button>
</section>
<div class="features">
${v.features.map(f => `  <div class="feature"><h3>${f}</h3></div>`).join('\n')}
</div>
<footer>© 2026 Heady Systems LLC. All rights reserved. ${v.domain}</footer>
<script>window.HEADY_API="https://api.headysystems.com";</script>
<script src="/buddy-widget.js"></script>
</body>
</html>`;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ── Generate all sites ──
console.log('╔══════════════════════════════════════════╗');
console.log('║  GENERATING ALL VERTICAL SITES           ║');
console.log('╚══════════════════════════════════════════╝\n');

let count = 0;
for (const v of VERTICALS) {
  const dir = path.join(SITES_DIR, v.id, 'dist');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), generatePage(v));
  // Copy buddy widget
  if (fs.existsSync(WIDGET_SRC)) {
    fs.copyFileSync(WIDGET_SRC, path.join(dir, 'buddy-widget.js'));
  }
  count++;
  console.log(`  ✓ ${v.name.padEnd(20)} → ${v.domain}`);
}

console.log(`\n  Generated ${count} vertical sites in ${SITES_DIR}/`);
console.log('  Each site has: index.html + buddy-widget.js');
console.log('  Run: pm2 restart ecosystem.config.cjs to serve them all');
