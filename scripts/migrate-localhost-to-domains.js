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
// ║  FILE: scripts/migrate-localhost-to-domains.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const fs = require('fs');
const path = require('path');
const { replaceInFile } = require('replace-in-file');

const bannedDomains = [
  'onrender.com',
  'vercel.app',
  'netlify.app',
  'herokuapp.com',
  'firebaseapp.com'
];

const config = {
  replacements: [
    { from: 'https://app.headysystems.com', to: 'https://app.headysystems.com' },
    { from: 'https://api.headysystems.com', to: 'https://api.headysystems.com' },
    { from: 'https://app.headysystems.com', to: 'https://app.headysystems.com' },
    { from: 'https://api.headysystems.com', to: 'https://api.headysystems.com' },
    // Enhanced Windows path replacement
    { from: /C:\\\\.*?\\Heady\\/g, to: '<HEADY_PROJECT_ROOT>' },
    ...bannedDomains.map(domain => ({
      from: new RegExp(`https?://[a-zA-Z0-9-]+\.${domain}`, 'g'),
      to: 'https://app.headysystems.com'
    })),
    ...bannedDomains.map(domain => ({
      from: new RegExp(`[a-zA-Z0-9-]+\.${domain}`, 'g'),
      to: 'app.headysystems.com'
    }))
  ],
  files: '**/*.{js,json,yaml,md,html}',
  ignore: ['node_modules/**', 'dist/**', 'build/**']
};

async function migrate() {
  for (const replacement of config.replacements) {
    const options = {
      files: config.files,
      from: replacement.from,
      to: replacement.to,
      ignore: config.ignore
    };
    
    try {
      const results = await replaceInFile(options);
      console.log(`Replaced ${replacement.from} with ${replacement.to}:`);
      console.log(results.join('\n'));
    } catch (error) {
      console.error('Error occurred:', error);
    }
  }
}

migrate();
