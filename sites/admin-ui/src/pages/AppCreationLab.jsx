import React, { useMemo, useState } from 'react';
import { Orbit, Cpu, Droplets, Sparkles, Gauge, Send } from 'lucide-react';
import { api } from '../api';

const AXIS_PRESETS = ['compute', 'memory', 'latency'];

export default function AppCreationLab() {
    const [form, setForm] = useState({
        appName: 'Heady Instant Builder',
        target: 'heady project + HeadyMe',
        colabMemberships: 3,
        gpuCount: 3,
        gpuRamGb: 120,
        axisA: AXIS_PRESETS[0],
        axisB: AXIS_PRESETS[1],
        axisC: AXIS_PRESETS[2],
        vecA: 0.92,
        vecB: 0.9,
        vecC: 0.95,
        liquidMode: 'adaptive-liquid',
    });
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const payload = useMemo(() => ({
        appName: form.appName,
        target: form.target,
        constraints: {
            colabMemberships: Number(form.colabMemberships),
            gpuCount: Number(form.gpuCount),
            gpuRamGb: Number(form.gpuRamGb),
        },
        vectorSpace: {
            axes: [form.axisA, form.axisB, form.axisC],
            [form.axisA]: Number(form.vecA),
            [form.axisB]: Number(form.vecB),
            [form.axisC]: Number(form.vecC),
        },
        liquidArchitecture: { mode: form.liquidMode },
    }), [form]);

    const generatePlan = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await api.createDynamicAppPlan(payload);
            setPlan(response);
        } catch (e) {
            setError(e.message || 'Failed to generate plan');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-white">Dynamic App Creation Lab</h1>
                    <p className="text-sm text-slate-400">Autonomous, alive, intelligent, bidirectional system in 3D vector space.</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-4">
                    <h2 className="text-sm font-semibold text-violet-300 flex items-center gap-2"><Sparkles size={14} /> Inputs</h2>
                    <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm" value={form.appName} onChange={(e) => onChange('appName', e.target.value)} />
                    <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm" value={form.target} onChange={(e) => onChange('target', e.target.value)} />
                    <div className="grid grid-cols-3 gap-3 text-sm">
                        <label>Colab+
                            <input type="number" min="1" max="3" className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5" value={form.colabMemberships} onChange={(e) => onChange('colabMemberships', e.target.value)} />
                        </label>
                        <label>GPU Count
                            <input type="number" min="1" max="3" className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5" value={form.gpuCount} onChange={(e) => onChange('gpuCount', e.target.value)} />
                        </label>
                        <label>GPU RAM GB
                            <input type="number" min="16" max="320" className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5" value={form.gpuRamGb} onChange={(e) => onChange('gpuRamGb', e.target.value)} />
                        </label>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-sm">
                        {['A', 'B', 'C'].map((letter, i) => {
                            const axisKey = `axis${letter}`;
                            const vecKey = `vec${letter}`;
                            return (
                                <div key={letter} className="space-y-1">
                                    <select className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5" value={form[axisKey]} onChange={(e) => onChange(axisKey, e.target.value)}>
                                        {AXIS_PRESETS.map((axis) => <option key={`${axis}-${i}`} value={axis}>{axis}</option>)}
                                    </select>
                                    <input type="number" min="0" max="1" step="0.01" className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5" value={form[vecKey]} onChange={(e) => onChange(vecKey, e.target.value)} />
                                </div>
                            );
                        })}
                    </div>

                    <input className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm" value={form.liquidMode} onChange={(e) => onChange('liquidMode', e.target.value)} />

                    <button onClick={generatePlan} disabled={loading} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-yellow-400 to-violet-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                        <Send size={14} /> {loading ? 'Generating...' : 'Generate Dynamic Plan'}
                    </button>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                </section>

                <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 space-y-4">
                    <h2 className="text-sm font-semibold text-emerald-300 flex items-center gap-2"><Orbit size={14} /> Generated Plan</h2>
                    {!plan ? <p className="text-slate-400 text-sm">No plan yet. Generate from the left panel.</p> : (
                        <>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="bg-slate-800 rounded p-2"><Gauge size={12} className="inline mr-1" />{plan.objectives.responseLatencyTargetMs}ms</div>
                                <div className="bg-slate-800 rounded p-2"><Cpu size={12} className="inline mr-1" />{plan.objectives.throughputTargetRps} rps</div>
                                <div className="bg-slate-800 rounded p-2"><Droplets size={12} className="inline mr-1" />{plan.objectives.autonomyScore}</div>
                            </div>
                            <pre className="text-xs bg-slate-950 border border-slate-800 rounded p-3 overflow-auto max-h-[420px]">{JSON.stringify(plan, null, 2)}</pre>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
