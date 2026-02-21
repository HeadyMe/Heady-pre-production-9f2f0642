// Heady Systems Control JavaScript
(function (Drupal) {
  'use strict';

  Drupal.behaviors.headyControl = {
    attach: function (context, settings) {
      
      // Initialize dashboard
      if (context === document) {
        initDashboard();
        startRealTimeUpdates();
      }

      // Service actions
      const serviceActions = document.querySelectorAll('.service-action');
      serviceActions.forEach(action => {
        action.addEventListener('click', function(e) {
          e.preventDefault();
          const action = this.dataset.action;
          const service = this.dataset.service;
          
          if (action === 'restart') {
            restartService(service);
          } else if (action === 'logs') {
            viewServiceLogs(service);
          }
        });
      });

      // Domain actions
      const domainActions = document.querySelectorAll('.domain-action');
      domainActions.forEach(action => {
        action.addEventListener('click', function(e) {
          e.preventDefault();
          const action = this.dataset.action;
          const domain = this.dataset.domain;
          
          if (action === 'deploy') {
            deployDomain(domain);
          } else if (action === 'open') {
            window.open(`https://${domain}`, '_blank');
          }
        });
      });

      // Quick actions
      const quickActions = document.querySelectorAll('.quick-action');
      quickActions.forEach(action => {
        action.addEventListener('click', function() {
          const action = this.dataset.action;
          executeQuickAction(action);
        });
      });

    }
  };

  function initDashboard() {
    console.log('🚀 Heady Systems Control Dashboard initialized');
    showNotification('Dashboard loaded successfully!', 'success');
    
    // Initialize tooltips
    initTooltips();
    
    // Load initial data
    loadDashboardData();
  }

  function startRealTimeUpdates() {
    // Update every 30 seconds
    setInterval(() => {
      updateServiceStatus();
      updateDomainStatus();
      updateWARPStats();
    }, 30000);

    // Update WARP stats every 10 seconds
    setInterval(() => {
      updateWARPStats();
    }, 10000);
  }

  function loadDashboardData() {
    // Simulate loading data
    updateServiceStatus();
    updateDomainStatus();
    updateWARPStats();
    updateBuddyDevices();
  }

  function updateServiceStatus() {
    const services = document.querySelectorAll('.service-card');
    services.forEach(service => {
      const status = service.querySelector('.service-status');
      const metrics = service.querySelectorAll('.metric-value');
      
      // Simulate status update
      const isOnline = Math.random() > 0.1;
      
      if (isOnline) {
        status.className = 'service-status online';
        status.textContent = '● Online';
        
        // Update metrics
        metrics[0].textContent = Math.floor(Math.random() * 100 + 50) + 'ms';
        metrics[1].textContent = Math.floor(Math.random() * 30 + 70) + '%';
      } else {
        status.className = 'service-status offline';
        status.textContent = '● Offline';
      }
    });
  }

  function updateDomainStatus() {
    const domains = document.querySelectorAll('.domain-card');
    domains.forEach(domain => {
      const status = domain.querySelector('.domain-status');
      const metrics = domain.querySelectorAll('.metric-value');
      
      // Simulate status update
      const isOnline = Math.random() > 0.05;
      
      if (isOnline) {
        status.className = 'service-status online';
        status.textContent = '● Online';
        
        // Update metrics
        metrics[0].textContent = Math.floor(Math.random() * 500 + 200) + 'ms';
        metrics[1].textContent = Math.floor(Math.random() * 5 + 95) + '%';
        metrics[2].textContent = Math.floor(Math.random() * 100 + 400) + 'ms';
      } else {
        status.className = 'service-status offline';
        status.textContent = '● Offline';
      }
    });
  }

  function updateWARPStats() {
    const warpStats = document.querySelectorAll('.warp-stat-value');
    if (warpStats.length >= 4) {
      // Update WARP statistics
      warpStats[0].textContent = Math.floor(Math.random() * 20 + 5);
      warpStats[1].textContent = Math.floor(Math.random() * 100 + 50) + ' Mbps';
      warpStats[2].textContent = Math.floor(Math.random() * 40 + 10) + '%';
      warpStats[3].textContent = Math.floor(Math.random() * 10);
    }
  }

  function updateBuddyDevices() {
    const deviceList = document.querySelector('.device-list');
    if (!deviceList) return;

    // Simulate device list
    const devices = [
      { name: 'Desktop-Linux', type: 'desktop', warp: true, status: 'connected' },
      { name: 'iPhone-15', type: 'mobile', warp: true, status: 'connected' },
      { name: 'MacBook-Pro', type: 'desktop', warp: false, status: 'idle' },
      { name: 'iPad-Pro', type: 'tablet', warp: true, status: 'connected' }
    ];

    deviceList.innerHTML = '';
    devices.forEach(device => {
      const deviceItem = document.createElement('div');
      deviceItem.className = 'device-item';
      deviceItem.innerHTML = `
        <div class="device-info">
          <h5>${device.name}</h5>
          <div class="device-meta">${device.type} • ${device.status}</div>
        </div>
        <div class="device-status">
          ${device.warp ? '<span class="warp-badge">🔐 WARP</span>' : ''}
          <span class="status-indicator ${device.status}"></span>
        </div>
      `;
      deviceList.appendChild(deviceItem);
    });
  }

  function restartService(serviceName) {
    if (!confirm(`Restart ${serviceName}? This may cause brief downtime.`)) {
      return;
    }

    showNotification(`Restarting ${serviceName}...`, 'info');
    
    // Simulate restart
    setTimeout(() => {
      showNotification(`${serviceName} restarted successfully!`, 'success');
      updateServiceStatus();
    }, 2000);
  }

  function deployDomain(domain) {
    if (!confirm(`Deploy ${domain}? This will trigger a new build.`)) {
      return;
    }

    showNotification(`Triggering deployment for ${domain}...`, 'info');
    
    // Simulate deployment
    setTimeout(() => {
      showNotification(`Deployment triggered for ${domain}!`, 'success');
    }, 1500);
  }

  function executeQuickAction(action) {
    const actions = {
      'full-sync': () => {
        showNotification('Initiating full system sync...', 'info');
        setTimeout(() => showNotification('Full sync completed!', 'success'), 3000);
      },
      'clean-build': () => {
        showNotification('Starting clean build process...', 'info');
        setTimeout(() => showNotification('Clean build initiated!', 'success'), 2000);
      },
      'restart-services': () => {
        showNotification('Restarting all services...', 'warning');
        setTimeout(() => showNotification('All services restarted!', 'success'), 4000);
      },
      'view-logs': () => {
        showNotification('Loading system logs...', 'info');
        setTimeout(() => showNotification('Logs loaded!', 'success'), 1000);
      },
      'health-check': () => {
        showNotification('Running system health check...', 'info');
        setTimeout(() => showNotification('Health check completed!', 'success'), 2500);
      },
      'deploy-all': () => {
        if (confirm('Deploy all domains? This may take several minutes.')) {
          showNotification('Deploying all domains...', 'warning');
          setTimeout(() => showNotification('All deployments triggered!', 'success'), 3000);
        }
      },
      'buddy-sync': () => {
        showNotification('Syncing HeadyBuddy devices...', 'info');
        setTimeout(() => showNotification('HeadyBuddy sync completed!', 'success'), 2000);
      },
      'warp-status': () => {
        showNotification('Checking WARP tunnel status...', 'info');
        setTimeout(() => showNotification('WARP tunnels operational!', 'success'), 1500);
      }
    };

    const actionFn = actions[action];
    if (actionFn) {
      actionFn();
    } else {
      showNotification(`Unknown action: ${action}`, 'error');
    }
  }

  function viewServiceLogs(service) {
    showNotification(`Loading logs for ${service}...`, 'info');
    
    // Simulate loading logs
    const logsContainer = document.querySelector('.logs-container');
    if (logsContainer) {
      const sampleLogs = [
        { timestamp: new Date().toISOString(), level: 'info', message: `Service ${service} started successfully` },
        { timestamp: new Date(Date.now() - 60000).toISOString(), level: 'info', message: `Configuration loaded for ${service}` },
        { timestamp: new Date(Date.now() - 120000).toISOString(), level: 'warning', message: `High memory usage detected` },
        { timestamp: new Date(Date.now() - 180000).toISOString(), level: 'info', message: `Health check passed` }
      ];

      logsContainer.innerHTML = '';
      sampleLogs.forEach(log => {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${log.level}`;
        logEntry.innerHTML = `
          <span class="log-timestamp">${new Date(log.timestamp).toLocaleTimeString()}</span>
          <span class="log-level">${log.level}</span>
          <span class="log-message">${log.message}</span>
        `;
        logsContainer.appendChild(logEntry);
      });
    }
  }

  function initTooltips() {
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(element => {
      element.addEventListener('mouseenter', function() {
        // Tooltip styling handled by CSS
      });
    });
  }

  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `heady-notification ${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white;
      border-radius: 0.5rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      animation: slideIn 0.3s ease;
      max-width: 400px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  // Add slide animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  // Export functions for global access
  window.HeadyControl = {
    restartService,
    deployDomain,
    executeQuickAction,
    showNotification
  };

})(Drupal);
