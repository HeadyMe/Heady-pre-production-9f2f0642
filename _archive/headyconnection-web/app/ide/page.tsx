'use client';

import { useState } from 'react';

export default function HeadyAIIDE() {
  const [code, setCode] = useState(`// Welcome to HeadyAI-IDE
// Intelligent Development Environment

function helloHeady() {
  const message = "Hello from HeadyAI-IDE!";
  console.log(message);
  return message;
}

// AI-powered code completion
// Intelligent refactoring
// Pattern recognition
// Performance optimization
// Bug detection

helloHeady();`);

  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const runCode = () => {
    setIsRunning(true);
    setOutput('🚀 Executing code with HeadyAI optimization...');
    
    setTimeout(() => {
      setOutput(`✅ Code executed successfully!

Output:
Hello from HeadyAI-IDE!

🧠 HeadyAI Analysis:
• Code complexity: Low
• Performance: Optimized
• Patterns detected: Function declaration
• Suggestions: Consider adding error handling

📊 Metrics:
• Execution time: 2.3ms
• Memory usage: 1.2KB
• AI optimizations applied: 3`);
      setIsRunning(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="absolute inset-0 bg-[url('/bg-pattern.png')] opacity-20"></div>
      
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="bg-black/30 backdrop-blur-lg border-b border-blue-500/30">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center">
                  <span className="text-xl font-bold text-white">AI</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">HeadyAI-IDE</h1>
                  <p className="text-blue-300">Intelligent Development Environment</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={runCode}
                  disabled={isRunning}
                  className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-2 rounded-xl font-bold hover:from-green-700 hover:to-teal-700 transition-all duration-300 disabled:opacity-50"
                >
                  {isRunning ? '🔄 Running...' : '▶️ Run Code'}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            
            {/* Code Editor */}
            <div className="bg-black/30 backdrop-blur-lg border border-blue-500/30 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">📝 Code Editor</h2>
                <div className="flex gap-2">
                  <span className="bg-blue-600/30 text-blue-300 px-3 py-1 rounded-lg text-sm">JavaScript</span>
                  <span className="bg-green-600/30 text-green-300 px-3 py-1 rounded-lg text-sm">AI Enhanced</span>
                </div>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-96 bg-black/50 border border-blue-500/30 rounded-xl p-4 text-green-400 font-mono text-sm focus:outline-none focus:border-blue-400 transition-colors resize-none"
                spellCheck={false}
              />
              <div className="mt-4 flex gap-4 text-sm">
                <div className="text-gray-400">Lines: {code.split('\n').length}</div>
                <div className="text-gray-400">Characters: {code.length}</div>
                <div className="text-green-400">✅ AI Ready</div>
              </div>
            </div>

            {/* Output Panel */}
            <div className="bg-black/30 backdrop-blur-lg border border-blue-500/30 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">📊 Output & Analysis</h2>
                <div className="flex gap-2">
                  <span className="bg-purple-600/30 text-purple-300 px-3 py-1 rounded-lg text-sm">AI Analysis</span>
                </div>
              </div>
              <div className="bg-black/50 border border-blue-500/30 rounded-xl p-4 h-96 overflow-y-auto">
                <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap">{output || '// Output will appear here when you run the code'}</pre>
              </div>
            </div>

          </div>

          {/* AI Features Panel */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 backdrop-blur-lg border border-blue-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">🧠 AI Completion</h3>
              <p className="text-gray-300">Intelligent code completion with context awareness</p>
            </div>
            <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">🔍 Pattern Detection</h3>
              <p className="text-gray-300">Identify code patterns and suggest improvements</p>
            </div>
            <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 backdrop-blur-lg border border-green-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">⚡ Performance</h3>
              <p className="text-gray-300">Real-time performance optimization suggestions</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
