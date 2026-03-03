/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady AI — VS Code Extension
 * Connects every editor action to the Heady Intelligence Layer.
 * Model-aware: supports heady-battle-v1, heady-flash, heady-reason, heady-edge, heady-buddy.
 */
const vscode = require("vscode");
const http = require("http");
const https = require("https");

const HEADY_MODELS = [
    { id: 'heady-flash', label: '⚡ Heady Flash', detail: 'Fast & free — 3 fastest nodes', tier: 'free' },
    { id: 'heady-edge', label: '🌐 Heady Edge', detail: 'Sub-200ms edge inference', tier: 'free' },
    { id: 'heady-buddy', label: '🤝 Heady Buddy', detail: 'Memory-aware companion', tier: 'pro' },
    { id: 'heady-reason', label: '🧠 Heady Reason', detail: 'Extended thinking — deep analysis', tier: 'premium' },
    { id: 'heady-battle-v1', label: '🏆 Heady Battle v1', detail: 'Full 20-node arena — highest quality', tier: 'premium' },
];

let currentModel = 'heady-flash';
let modelStatusBar;

function getApiUrl() {
    return vscode.workspace.getConfiguration("heady").get("apiUrl") || "http://api.headysystems.com";
}

function getModel() {
    return vscode.workspace.getConfiguration("heady").get("model") || currentModel;
}

/**
 * Call the OpenAI-compatible Heady models API
 */
async function callHeady(message, model) {
    const apiUrl = getApiUrl();
    const url = new URL(apiUrl);
    const useModel = model || getModel();
    const apiKey = vscode.workspace.getConfiguration("heady").get("apiKey") || '';

    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            model: useModel,
            messages: [{ role: 'user', content: message }],
            temperature: 0.7,
        });

        const proto = url.protocol === 'https:' ? https : http;
        const req = proto.request({
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 3301),
            path: "/api/v1/chat/completions",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
                ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
            },
            timeout: 30000,
        }, (res) => {
            let data = "";
            res.on("data", c => data += c);
            res.on("end", () => {
                try {
                    const j = JSON.parse(data);
                    if (j.choices?.[0]?.message?.content) {
                        resolve(j.choices[0].message.content);
                    } else if (j.error) {
                        reject(new Error(j.error.message));
                    } else {
                        resolve(j.response || j.text || JSON.stringify(j));
                    }
                } catch { resolve(data); }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
        req.write(body);
        req.end();
    });
}

function activate(context) {
    currentModel = getModel();

    // ── Model Status Bar ──
    modelStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    updateModelStatusBar();
    modelStatusBar.command = "heady.selectModel";
    modelStatusBar.show();
    context.subscriptions.push(modelStatusBar);

    // ── Main Status Bar ──
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.text = "$(hubot) Heady AI";
    statusBar.tooltip = "Heady Intelligence Layer — Click to chat";
    statusBar.command = "heady.chat";
    statusBar.show();
    context.subscriptions.push(statusBar);

    // Check health on startup
    const healthUrl = new URL(getApiUrl());
    const healthProto = healthUrl.protocol === 'https:' ? https : http;
    healthProto.get(`${getApiUrl()}/api/pulse`, (res) => {
        statusBar.text = "$(hubot) Heady ✓";
        statusBar.color = "#57F287";
    }).on("error", () => {
        statusBar.text = "$(hubot) Heady ✗";
        statusBar.color = "#ED4245";
    });

    // ── Model Selector Command ──
    context.subscriptions.push(
        vscode.commands.registerCommand("heady.selectModel", async () => {
            const picked = await vscode.window.showQuickPick(HEADY_MODELS.map(m => ({
                ...m,
                description: m.tier === 'premium' ? '⭐ PREMIUM' : m.tier === 'pro' ? '✨ PRO' : '🆓 FREE',
            })), {
                placeHolder: `Current: ${getModel()} — Select a Heady model`,
                title: '🐝 Heady Model Selector',
            });
            if (picked) {
                currentModel = picked.id;
                await vscode.workspace.getConfiguration("heady").update("model", picked.id, true);
                updateModelStatusBar();
                vscode.window.showInformationMessage(`🐝 Switched to ${picked.label}`);
            }
        })
    );

    // ── Chat Command ──
    context.subscriptions.push(
        vscode.commands.registerCommand("heady.chat", async () => {
            const input = await vscode.window.showInputBox({
                prompt: `🐝 Ask Heady (${getModel()})`,
                placeHolder: "What would you like to know?",
            });
            if (!input) return;
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `🐝 ${getModel()} is thinking...`, cancellable: false },
                async () => {
                    try {
                        const res = await callHeady(input);
                        const doc = await vscode.workspace.openTextDocument({ content: res, language: "markdown" });
                        await vscode.window.showTextDocument(doc, { preview: true });
                    } catch (e) {
                        vscode.window.showErrorMessage(`Heady: ${e.message}`);
                    }
                }
            );
        })
    );

    // ── Selection Commands ──
    function registerSelectionCommand(cmdId, tag, label, defaultModel) {
        context.subscriptions.push(
            vscode.commands.registerCommand(cmdId, async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;
                const selection = editor.document.getText(editor.selection);
                if (!selection) return vscode.window.showWarningMessage("Select some text first.");
                const lang = editor.document.languageId;
                const model = defaultModel || getModel();
                await vscode.window.withProgress(
                    { location: vscode.ProgressLocation.Notification, title: `🐝 ${label} (${model})...`, cancellable: false },
                    async () => {
                        try {
                            const res = await callHeady(`${tag} (language: ${lang})\n\n${selection}`, model);
                            const doc = await vscode.workspace.openTextDocument({ content: `# Heady ${label}\n\n${res}`, language: "markdown" });
                            await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: true });
                        } catch (e) {
                            vscode.window.showErrorMessage(`Heady: ${e.message}`);
                        }
                    }
                );
            })
        );
    }

    registerSelectionCommand("heady.explain", "[INTELLIGENCE] Explain this code in detail:", "Explain");
    registerSelectionCommand("heady.refactor", "[CODE TASK] Refactor and improve this code:", "Refactor");
    registerSelectionCommand("heady.battle", "[BATTLE] Validate for regressions, security issues, and quality:", "Battle Validate", "heady-battle-v1");
    registerSelectionCommand("heady.swarm", "[SWARM TASK] Research and provide multiple perspectives on:", "Swarm", "heady-reason");
    registerSelectionCommand("heady.creative", "[CREATIVE] Generate creative alternatives for:", "Creative");
    registerSelectionCommand("heady.audit", "[AUDIT] Security and compliance audit:", "Audit", "heady-reason");
    registerSelectionCommand("heady.simulate", "[SIMULATION] Monte Carlo analysis of:", "Simulate", "heady-battle-v1");

    // ── Sidebar Webview ──
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("heady.chatView", {
            resolveWebviewView(view) {
                view.webview.options = { enableScripts: true };
                view.webview.html = getSidebarHtml();
                view.webview.onDidReceiveMessage(async (msg) => {
                    if (msg.type === "chat") {
                        try {
                            const res = await callHeady(msg.message);
                            view.webview.postMessage({ type: "response", text: res });
                        } catch (e) {
                            view.webview.postMessage({ type: "response", text: `⚠️ ${e.message}` });
                        }
                    }
                });
            },
        })
    );

    vscode.window.showInformationMessage(`🐝 Heady AI activated — Model: ${getModel()} | Ctrl+Shift+H to chat`);
}

function updateModelStatusBar() {
    const model = getModel();
    const m = HEADY_MODELS.find(m => m.id === model);
    modelStatusBar.text = m ? `${m.label}` : `$(beaker) ${model}`;
    modelStatusBar.tooltip = m ? `${m.detail} — Click to change model` : 'Click to select Heady model';
}

function getSidebarHtml() {
    const model = getModel();
    return `<!DOCTYPE html><html><head><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:var(--vscode-font-family);background:var(--vscode-sideBar-background);color:var(--vscode-foreground);display:flex;flex-direction:column;height:100vh;}
    .model-bar{padding:4px 8px;background:var(--vscode-titleBar-activeBackground);font-size:11px;display:flex;align-items:center;justify-content:space-between;}
    .model-name{font-weight:bold;}
    .msgs{flex:1;overflow-y:auto;padding:8px;}
    .msg{margin-bottom:8px;padding:6px 10px;border-radius:6px;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;}
    .msg.bot{background:var(--vscode-textBlockQuote-background);}
    .msg.user{background:var(--vscode-button-background);color:var(--vscode-button-foreground);text-align:right;}
    .input-area{padding:8px;border-top:1px solid var(--vscode-panel-border);}
    .input-area input{width:100%;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:4px;padding:6px 8px;font-size:12px;outline:none;}
    .typing{padding:4px 8px;font-size:11px;color:var(--vscode-descriptionForeground);min-height:16px;}
  </style></head><body>
    <div class="model-bar"><span class="model-name">🐝 ${model}</span></div>
    <div class="msgs" id="msgs"><div class="msg bot">🐝 Heady AI ready (${model}). Type anything to chat.</div></div>
    <div class="typing" id="typing"></div>
    <div class="input-area"><input id="input" placeholder="Ask Heady..." autofocus></div>
    <script>
      const vscode=acquireVsCodeApi();const msgs=document.getElementById('msgs');const input=document.getElementById('input');const typing=document.getElementById('typing');
      function addMsg(t,r){const e=document.createElement('div');e.className='msg '+r;e.textContent=t;msgs.appendChild(e);msgs.scrollTop=msgs.scrollHeight;}
      input.addEventListener('keydown',e=>{if(e.key==='Enter'){const t=input.value.trim();if(!t)return;input.value='';addMsg(t,'user');typing.textContent='🐝 Thinking...';vscode.postMessage({type:'chat',message:t});}});
      window.addEventListener('message',e=>{if(e.data.type==='response'){typing.textContent='';addMsg(e.data.text,'bot');}});
    </script>
  </body></html>`;
}

function deactivate() { }
module.exports = { activate, deactivate };
