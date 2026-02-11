const electronPath = require('electron');
const { app, BrowserWindow } = require(electronPath);

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 800, height: 600 });
  win.loadURL('https://electronjs.org');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
