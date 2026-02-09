// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: headybuddy/src/components/ExpandedView.jsx                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  HEADY SYSTEMS                                                 ║
 * ║  ━━━━━━━━━━━━━━                                                ║
 * ║  ∞ Sacred Geometry Architecture ∞                              ║
 * ║                                                                ║
 * ║  ExpandedView.jsx - Full expanded companion view with tabs:    ║
 * ║  Overview, Steps, Resources, History                           ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import React, { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Send,
  LayoutDashboard,
  ListChecks,
  Activity,
  MessageSquare,
} from "lucide-react";
import SacredAvatar from "./SacredAvatar";
import ChatMessage from "./ChatMessage";
import ResourceHealthBar from "./ResourceHealthBar";

const HEADY_API = process.env.VITE_HEADY_API || "http://api.heady.io:3300";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "steps", label: "Steps", icon: ListChecks },
  { id: "resources", label: "Resources", icon: Activity },
  { id: "history", label: "History", icon: MessageSquare },
];

export default function ExpandedView({
  status,
  messages,
  onSend,
  onCollapse,
  resourceData,
  pipelineState,
  syncStatus,
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const syncEvents = new EventSource(`${HEADY_API}/api/buddy/sync-events`);
    
    syncEvents.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setSyncStatus(data.status);
    };
    
    return () => syncEvents.close();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, activeTab]);

  useEffect(() => { inputRef.current?.focus(); }, []);

      className="
        fixed bottom-6 right-6 z-[9999]
        w-[420px] max-h-[680px]
        flex flex-col
        glass glow-cyan rounded-sacred
        border border-heady-border
        shadow-2xl animate-slide-up
        overflow-hidden
      "
      onKeyDown={(e) => e.key === "Escape" && onCollapse()}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-heady-border/60">
        <div className="flex items-center gap-2.5">
          <SacredAvatar status={status} size={28} />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-heady-cyan tracking-wide">
              HeadyBuddy
            </span>
            <span className="text-[9px] text-heady-muted leading-none">
              Expanded View
            </span>
          </div>
        </div>
        <button
          onClick={onCollapse}
          className="p-1.5 rounded-lg text-heady-muted hover:text-heady-text hover:bg-heady-border/40 transition-colors"
          title="Collapse (Esc)"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────────── */}
      <div className="flex border-b border-heady-border/40 px-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-1.5 px-3 py-2 text-[10px] font-medium
                border-b-2 transition-all
                ${isActive
                  ? "border-heady-cyan text-heady-cyan"
                  : "border-transparent text-heady-muted hover:text-heady-text"
                }
              `}
            >
              <Icon size={12} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ─────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 min-h-[280px] max-h-[460px]">
        {activeTab === "overview" && (
          <OverviewTab
            pipelineState={pipelineState}
            resourceData={resourceData}
            syncStatus={syncStatus}
          />
        )}
        {activeTab === "steps" && (
          <StepsTab pipelineState={pipelineState} />
        )}
        {activeTab === "resources" && (
          <ResourcesTab resourceData={resourceData} />
        )}
        {activeTab === "history" && (
          <HistoryTab messages={messages} />
        )}
      </div>

      {/* ── Input ───────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3 border-t border-heady-border/60">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Continue conversation…"
          className="
            flex-1 bg-heady-bg/60 text-sm text-heady-text
            placeholder:text-heady-muted/60
            rounded-full px-4 py-2
            border border-heady-border focus:border-heady-cyan/40
            outline-none transition-colors
          "
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="
            p-2 rounded-full
            bg-heady-cyan/20 text-heady-cyan hover:bg-heady-cyan/30
            disabled:opacity-30 disabled:cursor-not-allowed transition-all
          "
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── TAB: OVERVIEW ─────────────────────────────────────────────────────────

function OverviewTab({ pipelineState, resourceData, syncStatus }) {
  const ps = pipelineState || {};
  return (
    <div className="space-y-4">
      {/* Device Status Section */}
      <div className="flex items-center gap-2 p-2 bg-heady-bg-secondary rounded-lg">
        <div className={`w-3 h-3 rounded-full ${syncStatus === 'connected' ? 'bg-heady-emerald' : syncStatus === 'syncing' ? 'bg-heady-amber' : 'bg-heady-error'}`} />
        <span className="text-xs">
          {syncStatus === 'connected' ? 'All devices in sync' : 
           syncStatus === 'syncing' ? 'Syncing across devices...' : 
           'Connection issues'}
        </span>
      </div>
      <div className="space-y-2">
        <h3 className="text-[10px] font-bold text-heady-text/70 uppercase tracking-wider">
          Pipeline Status
        </h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Fact label="Current Task" value={ps.currentTask || "None"} />
          <Fact label="Stage" value={ps.currentStage || "idle"} />
          <Fact label="Cycle" value={ps.cycleCount || 0} />
          <Fact label="Mode" value={ps.continuousMode ? "Continuous" : "Manual"} />
        </div>
      </div>

      <ResourceHealthBar resourceData={resourceData} />

      <div className="space-y-2">
        <h3 className="text-[10px] font-bold text-heady-text/70 uppercase tracking-wider">
          Activation
        </h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Fact label="Status" value="ACTIVATED" accent />
          <Fact label="Nodes" value={`${ps.nodesActive || 16}/${ps.nodesTotal || 16}`} />
        </div>
      </div>
    </div>
  );
}

// ─── TAB: STEPS ────────────────────────────────────────────────────────────

function StepsTab({ pipelineState }) {
  const stages = [
    { id: "discover_define", name: "Discover & Define" },
    { id: "design_plan", name: "Design & Plan" },
    { id: "build_integrate", name: "Build & Integrate" },
    { id: "test_validate", name: "Test & Validate" },
    { id: "evaluate_optimize", name: "Evaluate & Optimize" },
    { id: "secure_observe", name: "Secure & Observe" },
    { id: "deploy_deliver", name: "Deploy & Deliver" },
  ];
  const currentStage = pipelineState?.currentStage || "";

  return (
    <div className="space-y-1.5">
      <h3 className="text-[10px] font-bold text-heady-text/70 uppercase tracking-wider mb-2">
        HCFullPipeline Stages
      </h3>
      {stages.map((s, i) => {
        const isCurrent = s.id === currentStage;
        const isPast = stages.findIndex(st => st.id === currentStage) > i;
        return (
          <div
            key={s.id}
            className={`
              flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs
              ${isCurrent
                ? "bg-heady-cyan/10 border border-heady-cyan/20 text-heady-cyan font-bold"
                : isPast
                  ? "text-heady-emerald/80"
                  : "text-heady-muted/60"
              }
            `}
          >
            <span className="w-4 text-center">
              {isPast ? "✓" : isCurrent ? "●" : "○"}
            </span>
            <span>{s.name}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── TAB: RESOURCES ────────────────────────────────────────────────────────

function ResourcesTab({ resourceData }) {
  if (!resourceData) {
    return (
      <p className="text-xs text-heady-muted text-center py-8">
        Resource monitoring not connected.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ResourceHealthBar resourceData={resourceData} />

      <div className="space-y-2">
        <h3 className="text-[10px] font-bold text-heady-text/70 uppercase tracking-wider">
          Quick Actions
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {["Explain my slowdown", "Pause background jobs", "Review GPU usage", "Safe mode"].map(
            (label) => (
              <button
                key={label}
                className="
                  px-2.5 py-1 rounded-full text-[10px] font-medium
                  bg-heady-border/40 text-heady-text/70
                  hover:bg-heady-cyan/15 hover:text-heady-cyan
                  border border-heady-border/40 hover:border-heady-cyan/30
                  transition-all cursor-pointer
                "
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {resourceData.safeMode && (
        <div className="rounded-lg bg-heady-amber/10 border border-heady-amber/20 px-3 py-2">
          <p className="text-[10px] text-heady-amber font-medium">
            Safe Mode Active — Only essential services running. Background jobs,
            training, and heavy indexing are paused to protect system stability.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── TAB: HISTORY ──────────────────────────────────────────────────────────

function HistoryTab({ messages }) {
  if (!messages || messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8">
        <SacredAvatar status="idle" size={40} />
        <p className="text-xs text-heady-muted mt-3">No conversation yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((msg, i) => (
        <ChatMessage key={i} message={msg} />
      ))}
    </div>
  );
}

// ─── HELPERS ───────────────────────────────────────────────────────────────

function Fact({ label, value, accent = false }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] text-heady-muted uppercase tracking-wider">{label}</span>
      <span className={`text-xs font-medium ${accent ? "text-heady-emerald" : "text-heady-text/80"}`}>
        {value}
      </span>
    </div>
  );
}
