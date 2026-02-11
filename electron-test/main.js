// Custom Electron API loader
const electronPath = require('electron');
const { app, BrowserWindow } = require(electronPath);

app.whenReady().then(() => {
  console.log('Electron app ready!');
  const win = new BrowserWindow({ show: false });
  win.loadURL('about:blank');
  win.close();
  app.quit();
});
