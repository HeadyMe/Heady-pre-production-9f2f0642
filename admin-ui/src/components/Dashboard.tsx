'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Cpu, Globe, Users, Zap, Settings } from 'lucide-react';

interface ConductorStatus {
  isRunning: boolean;
  workers: {
    total: number;
    busy: number;
    available: number;
  };
  tasks: {
    queued: number;
    active: number;
    completed: number;
  };
  performance: {
    resourceUtilization: string;
    parallelEfficiency: string;
  };
}

export default function Dashboard() {
  const [selectedSite, setSelectedSite] = useState('headyme.com');

  // Fetch HeadyConductor status
  const { data: conductorStatus, isLoading } = useQuery<ConductorStatus>({
    queryKey: ['conductor-status'],
    queryFn: async () => {
      const headyResponse = await fetch('https://api.headyio.com/api/conductor/status');
      if (!headyResponse.ok) throw new Error('Failed to fetch conductor status');
      const headyData = await headyResponse.json();
      return headyData.conductor;
    },
    refetchInterval: 1000, // Real-time updates
  });

  const headyMetrics = [
    {
      title: 'Parallel Workers',
      value: conductorStatus?.workers.total || 0,
      icon: Cpu,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Active Tasks',
      value: conductorStatus?.tasks.active || 0,
      icon: Activity,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Resource Utilization',
      value: conductorStatus?.performance.resourceUtilization || '0%',
      icon: Zap,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      title: 'Parallel Efficiency',
      value: conductorStatus?.performance.parallelEfficiency || '0%',
      icon: Settings,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  const headySites = [
    { id: 'headyme.com', name: 'Admin Dashboard', type: 'Next.js', status: 'Active' },
    { id: 'blog.headyme.com', name: 'Blog Platform', type: 'Drupal', status: 'Active' },
    { id: 'app.headyme.com', name: 'Main Application', type: 'Next.js', status: 'Active' },
    { id: 'shop.headyme.com', name: 'E-commerce', type: 'Next.js', status: 'Planned' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">🎛️ HeadyMe Admin</h1>
              <span className="ml-4 px-3 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                HeadyConductor Active
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {headySites.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                H
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {headyMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.title} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className={`p-3 rounded-lg ${metric.bgColor}`}>
                    <Icon className={`h-6 w-6 ${metric.color}`} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                    <p className="text-2xl font-semibold text-gray-900">{metric.value}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* System Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* HeadyConductor Status */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">🎼 HeadyConductor Status</h2>
            </div>
            <div className="p-6">
              {isLoading ? (
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className="text-sm font-medium text-green-600">
                      {conductorStatus?.isRunning ? 'Running' : 'Stopped'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Workers</span>
                    <span className="text-sm font-medium">
                      {conductorStatus?.workers.busy}/{conductorStatus?.workers.total} busy
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Queue</span>
                    <span className="text-sm font-medium">
                      {conductorStatus?.tasks.queued} queued
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: conductorStatus?.performance.resourceUtilization || '0%' }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Site Management */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">🌐 Site Management</h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {headySites.map((site) => (
                  <div key={site.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Globe className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{site.name}</p>
                        <p className="text-xs text-gray-500">{site.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        site.status === 'Active' 
                          ? 'text-green-800 bg-green-100' 
                          : 'text-yellow-800 bg-yellow-100'
                      }`}>
                        {site.status}
                      </span>
                      <button className="text-blue-600 hover:text-blue-800 text-sm">
                        Manage
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">⚡ Quick Actions</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                <Users className="h-4 w-4 mr-2" />
                Create New Site
              </button>
              <button className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                <Settings className="h-4 w-4 mr-2" />
                Worker Configuration
              </button>
              <button className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                <Activity className="h-4 w-4 mr-2" />
                View Logs
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
