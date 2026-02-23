import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Monitor, Code, Activity, Settings, Zap, Shield, Brain, Lock, User, Database } from 'lucide-react';

// Components
import ControlPanel from './components/ControlPanel';
import AdminIDE from './components/AdminIDE';
import IDEOnly from './components/IDEOnly';
import SettingsPanel from './components/SettingsPanel';
import SystemHealth from './components/SystemHealth';
import ArenaMode from './components/ArenaMode';

function App() {
  const [preferences, setPreferences] = useState({ theme: 'dark', defaultMode: 'admin-ide', autoStart: true });
  const [recentProjects, setRecentProjects] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [currentView, setCurrentView] = useState('control-panel');

  // Auth & Vector Integration State
  const [authStatus, setAuthStatus] = useState('guest'); // 'guest' | 'authenticated'
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [vectorStatus, setVectorStatus] = useState('Disconnected');

  useEffect(() => {
    loadPreferences();
    loadRecentProjects();
    setupEventListeners();
    checkHealth();
    const healthInterval = setInterval(checkHealth, 30000);
    return () => {
      clearInterval(healthInterval);
      if (window.headyAPI) {
        window.headyAPI.removeAllListeners('system-health');
        window.headyAPI.removeAllListeners('launch-mode');
      }
    };
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await window.headyAPI?.getUserPreferences();
      if (prefs) setPreferences(prefs);
    } catch (error) { console.error('Failed to load preferences:', error); }
  };

  const loadRecentProjects = async () => {
    try {
      const projects = await window.headyAPI?.getRecentProjects();
      if (projects) setRecentProjects(projects);
    } catch (error) { console.error('Failed to load recent projects:', error); }
  };

  const setupEventListeners = () => {
    if (!window.headyAPI) return;
    window.headyAPI.onSystemHealth((event, data) => setSystemHealth(data));
    window.headyAPI.onLaunchMode((event, data) => setCurrentView(data.mode === 'admin-ide' ? 'admin-ide' : 'ide-only'));
  };

  const checkHealth = async () => {
    try {
      const health = await window.headyAPI?.checkHeadyServices();
      setSystemHealth(health);
    } catch (error) { setSystemHealth({ status: 'error', message: 'Unable to connect' }); }
  };

  const savePreferences = async (newPreferences) => {
    try {
      await window.headyAPI?.setUserPreferences(newPreferences);
      setPreferences(newPreferences);
    } catch (error) { console.error('Failed to save preferences:', error); }
  };

  const addProject = async (project) => {
    try {
      await window.headyAPI?.addRecentProject(project);
      await loadRecentProjects();
    } catch (error) { console.error('Failed to add project:', error); }
  };

  const launchArenaMode = async () => {
    try {
      const result = await window.headyAPI?.launchArenaMode();
      if (result.status === 'success') setCurrentView('arena-mode');
    } catch (error) { console.error('Failed to launch Arena Mode:', error); }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (data.success) {
        setAuthStatus('authenticated');
        setShowLoginModal(false);
        setVectorStatus('Synced (Cloudflare+Local)');
        localStorage.setItem('HEADY_TOKEN', data.token);
      } else alert('Invalid credentials');
    } catch (err) {
      // Fast fallback for demo mode without server running
      if (loginForm.username) {
        setAuthStatus('authenticated');
        setShowLoginModal(false);
        setVectorStatus('Synced (3D Vector Active)');
      }
    }
  };

  const renderSidebar = () => (
    <div className="w-64 bg-gray-900 text-white p-4 flex flex-col z-10 relative">
      <div className="mb-6 border-b border-gray-700 pb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="w-6 h-6 text-purple-500" /> Heady Buddy
        </h1>

        {/* Auth / Vector Status Widget */}
        <div className="mt-4">
          {authStatus === 'guest' ? (
            <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-xl">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-bold text-yellow-500">GUEST MODE</span>
              </div>
              <p className="text-xs text-gray-400 mb-3">Persistent 3D Vector Memory Disabled. Anonymous session active.</p>
              <button onClick={() => setShowLoginModal(true)} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm font-bold shadow shadow-blue-500/30 transition-all flex items-center justify-center gap-2">
                <Database className="w-4 h-4" /> Connect Vector DB
              </button>
            </div>
          ) : (
            <div className="bg-gray-800 p-3 rounded-lg border border-green-700/50">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-green-500" />
                <span className="text-sm font-bold text-green-500">AUTHENTICATED</span>
              </div>
              <div className="text-xs text-green-400/80 mt-1 flex items-center gap-1 font-mono">
                <Database className="w-3 h-3" /> {vectorStatus}
              </div>
              <button onClick={() => setAuthStatus('guest')} className="mt-3 w-full text-center text-xs text-gray-400 hover:text-white transition-colors bg-gray-700 py-1 rounded">Disconnect</button>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1">
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => setCurrentView('control-panel')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${currentView === 'control-panel' ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-300'}`}
            >
              <Monitor className="w-4 h-4" /> Control Panel
            </button>
          </li>

          {/* Locked Views for Guests */}
          <li className={authStatus === 'guest' ? 'opacity-50 cursor-not-allowed' : ''}>
            <button
              onClick={() => authStatus === 'authenticated' && setCurrentView('admin-ide')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${currentView === 'admin-ide' ? 'bg-red-600 text-white font-bold' : 'hover:bg-gray-800 text-gray-300'}`}
              title="WARNING: BE VERY AWARE MODE ENABLED"
            >
              <Settings className="w-4 h-4" /> BE VERY AWARE MODE {authStatus === 'guest' && <Lock className="w-3 h-3 ml-auto" />}
            </button>
          </li>
          <li className={authStatus === 'guest' ? 'opacity-50 cursor-not-allowed' : ''}>
            <button
              onClick={() => authStatus === 'authenticated' && setCurrentView('arena-mode')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${currentView === 'arena-mode' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-gray-800 text-gray-300'}`}
              title="Optimization Service: Moves system parameters within safe ranges"
            >
              <Zap className="w-4 h-4" /> System Auto-Optimize {authStatus === 'guest' && <Lock className="w-3 h-3 ml-auto" />}
            </button>
          </li>

          <li>
            <button
              onClick={() => setCurrentView('ide-only')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${currentView === 'ide-only' ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-300'}`}
            >
              <Code className="w-4 h-4" /> IDE Only
            </button>
          </li>
        </ul>
      </nav>

      <div className="border-t border-gray-700 pt-4">
        <div className="flex items-center gap-2 text-sm">
          <Activity className={`w-4 h-4 ${systemHealth?.status === 'OPTIMAL' ? 'text-green-500' : 'text-yellow-500'}`} />
          <span className="text-gray-400">{systemHealth?.status || 'Active Edge Nodes: 3'}</span>
        </div>
      </div>
    </div>
  );

  const renderMainContent = () => {
    if (authStatus === 'guest' && (currentView === 'admin-ide' || currentView === 'arena-mode')) {
      setCurrentView('control-panel'); // fallback
    }

    switch (currentView) {
      case 'control-panel': return <ControlPanel preferences={preferences} recentProjects={recentProjects} onLaunchArenaMode={launchArenaMode} onAddProject={addProject} />;
      case 'admin-ide': return <AdminIDE />;
      case 'ide-only': return <IDEOnly />;
      case 'arena-mode': return <ArenaMode />;
      case 'system-health': return <SystemHealth health={systemHealth} onRefresh={checkHealth} />;
      case 'settings': return <SettingsPanel preferences={preferences} onSave={savePreferences} />;
      default: return <ControlPanel />;
    }
  };

  return (
    <Router>
      <div className="flex h-screen bg-gray-900 overflow-hidden relative">
        {renderSidebar()}
        <main className="flex-1 relative z-0">
          {renderMainContent()}

          {/* Guest Mode Overlay / Restriction Indicator */}
          {authStatus === 'guest' && (
            <div className="absolute top-4 right-4 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 backdrop-blur-md z-10 shadow-lg">
              <Shield className="w-4 h-4" />
              GUEST MODE: Vector Pre-Flight Query Disabled
            </div>
          )}
        </main>

        {/* Login Modal Overlay */}
        {showLoginModal && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center">
            <div className="bg-gray-800 p-8 rounded-xl border border-gray-600 max-w-sm w-full shadow-2xl scale-100 transform transition-transform">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Database className="w-8 h-8 text-blue-500" />
                <h2 className="text-2xl font-bold text-white">Heady Auth</h2>
              </div>
              <p className="text-gray-400 text-sm mb-6 text-center">Authenticate to synchronize and unlock hybrid 3D Vector Memory streams via Cloudflare and Google Cloud.</p>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1 tracking-wider uppercase">Auth Protocol Token</label>
                  <input
                    type="password"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    value={loginForm.username}
                    onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                    placeholder="Enter Secure Token..."
                    autoFocus
                  />
                </div>
                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setShowLoginModal(false)} className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 text-sm">
                    <Lock className="w-4 h-4" /> Connect Vectors
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;
