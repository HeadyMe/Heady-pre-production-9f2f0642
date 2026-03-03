import { useState, useEffect } from "react";
import { Activity, Cpu, Zap, Globe, Server, BookOpen, Bot, Code, Shield, BarChart3, Users, Plug, Palette, Brain, ExternalLink } from "lucide-react";

/**
 * HEADY WEB — Central App & Vertical Delivery Portal
 * 
 * This is the main hub for the entire Heady ecosystem.
 * Every app, vertical, and service is accessible from here.
 * Design Language: Sacred Geometry, Breathing Interfaces, Organic Systems
 */

const APPS = [
  { id: "admin", name: "Heady Admin", desc: "Operations console. System health, node orchestration, pipeline control.", icon: Server, href: "https://admin.headysystems.com", port: 4401, color: "emerald", gradient: "from-emerald-900/30 to-emerald-800/10" },
  { id: "ide", name: "HeadyAI-IDE", desc: "AI-powered development environment. Code-server with 20-node intelligence.", icon: Code, href: "https://ide.headysystems.com", port: 8443, color: "blue", gradient: "from-blue-900/30 to-blue-800/10" },
  { id: "buddy", name: "HeadyBuddy", desc: "Your AI Swarm Commander. Voice, chat, and HeadyBees task execution.", icon: Bot, href: "https://headybuddy.org", port: 4201, color: "pink", gradient: "from-pink-900/30 to-pink-800/10" },
  { id: "manager", name: "Heady Manager", desc: "Backend API server. 20 nodes, HCFP pipeline, auto-success engine.", icon: Cpu, href: "https://manager.headysystems.com", port: 4300, color: "green", gradient: "from-green-900/30 to-green-800/10" },
  { id: "mcp", name: "HeadyMCP", desc: "Model Context Protocol hub. Verified connectors, one-click deploy.", icon: Plug, href: "https://headymcp.com", color: "purple", gradient: "from-purple-900/30 to-purple-800/10" },
  { id: "io", name: "HeadyIO", desc: "Developer portal. REST API docs, Hive SDK, Arena Mode API.", icon: BookOpen, href: "https://headyio.com", port: 4500, color: "sky", gradient: "from-sky-900/30 to-sky-800/10" },
  { id: "connection", name: "HeadyConnection", desc: "AI for nonprofit impact. Grant writing, impact analytics, Proof View.", icon: Users, href: "https://headyconnection.org", port: 4600, color: "amber", gradient: "from-amber-900/30 to-amber-800/10" },
  { id: "instant", name: "1ime1", desc: "Instant Everything. Generate, deploy, and iterate in seconds.", icon: Zap, href: "https://1ime1.com", color: "orange", gradient: "from-orange-900/30 to-orange-800/10" },
  { id: "canvas", name: "HeadyVinci Canvas", desc: "Creative AI sandbox. Multi-model generation, remix, and composition.", icon: Palette, href: "https://manager.headysystems.com/canvas", color: "violet", gradient: "from-violet-900/30 to-violet-800/10" },
  { id: "systems", name: "HeadySystems", desc: "The Architecture of Intelligence. Self-healing infrastructure.", icon: Shield, href: "https://headysystems.com", color: "teal", gradient: "from-teal-900/30 to-teal-800/10" },
  { id: "me", name: "HeadyMe", desc: "Your AI Command Center. Cross-device memory, HCFP auto-planning.", icon: Brain, href: "https://headyme.com", color: "indigo", gradient: "from-indigo-900/30 to-indigo-800/10" },
];

const VERTICALS = [
  { name: "Trading & Finance", desc: "Autonomous algorithmic trading, risk analysis, compliance", color: "emerald" },
  { name: "Creative & Media", desc: "AI image, video, music generation with multi-model pipelines", color: "pink" },
  { name: "Developer Tools", desc: "IDE, MCP connectors, API documentation, Hive SDK", color: "blue" },
  { name: "Nonprofit & Impact", desc: "Grant writing, impact measurement, donor engagement", color: "amber" },
  { name: "Enterprise Ops", desc: "Infrastructure orchestration, security, compliance", color: "green" },
  { name: "Research & Intel", desc: "Deep analysis, competitive intelligence, pattern recognition", color: "purple" },
];

export default function App() {
  const [health, setHealth] = useState(null);
  const [autoSuccess, setAutoSuccess] = useState(null);
  const [appStatuses, setAppStatuses] = useState({});

  useEffect(() => {
    // Fetch system health
    fetch("/api/health").then(r => r.json()).then(setHealth).catch(() => { });

    // Fetch auto-success status
    fetch("/api/auto-success/status").then(r => r.json()).then(setAutoSuccess).catch(() => { });

    // Check app port liveness
    APPS.filter(a => a.port).forEach(app => {
      fetch(`http://localhost:${app.port}/`, { mode: "no-cors", signal: AbortSignal.timeout(3000) })
        .then(() => setAppStatuses(prev => ({ ...prev, [app.id]: "live" })))
        .catch(() => setAppStatuses(prev => ({ ...prev, [app.id]: "offline" })));
    });

    // Refresh auto-success every 15s
    const interval = setInterval(() => {
      fetch("/api/auto-success/status").then(r => r.json()).then(setAutoSuccess).catch(() => { });
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 relative overflow-hidden">

      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vw] opacity-[0.03]">
          <div className="w-full h-full border border-indigo-500 rounded-full animate-[spin_120s_linear_infinite]" />
          <div className="absolute inset-[15%] border border-purple-500 rounded-full animate-[spin_80s_linear_infinite_reverse]" />
          <div className="absolute inset-[30%] border border-blue-500 rounded-full animate-[spin_60s_linear_infinite]" />
        </div>
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-gray-800/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_12px_#818cf8]" />
            <h1 className="text-2xl font-light tracking-[0.2em] text-white uppercase">HeadyWeb</h1>
            <span className="text-xs text-gray-500 bg-gray-900 px-3 py-1 rounded-full border border-gray-800">Central Portal</span>
          </div>
          <div className="flex items-center gap-4">
            {autoSuccess && (
              <div className="text-xs text-gray-400 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${autoSuccess.running ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                <span>{autoSuccess.totalTasks || 0} tasks</span>
                <span className="text-gray-600">·</span>
                <span>{autoSuccess.totalSucceeded || 0} succeeded</span>
              </div>
            )}
            {health && (
              <div className="text-xs text-emerald-400/80 flex items-center gap-2">
                <Activity className="w-3 h-3" /> System Live
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10">

        {/* Hero Section */}
        <div className="text-center mb-14">
          <h2 className="text-4xl font-extralight text-white tracking-wide mb-3">
            All Heady Apps & Verticals
          </h2>
          <p className="text-gray-500 text-sm max-w-xl mx-auto">
            Your central hub for the entire Heady ecosystem. Launch any app, explore any vertical,
            monitor the pipeline — all from one place.
          </p>
        </div>

        {/* Auto-Success Pipeline Status Bar */}
        {autoSuccess && autoSuccess.running && (
          <div className="mb-10 bg-gray-900/60 backdrop-blur-md border border-gray-800 rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-green-900/30 flex items-center justify-center">
                <Zap className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <div className="text-sm text-white font-medium">HCFP Auto-Success Pipeline</div>
                <div className="text-xs text-gray-500">
                  {autoSuccess.cycleCount || 0} cycles · {autoSuccess.batchSize || 0}/batch · {autoSuccess.intervalMs || 0}ms interval
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs text-gray-400">
              <div className="text-center">
                <div className="text-lg font-light text-green-400">{autoSuccess.totalSucceeded || 0}</div>
                <div>Succeeded</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-light text-white">{Object.keys(autoSuccess.categories || {}).length}</div>
                <div>Categories</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-light text-indigo-400">{autoSuccess.successRate || "100%"}</div>
                <div>Success Rate</div>
              </div>
            </div>
          </div>
        )}

        {/* Apps Grid */}
        <h3 className="text-xs text-gray-500 uppercase tracking-[0.3em] mb-5 flex items-center gap-2">
          <Globe className="w-3 h-3" /> Applications
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-14">
          {APPS.map(app => {
            const Icon = app.icon;
            const status = appStatuses[app.id];
            return (
              <a
                key={app.id}
                href={app.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`group bg-gradient-to-br ${app.gradient} backdrop-blur-md border border-gray-800 rounded-2xl p-5 hover:border-${app.color}-700/40 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer block`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2.5 rounded-xl bg-${app.color}-900/30 text-${app.color}-400 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    {status === "live" && <div className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                    <ExternalLink className="w-3 h-3 text-gray-600 group-hover:text-gray-400 transition-colors" />
                  </div>
                </div>
                <h4 className="text-white text-sm font-medium mb-1">{app.name}</h4>
                <p className="text-gray-500 text-xs leading-relaxed">{app.desc}</p>
                {app.port && (
                  <div className="mt-3 text-[0.6rem] text-gray-600 font-mono">:{app.port}</div>
                )}
              </a>
            );
          })}
        </div>

        {/* Verticals Grid */}
        <h3 className="text-xs text-gray-500 uppercase tracking-[0.3em] mb-5 flex items-center gap-2">
          <BarChart3 className="w-3 h-3" /> Verticals
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
          {VERTICALS.map((v, i) => (
            <div
              key={i}
              className={`bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-2xl p-5 hover:border-${v.color}-800/30 transition-all duration-300`}
            >
              <h4 className={`text-${v.color}-400 text-sm font-medium mb-1`}>{v.name}</h4>
              <p className="text-gray-500 text-xs">{v.desc}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => fetch("/api/system/production", { method: "POST" }).then(r => r.json()).then(() => location.reload())}
            className="px-5 py-2.5 bg-indigo-900/20 border border-indigo-700/30 rounded-full text-xs text-indigo-300 hover:bg-indigo-800/30 transition-all"
          >
            <Zap className="w-3 h-3 inline mr-2" />Initiate Production
          </button>
          <button
            onClick={() => fetch("/api/pipeline/run", { method: "POST" }).then(r => r.json()).then(d => alert(JSON.stringify(d, null, 2)))}
            className="px-5 py-2.5 bg-gray-800/30 border border-gray-700/50 rounded-full text-xs text-gray-400 hover:bg-gray-700/50 transition-all"
          >
            Execute HCFP Pipeline
          </button>
          <button
            onClick={() => fetch("/api/auto-success/status").then(r => r.json()).then(d => alert(JSON.stringify(d, null, 2)))}
            className="px-5 py-2.5 bg-gray-800/30 border border-gray-700/50 rounded-full text-xs text-gray-400 hover:bg-gray-700/50 transition-all"
          >
            <Activity className="w-3 h-3 inline mr-2" />Pipeline Status
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl mx-auto px-6 py-8 border-t border-gray-900 text-center text-gray-600 text-xs tracking-widest uppercase">
        <p>HeadyWeb · Central Portal · Sacred Geometry Architecture · © 2026 Heady Systems LLC</p>
      </footer>
    </div>
  );
}
