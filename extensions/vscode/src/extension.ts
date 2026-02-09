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
// ║  FILE: extensions/vscode/src/extension.ts                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady VS Code Extension
 * Sacred Geometry AI integration for Visual Studio Code
 */

import * as vscode from 'vscode';
import axios from 'axios';

const HEADY_MANAGER_ENDPOINT = 'http://manager.dev.local.heady.internal:3300';

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;
let healthCheckInterval: NodeJS.Timeout | undefined;

// API endpoints
const API_ENDPOINTS = {
  local: HEADY_MANAGER_ENDPOINT,
  'cloud-me': 'https://cloud-me.heady.io',
  'cloud-sys': 'https://cloud-sys.heady.io',
  'cloud-conn': 'https://cloud-conn.heady.io',
};

export function activate(context: vscode.ExtensionContext) {
  console.log('∞ Heady Dev Companion activated');

  // Create output channel
  outputChannel = vscode.window.createOutputChannel('Heady Systems');
  outputChannel.appendLine('∞ Heady Systems initialized');

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'heady.openDashboard';
  statusBarItem.text = '$(loading~spin) Heady';
  statusBarItem.tooltip = 'Checking Heady connection...';
  
  const config = vscode.workspace.getConfiguration('heady');
  if (config.get('showStatusBar', true)) {
    statusBarItem.show();
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('heady.openDashboard', openDashboard),
    vscode.commands.registerCommand('heady.sendSelection', sendSelection),
    vscode.commands.registerCommand('heady.checkHealth', checkHealth),
    vscode.commands.registerCommand('heady.switchEndpoint', switchEndpoint),
    vscode.commands.registerCommand('heady.runCleanBuild', runCleanBuild),
    vscode.commands.registerCommand('heady.viewTasks', viewTasks),
    statusBarItem
  );

  // Auto-connect on startup
  if (config.get('autoConnect', true)) {
    checkHealth();
    
    // Periodic health check every 5 minutes
    healthCheckInterval = setInterval(checkHealth, 5 * 60 * 1000);
    context.subscriptions.push({
      dispose: () => {
        if (healthCheckInterval) {
          clearInterval(healthCheckInterval);
        }
      }
    });
  }
}

export function deactivate() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  outputChannel.appendLine('∞ Heady Systems deactivated');
}

// Open Heady dashboard
async function openDashboard() {
  const endpoint = getActiveEndpoint();
  vscode.env.openExternal(vscode.Uri.parse(endpoint));
}

// Send selected text to Heady
async function sendSelection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  const selection = editor.document.getText(editor.selection);
  if (!selection) {
    vscode.window.showWarningMessage('No text selected');
    return;
  }

  try {
    const endpoint = getActiveEndpoint();
    const response = await axios.post(`${endpoint}/api/inbox/vscode`, {
      source: 'vscode-extension',
      timestamp: new Date().toISOString(),
      data: {
        text: selection,
        file: editor.document.fileName,
        language: editor.document.languageId,
      },
    });

    if (response.status === 200) {
      vscode.window.showInformationMessage('∞ Sent to Heady successfully');
      outputChannel.appendLine(`Sent selection from ${editor.document.fileName}`);
    }
  } catch (error: any) {
    vscode.window.showErrorMessage(`Heady error: ${error.message}`);
    outputChannel.appendLine(`Error: ${error.message}`);
  }
}

// Check health of all endpoints
async function checkHealth() {
  outputChannel.appendLine('Checking Heady health...');
  
  const results: Record<string, any> = {};
  
  for (const [name, url] of Object.entries(API_ENDPOINTS)) {
    try {
      const response = await axios.get(`${url}/api/health`, {
        timeout: 5000,
      });
      
      if (response.status === 200) {
        results[name] = { status: 'healthy', data: response.data };
        outputChannel.appendLine(`✓ ${name}: healthy`);
      } else {
        results[name] = { status: 'unhealthy', code: response.status };
        outputChannel.appendLine(`✗ ${name}: unhealthy (${response.status})`);
      }
    } catch (error: any) {
      results[name] = { status: 'unreachable', error: error.message };
      outputChannel.appendLine(`✗ ${name}: unreachable`);
    }
  }
  
  // Update status bar based on active endpoint
  const activeEndpoint = getActiveEndpoint();
  const activeKey = Object.keys(API_ENDPOINTS).find(k => API_ENDPOINTS[k as keyof typeof API_ENDPOINTS] === activeEndpoint);
  const activeHealth = activeKey ? results[activeKey] : null;
  
  if (activeHealth?.status === 'healthy') {
    statusBarItem.text = '$(check) Heady';
    statusBarItem.tooltip = `Connected to ${activeKey}`;
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = '$(alert) Heady';
    statusBarItem.tooltip = `Offline - ${activeHealth?.error || 'Connection failed'}`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }
  
  return results;
}

// Switch active endpoint
async function switchEndpoint() {
  const items = [
    { label: 'Local Dev', description: 'manager.dev.local.heady.internal:3300', endpoint: 'local' },
    { label: 'Cloud - HeadyMe', description: 'cloud-me.heady.io', endpoint: 'cloud-me' },
    { label: 'Cloud - HeadySystems', description: 'cloud-sys.heady.io', endpoint: 'cloud-sys' },
    { label: 'Cloud - HeadyConnection', description: 'cloud-conn.heady.io', endpoint: 'cloud-conn' },
  ];
  
  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select Heady endpoint',
  });
  
  if (selected) {
    const config = vscode.workspace.getConfiguration('heady');
    await config.update('endpoint', API_ENDPOINTS[selected.endpoint as keyof typeof API_ENDPOINTS], vscode.ConfigurationTarget.Global);
    
    vscode.window.showInformationMessage(`∞ Switched to ${selected.label}`);
    checkHealth();
  }
}

// Run clean build
async function runCleanBuild() {
  const terminal = vscode.window.createTerminal('Heady Clean Build');
  terminal.show();
  terminal.sendText('npm run build:clean');
}

// View active tasks
async function viewTasks() {
  const endpoint = getActiveEndpoint();
  vscode.env.openExternal(vscode.Uri.parse(`${endpoint}/api/pulse`));
}

// Get active endpoint from config
function getActiveEndpoint(): string {
  const config = vscode.workspace.getConfiguration('heady');
  return config.get('endpoint', HEADY_MANAGER_ENDPOINT);
}
