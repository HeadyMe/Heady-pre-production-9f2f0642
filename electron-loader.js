// Custom Electron API loader
const electronPath = require('electron');
const electron = require(electronPath);

// Test API access
electron.app.whenReady().then(() => {
  console.log('Electron API successfully accessed!');
  const win = new electron.BrowserWindow({ show: false });
  win.loadURL('about:blank');
  win.close();
  electron.app.quit();
});
