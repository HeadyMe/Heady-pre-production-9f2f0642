import React, { useState } from 'react';
import './Sidebar.css';

const FolderIcon = ({ open }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={open ? "rgba(168, 85, 247, 0.2)" : "none"} stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
);

const FileIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
        <polyline points="13 2 13 9 20 9"></polyline>
    </svg>
);

const Sidebar = () => {
    const [expanded, setExpanded] = useState({ playground: true, worktree: false });

    const toggle = (sec) => setExpanded(prev => ({ ...prev, [sec]: !prev[sec] }));

    return (
        <div className="glass-panel sidebar animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <div className="sidebar-header">
                <h2 className="sidebar-title">Heady Explorer</h2>
            </div>

            <div className="tree-container">
                <div className="tree-section">
                    <div className="tree-header" onClick={() => toggle('playground')}>
                        <span className="icon"><FolderIcon open={expanded.playground} /></span>
                        <span className="folder-name">heady-playground</span>
                    </div>
                    {expanded.playground && (
                        <ul className="tree-list">
                            <li className="tree-item"><span className="icon"><FileIcon /></span> pattern-matrix.js</li>
                            <li className="tree-item"><span className="icon"><FileIcon /></span> test-battle.py</li>
                            <li className="tree-item"><span className="icon"><FileIcon /></span> ui-experiments.tsx</li>
                        </ul>
                    )}
                </div>

                <div className="tree-section">
                    <div className="tree-header" onClick={() => toggle('worktree')}>
                        <span className="icon"><FolderIcon open={expanded.worktree} /></span>
                        <span className="folder-name">heady-worktree-production</span>
                    </div>
                    {expanded.worktree && (
                        <ul className="tree-list">
                            <li className="tree-item"><span className="icon"><FolderIcon /></span> src</li>
                            <li className="tree-item"><span className="icon"><FolderIcon /></span> configs</li>
                            <li className="tree-item"><span className="icon"><FileIcon /></span> heady-manager.js</li>
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
