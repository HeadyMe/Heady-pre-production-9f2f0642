/**
 * ═══════════════════════════════════════════════════════════════
 * UI-002: SandboxedComponent — Safe AI-generated UI execution
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * ═══════════════════════════════════════════════════════════════
 *
 * Wraps AI-generated UI components in a sandboxed iframe with
 * CSP restrictions and message-passing communication.
 */

'use strict';

class SandboxedComponent {
    /**
     * Create a sandboxed HTML document from generated component
     */
    static createSandbox(component, options = {}) {
        const { html, css, js } = component;
        const allowScripts = options.allowScripts !== false;
        const theme = options.theme || 'dark';

        const csp = [
            "default-src 'none'",
            "style-src 'unsafe-inline'",
            allowScripts ? "script-src 'unsafe-inline'" : "script-src 'none'",
            "img-src data: https:",
            "font-src https://fonts.gstatic.com",
        ].join('; ');

        return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --heady-bg: ${theme === 'dark' ? '#0f0f23' : '#ffffff'};
      --heady-surface: ${theme === 'dark' ? '#1a1a2e' : '#f8f9fa'};
      --heady-text: ${theme === 'dark' ? '#e0e0e0' : '#1a1a2e'};
      --heady-text-secondary: ${theme === 'dark' ? '#94a3b8' : '#64748b'};
      --heady-primary: #6366f1;
      --heady-accent: #22d3ee;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--heady-bg);
      color: var(--heady-text);
      padding: 16px;
    }
    ${css || ''}
  </style>
</head>
<body>
  ${html || '<p>No component generated</p>'}
  ${allowScripts && js ? `<script>${js}</script>` : ''}
  <script>
    // Communicate with parent via postMessage
    window.addEventListener('message', function(event) {
      if (event.data.type === 'heady:update') {
        // Handle updates from parent
        const el = document.getElementById(event.data.targetId);
        if (el) el.textContent = event.data.value;
      }
    });

    // Notify parent that sandbox is ready
    window.parent.postMessage({ type: 'heady:sandbox:ready', id: '${component.id || 'unknown'}' }, '*');
  </script>
</body>
</html>`;
    }

    /**
     * Generate an iframe embedding string for the sandboxed component
     */
    static createIframe(component, options = {}) {
        const sandbox = this.createSandbox(component, options);
        const blob = `data:text/html;charset=utf-8,${encodeURIComponent(sandbox)}`;

        return `<iframe
  src="${blob}"
  sandbox="allow-scripts"
  style="width: ${options.width || '100%'}; height: ${options.height || '400px'}; border: none; border-radius: 12px;"
  title="Heady Generated Component: ${component.id || 'unknown'}"
  loading="lazy"
></iframe>`;
    }

    /**
     * Validate component safety
     */
    static validate(component) {
        const issues = [];

        // Check for dangerous patterns
        if (component.js) {
            const dangerous = [/eval\s*\(/, /Function\s*\(/, /document\.cookie/, /localStorage/, /fetch\s*\(/];
            for (const pattern of dangerous) {
                if (pattern.test(component.js)) {
                    issues.push(`Potentially dangerous JS pattern: ${pattern.source}`);
                }
            }
        }

        if (component.html) {
            if (/<script[^>]*src/i.test(component.html)) {
                issues.push('External script loading detected');
            }
            if (/on\w+\s*=/i.test(component.html)) {
                issues.push('Inline event handlers detected');
            }
        }

        return {
            safe: issues.length === 0,
            issues,
            component: component.id,
        };
    }
}

if (require.main === module) {
    const { GenerativeUIEngine } = require('./generative-engine');

    const engine = new GenerativeUIEngine();

    engine.generate('status dashboard with live metrics').then(component => {
        console.log('═══ Sandboxed Component ═══\n');

        const validation = SandboxedComponent.validate(component);
        console.log('Validation:', validation);

        const sandboxHtml = SandboxedComponent.createSandbox(component);
        console.log(`Sandbox HTML: ${sandboxHtml.length} chars`);

        const iframe = SandboxedComponent.createIframe(component);
        console.log(`Iframe: ${iframe.length} chars`);

        console.log('✅ SandboxedComponent operational');
    });
}

module.exports = { SandboxedComponent };
