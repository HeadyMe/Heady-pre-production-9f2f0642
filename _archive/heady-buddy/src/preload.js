const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('headyAPI', {
  // User preferences
  getUserPreferences: () => ipcRenderer.invoke('get-user-preferences'),
  setUserPreferences: (preferences) => ipcRenderer.invoke('set-user-preferences', preferences),
  
  // Recent projects
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
  addRecentProject: (project) => ipcRenderer.invoke('add-recent-project', project),
  
  // System health
  checkHeadyServices: () => ipcRenderer.invoke('check-heady-services'),
  
  // Arena Mode
  launchArenaMode: () => ipcRenderer.invoke('launch-arena-mode'),
  
  // Event listeners
  onLaunchMode: (callback) => ipcRenderer.on('launch-mode', callback),
  onSystemHealth: (callback) => ipcRenderer.on('system-health', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Expose node.js versions
contextBridge.exposeInMainWorld('versions', {
  node: process.versions.node,
  chrome: process.versions.chrome,
  electron: process.versions.electron
});

// Expose platform info
contextBridge.exposeInMainWorld('platform', {
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux'
});
