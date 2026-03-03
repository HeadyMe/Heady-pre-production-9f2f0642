const fs = require('fs');

const configPath = '/home/headyme/.cloudflared/config.yml';
let config = fs.readFileSync(configPath, 'utf8');

const VERTICALS = [
    'heady-buddy-portal', 'heady-maestro', 'heady-jules', 'heady-observer',
    'heady-builder', 'heady-atlas', 'heady-pythia', 'heady-montecarlo',
    'heady-patterns', 'heady-critique', 'heady-imagine', 'heady-stories',
    'heady-sentinel', 'heady-vinci', 'heady-kinetics', 'heady-metrics',
    'heady-logs', 'heady-traces', 'heady-desktop', 'heady-mobile',
    'heady-chrome', 'heady-vscode', 'heady-jetbrains', 'heady-slack',
    'heady-github-integration'
];

let added = '\n  # ===== VERTICAL NODES =====\n';
let basePort = 9100;

for (const v of VERTICALS) {
    let subdomain = v.replace('heady-', '');
    if (v === 'heady-buddy-portal') subdomain = 'buddy';
    if (v === 'heady-github-integration') subdomain = 'github';

    added += `  - hostname: ${subdomain}.headyio.com\n`;
    added += `    service: http://localhost:${basePort++}\n`;
}

// Find the wildcard catchalls section and insert before it
if (!config.includes('VERTICAL NODES')) {
    config = config.replace('  # ===== WILDCARD CATCH-ALLS =====', added + '\n  # ===== WILDCARD CATCH-ALLS =====');
    fs.writeFileSync(configPath, config);
    console.log('Added verticals to cloudflared config');
} else {
    console.log('Verticals already in cloudflared config');
}
