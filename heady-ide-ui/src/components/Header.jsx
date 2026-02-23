import React, { useState, useEffect } from 'react';
import './Header.css';

const Header = () => {
    const [tier, setTier] = useState('core');
    const [services, setServices] = useState(['heady_chat', 'heady_analyze']);
    const [selectedService, setSelectedService] = useState('heady_chat');

    // Simulated fetch from heady-manager.js logic (/api/services/groups)
    useEffect(() => {
        const isAdmin = localStorage.getItem('HEADY_TOKEN') === 'admin_token';
        if (isAdmin) {
            setTier('admin');
            setServices(['heady_chat', 'heady_analyze', 'heady_battle', 'heady_orchestrator']);
        }
    }, []);

    return (
        <div className="glass-header animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <div className="header-logo">
                <div className="logo-orb"></div>
                <h1>HeadyAI-IDE</h1>
            </div>

            <div className="header-controls">
                <label className="service-label">SERVICE GROUP:</label>
                <div className="service-dropdown-container">
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
            </div>
        </div>
    );
};

export default Header;
