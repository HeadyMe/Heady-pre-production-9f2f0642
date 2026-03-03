import React, { useState, useEffect } from 'react';
import './Header.css';

const Header = () => {
    const [tier] = useState(() => {
        const token = localStorage.getItem('HEADY_TOKEN');
        return (token === 'admin_token' || token?.startsWith('sk-heady-pro')) ? 'premium' : 'free';
    });
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('heady-flash');
    const [services] = useState(() => {
        const token = localStorage.getItem('HEADY_TOKEN');
        if (token === 'admin_token' || token?.startsWith('sk-heady-pro')) {
            return ['heady_chat', 'heady_analyze', 'heady_battle', 'heady_orchestrator'];
        }
        return ['heady_chat', 'heady_analyze'];
    });
    const [selectedService, setSelectedService] = useState('heady_chat');

    useEffect(() => {
        // Fetch models from heady-manager
        fetch('https://manager.headysystems.com/api/models')
            .then(res => res.json())
            .then(data => {
                if (data.models) {
                    setModels(data.models);
                }
            })
            .catch(err => console.error('Failed to fetch models:', err));
    }, []);

    const handleModelChange = (e) => {
        const modelId = e.target.value;
        const model = models.find(m => m.id === modelId);
        setSelectedModel(modelId);
        if (model && model.tier === 'premium' && tier !== 'premium') {
            alert('Premium model selected. Please upgrade or provide an API key for full access.');
        }
    };

    return (
        <div className="glass-header animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <div className="header-logo">
                <div className="logo-orb"></div>
                <h1>HeadyAI-IDE</h1>
            </div>

            <div className="header-controls">
                <div class="control-group">
                    <label className="service-label">MODEL:</label>
                    <select
                        className="service-dropdown"
                        value={selectedModel}
                        onChange={handleModelChange}
                    >
                        {models.map(m => (
                            <option key={m.id} value={m.id}>
                                {m.badge.split(' ')[0]} {m.id.split('-').slice(1).join('-').toUpperCase() || m.id.toUpperCase()}
                            </option>
                        ))}
                        {models.length === 0 && <option value="heady-flash">⚡ FLASH</option>}
                    </select>
                </div>

                <div class="control-group">
                    <label className="service-label">SERVICE:</label>
                    <select
                        className="service-dropdown"
                        value={selectedService}
                        onChange={(e) => setSelectedService(e.target.value)}
                    >
                        {services.map(srv => (
                            <option key={srv} value={srv}>{srv.toUpperCase()}</option>
                        ))}
                    </select>
                </div>

                <div className={`tier-badge ${tier}`}>{tier.toUpperCase()}</div>
                <div className="pulse-container">
                    <div className="status-dot"></div>
                </div>
            </div>
        </div>
    );
};

export default Header;
