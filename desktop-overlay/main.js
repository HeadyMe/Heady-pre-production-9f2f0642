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
// ║  FILE: desktop-overlay/main.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  HEADY SYSTEMS                                                 ║
 * ║  ━━━━━━━━━━━━━━                                                ║
 * ║  ∞ Sacred Geometry Architecture ∞                              ║
 * ║                                                                ║
 * ║  main.js — Electron main process for HeadyBuddy Desktop       ║
 * ║  Overlay. Creates a frameless, always-on-top, transparent      ║
 * ║  window anchored to the bottom-right of the screen.            ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store({
  defaults: {
    apiBase: "http://localhost:3300",
    position: { x: null, y: null },
    collapsed: true,
    opacity: 0.95,
    alwaysOnTop: true,
    globalHotkey: "CommandOrControl+Shift+H",
    quietMode: false,
  },
});

const IS_DEV = process.argv.includes("--dev");
const WIDGET_WIDTH = 420;
const WIDGET_HEIGHT = 700;
const PILL_WIDTH = 220;
const PILL_HEIGHT = 56;

let mainWindow = null;
let tray = null;
let isCollapsed = store.get("collapsed");

function createWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const savedPos = store.get("position");

  const x = savedPos.x != null ? savedPos.x : screenW - WIDGET_WIDTH - 24;
  const y = savedPos.y != null ? savedPos.y : screenH - WIDGET_HEIGHT - 24;

  mainWindow = new BrowserWindow({
    width: isCollapsed ? PILL_WIDTH : WIDGET_WIDTH,
    height: isCollapsed ? PILL_HEIGHT : WIDGET_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: store.get("alwaysOnTop"),
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setOpacity(store.get("opacity"));

  if (IS_DEV) {
    mainWindow.loadURL("http://localhost:3400");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const widgetPath = path.join(process.resourcesPath, "widget", "index.html");
    mainWindow.loadFile(widgetPath).catch(() => {
      mainWindow.loadFile(path.join(__dirname, "..", "headybuddy", "dist", "index.html"));
    });
  }

  mainWindow.on("moved", () => {
    const [mx, my] = mainWindow.getPosition();
    store.set("position", { x: mx, y: my });
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

function createTray() {
  const iconPath = path.join(__dirname, "icons", "tray-icon.png");
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) throw new Error("empty");
  } catch {
    // Generate a 16x16 placeholder tray icon (blue circle)
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - 7.5, dy = y - 7.5;
        const inside = (dx * dx + dy * dy) <= 49;
        const i = (y * size + x) * 4;
        canvas[i] = inside ? 66 : 0;     // R
        canvas[i+1] = inside ? 133 : 0;  // G
        canvas[i+2] = inside ? 244 : 0;  // B
        canvas[i+3] = inside ? 255 : 0;  // A
      }
    }
    trayIcon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  }

  tray = new Tray(trayIcon);
  tray.setToolTip("HeadyBuddy — Perfect Day AI Companion");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show / Hide",
      click: () => toggleVisibility(),
    },
    {
      label: "Always on Top",
      type: "checkbox",
      checked: store.get("alwaysOnTop"),
      click: (item) => {
        store.set("alwaysOnTop", item.checked);
        if (mainWindow) mainWindow.setAlwaysOnTop(item.checked);
      },
    },
    {
      label: "Quiet Mode",
      type: "checkbox",
      checked: store.get("quietMode"),
      click: (item) => {
        store.set("quietMode", item.checked);
        if (mainWindow) mainWindow.webContents.send("quiet-mode", item.checked);
      },
    },
    { type: "separator" },
    {
      label: "Reset Position",
      click: () => {
        store.set("position", { x: null, y: null });
        if (mainWindow) {
          const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
          mainWindow.setPosition(sw - WIDGET_WIDTH - 24, sh - WIDGET_HEIGHT - 24);
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit HeadyBuddy",
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => toggleVisibility());
}

function toggleVisibility() {
  if (!mainWindow) return createWindow();
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function resizeForState(collapsed) {
  if (!mainWindow) return;
  isCollapsed = collapsed;
  store.set("collapsed", collapsed);

  const [cx, cy] = mainWindow.getPosition();
  const newW = collapsed ? PILL_WIDTH : WIDGET_WIDTH;
  const newH = collapsed ? PILL_HEIGHT : WIDGET_HEIGHT;

  // Keep bottom-right anchor stable
  const dx = (collapsed ? WIDGET_WIDTH : PILL_WIDTH) - newW;
  const dy = (collapsed ? WIDGET_HEIGHT : PILL_HEIGHT) - newH;
  mainWindow.setBounds({ x: cx + dx, y: cy + dy, width: newW, height: newH }, true);
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Initialize IPC handlers after app is ready
  ipcMain.on("widget-state", (event, state) => {
    resizeForState(state === "pill");
  });

  ipcMain.handle("get-config", () => ({
    apiBase: store.get("apiBase"),
    quietMode: store.get("quietMode"),
  }));

  ipcMain.handle("set-config", (event, key, value) => {
    store.set(key, value);
    return true;
  });

  ipcMain.handle("get-system-info", () => {
    const os = require("os");
    return {
      platform: process.platform,
      arch: process.arch,
      cpus: os.cpus().length,
      totalMemMB: Math.round(os.totalmem() / 1048576),
      freeMemMB: Math.round(os.freemem() / 1048576),
      hostname: os.hostname(),
      uptime: os.uptime(),
    };
  });

  const hotkey = store.get("globalHotkey");
  try {
    globalShortcut.register(hotkey, toggleVisibility);
  } catch (err) {
    console.warn(`Failed to register hotkey ${hotkey}: ${err.message}`);
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  // Keep running in tray
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
});
