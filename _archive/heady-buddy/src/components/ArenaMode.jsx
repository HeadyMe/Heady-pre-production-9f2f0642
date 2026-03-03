import React, { useState, useEffect } from 'react';
import { Zap, Play, Pause, Trophy, GitBranch, Users, Activity, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const ArenaMode = () => {
  const [arenaStatus, setArenaStatus] = useState('idle');
  const [candidates, setCandidates] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      if (arenaStatus === 'running') {
        // Add mock log entries
        const newLog = {
          timestamp: new Date(),
          message: `Arena candidate ${Math.floor(Math.random() * 3) + 1} executing task...`,
          level: 'info'
        };
        setLogs(prev => [...prev.slice(-4), newLog]);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [arenaStatus]);

  const startArena = async () => {
    try {
      setArenaStatus('starting');
      const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:3300/api/arena/start' : `https://api.${window.location.hostname.replace('buddy.', '')}/api/arena/start`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: {
            description: 'Optimize Heady Buddy performance',
            complexity: 'medium',
            success_metrics: ['response_time', 'resource_usage', 'user_satisfaction']
          },
          strategies: {
            headysystems: 'aggressive-innovation',
            headyconnection: 'community-driven',
            headyme: 'personal-optimization'
          }
        })
      });

      if (response.ok) {
        setArenaStatus('running');
        initializeCandidates();
      } else {
        setArenaStatus('error');
      }
    } catch (error) {
      console.error('Arena start failed:', error);
      setArenaStatus('error');
    }
  };

  const initializeCandidates = () => {
    setCandidates([
      {
        id: 'headysystems',
        name: 'HeadySystems',
        strategy: 'Aggressive Innovation',
        status: 'running',
        progress: 0,
        metrics: { codeQuality: 0, performance: 0, innovation: 0 }
      },
      {
        id: 'headyconnection',
        name: 'HeadyConnection',
        strategy: 'Community Driven',
        status: 'running',
        progress: 0,
        metrics: { codeQuality: 0, performance: 0, innovation: 0 }
      },
      {
        id: 'headyme',
        name: 'HeadyMe',
        strategy: 'Personal Optimization',
        status: 'running',
        progress: 0,
        metrics: { codeQuality: 0, performance: 0, innovation: 0 }
      }
    ]);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setCandidates(prev => prev.map(candidate => ({
        ...candidate,
        progress: Math.min(100, candidate.progress + Math.random() * 15),
        metrics: {
          codeQuality: Math.min(100, candidate.metrics.codeQuality + Math.random() * 10),
          performance: Math.min(100, candidate.metrics.performance + Math.random() * 10),
          innovation: Math.min(100, candidate.metrics.innovation + Math.random() * 10)
        }
      })));
    }, 1000);

    // Complete after 10 seconds
    setTimeout(() => {
      clearInterval(progressInterval);
      setArenaStatus('completed');
      setCandidates(prev => prev.map(candidate => ({
        ...candidate,
        status: 'completed',
        progress: 100
      })));
    }, 10000);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getWinner = () => {
    if (arenaStatus !== 'completed') return null;
    return candidates.reduce((prev, current) => {
      const prevScore = prev.metrics.codeQuality + prev.metrics.performance + prev.metrics.innovation;
      const currentScore = current.metrics.codeQuality + current.metrics.performance + current.metrics.innovation;
      return currentScore > prevScore ? current : prev;
    });
  };

  return (
    <div className="p-8 bg-gray-50 h-full overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Arena Mode</h2>
          <p className="text-gray-600">Tri-repo competition system for optimal solutions</p>
        </div>

        {/* Control Panel */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6 text-purple-600" />
              <h3 className="text-xl font-semibold">Arena Control</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Status:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${arenaStatus === 'running' ? 'bg-blue-100 text-blue-800' :
                    arenaStatus === 'completed' ? 'bg-green-100 text-green-800' :
                      arenaStatus === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                  }`}>
                  {arenaStatus.toUpperCase()}
                </span>
              </div>
              <button
                onClick={startArena}
                disabled={arenaStatus === 'running' || arenaStatus === 'starting'}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {arenaStatus === 'running' ? (
                  <><Pause className="w-4 h-4" /> Pause</>
                ) : (
                  <><Play className="w-4 h-4" /> Start Arena</>
                )}
              </button>
            </div>
          </div>

          {/* Arena Progress */}
          {arenaStatus === 'running' && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-purple-600" />
                <span className="font-medium text-purple-900">Competition in Progress</span>
              </div>
              <p className="text-purple-700 text-sm">
                Three candidates are competing across HeadySystems, HeadyConnection, and HeadyMe repositories.
              </p>
            </div>
          )}

          {/* Winner Announcement */}
          {arenaStatus === 'completed' && getWinner() && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-green-600" />
                <span className="font-medium text-green-900">Winner: {getWinner().name}</span>
              </div>
              <p className="text-green-700 text-sm">
                {getWinner().name} won with the "{getWinner().strategy}" strategy!
                The winning solution will be squash-merged to all repositories.
              </p>
            </div>
          )}
        </div>

        {/* Candidates Grid */}
        {candidates.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {candidates.map((candidate) => (
              <div key={candidate.id} className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-900">{candidate.name}</h4>
                  {getStatusIcon(candidate.status)}
                </div>

                <div className="mb-4">
                  <div className="text-sm text-gray-600 mb-1">Strategy</div>
                  <div className="font-medium text-gray-900">{candidate.strategy}</div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Progress</span>
                    <span className="text-sm font-medium">{Math.round(candidate.progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${candidate.progress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Code Quality</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-1">
                        <div
                          className="bg-green-600 h-1 rounded-full"
                          style={{ width: `${candidate.metrics.codeQuality}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium">{Math.round(candidate.metrics.codeQuality)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Performance</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-1">
                        <div
                          className="bg-blue-600 h-1 rounded-full"
                          style={{ width: `${candidate.metrics.performance}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium">{Math.round(candidate.metrics.performance)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Innovation</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-1">
                        <div
                          className="bg-purple-600 h-1 rounded-full"
                          style={{ width: `${candidate.metrics.innovation}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium">{Math.round(candidate.metrics.innovation)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Arena Logs */}
        {logs.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <GitBranch className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold">Arena Activity Log</h3>
            </div>
            <div className="space-y-2">
              {logs.map((log, index) => (
                <div key={index} className="flex items-start gap-3 text-sm">
                  <span className="text-gray-500 font-mono">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                  <span className="text-gray-700">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        {arenaStatus === 'idle' && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">How Arena Mode Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-purple-600 mt-1" />
                <div>
                  <h4 className="font-medium text-gray-900">Three Competitors</h4>
                  <p className="text-sm text-gray-600">HeadySystems, HeadyConnection, and HeadyMe each implement different strategies</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Activity className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <h4 className="font-medium text-gray-900">Parallel Execution</h4>
                  <p className="text-sm text-gray-600">All candidates run simultaneously with full service utilization</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Trophy className="w-5 h-5 text-green-600 mt-1" />
                <div>
                  <h4 className="font-medium text-gray-900">Winner Takes All</h4>
                  <p className="text-sm text-gray-600">Best solution is squash-merged to all repositories</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArenaMode;
