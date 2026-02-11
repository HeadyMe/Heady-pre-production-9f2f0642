// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: headybuddy/src/components/DemoRepos.jsx                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
import React, { useState, useEffect } from 'react';

export default function DemoRepos() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const response = await fetch('http://api.heady.io:3300/api/registry/demo-repos');
        const data = await response.json();
        setRepos(data.repos);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching demo repos:', error);
        setLoading(false);
      }
    };

    fetchRepos();
  }, []);

  const runDemo = async (repoId) => {
    try {
      await fetch(`http://api.heady.io:3300/api/demo/${repoId}/run`, { method: 'POST' });
      alert(`Demo started for ${repoId}`);
    } catch (error) {
      console.error('Error starting demo:', error);
      alert('Failed to start demo');
    }
  };

  if (loading) return <div>Loading demo repositories...</div>;

  return (
    <div className="demo-repos">
      <h3>Finished Functional Repositories</h3>
      <ul>
        {repos.map(repo => (
          <li key={repo.id}>
            <strong>{repo.name}</strong>: {repo.description}
            <button onClick={() => runDemo(repo.id)}>Run Demo</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
