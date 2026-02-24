#!/usr/bin/env node
/**
 * Heady Site Generator — Produces production-ready static sites for each brand
 * Each site gets unique branding, colors, copy, and features while sharing
 * a premium design system.
 */

const fs = require('fs');
const path = require('path');

const SITES_DIR = '/home/headyme/sites';

// ── Site Definitions ─────────────────────────────────────────────────
const sites = [
    {
        id: 'headyme',
        dir: 'headyme',
        title: 'HeadyMe — Your Personal AI Cloud',
        tagline: 'Everything you worked on. Everything that\'s next.',
        description: 'HeadyMe is your personal cloud hub — cross-device memory, AI task management, and intelligent daily planning powered by the Heady ecosystem.',
        gradient: ['#7C3AED', '#2563EB'],
        accent: '#A78BFA',
        icon: '🧠',
        features: [
            { icon: '🔄', title: 'Cross-Device Memory', desc: 'Your context follows you across every device, every session.' },
            { icon: '📋', title: 'AI Task Planning', desc: 'Auto-generates daily plans from your calendar, projects, and goals.' },
            { icon: '🏆', title: 'Arena Optimization', desc: 'Multiple AI strategies compete to find the best approach to your tasks.' },
            { icon: '🔐', title: 'Private by Design', desc: 'Your data stays yours. Local-first with optional cloud sync.' },
        ],
        cta: 'Launch Your Dashboard',
        ctaHref: 'https://app.headyme.com',
        domain: 'headyme.com',
    },
    {
        id: 'headyme-com',
        dir: 'headyme-com',
        title: 'HeadyMe — Your Personal AI Cloud',
        tagline: 'Everything you worked on. Everything that\'s next.',
        description: 'HeadyMe is your personal cloud hub — cross-device memory, AI task management, and intelligent daily planning powered by the Heady ecosystem.',
        gradient: ['#7C3AED', '#2563EB'],
        accent: '#A78BFA',
        icon: '🧠',
        features: [
            { icon: '🔄', title: 'Cross-Device Memory', desc: 'Your context follows you across every device, every session.' },
            { icon: '📋', title: 'AI Task Planning', desc: 'Auto-generates daily plans from your calendar, projects, and goals.' },
            { icon: '🏆', title: 'Arena Optimization', desc: 'Multiple AI strategies compete to find the best approach to your tasks.' },
            { icon: '🔐', title: 'Private by Design', desc: 'Your data stays yours. Local-first with optional cloud sync.' },
        ],
        cta: 'Launch Your Dashboard',
        ctaHref: 'https://app.headyme.com',
        domain: 'headyme.com',
    },
    {
        id: 'headysystems',
        dir: 'headysystems',
        title: 'HeadySystems — Platform Operations Intelligence',
        tagline: 'Self-healing infrastructure. Arena-validated remediation.',
        description: 'HeadySystems is the operations backbone — monitor 18+ services, auto-detect drift, and let AI strategies compete to find the optimal fix.',
        gradient: ['#059669', '#0D9488'],
        accent: '#34D399',
        icon: '⚡',
        features: [
            { icon: '📊', title: 'Service Observatory', desc: '18 PM2 processes, Cloudflare Workers, and edge nodes — one view.' },
            { icon: '🔧', title: 'Self-Healing Ops', desc: 'Arena Mode proposes 3 competing fixes for every issue. You pick or auto-approve.' },
            { icon: '🛡️', title: 'Drift Detection', desc: 'Continuous compliance audits catch config drift before it causes outages.' },
            { icon: '📈', title: 'FinOps Dashboard', desc: 'Track cost-per-request, model selection efficiency, and infrastructure spend.' },
        ],
        cta: 'Open Operations Console',
        ctaHref: 'https://app.headysystems.com',
        domain: 'headysystems.com',
    },
    {
        id: 'headysystems-com',
        dir: 'headysystems-com',
        title: 'HeadySystems — Platform Operations Intelligence',
        tagline: 'Self-healing infrastructure. Arena-validated remediation.',
        description: 'HeadySystems is the operations backbone — monitor 18+ services, auto-detect drift, and let AI strategies compete to find the optimal fix.',
        gradient: ['#059669', '#0D9488'],
        accent: '#34D399',
        icon: '⚡',
        features: [
            { icon: '📊', title: 'Service Observatory', desc: '18 PM2 processes, Cloudflare Workers, and edge nodes — one view.' },
            { icon: '🔧', title: 'Self-Healing Ops', desc: 'Arena Mode proposes 3 competing fixes for every issue. You pick or auto-approve.' },
            { icon: '🛡️', title: 'Drift Detection', desc: 'Continuous compliance audits catch config drift before it causes outages.' },
            { icon: '📈', title: 'FinOps Dashboard', desc: 'Track cost-per-request, model selection efficiency, and infrastructure spend.' },
        ],
        cta: 'Open Operations Console',
        ctaHref: 'https://app.headysystems.com',
        domain: 'headysystems.com',
    },
    {
        id: 'headyconnection',
        dir: 'headyconnection',
        title: 'HeadyConnection — AI for Nonprofit Impact',
        tagline: 'Amplify your mission with intelligent automation.',
        description: 'HeadyConnection empowers nonprofits with AI-powered grant writing, impact reporting, and donor engagement — with full Proof View transparency.',
        gradient: ['#D97706', '#DC2626'],
        accent: '#FBBF24',
        icon: '🤝',
        features: [
            { icon: '📝', title: 'AI Grant Writing', desc: 'Generate grant applications backed by your real data. Every claim verified.' },
            { icon: '📊', title: 'Impact Reporting', desc: 'Auto-generate reports that show measurable outcomes and program effectiveness.' },
            { icon: '✅', title: 'Proof View Receipts', desc: 'Every AI output comes with a transparent audit trail. No hallucination risk.' },
            { icon: '👥', title: 'Volunteer Intelligence', desc: 'Match volunteers to opportunities using AI-driven skill and schedule analysis.' },
        ],
        cta: 'Start Amplifying Impact',
        ctaHref: 'https://app.headyconnection.org',
        domain: 'headyconnection.org',
    },
    {
        id: 'headyconnection-org',
        dir: 'headyconnection-org',
        title: 'HeadyConnection — AI for Nonprofit Impact',
        tagline: 'Amplify your mission with intelligent automation.',
        description: 'HeadyConnection empowers nonprofits with AI-powered grant writing, impact reporting, and donor engagement — with full Proof View transparency.',
        gradient: ['#D97706', '#DC2626'],
        accent: '#FBBF24',
        icon: '🤝',
        features: [
            { icon: '📝', title: 'AI Grant Writing', desc: 'Generate grant applications backed by your real data. Every claim verified.' },
            { icon: '📊', title: 'Impact Reporting', desc: 'Auto-generate reports that show measurable outcomes and program effectiveness.' },
            { icon: '✅', title: 'Proof View Receipts', desc: 'Every AI output comes with a transparent audit trail. No hallucination risk.' },
            { icon: '👥', title: 'Volunteer Intelligence', desc: 'Match volunteers to opportunities using AI-driven skill and schedule analysis.' },
        ],
        cta: 'Start Amplifying Impact',
        ctaHref: 'https://app.headyconnection.org',
        domain: 'headyconnection-org',
    },
    {
        id: 'headymcp',
        dir: 'headymcp',
        title: 'HeadyMCP — Verified AI Connector Marketplace',
        tagline: 'Find it. Trust it. Ship it.',
        description: 'HeadyMCP is the trusted registry for Model Context Protocol connectors — verified publishers, quality scoring, one-click install.',
        gradient: ['#7C3AED', '#EC4899'],
        accent: '#C084FC',
        icon: '🔌',
        features: [
            { icon: '🔍', title: 'Connector Discovery', desc: 'Search hundreds of MCP connectors by category, quality score, and publisher.' },
            { icon: '✓', title: 'Trust Scoring', desc: 'Every connector is security-scanned, rated, and verified before listing.' },
            { icon: '⚡', title: 'One-Click Install', desc: 'Install connectors to HeadyBuddy, HeadyAI-IDE, or your own apps instantly.' },
            { icon: '🏗️', title: 'Publish Your Own', desc: 'Build and publish connectors with full governance pipeline support.' },
        ],
        cta: 'Browse Connectors',
        ctaHref: 'https://headymcp.com',
        domain: 'headymcp.com',
    },
    {
        id: 'headymcp-com',
        dir: 'headymcp-com',
        title: 'HeadyMCP — Verified AI Connector Marketplace',
        tagline: 'Find it. Trust it. Ship it.',
        description: 'HeadyMCP is the trusted registry for Model Context Protocol connectors — verified publishers, quality scoring, one-click install.',
        gradient: ['#7C3AED', '#EC4899'],
        accent: '#C084FC',
        icon: '🔌',
        features: [
            { icon: '🔍', title: 'Connector Discovery', desc: 'Search hundreds of MCP connectors by category, quality score, and publisher.' },
            { icon: '✓', title: 'Trust Scoring', desc: 'Every connector is security-scanned, rated, and verified before listing.' },
            { icon: '⚡', title: 'One-Click Install', desc: 'Install connectors to HeadyBuddy, HeadyAI-IDE, or your own apps instantly.' },
            { icon: '🏗️', title: 'Publish Your Own', desc: 'Build and publish connectors with full governance pipeline support.' },
        ],
        cta: 'Browse Connectors',
        ctaHref: 'https://headymcp.com',
        domain: 'headymcp.com',
    },
    {
        id: 'headyio',
        dir: 'headyio',
        title: 'HeadyIO — Developer Portal & API',
        tagline: 'Build with Heady. Ship with confidence.',
        description: 'HeadyIO is the developer hub — API documentation, SDKs, code examples, and everything you need to integrate the Heady ecosystem.',
        gradient: ['#1E40AF', '#3B82F6'],
        accent: '#60A5FA',
        icon: '💻',
        features: [
            { icon: '📚', title: 'API Documentation', desc: 'Complete REST API reference with interactive examples and response schemas.' },
            { icon: '🧰', title: 'SDKs & Libraries', desc: 'JavaScript, Python, and Go SDKs for rapid integration.' },
            { icon: '🏎️', title: 'Arena Mode API', desc: 'Run multi-model competitions programmatically via the Arena API.' },
            { icon: '🔑', title: 'API Keys & Auth', desc: 'Generate API keys, configure scopes, and manage access with the Policy Ladder.' },
        ],
        cta: 'Read the Docs',
        ctaHref: 'https://api.headyio.com',
        domain: 'headyio.com',
    },
    {
        id: 'headybuddy',
        dir: 'headybuddy',
        title: 'HeadyBuddy — Your AI Companion',
        tagline: 'Always learning. Always there. Always you.',
        description: 'HeadyBuddy is your personal AI companion — voice-activated, cross-device, with persistent memory that learns from every interaction.',
        gradient: ['#EC4899', '#8B5CF6'],
        accent: '#F472B6',
        icon: '🤖',
        features: [
            { icon: '🎤', title: 'Voice Activation', desc: 'Talk naturally. HeadyBuddy listens, understands, and acts across devices.' },
            { icon: '🧠', title: 'Persistent Memory', desc: 'HeadyBuddy remembers your preferences, context, and conversation history.' },
            { icon: '🔄', title: 'Cross-Device Sync', desc: 'Start a conversation on your phone, continue on your laptop. Seamlessly.' },
            { icon: '🛡️', title: 'Arena-Validated', desc: 'Every response is evaluated by competing AI strategies for accuracy.' },
        ],
        cta: 'Meet Your Buddy',
        ctaHref: 'https://app.headybuddy.org',
        domain: 'headybuddy.org',
    },
    {
        id: 'headybuddy-org',
        dir: 'headybuddy-org',
        title: 'HeadyBuddy — Your AI Companion',
        tagline: 'Always learning. Always there. Always you.',
        description: 'HeadyBuddy is your personal AI companion — voice-activated, cross-device, with persistent memory that learns from every interaction.',
        gradient: ['#EC4899', '#8B5CF6'],
        accent: '#F472B6',
        icon: '🤖',
        features: [
            { icon: '🎤', title: 'Voice Activation', desc: 'Talk naturally. HeadyBuddy listens, understands, and acts across devices.' },
            { icon: '🧠', title: 'Persistent Memory', desc: 'HeadyBuddy remembers your preferences, context, and conversation history.' },
            { icon: '🔄', title: 'Cross-Device Sync', desc: 'Start a conversation on your phone, continue on your laptop. Seamlessly.' },
            { icon: '🛡️', title: 'Arena-Validated', desc: 'Every response is evaluated by competing AI strategies for accuracy.' },
        ],
        cta: 'Meet Your Buddy',
        ctaHref: 'https://app.headybuddy.org',
        domain: 'headybuddy.org',
    },
    {
        id: 'headyweb',
        dir: 'headyweb',
        title: 'HeadyWeb — Intelligent Search & AI Sidebar',
        tagline: 'Search smarter. Browse better. Think deeper.',
        description: 'HeadyWeb transforms your browser into an AI-powered workspace with intelligent search, AI sidebar assistance, and smart tab management.',
        gradient: ['#0EA5E9', '#6366F1'],
        accent: '#38BDF8',
        icon: '🌐',
        features: [
            { icon: '🔍', title: 'AI-Powered Search', desc: 'Search the web with contextual AI understanding — not just keywords.' },
            { icon: '💬', title: 'AI Sidebar', desc: 'Get intelligent assistance while browsing — summarize, explain, or act on any page.' },
            { icon: '📑', title: 'Smart Tabs', desc: 'AI-organized tabs that group, prioritize, and clean up automatically.' },
            { icon: '🔗', title: 'HeadyBuddy Integration', desc: 'Your AI companion is always one click away in the sidebar.' },
        ],
        cta: 'Get HeadyWeb',
        ctaHref: 'https://headyweb.com',
        domain: 'headyweb.com',
    },
    {
        id: 'instant',
        dir: 'instant',
        title: '1ime1 — Instant Everything',
        tagline: 'One time. Every time. All the time.',
        description: '1ime1 delivers instant access to AI-powered tools, creative generation, and rapid deployment — no setup, no friction, just results.',
        gradient: ['#F59E0B', '#EF4444'],
        accent: '#FCD34D',
        icon: '⚡',
        features: [
            { icon: '🚀', title: 'Instant Deploy', desc: 'Ship websites, APIs, and AI workflows in seconds. Zero config.' },
            { icon: '🎨', title: 'AI Creative', desc: 'Generate images, copy, and designs with one prompt.' },
            { icon: '⏱️', title: 'Real-Time', desc: 'Everything streams. Everything updates live. No refreshing.' },
            { icon: '🔮', title: 'Predictive', desc: 'AI anticipates what you need before you ask for it.' },
        ],
        cta: 'Try it Now',
        ctaHref: 'https://1ime1.com',
        domain: '1ime1.com',
    },
    {
        id: '1ime1',
        dir: '1ime1',
        title: '1ime1 — Instant Everything',
        tagline: 'One time. Every time. All the time.',
        description: '1ime1 delivers instant access to AI-powered tools, creative generation, and rapid deployment — no setup, no friction, just results.',
        gradient: ['#F59E0B', '#EF4444'],
        accent: '#FCD34D',
        icon: '⚡',
        features: [
            { icon: '🚀', title: 'Instant Deploy', desc: 'Ship websites, APIs, and AI workflows in seconds. Zero config.' },
            { icon: '🎨', title: 'AI Creative', desc: 'Generate images, copy, and designs with one prompt.' },
            { icon: '⏱️', title: 'Real-Time', desc: 'Everything streams. Everything updates live. No refreshing.' },
            { icon: '🔮', title: 'Predictive', desc: 'AI anticipates what you need before you ask for it.' },
        ],
        cta: 'Try it Now',
        ctaHref: 'https://1ime1.com',
        domain: '1ime1.com',
    },
];

// ── HTML Generator ───────────────────────────────────────────────────

function generateSite(site) {
    const [g1, g2] = site.gradient;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${site.title}</title>
  <meta name="description" content="${site.description}">
  <meta name="theme-color" content="${g1}">
  <meta property="og:title" content="${site.title}">
  <meta property="og:description" content="${site.description}">
  <meta property="og:type" content="website">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${site.icon}</text></svg>">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --g1: ${g1}; --g2: ${g2}; --accent: ${site.accent};
      --bg: #0a0a0f; --surface: #13131a; --surface-2: #1a1a24;
      --text: #e8e8ef; --text-muted: #8888a0; --border: #2a2a3a;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg); color: var(--text);
      line-height: 1.6; overflow-x: hidden;
      min-height: 100vh;
    }
    /* ── Ambient glow ── */
    body::before {
      content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
      background: radial-gradient(ellipse 80% 50% at 50% -20%, ${g1}15, transparent),
                  radial-gradient(ellipse 60% 40% at 80% 100%, ${g2}10, transparent);
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; position: relative; z-index: 1; }
    
    /* ── Nav ── */
    nav {
      padding: 20px 0; display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid var(--border);
    }
    .logo { font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px; }
    .logo-icon { font-size: 1.6rem; }
    .logo-text { background: linear-gradient(135deg, var(--g1), var(--g2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .nav-links { display: flex; gap: 32px; align-items: center; }
    .nav-links a { color: var(--text-muted); text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: color 0.2s; }
    .nav-links a:hover { color: var(--text); }
    .nav-cta {
      padding: 8px 20px; border-radius: 8px; font-weight: 600; font-size: 0.85rem;
      background: linear-gradient(135deg, var(--g1), var(--g2));
      color: white; text-decoration: none; transition: all 0.3s;
      box-shadow: 0 4px 15px ${g1}30;
    }
    .nav-cta:hover { transform: translateY(-1px); box-shadow: 0 6px 25px ${g1}50; }
    
    /* ── Hero ── */
    .hero { padding: 100px 0 80px; text-align: center; }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px;
      border-radius: 100px; background: var(--surface-2); border: 1px solid var(--border);
      font-size: 0.8rem; color: var(--accent); font-weight: 500; margin-bottom: 24px;
    }
    .hero-badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    h1 {
      font-size: clamp(2.8rem, 6vw, 4.5rem); font-weight: 900; letter-spacing: -0.03em;
      line-height: 1.1; margin-bottom: 20px;
      background: linear-gradient(135deg, var(--text) 0%, var(--text-muted) 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    h1 span {
      background: linear-gradient(135deg, var(--g1), var(--g2));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .hero-sub {
      font-size: 1.2rem; color: var(--text-muted); max-width: 600px; margin: 0 auto 40px;
      line-height: 1.7;
    }
    .hero-actions { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
    .btn-primary {
      padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 1rem;
      background: linear-gradient(135deg, var(--g1), var(--g2));
      color: white; text-decoration: none; transition: all 0.3s;
      box-shadow: 0 8px 30px ${g1}30;
      border: none; cursor: pointer;
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 40px ${g1}50; }
    .btn-secondary {
      padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 1rem;
      background: var(--surface); color: var(--text); text-decoration: none;
      border: 1px solid var(--border); transition: all 0.3s; cursor: pointer;
    }
    .btn-secondary:hover { background: var(--surface-2); border-color: var(--accent); }
    
    /* ── Features ── */
    .features { padding: 80px 0; }
    .features-label {
      text-align: center; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em;
      color: var(--accent); font-weight: 600; margin-bottom: 12px;
    }
    .features-title {
      text-align: center; font-size: 2.2rem; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 60px;
    }
    .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; }
    .feature-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
      padding: 32px; transition: all 0.3s; position: relative; overflow: hidden;
    }
    .feature-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, var(--g1), var(--g2)); opacity: 0; transition: opacity 0.3s;
    }
    .feature-card:hover { border-color: var(--accent); transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
    .feature-card:hover::before { opacity: 1; }
    .feature-icon { font-size: 2rem; margin-bottom: 16px; }
    .feature-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 8px; }
    .feature-desc { font-size: 0.9rem; color: var(--text-muted); line-height: 1.6; }
    
    /* ── Stats ── */
    .stats { padding: 60px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; text-align: center; }
    .stat-value {
      font-size: 2.5rem; font-weight: 900; letter-spacing: -0.02em;
      background: linear-gradient(135deg, var(--g1), var(--g2));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .stat-label { font-size: 0.85rem; color: var(--text-muted); margin-top: 4px; }
    
    /* ── CTA ── */
    .cta-section {
      padding: 100px 0; text-align: center;
    }
    .cta-card {
      background: linear-gradient(135deg, ${g1}15, ${g2}15);
      border: 1px solid var(--border); border-radius: 24px; padding: 60px;
    }
    .cta-title { font-size: 2rem; font-weight: 800; margin-bottom: 16px; }
    .cta-desc { font-size: 1.1rem; color: var(--text-muted); margin-bottom: 32px; max-width: 500px; margin-left: auto; margin-right: auto; }
    
    /* ── Footer ── */
    footer {
      padding: 40px 0; border-top: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;
    }
    .footer-brand { font-weight: 700; color: var(--text-muted); font-size: 0.9rem; }
    .footer-links { display: flex; gap: 24px; }
    .footer-links a { color: var(--text-muted); text-decoration: none; font-size: 0.85rem; transition: color 0.2s; }
    .footer-links a:hover { color: var(--accent); }
    .footer-copy { color: var(--text-muted); font-size: 0.8rem; opacity: 0.6; }
    
    /* ── Responsive ── */
    @media (max-width: 768px) {
      .nav-links { display: none; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .hero { padding: 60px 0 40px; }
      .cta-card { padding: 40px 24px; }
    }
    
    /* ── Micro-animations ── */
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .hero { animation: fadeInUp 0.8s ease-out; }
    .feature-card { animation: fadeInUp 0.6s ease-out backwards; }
    .feature-card:nth-child(1) { animation-delay: 0.1s; }
    .feature-card:nth-child(2) { animation-delay: 0.2s; }
    .feature-card:nth-child(3) { animation-delay: 0.3s; }
    .feature-card:nth-child(4) { animation-delay: 0.4s; }
  </style>
</head>
<body>
  <div class="container">
    <nav>
      <div class="logo">
        <span class="logo-icon">${site.icon}</span>
        <span class="logo-text">${site.title.split('—')[0].trim()}</span>
      </div>
      <div class="nav-links">
        <a href="#features">Features</a>
        <a href="https://headyio.com">Developers</a>
        <a href="https://headymcp.com">MCP</a>
        <a href="${site.ctaHref}" class="nav-cta">${site.cta}</a>
      </div>
    </nav>
    
    <section class="hero">
      <div class="hero-badge">Part of the Heady Ecosystem</div>
      <h1>${site.tagline.split('.').map((s, i) => i === 0 ? `<span>${s.trim()}</span>` : ` ${s.trim()}`).join('.')}</h1>
      <p class="hero-sub">${site.description}</p>
      <div class="hero-actions">
        <a href="${site.ctaHref}" class="btn-primary">${site.cta}</a>
        <a href="https://headyio.com" class="btn-secondary">Documentation →</a>
      </div>
    </section>
    
    <section class="features" id="features">
      <div class="features-label">Core Capabilities</div>
      <div class="features-title">Built different. Built better.</div>
      <div class="features-grid">
${site.features.map(f => `        <div class="feature-card">
          <div class="feature-icon">${f.icon}</div>
          <div class="feature-title">${f.title}</div>
          <div class="feature-desc">${f.desc}</div>
        </div>`).join('\n')}
      </div>
    </section>
    
    <section class="stats">
      <div class="stats-grid">
        <div><div class="stat-value">20</div><div class="stat-label">AI Nodes</div></div>
        <div><div class="stat-value">7+</div><div class="stat-label">Domains</div></div>
        <div><div class="stat-value">0</div><div class="stat-label">Vulnerabilities</div></div>
        <div><div class="stat-value">∞</div><div class="stat-label">Memory</div></div>
      </div>
    </section>
    
    <section class="cta-section">
      <div class="cta-card">
        <div class="cta-title">Ready to get started?</div>
        <div class="cta-desc">${site.description.split('—')[0].trim()} — available now.</div>
        <a href="${site.ctaHref}" class="btn-primary">${site.cta}</a>
      </div>
    </section>
    
    <footer>
      <div class="footer-brand">${site.title.split('—')[0].trim()}</div>
      <div class="footer-links">
        <a href="https://headyme.com">HeadyMe</a>
        <a href="https://headysystems.com">HeadySystems</a>
        <a href="https://headyconnection.org">HeadyConnection</a>
        <a href="https://headymcp.com">HeadyMCP</a>
        <a href="https://headyio.com">HeadyIO</a>
        <a href="https://headybuddy.org">HeadyBuddy</a>
      </div>
      <div class="footer-copy">© ${new Date().getFullYear()} Heady Systems. All rights reserved.</div>
    </footer>
  </div>
</body>
</html>`;
}

// ── Deploy ────────────────────────────────────────────────────────────
let count = 0;
for (const site of sites) {
    const siteDir = path.join(SITES_DIR, site.dir);
    const distDir = path.join(siteDir, 'dist');

    // Ensure directories exist
    if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

    const html = generateSite(site);
    fs.writeFileSync(path.join(distDir, 'index.html'), html);
    count++;
    console.log(`✅ ${site.id.padEnd(25)} → ${distDir}/index.html (${html.length} bytes)`);
}

console.log(`\n🎯 Generated ${count} sites in ${SITES_DIR}`);
