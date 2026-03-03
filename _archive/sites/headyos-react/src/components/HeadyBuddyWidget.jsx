import React, { useState } from 'react';

export default function HeadyBuddyWidget() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([
        { text: "Memory Sync Complete. I'm HeadyBuddy. Your Swarm and Vector facts are loaded locally and globally. What's the directive?", sender: 'bot' }
    ]);
    const [input, setInput] = useState('');

    const send = (e) => {
        e.preventDefault();
        if (!input.trim()) return;
        setMessages(prev => [...prev, { text: input, sender: 'user' }]);
        setInput('');
        setTimeout(() => {
            setMessages(prev => [...prev, { text: "Command received. Teleporting payload via Heady Remote Compute.", sender: 'bot' }]);
        }, 1000);
    };

    return (
        <>
            {/* Floating Action Button */}
            <button
                onClick={() => setOpen(!open)}
                className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 text-white flex items-center justify-center shadow-[0_0_25px_rgba(168,85,247,0.6)] hover:scale-110 transition-transform duration-300"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            </button>

            {/* Glassmorphic Chat Window */}
            {open && (
                <div className="fixed bottom-24 right-6 z-50 w-[380px] h-[500px] bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-In">
                    {/* Header */}
                    <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 bg-slate-800/40">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold shadow-[0_0_10px_rgba(59,130,246,0.6)]">H</div>
                            <div>
                                <h3 className="text-white font-bold text-sm">HeadyBuddy</h3>
                                <p className="text-xs text-green-400 font-medium">Remote Edge Online</p>
                            </div>
                        </div>
                        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">✕</button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                        {messages.map((m, idx) => (
                            <div key={idx} className={`max-w-[85%] p-3 rounded-xl text-sm ${m.sender === 'user' ? 'bg-blue-600 text-white self-end rounded-tr-sm' : 'bg-white/10 text-slate-200 self-start rounded-tl-sm backdrop-blur-md border border-white/5'}`}>
                                {m.text}
                            </div>
                        ))}
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t border-white/10 bg-black/20">
                        <form onSubmit={send} className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Ask Buddy..."
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
                            />
                            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors">
                                Send
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
