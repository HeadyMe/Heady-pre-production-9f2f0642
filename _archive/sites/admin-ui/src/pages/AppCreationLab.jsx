import React, { useMemo, useState } from 'react';
import { Cpu, Rocket, Workflow, Boxes, Orbit, ArrowRightLeft, BrainCircuit } from 'lucide-react';

const DEFAULT_REQUIREMENTS = `Build a fully autonomous app creation fabric based on Heady + HeadyMe.
Support alive stateful agents, bi-directional event channels, and instant operations in 3D vector space.`;

const PHASES = [
    { key: 'intake', label: 'Intent Intake', icon: BrainCircuit, output: 'Intent graph + constraints extracted from prompt and existing repos.' },
    { key: 'vector', label: '3D Vector Design', icon: Orbit, output: 'Components projected into xyz coordinate groups (compute, memory, interaction).' },
    { key: 'runtime', label: 'Autonomous Runtime', icon: Workflow, output: 'Alive agent mesh with bidirectional event bus + self-healing loop.' },
    { key: 'deploy', label: 'Instant Deploy', icon: Rocket, output: 'GPU allocation and release plan with instant route promotion.' },
];

function buildPlan(input) {
    const totalGpuGb = input.colabs * input.gpuRamPerColab;
    const activeGpuGb = Math.floor(totalGpuGb * 0.8);

    return {
        title: `${input.systemName} Dynamic App Fabric`,
        vectorModel: {
            axes: [
                { axis: 'X (Compute)', detail: 'Model orchestration + autonomous builders' },
                { axis: 'Y (Memory)', detail: 'Vector memory + state snapshots + retrieval' },
                { axis: 'Z (Interaction)', detail: 'Bidirectional APIs + UI + event streams' },
            ],
            recommendation: `Keep all app entities encoded as 3D vectors so orchestration can route by spatial proximity instead of static service names.`,
        },
        colabCluster: {
            memberships: input.colabs,
            totalGpuGb,
            activeGpuGb,
            strategy: `Reserve ~${Math.round(input.responseSloMs / 10)}% of one GPU node for low-latency responder while remaining capacity performs generation and training updates.`,
        },
        liquidArchitecture: [
            'Use a fluid control plane that can move workloads between Colab nodes every 5-15 seconds based on queue pressure.',
            'Maintain a hot shadow runtime for each critical service to preserve instantaneous failover.',
            'Publish every model/tool capability as a composable module in a service registry.',
        ],
        firstBacklog: [
            'Connect Heady + HeadyMe repos to a shared capability manifest.',
            'Implement vectorized project graph (tasks, services, schemas, prompts).',
            'Create autonomous planner + verifier agents with bidirectional message bus.',
            `Enforce response SLO <= ${input.responseSloMs}ms with GPU pre-warming and streaming output.`,
        ],
    };
}

export default function AppCreationLab() {
    const [systemName, setSystemName] = useState('Heady HyperFabric');
    const [requirements, setRequirements] = useState(DEFAULT_REQUIREMENTS);
    const [colabs, setColabs] = useState(3);
    const [gpuRamPerColab, setGpuRamPerColab] = useState(24);
    const [responseSloMs, setResponseSloMs] = useState(120);

    const plan = useMemo(() => buildPlan({ systemName, requirements, colabs, gpuRamPerColab, responseSloMs }), [
        systemName,
        requirements,
        colabs,
        gpuRamPerColab,
        responseSloMs,
    ]);

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-violet-500/30 bg-slate-900/70 p-5">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Boxes className="w-6 h-6 text-violet-300" /> Dynamic App Creation Optimizer</h1>
                <p className="text-slate-300 text-sm mt-1">Design an autonomous, alive, intelligent, instantaneous system grounded in 3D vector space + liquid architecture.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <section className="xl:col-span-1 rounded-2xl border border-slate-700 bg-slate-900/70 p-5 space-y-4">
                    <h2 className="text-lg font-semibold text-violet-200">System Inputs</h2>
                    <label className="block text-sm text-slate-300">System Name
                        <input value={systemName} onChange={(e) => setSystemName(e.target.value)} className="mt-1 w-full rounded bg-slate-800 border border-slate-700 p-2 text-slate-100" />
                    </label>
                    <label className="block text-sm text-slate-300">Core Requirements
                        <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={5} className="mt-1 w-full rounded bg-slate-800 border border-slate-700 p-2 text-slate-100" />
                    </label>
                    <label className="block text-sm text-slate-300">Colab Pro+ Memberships
                        <input type="number" min="1" max="12" value={colabs} onChange={(e) => setColabs(Number(e.target.value) || 1)} className="mt-1 w-full rounded bg-slate-800 border border-slate-700 p-2 text-slate-100" />
                    </label>
                    <label className="block text-sm text-slate-300">GPU RAM per Colab (GB)
                        <input type="number" min="8" max="120" value={gpuRamPerColab} onChange={(e) => setGpuRamPerColab(Number(e.target.value) || 8)} className="mt-1 w-full rounded bg-slate-800 border border-slate-700 p-2 text-slate-100" />
                    </label>
                    <label className="block text-sm text-slate-300">Response SLO (ms)
                        <input type="number" min="40" max="2000" value={responseSloMs} onChange={(e) => setResponseSloMs(Number(e.target.value) || 100)} className="mt-1 w-full rounded bg-slate-800 border border-slate-700 p-2 text-slate-100" />
                    </label>
                </section>

                <section className="xl:col-span-2 rounded-2xl border border-slate-700 bg-slate-900/70 p-5 space-y-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-emerald-300">Generated Architecture Blueprint</h2>
                        <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-300">Instantly recomputed</span>
                    </div>

                    <div className="rounded-xl border border-violet-500/20 bg-slate-950/70 p-4">
                        <h3 className="text-white font-semibold">{plan.title}</h3>
                        <p className="text-slate-300 text-sm mt-2 whitespace-pre-wrap">{requirements}</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-slate-700 p-4">
                            <h3 className="text-slate-100 font-medium flex items-center gap-2"><Orbit className="w-4 h-4 text-blue-300" /> 3D Vector Model</h3>
                            <ul className="mt-2 space-y-2 text-sm text-slate-300">
                                {plan.vectorModel.axes.map(({ axis, detail }) => (
                                    <li key={axis}><strong>{axis}:</strong> {detail}</li>
                                ))}
                            </ul>
                            <p className="text-xs text-blue-200 mt-3">{plan.vectorModel.recommendation}</p>
                        </div>

                        <div className="rounded-xl border border-slate-700 p-4">
                            <h3 className="text-slate-100 font-medium flex items-center gap-2"><Cpu className="w-4 h-4 text-yellow-300" /> Colab + GPU Allocation</h3>
                            <p className="text-sm text-slate-300 mt-2">{plan.colabCluster.memberships} memberships · {plan.colabCluster.totalGpuGb}GB GPU RAM total</p>
                            <p className="text-sm text-slate-300">Operational pool: {plan.colabCluster.activeGpuGb}GB</p>
                            <p className="text-xs text-yellow-200 mt-3">{plan.colabCluster.strategy}</p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-700 p-4">
                        <h3 className="text-slate-100 font-medium flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-fuchsia-300" /> Liquid Architecture Behaviors</h3>
                        <ul className="mt-2 list-disc pl-5 text-sm text-slate-300 space-y-1">
                            {plan.liquidArchitecture.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                    </div>

                    <div className="rounded-xl border border-slate-700 p-4">
                        <h3 className="text-slate-100 font-medium">Implementation Phases</h3>
                        <div className="mt-2 grid md:grid-cols-2 gap-3">
                            {PHASES.map(({ key, label, icon: Icon, output }) => (
                                <div key={key} className="rounded border border-slate-700 bg-slate-950/50 p-3">
                                    <p className="text-sm text-violet-200 flex items-center gap-2"><Icon className="w-4 h-4" />{label}</p>
                                    <p className="text-xs text-slate-300 mt-1">{output}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-700 p-4">
                        <h3 className="text-slate-100 font-medium">First Execution Backlog</h3>
                        <ul className="mt-2 list-decimal pl-5 text-sm text-slate-300 space-y-1">
                            {plan.firstBacklog.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                    </div>
                </section>
            </div>
        </div>
    );
}
