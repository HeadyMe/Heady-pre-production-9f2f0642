import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Heady Command Center - Omni-Orchestrator Swarm Dashboard
 * HeadyVinci Node Execution:
 * A visually engaging, dark-mode 'Glass Box' drop-down UI for parallel AI tasks.
 */

const SwarmTracker = () => {
    const [tasks, setTasks] = useState([]);
    const [expandedId, setExpandedId] = useState(null);

    // Simulated WebSocket feed from Heady Pipeline
    useEffect(() => {
        const wsData = [
            { id: 'SCI-001', name: 'HeadyScientist: Market Data Ingestion', status: 'In Progress', progress: 65, logs: 'Ingesting L2 Order Book Data...' },
            { id: 'VIN-001', name: 'HeadyVinci: UI Theme Tokens', status: 'Completed', progress: 100, hash: '0xa4c2d3e4f5g...a6b7', logs: 'Tokens generated: --cyber-cyan, --matrix-green' },
            { id: 'MAI-001', name: 'HeadyMaid: Security Linting', status: 'Completed', progress: 100, hash: '0x992ddab43...cc12', logs: '0 XSS vulnerabilities detected.' }
        ];
        setTasks(wsData);
    }, []);

    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="min-h-screen bg-[#0a0f16] text-[#e0e0e0] font-sans p-8">
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-bold tracking-widest text-[#00ffcc] drop-shadow-[0_0_10px_rgba(0,255,204,0.5)]">HEADY COMMAND CENTER</h1>
                <p className="text-[#8892b0] mt-2 text-sm uppercase tracking-widest">Omni-Orchestrator Swarm Active</p>
            </header>

            <div className="max-w-4xl mx-auto space-y-4">
                {tasks.map((task) => (
                    <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border border-[#1e293b] bg-[#111827]/80 backdrop-blur-md rounded-lg overflow-hidden glassmorphism"
                    >
                        {/* Accordion Header */}
                        <div
                            className="px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-[#1f2937] transition-colors"
                            onClick={() => toggleExpand(task.id)}
                        >
                            <div className="flex items-center space-x-4">
                                <div className={`w-3 h-3 rounded-full ${task.progress === 100 ? 'bg-[#10b981]' : 'bg-[#eab308] animate-pulse'}`}></div>
                                <h3 className="font-semibold text-lg text-[#f8fafc]">{task.name}</h3>
                            </div>
                            <div className="text-sm font-mono text-[#94a3b8]">{task.status} [{task.progress}%]</div>
                        </div>

                        {/* Accordion Body */}
                        <AnimatePresence>
                            {expandedId === task.id && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="px-6 pb-6 pt-2 border-t border-[#1e293b] bg-[#0f172a]"
                                >
                                    <div className="grid grid-cols-2 gap-6 mt-4">
                                        {/* Logic Timeline */}
                                        <div>
                                            <h4 className="text-xs uppercase tracking-widest text-[#64748b] mb-2">Execution Flow</h4>
                                            <div className="pl-4 border-l-2 border-[#334155] text-sm space-y-3">
                                                <div className="relative">
                                                    <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-[#10b981]"></span>
                                                    <p className="text-[#cbd5e1]">Task Initialized via Auto-Flow</p>
                                                </div>
                                                <div className="relative">
                                                    <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-[#0ea5e9]"></span>
                                                    <p className="font-mono text-[#38bdf8]">{task.logs}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Audit Trail */}
                                        <div>
                                            <h4 className="text-xs uppercase tracking-widest text-[#64748b] mb-2">Immutable Audit</h4>
                                            {task.hash ? (
                                                <div className="p-3 bg-[#1e293b] rounded flex items-center justify-between border border-[#334155]">
                                                    <span className="font-mono text-xs text-[#a8b2d1] truncate pr-4">{task.hash}</span>
                                                    <button className="px-3 py-1 bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30 rounded text-xs hover:bg-[#10b981]/20 transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                                        Verify PQC Receipt
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="p-3 bg-[#1e293b] rounded text-xs font-mono text-[#64748b] border border-[#334155] border-dashed">
                                                    Hashing in progress...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default SwarmTracker;
