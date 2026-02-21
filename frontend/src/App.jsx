import { useState, useEffect } from "react";
import { Activity, Cpu, Zap, Globe, Server, BookOpen } from "lucide-react";

/**
 * HEADY SYSTEMS - MAIN FRONTEND APPLICATION
 * 
 * Documentation:
 * This is the central dashboard for the Heady ecosystem. 
 * Design Language: Sacred Geometry, Breathing Interfaces, Organic Systems
 * 
 * Sites Managed from this unified interface:
 * - headysystems.com (Platform Hub)
 * - headyme.com (Personal App)
 * - headyconnection.org (Community Platform)
 */
export default function App() {
  const [health, setHealth] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [activeDomain, setActiveDomain] = useState("headysystems.com");

  useEffect(() => {
    // In a real environment, this would read window.location.hostname
    // For now, we simulate the domain detection
    const hostname = window.location.hostname;
    if (hostname.includes("headyme")) setActiveDomain("headyme.com");
    if (hostname.includes("headyconnection")) setActiveDomain("headyconnection.org");

    fetch("/api/health").then(r => r.json()).then(setHealth).catch(() => {});
    fetch("/api/system/status").then(r => r.json()).then(setSystemStatus).catch(() => {});
  }, []);

  // Sacred Geometry Branding based on Domain
  const getTheme = () => {
    switch (activeDomain) {
      case "headyme.com":
        return { color: "blue", hex: "#60a5fa", name: "Heady Me", shape: "Flower of Life" };
      case "headyconnection.org":
        return { color: "rose", hex: "#fb7185", name: "Heady Connection", shape: "Torus" };
      default:
        return { color: "green", hex: "#4ade80", name: "Heady Systems", shape: "Metatron's Cube" };
    }
  };

  const theme = getTheme();

  return (
    <div className="min-h-screen bg-gray-950 p-8 relative overflow-hidden">
      
      {/* Sacred Geometry Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] opacity-5 pointer-events-none flex justify-center items-center">
         <div className={`w-full h-full border border-${theme.color}-500 rounded-full animate-[spin_60s_linear_infinite]`}></div>
         <div className={`absolute w-3/4 h-3/4 border border-${theme.color}-500 rounded-full animate-[spin_40s_linear_infinite_reverse]`}></div>
         <div className={`absolute w-1/2 h-1/2 border border-${theme.color}-500 transform rotate-45`}></div>
      </div>

      <header className="max-w-6xl mx-auto mb-16 relative z-10 text-center flex flex-col items-center">
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-4 h-4 rounded-full bg-${theme.color}-400 animate-breathe shadow-[0_0_15px_${theme.hex}]`} />
          <h1 className="text-4xl font-light tracking-widest text-white uppercase">
            {theme.name}
          </h1>
        </div>
        <p className="text-gray-400 text-sm tracking-widest uppercase mb-2">
          Organic Systems :: {theme.shape} Architecture
        </p>
        <div className="flex gap-4 mt-6">
           <span className="text-xs text-gray-500 bg-gray-900 px-3 py-1 rounded-full border border-gray-800 flex items-center gap-2">
             <BookOpen className="w-3 h-3"/> Docs Attached
           </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
        
        {/* Health Card */}
        <div className={`bg-gray-900/80 backdrop-blur-md border border-gray-800 rounded-[30px] p-8 hover:border-${theme.color}-800/50 transition-all duration-500 hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] group`}>
          <div className="flex items-center justify-between mb-6">
            <div className={`p-3 rounded-full bg-${theme.color}-900/20 text-${theme.color}-400 group-hover:scale-110 transition-transform`}>
              <Activity className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-light tracking-wide">Vitals</h2>
          </div>
          {health ? (
            <div className="space-y-4 text-sm text-gray-400 font-mono">
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span>Resonance</span> <span className={`text-${theme.color}-400`}>Synchronized</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span>Iteration</span> <span>{health.version || 'v3.0.0'}</span>
              </div>
              <div className="flex justify-between pb-2">
                <span>Continuity</span> <span>{Math.floor(health.uptime || 0)} cycles</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-gray-600 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-gray-600"></div> Aligning...
            </div>
          )}
        </div>

        {/* System Status Card */}
        <div className={`bg-gray-900/80 backdrop-blur-md border border-gray-800 rounded-[30px] p-8 hover:border-${theme.color}-800/50 transition-all duration-500 hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] group`}>
          <div className="flex items-center justify-between mb-6">
            <div className={`p-3 rounded-full bg-${theme.color}-900/20 text-${theme.color}-400 group-hover:scale-110 transition-transform`}>
              <Server className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-light tracking-wide">Network</h2>
          </div>
          {systemStatus ? (
            <div className="space-y-4 text-sm text-gray-400 font-mono">
               <div className="flex justify-between border-b border-gray-800 pb-2">
                <span>Layer</span> <span className={`text-${theme.color}-400 capitalize`}>{systemStatus.environment || 'Production'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span>Active Nodes</span> <span>{systemStatus.capabilities?.nodes?.active || 5} / {systemStatus.capabilities?.nodes?.total || 5}</span>
              </div>
              <div className="flex justify-between pb-2">
                <span>Arena Status</span> <span>{systemStatus.production_ready ? "Victor" : "Evaluating"}</span>
              </div>
            </div>
          ) : (
             <div className="flex items-center gap-3 text-gray-600 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-gray-600"></div> Mapping...
            </div>
          )}
        </div>

        {/* Sacred Actions Card */}
        <div className={`bg-gray-900/80 backdrop-blur-md border border-gray-800 rounded-[30px] p-8 hover:border-${theme.color}-800/50 transition-all duration-500 hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] group`}>
          <div className="flex items-center justify-between mb-6">
             <div className={`p-3 rounded-full bg-${theme.color}-900/20 text-${theme.color}-400 group-hover:scale-110 transition-transform`}>
              <Zap className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-light tracking-wide">Catalysts</h2>
          </div>
          <div className="space-y-4">
            <button
              onClick={() => fetch("/api/system/production", { method: "POST" }).then(r => r.json()).then(d => { alert("Production activated!"); location.reload(); })}
              className={`w-full px-6 py-3 bg-${theme.color}-900/20 border border-${theme.color}-700/30 rounded-[20px] text-sm tracking-wide text-${theme.color}-300 hover:bg-${theme.color}-800/40 hover:shadow-[0_0_15px_${theme.hex}33] transition-all duration-300`}
            >
              Initiate Production
            </button>
            <button
              onClick={() => fetch("/api/pipeline/run", { method: "POST" }).then(r => r.json()).then(d => alert(JSON.stringify(d, null, 2)))}
              className="w-full px-6 py-3 bg-gray-800/30 border border-gray-700/50 rounded-[20px] text-sm tracking-wide text-gray-300 hover:bg-gray-700/50 transition-all duration-300"
            >
              Execute HCFP Pipeline
            </button>
          </div>
        </div>
      </main>
      
      <footer className="max-w-6xl mx-auto mt-20 text-center text-gray-600 text-xs tracking-widest uppercase relative z-10 border-t border-gray-900 pt-8">
         <p>Heady Documentation Embedded • Architecture: Organic</p>
      </footer>
    </div>
  );
}
