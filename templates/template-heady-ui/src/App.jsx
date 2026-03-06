import React, { useState, useEffect } from 'react';
import './App.css';

/**
 * Heady™ UI Shell — Liquid Micro-Frontend Base
 * 
 * This component is the root of every Heady vertical UI.
 * It connects to the Colab Overmind via WebSocket for real-time telemetry
 * and renders the vertical-specific content injected by the HologramBee.
 */
const App = () => {
    const [status, setStatus] = useState('initializing');
    const [telemetry, setTelemetry] = useState(null);
    const [vertical, setVertical] = useState(window.__HEADY_VERTICAL__ || 'default');

    useEffect(() => {
        // Connect to the MCP telemetry WebSocket for live Overmind state
        const wsUrl = process.env.HEADY_TELEMETRY_WS || 'wss://mcp.headymcp.com/telemetry';
        let ws;
        try {
            ws = new WebSocket(wsUrl);
            ws.onopen = () => setStatus('connected');
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setTelemetry(data);
                } catch (e) { /* non-JSON telemetry */ }
            };
            ws.onclose = () => setStatus('disconnected');
            ws.onerror = () => setStatus('error');
        } catch (e) {
            setStatus('offline');
        }

        return () => { if (ws) ws.close(); };
    }, []);

    return (
        <div className="heady-shell">
            <header className="heady-header">
                <div className="heady-logo">
                    <span className="heady-icon">◆</span>
                    <h1>Heady<span className="heady-accent">™</span></h1>
                </div>
                <div className="heady-status">
                    <span className={`status-dot status-${status}`} />
                    <span className="status-text">{vertical}</span>
                </div>
            </header>

            <main className="heady-content">
                {/* Vertical-specific content is injected here by the HologramBee */}
                <div id="heady-vertical-root">
                    <div className="heady-placeholder">
                        <h2>Heady™ Liquid UI</h2>
                        <p>This vertical is projected on-demand from 3D vector space.</p>
                        <p>Status: <strong>{status}</strong></p>
                        {telemetry && (
                            <pre className="heady-telemetry">
                                {JSON.stringify(telemetry, null, 2)}
                            </pre>
                        )}
                    </div>
                </div>
            </main>

            <footer className="heady-footer">
                <p>© 2026 Heady Systems LLC — Projected from Latent Space</p>
            </footer>
        </div>
    );
};

export default App;
