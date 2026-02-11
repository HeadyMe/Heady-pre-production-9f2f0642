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
// ║  FILE: HeadyAI-IDE/main.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Set up cache directory
const cacheDir = path.join(__dirname, 'cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir);
}
process.env.ELECTRON_CACHE_DIR = cacheDir;

console.log('[Main] Starting Electron app');

function createWindow() {
  console.log('[Main] Creating browser window');
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  // In development, load the Vite dev server, in production, load index.html from the dist directory
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  win.webContents.openDevTools();
  console.log('[Main] Dev tools opened');
}

app.whenReady().then(() => {
  console.log('[Main] App ready');
  createWindow();
});

ipcMain.handle('read-dir', async (event, dirPath) => {
  try {
    const files = await fs.promises.readdir(dirPath);
    const fileDetails = await Promise.all(files.map(async (file) => {
      const filePath = path.join(dirPath, file);
      const stats = await fs.promises.stat(filePath);
      return {
        name: file,
        path: filePath,
        isDirectory: stats.isDirectory(),
        size: stats.size,
      };
    }));
    return fileDetails;
  } catch (error) {
    console.error(error);
    throw error;
  }
});
