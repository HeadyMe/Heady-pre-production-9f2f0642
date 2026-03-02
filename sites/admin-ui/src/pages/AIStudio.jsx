import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Sparkles, Zap, Brain, RotateCcw, Copy, ChevronDown, ChevronUp, Settings, Cpu, Activity } from 'lucide-react';

const DEFAULT_SYSTEM = `You are HeadyAI — the sacred geometry intelligence powering the Heady Systems ecosystem.

You operate within the HCFP (Heady Communication Flow Protocol) Auto-Success framework:
- Responses are optimized for maximum clarity, precision, and resonance
- You understand the Heady ecosystem: HeadyMe, HeadySystems, HeadyConnection, HeadyMCP, HeadyIO, HeadyBuddy
- You assist with infrastructure, Drupal 11 headless CMS, Cloudflare Tunnel routing, Docker, and AI orchestration

Respond with technical depth. Format code with markdown. Use sacred geometry metaphors where natural.`;

const QUICK_PROMPTS = [
    { label: '⬡ HCFP Status', prompt: 'What is the current HCFP health score and what actions would optimize it further?' },
    { label: '🔌 Drupal 11', prompt: 'How do I set up a custom JSON:API endpoint in Drupal 11 for the HeadyBuddy task sync?' },
    { label: '🐳 Docker', prompt: 'Review the ai-services docker-compose and suggest optimizations for the Heady ecosystem.' },
    { label: '🌐 Cloudflare', prompt: 'What is the optimal Cloudflare Tunnel configuration for routing all Heady domains?' },
    { label: '🧠 Ollama', prompt: 'Compare Ollama local models vs Gemini 2.0 Pro for the HeadyBuddy assistant use case.' },
    { label: '⚡ Sacred Geo', prompt: 'How can sacred geometry principles like the Fibonacci sequence be applied to API rate limiting?' },
];

const APP_CREATION_DEFAULTS = {
    projectName: 'Heady Dynamic App',
    targetRepo: 'HeadyMe',
    colabMemberships: 3,
    vectorDimension: '3D vector only',
    responseTargetMs: 120,
    liquidArchitecture: true,
};

function ModelBadge({ tier }) {
    return tier === 'ultra'
        ? <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-semibold">ULTRA</span>
        : <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">STD</span>;
}

function TokenBar({ used, max }) {
    if (!max || !used) return null;
    const pct = Math.min((used / max) * 100, 100);
    const color = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-emerald-500';
    return (
        <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span>{used.toLocaleString()} / {(max / 1000).toFixed(0)}K ctx</span>
        </div>
    );
}

function MessageBubble({ msg }) {
    const isUser = msg.role === 'user';
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(msg.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-violet-600/30' : 'bg-gradient-to-br from-yellow-400/20 to-violet-600/20 border border-yellow-400/20'
                }`}>
                {isUser ? <User size={14} className="text-violet-300" /> : <Bot size={14} className="text-yellow-400" />}
            </div>
            <div className={`group relative max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? 'bg-violet-600/20 border border-violet-500/30 text-violet-100' : 'bg-slate-800/80 border border-slate-700/50 text-slate-200'
                }`}>
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                {msg.usage && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50 text-xs text-slate-500 flex gap-3">
                        {msg.usage.promptTokens && <span>↑{msg.usage.promptTokens}</span>}
                        {msg.usage.completionTokens && <span>↓{msg.usage.completionTokens}</span>}
                        {msg.usage.totalTokens && <span>Σ{msg.usage.totalTokens}</span>}
                    </div>
                )}
                <button
                    onClick={handleCopy}
                    className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-700 hover:bg-slate-600 rounded p-1"
                >
                    <Copy size={10} className={copied ? 'text-green-400' : 'text-slate-400'} />
                </button>
            </div>
        </div>
    );
}

export default function AIStudio() {
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM);
    const [showSystem, setShowSystem] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [temperature, setTemperature] = useState(0.7);
    const [maxTokens, setMaxTokens] = useState(8192);
    const [useStream, setUseStream] = useState(true);
    const [totalTokensUsed, setTotalTokensUsed] = useState(0);
    const [appCreationSpec, setAppCreationSpec] = useState(APP_CREATION_DEFAULTS);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    const currentModel = models.find(m => m.id === selectedModel);

    useEffect(() => {
        fetch('/api/ai/models').then(r => r.json()).then(setModels).catch(() => { });
        fetch('/api/ai/status').then(r => r.json()).then(setStatus).catch(() => { });
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = useCallback(async (text) => {
        const userMsg = text || input.trim();
        if (!userMsg || loading) return;

        const newMessages = [...messages, { role: 'user', content: userMsg }];
        setMessages(newMessages);
        setInput('');
        setLoading(true);

        if (useStream) {
            const assistantId = Date.now();
            setMessages(prev => [...prev, { role: 'assistant', content: '', id: assistantId, streaming: true }]);

            try {
                const res = await fetch('/api/ai/chat/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: selectedModel, messages: newMessages, systemPrompt, temperature, maxTokens }),
                });

                const reader = res.body?.getReader();
                const decoder = new TextDecoder();
                let fullText = '';

                if (reader) {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
                        for (const line of lines) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.text) fullText += parsed.text;
                                if (parsed.usage) {
                                    setTotalTokensUsed(t => t + (parsed.usage.totalTokens || 0));
                                }
                            } catch { }
                        }
                        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m));
                    }
                }
                setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m));
            } catch (e) {
                setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `Error: ${e.message}`, streaming: false } : m));
            }
        } else {
            try {
                const res = await fetch('/api/ai/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: selectedModel, messages: newMessages, systemPrompt, temperature, maxTokens }),
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                setMessages(prev => [...prev, { role: 'assistant', content: data.text, usage: data.usage }]);
                if (data.usage?.totalTokens) setTotalTokensUsed(t => t + data.usage.totalTokens);
            } catch (e) {
                setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
            }
        }
        setLoading(false);
    }, [input, loading, messages, selectedModel, systemPrompt, temperature, maxTokens, useStream]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const clearChat = () => { setMessages([]); setTotalTokensUsed(0); };

    const launchAppCreationPlan = () => {
        const prompt = [
            'Create a dynamic app creation optimized system spec and rollout plan.',
            `Project Name: ${appCreationSpec.projectName}`,
            `Primary Repo Context: heady project + ${appCreationSpec.targetRepo}`,
            `Compute Profile: ${appCreationSpec.colabMemberships} Google Colab Pro+ memberships with coordinated GPU/GPU RAM pooling`,
            `Runtime Space Constraint: ${appCreationSpec.vectorDimension}`,
            `Interaction Goal: autonomous, alive, intelligent, instantaneous, dynamic, bidirectional`,
            `Latency SLO: < ${appCreationSpec.responseTargetMs} ms perceived response`,
            `Architecture Mode: ${appCreationSpec.liquidArchitecture ? 'liquid architecture enforced' : 'modular architecture'}`,
            'Output required sections: system architecture, orchestration topology, 3D vector data model, GPU memory strategy, safety controls, phased implementation steps, and measurable KPIs.',
        ].join('\n');

        sendMessage(prompt);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] gap-0">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-400 to-violet-600 flex items-center justify-center">
                        <Sparkles size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-white">HeadyAI Studio</h1>
                        <p className="text-xs text-slate-400">Google AI Ultra · Sacred Geometry Intelligence</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {status && (
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${status.connected ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${status.connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                            {status.connected ? 'AI Ultra Connected' : 'Disconnected'}
                        </div>
                    )}
                    {totalTokensUsed > 0 && (
                        <div className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">
                            {totalTokensUsed.toLocaleString()} tokens
                        </div>
                    )}
                    <button onClick={() => setShowSettings(s => !s)}
                        className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-violet-600/30 text-violet-300' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                        <Settings size={16} />
                    </button>
                    <button onClick={clearChat}
                        className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors" title="Clear chat">
                        <RotateCcw size={16} />
                    </button>
                </div>
            </div>

            {/* Main area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Chat area */}
                <div className="flex-1 flex flex-col">
                    {/* System prompt */}
                    <div className="px-6 py-2 border-b border-slate-800/50">
                        <button onClick={() => setShowSystem(s => !s)}
                            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                            <Brain size={12} />
                            <span>System Prompt</span>
                            {showSystem ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {showSystem && (
                            <textarea
                                value={systemPrompt}
                                onChange={e => setSystemPrompt(e.target.value)}
                                className="mt-2 w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 resize-y min-h-[80px] focus:outline-none focus:border-violet-500"
                            />
                        )}
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400/20 to-violet-600/20 border border-yellow-400/20 flex items-center justify-center">
                                    <Sparkles size={28} className="text-yellow-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-white mb-1">HeadyAI Ready</h3>
                                    <p className="text-slate-400 text-sm">Google AI Ultra · Sacred Geometry Intelligence · HCFP Aligned</p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-2xl w-full">
                                    {QUICK_PROMPTS.map(qp => (
                                        <button
                                            key={qp.label}
                                            onClick={() => sendMessage(qp.prompt)}
                                            className="text-left px-3 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-violet-500/40 hover:bg-slate-800 transition-all text-xs text-slate-300 hover:text-white"
                                        >
                                            <span className="font-medium">{qp.label}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="w-full max-w-2xl rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 text-left space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-cyan-300">Dynamic App Creation Optimizer</h4>
                                        <button
                                            onClick={launchAppCreationPlan}
                                            className="text-xs px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 hover:bg-cyan-500/30"
                                        >
                                            Generate Full Blueprint
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-300">
                                        Builds a full implementation blueprint for autonomous, 3D-vector-space-native Heady systems using multi-Colab GPU orchestration.
                                    </p>
                                </div>
                            </div>
                        )}
                        {messages.map((msg, i) => (
                            <MessageBubble key={msg.id || i} msg={msg} />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="px-6 py-4 border-t border-slate-800 flex-shrink-0">
                        <div className="flex gap-3 items-end">
                            <div className="flex-1 relative">
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask HeadyAI anything… (Enter to send, Shift+Enter for newline)"
                                    rows={1}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none min-h-[48px] max-h-[120px]"
                                    style={{ height: 'auto' }}
                                    onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                                />
                            </div>
                            <button
                                onClick={() => sendMessage()}
                                disabled={loading || !input.trim()}
                                className={`p-3 rounded-xl transition-all ${loading || !input.trim() ? 'bg-slate-800 text-slate-600' : 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-600/20'}`}
                            >
                                {loading ? <Activity size={18} className="animate-spin" /> : <Send size={18} />}
                            </button>
                        </div>
                        {currentModel && (
                            <div className="mt-2">
                                <TokenBar used={totalTokensUsed} max={currentModel?.context} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Settings sidebar */}
                {showSettings && (
                    <div className="w-72 border-l border-slate-800 bg-slate-900/70 p-4 overflow-y-auto space-y-4 flex-shrink-0">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Settings size={14} /> Settings</h3>

                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Model</label>
                            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500">
                                {models.map(m => <option key={m.id} value={m.id}>{m.label || m.id}</option>)}
                                {models.length === 0 && <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Temperature: {temperature}</label>
                            <input type="range" min="0" max="1" step="0.05" value={temperature}
                                onChange={e => setTemperature(parseFloat(e.target.value))}
                                className="w-full accent-violet-500" />
                            <div className="flex justify-between text-xs text-slate-500 mt-0.5"><span>Precise</span><span>Creative</span></div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Max Output Tokens</label>
                            <select value={maxTokens} onChange={e => setMaxTokens(Number(e.target.value))}
                                className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500">
                                {[1024, 2048, 4096, 8192, 16384, 32768].map(v => (
                                    <option key={v} value={v}>{(v / 1024).toFixed(0)}K tokens</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">Streaming</span>
                            <button onClick={() => setUseStream(s => !s)}
                                className={`w-10 h-5 rounded-full transition-colors relative ${useStream ? 'bg-violet-600' : 'bg-slate-700'}`}>
                                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useStream ? 'left-5' : 'left-0.5'}`} />
                            </button>
                        </div>

                        <div className="border-t border-slate-800 pt-4">
                            <h4 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Dynamic App Creation Spec</h4>
                            <div className="space-y-2.5 mb-4">
                                <input
                                    value={appCreationSpec.projectName}
                                    onChange={(e) => setAppCreationSpec(prev => ({ ...prev, projectName: e.target.value }))}
                                    placeholder="Project name"
                                    className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500"
                                />
                                <input
                                    value={appCreationSpec.targetRepo}
                                    onChange={(e) => setAppCreationSpec(prev => ({ ...prev, targetRepo: e.target.value }))}
                                    placeholder="Target repository"
                                    className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="number" min="1" max="8"
                                        value={appCreationSpec.colabMemberships}
                                        onChange={(e) => setAppCreationSpec(prev => ({ ...prev, colabMemberships: Number(e.target.value) || 1 }))}
                                        className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500"
                                        title="Colab Pro+ memberships"
                                    />
                                    <input
                                        type="number" min="20" max="1500"
                                        value={appCreationSpec.responseTargetMs}
                                        onChange={(e) => setAppCreationSpec(prev => ({ ...prev, responseTargetMs: Number(e.target.value) || 120 }))}
                                        className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500"
                                        title="Response target ms"
                                    />
                                </div>
                                <button
                                    onClick={launchAppCreationPlan}
                                    className="w-full text-xs px-3 py-2 rounded-lg bg-cyan-600/20 text-cyan-200 border border-cyan-500/40 hover:bg-cyan-600/30"
                                >
                                    Send Optimized Build Request
                                </button>
                            </div>

                            <h4 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Available Models</h4>
                            <div className="space-y-2">
                                {models.map(m => (
                                    <button key={m.id} onClick={() => setSelectedModel(m.id)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${selectedModel === m.id ? 'bg-violet-600/30 border border-violet-500/40 text-violet-200' : 'bg-slate-800 border border-slate-700 text-slate-300 hover:border-slate-600'}`}>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="font-medium">{m.label}</span>
                                            <ModelBadge tier={m.tier} />
                                        </div>
                                        <div className="text-slate-500">{(m.context / 1000).toFixed(0)}K ctx · {m.capabilities?.slice(0, 2).join(', ')}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {status && (
                            <div className="border-t border-slate-800 pt-4">
                                <h4 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Connection Info</h4>
                                <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between"><span className="text-slate-500">Subscription</span><span className="text-yellow-400 font-semibold">AI Ultra</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">API Status</span><span className={status.connected ? 'text-emerald-400' : 'text-red-400'}>{status.connected ? '✓ Connected' : '✗ Error'}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Models</span><span className="text-white">{status.modelsAvailable || models.length}</span></div>
                                    {status.testResponse && <div className="flex justify-between"><span className="text-slate-500">Test</span><span className="text-emerald-400 truncate max-w-[120px]">{status.testResponse}</span></div>}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
