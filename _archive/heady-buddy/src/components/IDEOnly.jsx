import React from 'react';
import { Code, Zap, Brain, GitBranch, Terminal } from 'lucide-react';

const IDEOnly = () => {
  return (
    <div className="p-8 bg-gray-50 h-full overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">IDE Only Mode</h2>
          <p className="text-gray-600">Focused development environment with Heady services quietly integrated</p>
        </div>

        {/* Development Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <Code className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-gray-600">Active Files</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">12</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <GitBranch className="w-5 h-5 text-green-600" />
              <span className="text-sm text-gray-600">Git Branch</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">arena/A</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <Brain className="w-5 h-5 text-purple-600" />
              <span className="text-sm text-gray-600">AI Assistants</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">5</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <Terminal className="w-5 h-5 text-orange-600" />
              <span className="text-sm text-gray-600">Tasks</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">3</div>
          </div>
        </div>

        {/* Main IDE Interface */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Development Workspace</h3>
            <button
              onClick={() => window.open('http://localhost:3300/ide', '_blank')}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Open Full IDE
            </button>
          </div>

          {/* File Explorer */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <h4 className="font-medium text-gray-900 mb-3">File Explorer</h4>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded cursor-pointer">
                  <GitBranch className="w-3 h-3 text-gray-500" />
                  <span className="text-gray-700">src/</span>
                </div>
                <div className="ml-4 space-y-1">
                  <div className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded cursor-pointer">
                    <span className="text-blue-600">App.jsx</span>
                  </div>
                  <div className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded cursor-pointer">
                    <span className="text-gray-700">components/</span>
                  </div>
                  <div className="ml-4 space-y-1">
                    <div className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded cursor-pointer">
                      <span className="text-gray-700">ControlPanel.jsx</span>
                    </div>
                    <div className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded cursor-pointer">
                      <span className="text-blue-600">ArenaMode.jsx</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Code Editor */}
            <div className="lg:col-span-3">
              <h4 className="font-medium text-gray-900 mb-3">Code Editor</h4>
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-300">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="ml-2 text-gray-500">ArenaMode.jsx</span>
                </div>
                <pre className="overflow-x-auto">
{`const ArenaMode = () => {
  const [arenaStatus, setArenaStatus] = useState('idle');
  const [candidates, setCandidates] = useState([]);
  
  const startArena = async () => {
    try {
      const response = await fetch('/api/arena/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: { description: 'Implement new feature' }
        })
      });
      const data = await response.json();
      setArenaStatus('running');
    } catch (error) {
      console.error('Arena start failed:', error);
    }
  };
  
  return (
    <div className="arena-mode">
      <h2>Arena Mode Competition</h2>
      <button onClick={startArena}>Start Arena</button>
    </div>
  );
};`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* AI Assistant Panel */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4">AI Assistants</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-purple-600" />
                <span className="font-medium">Claude</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">Architecture review and deep reasoning</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-600">Active</span>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Kimi-Dev</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">Primary code generation</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-600">Active</span>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Code className="w-4 h-4 text-green-600" />
                <span className="font-medium">DeepSeek</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">Code reasoning and tools</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-600">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Heady Features */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Heady IDE Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-blue-600 mt-1" />
              <div>
                <h4 className="font-medium text-gray-900">Command Palette Integration</h4>
                <p className="text-sm text-gray-600">Access Heady services via VS Code command palette</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-purple-600 mt-1" />
              <div>
                <h4 className="font-medium text-gray-900">Side Panel Chat</h4>
                <p className="text-sm text-gray-600">AI assistant with codebase understanding</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Code className="w-5 h-5 text-green-600 mt-1" />
              <div>
                <h4 className="font-medium text-gray-900">Inline Hints</h4>
                <p className="text-sm text-gray-600">Context-aware suggestions and corrections</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <GitBranch className="w-5 h-5 text-orange-600 mt-1" />
              <div>
                <h4 className="font-medium text-gray-900">Monte Carlo Planning</h4>
                <p className="text-sm text-gray-600">Intelligent task planning and optimization</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IDEOnly;
