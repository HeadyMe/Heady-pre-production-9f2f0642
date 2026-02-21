// HeadyBuddy Integration for Drupal Admin
(function($) {
  'use strict';

  // HeadyBuddy Widget
  const HeadyBuddyWidget = {
    init: function() {
      this.createWidget();
      this.setupEventListeners();
      this.initializeTaskManagement();
      this.setupHeadlessBrowser();
    },

    createWidget: function() {
      const widget = $('<div id="heady-buddy-widget" class="heady-buddy-widget">🤖</div>');
      $('body').append(widget);
    },

    setupEventListeners: function() {
      $('#heady-buddy-widget').on('click', function() {
        HeadyBuddyWidget.togglePanel();
      });
    },

    togglePanel: function() {
      // Toggle HeadyBuddy panel
      const panel = $('#heady-buddy-panel');
      if (panel.length) {
        panel.toggle();
      } else {
        HeadyBuddyWidget.createPanel();
      }
    },

    createPanel: function() {
      const panel = $(`
        <div id="heady-buddy-panel" style="position: fixed; bottom: 90px; right: 20px; width: 400px; max-height: 600px; background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); z-index: 999; overflow: hidden;">
          <div style="background: var(--heady-primary); color: white; padding: 1rem; font-weight: bold;">
            HeadyBuddy Assistant
          </div>
          <div style="padding: 1rem;">
            <div id="task-management-section">
              <h4>Task Management</h4>
              <div id="task-list"></div>
              <button id="add-task-btn" class="button">Add Task</button>
            </div>
            <div id="headless-browser-section" style="margin-top: 1rem;">
              <h4>Headless Browser</h4>
              <button id="start-browser-btn" class="button">Start Browser</button>
              <div id="browser-status"></div>
            </div>
            <div id="system-controls" style="margin-top: 1rem;">
              <h4>System Controls</h4>
              <button id="domain-builder-btn" class="button">Domain Builder</button>
              <button id="system-monitor-btn" class="button">System Monitor</button>
            </div>
          </div>
        </div>
      `);
      $('body').append(panel);
      HeadyBuddyWidget.setupPanelEvents();
    },

    setupPanelEvents: function() {
      $('#add-task-btn').on('click', function() {
        HeadyBuddyWidget.addTask();
      });

      $('#start-browser-btn').on('click', function() {
        HeadyBuddyWidget.startHeadlessBrowser();
      });

      $('#domain-builder-btn').on('click', function() {
        HeadyBuddyWidget.openDomainBuilder();
      });

      $('#system-monitor-btn').on('click', function() {
        HeadyBuddyWidget.openSystemMonitor();
      });
    },

    initializeTaskManagement: function() {
      // Initialize task management system
      this.loadTasks();
      this.setupTaskSync();
    },

    loadTasks: function() {
      // Load tasks from local storage or API
      const tasks = localStorage.getItem('heady-tasks') || '[]';
      this.tasks = JSON.parse(tasks);
      this.renderTasks();
    },

    renderTasks: function() {
      const taskList = $('#task-list');
      taskList.empty();
      
      this.tasks.forEach((task, index) => {
        const taskItem = $(`
          <div style="border: 1px solid #e5e7eb; border-radius: 4px; padding: 0.5rem; margin-bottom: 0.5rem;">
            <div><strong>${task.title}</strong></div>
            <div style="font-size: 0.8rem; color: #6b7280;">${task.description}</div>
            <button class="button" onclick="HeadyBuddyWidget.completeTask(${index})">Complete</button>
          </div>
        `);
        taskList.append(taskItem);
      });
    },

    addTask: function() {
      const title = prompt('Task title:');
      const description = prompt('Task description:');
      
      if (title) {
        this.tasks.push({
          title: title,
          description: description || '',
          completed: false,
          created: new Date().toISOString()
        });
        
        localStorage.setItem('heady-tasks', JSON.stringify(this.tasks));
        this.renderTasks();
      }
    },

    completeTask: function(index) {
      this.tasks.splice(index, 1);
      localStorage.setItem('heady-tasks', JSON.stringify(this.tasks));
      this.renderTasks();
    },

    setupTaskSync: function() {
      // Setup cross-device sync via WARP tunnel
      setInterval(() => {
        this.syncTasks();
      }, 30000); // Sync every 30 seconds
    },

    syncTasks: function() {
      // Sync tasks with WARP tunnel endpoint
      fetch('/api/headybuddy/sync/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tasks: this.tasks,
          timestamp: new Date().toISOString()
        })
      }).catch(err => {
        console.log('Task sync failed:', err);
      });
    },

    startHeadlessBrowser: function() {
      const status = $('#browser-status');
      status.text('Starting headless browser...');
      
      // Start headless browser via API
      fetch('/api/headybuddy/browser/start', {
        method: 'POST'
      })
      .then(response => response.json())
      .then(data => {
        status.text(`Browser running: ${data.url || 'Ready'}`);
      })
      .catch(err => {
        status.text('Failed to start browser');
        console.error(err);
      });
    },

    openDomainBuilder: function() {
      // Open domain builder interface
      window.location.href = '/admin/domains/builder';
    },

    openSystemMonitor: function() {
      // Open system monitor
      window.location.href = '/admin/system/monitor';
    }
  };

  // Initialize on document ready
  $(document).ready(function() {
    HeadyBuddyWidget.init();
  });

})(jQuery);
