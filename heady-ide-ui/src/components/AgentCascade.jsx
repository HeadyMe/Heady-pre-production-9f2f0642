import React, { useState } from 'react';
import './AgentCascade.css';

const AgentCascade = () => {
    const [messages, setMessages] = useState([
        { role: 'system', content: '[MEMORY UPDATE] Persistent Context Loaded. Routing dynamically locked to HEADY_ONLY backend.' },
        { role: 'assistant', content: 'Heady Node initialized. Awaiting parameters.' }
    ]);
    const [input, setInput] = useState('');
    const [battleMode, setBattleMode] = useState(false);
    const [autoOptimize, setAutoOptimize] = useState(true);

    const handleSend = () => {
        if (!input.trim()) return;
        setMessages(prev => [...prev, { role: 'user', content: input }]);
        setTimeout(() => {
            const optMsg = autoOptimize ? '[Optimization Service: Safe Range Parameters Auto-Tuned]' : '';
            setMessages(prev => [...prev, { role: 'assistant', content: `Processing request via ${battleMode ? 'BE VERY AWARE MODE' : 'heady-brain inference'}... ${optMsg}` }]);
        }, 500);
        setInput('');
    };

    return (
        <div className="glass-panel cascade animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <div className="cascade-toolbar">
                <div className="model-lock-indicator" style={{ display: 'flex', gap: '15px' }}>
                    <span><span className="lock-icon">🔒</span> Model: HEADY_BRAIN (Overrides enforced)</span>
                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="lock-icon" style={{ fontSize: '10px' }}>🟢</span> Global Default: Hybrid Colab/Edge Scanning Active
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', gap: '6px', cursor: 'pointer', alignItems: 'center' }} title="Moves system parameters within safe ranges to find optimal operating parameters everywhere that makes sense">
                        <input
                            type="checkbox"
                            checked={autoOptimize}
                            onChange={(e) => setAutoOptimize(e.target.checked)}
                            style={{ accentColor: '#10b981' }}
                        />
                        System Auto-Optimize
                    </label>

                    <div className="mode-selector">
                        <label className={`mode-toggle ${!battleMode ? 'active' : ''}`}>
                            <input
                                type="radio"
                                name="mode"
                                checked={!battleMode}
                                onChange={() => setBattleMode(false)}
                            />
                            Normal
                        </label>
                        <label
                            className={`mode-toggle ${battleMode ? 'active battle' : ''}`}
                            title="WARNING: Unrestricted context limits and parameter drift enabled. Watch system load."
                        >
                            <input
                                type="radio"
                                name="mode"
                                checked={battleMode}
                                onChange={() => setBattleMode(true)}
                            />
                            BE VERY AWARE MODE
                        </label>
                    </div>
                </div>
            </div>

            <div className="cascade-messages" style={{ flex: 1, padding: '30px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {messages.map((msg, idx) => (
                    <div key={idx} className={`chat-bubble ${msg.role === 'user' ? 'user-bubble' : 'heady-bubble'} animate-fade-in`} style={{ animationDelay: `${Math.min(idx * 0.05, 0.5)}s` }}>
                        <div className="bubble-header">
                            {msg.role === 'user' ? 'System Operator' : 'Heady Core Engine'}
                        </div>
                        <div className="bubble-text">
                            {msg.content}
                        </div>
                    </div>
                ))}
            </div>

            <div className="cascade-input-area">
                <input
                    className="chat-input"
                    type="text"
                    placeholder="Command the Heady Architecture..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <button className="action-send" onClick={handleSend} title="Send Instruction">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </div>
        </div>
    );
};

export default AgentCascade;
