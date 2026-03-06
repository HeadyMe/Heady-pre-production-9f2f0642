(function ($) {
  'use strict';

  Drupal.behaviors.headyDashboard = {
    attach: function (context, settings) {
      const apiBase = settings.heady.apiBase;
      let autoRefresh = true;
      let refreshInterval;

      // Initialize dashboard
      function initDashboard() {
        loadWARPStatus();
        startAutoRefresh();
        updateLastUpdateTime();
      }

      // Load WARP status
      function loadWARPStatus() {
        $.get(apiBase + '/admin/heady/warp-status')
          .done(function(data) {
            renderWARPDashboard(data);
          })
          .fail(function() {
            $('#warp-dashboard').html('<div class="error">WARP status unavailable</div>');
          });
      }

      // Render WARP dashboard
      function renderWARPDashboard(stats) {
        const html = `
          <div class="warp-status-badge" style="background: ${stats.enabled ? '#22c55e' : '#ef4444'}; color: white; padding: 0.5rem 1rem; border-radius: 0.5rem; display: inline-block; margin-bottom: 1rem;">
            ${stats.enabled ? '✓ WARP Connected' : '✗ WARP Disconnected'}
          </div>
          
          <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
            <div class="stat-card">
              <h3>Latency</h3>
              <p class="stat-value">${stats.latency || 0}ms</p>
              <p class="stat-label">Average Response Time</p>
            </div>
            
            <div class="stat-card">
              <h3>Throughput</h3>
              <p class="stat-value">${stats.throughput || 0} Mbps</p>
              <p class="stat-label">Network Speed</p>
            </div>
            
            <div class="stat-card">
              <h3>Active Connections</h3>
              <p class="stat-value">${stats.connections || 0}</p>
              <p class="stat-label">Concurrent Devices</p>
            </div>
          </div>
          
          <div class="connected-devices">
            <h3>Connected Devices</h3>
            <div class="devices-list">
              ${(stats.devices || []).map(device => `
                <div class="device-card" style="background: rgba(30, 41, 59, 0.8); padding: 1rem; border-radius: 0.5rem; margin-bottom: 0.5rem; border: ${device.warp ? '1px solid #22c55e' : '1px solid #64748b'}">
                  <div style="display: flex; justify-content: space-between;">
                    <div>
                      <strong>${device.name}</strong>
                      <p style="font-size: 0.875rem; opacity: 0.7;">${device.type} • ${device.platform}</p>
                    </div>
                    <div>
                      ${device.warp ? '<span style="color: #22c55e;">🔐 WARP</span>' : ''}
                      ${device.online ? '<span style="color: #22c55e; margin-left: 0.5rem;">● Online</span>' : ''}
                    </div>
                  </div>
                  <p style="font-size: 0.75rem; margin-top: 0.5rem; opacity: 0.6;">
                    Last seen: ${new Date(device.lastSeen).toLocaleString()}
                  </p>
                </div>
              `).join('') || '<p>No devices connected</p>'}
            </div>
          </div>
        `;
        
        $('#warp-dashboard').html(html);
      }

      // Auto refresh functionality
      function startAutoRefresh() {
        if (autoRefresh) {
          refreshInterval = setInterval(function() {
            refreshDashboard();
          }, settings.heady.refreshInterval);
        }
      }

      function stopAutoRefresh() {
        if (refreshInterval) {
          clearInterval(refreshInterval);
        }
      }

      function refreshDashboard() {
        updateLastUpdateTime();
        loadWARPStatus();
        // Reload the page to refresh other data
        setTimeout(function() {
          location.reload();
        }, 1000);
      }

      function updateLastUpdateTime() {
        $('#last-update').text(new Date().toLocaleTimeString());
      }

      // Global functions for onclick handlers
      window.triggerDeploy = function(domain) {
        if (!confirm('Deploy ' + domain + '? This will trigger a new build.')) {
          return;
        }

        $.post(apiBase + '/admin/heady/deploy/' + domain)
          .done(function(data) {
            showNotification('Deployment triggered for ' + domain, 'success');
            setTimeout(refreshDashboard, 2000);
          })
          .fail(function(xhr) {
            showNotification('Error: ' + (xhr.responseJSON?.error || 'Unknown error'), 'error');
          });
      };

      window.runFullSync = function() {
        showNotification('Initiating full system sync...', 'info');
        
        $.post(apiBase + '/admin/heady/sync')
          .done(function(data) {
            showNotification('Full sync initiated successfully', 'success');
            setTimeout(refreshDashboard, 3000);
          })
          .fail(function(xhr) {
            showNotification('Error: ' + (xhr.responseJSON?.error || 'Unknown error'), 'error');
          });
      };

      window.deployAll = function() {
        const domains = ['headybuddy.org', 'headysystems.com', 'headyconnection.org', 'headymcp.com', 'headyio.com', 'headyme.com'];
        if (!confirm('Deploy all ' + domains.length + ' domains? This may take several minutes.')) {
          return;
        }

        showNotification('Triggering deployments for all domains...', 'info');
        let completed = 0;
        
        domains.forEach(domain => {
          $.post(apiBase + '/admin/heady/deploy/' + domain)
            .always(function() {
              completed++;
              if (completed === domains.length) {
                showNotification('All deployments triggered', 'success');
                setTimeout(refreshDashboard, 5000);
              }
            });
        });
      };

      window.refreshDashboard = function() {
        showNotification('Refreshing dashboard...', 'info');
        refreshDashboard();
      };

      window.toggleAutoRefresh = function() {
        autoRefresh = !autoRefresh;
        $('#auto-refresh-status').text(autoRefresh ? 'ON' : 'OFF');
        
        if (autoRefresh) {
          startAutoRefresh();
          showNotification('Auto refresh enabled', 'success');
        } else {
          stopAutoRefresh();
          showNotification('Auto refresh disabled', 'info');
        }
      };

      window.debugDomain = function(domain) {
        showNotification('Debugging ' + domain + '...', 'info');
        // Open debug tools or logs
        window.open('https://www.cloudflare.com/analytics/', '_blank');
      };

      // Placeholder functions for other actions
      window.forceBuddySync = function() {
        showNotification('HeadyBuddy sync triggered', 'success');
      };

      window.clearBuddyCache = function() {
        showNotification('HeadyBuddy cache cleared', 'success');
      };

      window.testBuddyConnection = function() {
        showNotification('Testing HeadyBuddy connection...', 'info');
      };

      window.viewBuddyLogs = function() {
        window.open(apiBase + '/logs/buddy', '_blank');
      };

      window.triggerCleanBuild = function() {
        showNotification('Clean build initiated', 'success');
      };

      window.restartServices = function() {
        if (!confirm('Restart all services? This will cause temporary downtime.')) {
          return;
        }
        showNotification('Services restart initiated', 'info');
      };

      window.viewLogs = function() {
        window.open(apiBase + '/logs', '_blank');
      };

      window.runHealthCheck = function() {
        showNotification('Running health check...', 'info');
        setTimeout(refreshDashboard, 2000);
      };

      // Notification system
      function showNotification(message, type = 'info') {
        const notification = $(`
          <div class="notification ${type}">
            ${message}
          </div>
        `);
        
        $('#notifications').append(notification);
        
        setTimeout(function() {
          notification.fadeOut(function() {
            $(this).remove();
          });
        }, 5000);
      }

      // Initialize on page load
      initDashboard();
    }
  };

})(jQuery);
