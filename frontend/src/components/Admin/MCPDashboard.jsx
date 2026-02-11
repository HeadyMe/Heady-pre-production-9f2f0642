import React from 'react';
import { useMCPTools } from '../../hooks/useMCP';

export const MCPDashboard = () => {
  const { tools, status, error } = useMCPTools();

  return (
    <div className="mcp-dashboard">
      <h2>MCP Tool Dashboard</h2>
      {status === 'loading' && <p>Loading MCP tools...</p>}
      {status === 'error' && <p>Error: {error.message}</p>}
      
      <div className="tool-grid">
        {tools.map(tool => (
          <div key={tool.name} className="tool-card">
            <h3>{tool.name}</h3>
            <p>{tool.description}</p>
            <div className="tool-status">
              Status: {tool.enabled ? '✅ Enabled' : '❌ Disabled'}
            </div>
            <div className="tool-actions">
              <button 
                onClick={() => console.log('Configure', tool.name)}
                data-lens-id={`mcp-tool-${tool.name.toLowerCase()}`}
                data-lens-role="configuration"
              >
                Configure
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
