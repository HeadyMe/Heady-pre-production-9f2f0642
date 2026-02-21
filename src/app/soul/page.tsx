'use client';

import { useState } from 'react';

export default function HeadySoul() {
  const [question, setQuestion] = useState('');
  const [dialogue, setDialogue] = useState([
    {
      role: 'soul',
      content: 'Welcome to HeadySoul. I employ Socratic questioning to help you explore ideas deeply. What would you like to examine today?',
      questions: ['What is your initial understanding?', 'What assumptions are you making?']
    }
  ]);

  const askQuestion = () => {
    if (!question.trim()) return;
    
    const newDialogue = [...dialogue];
    newDialogue.push({
      role: 'user',
      content: question,
      questions: []
    });
    
    // Simulate Socratic response
    setTimeout(() => {
      const soulResponse = {
        role: 'soul',
        content: `That's an interesting perspective on "${question}". Let me ask you some questions to deepen our understanding:\n\n• What evidence supports this view?\n• Are there alternative perspectives?\n• What are the implications of this idea?\n• How does this relate to other concepts you know?`,
        questions: [
          'What evidence supports this?',
          'What are alternative perspectives?',
          'What are the implications?'
        ]
      };
      newDialogue.push(soulResponse);
      setDialogue(newDialogue);
    }, 1500);
    
    setDialogue(newDialogue);
    setQuestion('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-slate-900">
      <div className="absolute inset-0 bg-[url('/bg-pattern.png')] opacity-20"></div>
      
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="bg-black/30 backdrop-blur-lg border-b border-green-500/30">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center">
                <span className="text-xl font-bold text-white">SO</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">HeadySoul</h1>
                <p className="text-green-300">Socratic Reasoning Engine</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
          <div className="bg-black/30 backdrop-blur-lg border border-green-500/30 rounded-2xl h-full flex flex-col">
            
            {/* Dialogue */}
            <div className="flex-1 p-6 overflow-y-auto">
              {dialogue.map((dialogueItem: any, index: number) => (
                <div key={index} className={`mb-8 ${dialogueItem.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block max-w-2xl ${
                    dialogueItem.role === 'user' ? 'ml-auto' : 'mr-auto'
                  }`}>
                    <div className={`px-6 py-4 rounded-2xl mb-4 ${
                      dialogueItem.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                        : 'bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 text-white'
                    }`}>
                      <p className="whitespace-pre-line">{dialogueItem.content}</p>
                    </div>
                    
                    {dialogueItem.questions && dialogueItem.questions.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-green-300 font-semibold text-sm">Follow-up Questions:</p>
                        {dialogueItem.questions.map((q: string, qIndex: number) => (
                          <div key={qIndex} className="bg-black/30 border border-green-500/30 rounded-lg px-4 py-2">
                            <p className="text-green-200 text-sm">• {q}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="p-6 border-t border-green-500/30">
              <div className="mb-4">
                <p className="text-green-300 text-sm mb-2">Ask a question or present an idea to explore:</p>
              </div>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && askQuestion()}
                  placeholder="Present an idea or ask a philosophical question..."
                  className="flex-1 bg-black/50 border border-green-500/30 rounded-xl px-6 py-4 text-white placeholder-gray-400 focus:outline-none focus:border-green-400 transition-colors"
                />
                <button
                  onClick={askQuestion}
                  disabled={!question.trim()}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-4 rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🤔 Explore
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Philosophy Panel */}
        <div className="max-w-6xl mx-auto w-full px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 backdrop-blur-lg border border-green-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">🎯 Critical Thinking</h3>
              <p className="text-gray-300">Question assumptions and explore logical implications</p>
            </div>
            <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 backdrop-blur-lg border border-blue-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">🔍 Deep Analysis</h3>
              <p className="text-gray-300">Examine ideas from multiple perspectives</p>
            </div>
            <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">🧠 Wisdom Building</h3>
              <p className="text-gray-300">Construct knowledge through guided inquiry</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
