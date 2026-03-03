import React from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import AgentCascade from './components/AgentCascade';

function App() {
  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <Header />
      <div className="layout-main" style={{ display: 'flex', flex: 1, padding: '16px', gap: '16px', overflow: 'hidden' }}>
        <Sidebar />
        <AgentCascade />
      </div>
    </div>
  );
}

export default App;
