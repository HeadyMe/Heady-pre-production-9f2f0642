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
// ║  FILE: scripts/migrate-config-paths.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const { replaceInFile } = require('replace-in-file');

const replacements = [
  { from: 'configs/domains/cloudflare-tunnel.yaml', to: 'configs/domains/cloudflare-tunnel.yaml' },
  { from: 'configs/domains/service-discovery.yaml', to: 'configs/domains/service-discovery.yaml' },
  { from: 'configs/protocols/aloha-protocol.yaml', to: 'configs/protocols/aloha-protocol.yaml' },
  { from: 'configs/workflows/heady-intent-routing.md', to: 'configs/workflows/heady-intent-routing.md' },
  { from: 'configs/workflows/clean-build.yml', to: 'configs/workflows/clean-build.yml' },
];

async function migrate() {
  for (const replacement of replacements) {
    try {
      const results = await replaceInFile({
        files: '**/*.{js,json,yaml,md}',
        from: replacement.from,
        to: replacement.to,
        ignore: ['node_modules/**', 'dist/**']
      });
      console.log(`Replaced ${replacement.from} with ${replacement.to}:`);
      console.log(results.join('\n'));
    } catch (error) {
      console.error(`Error replacing ${replacement.from}:`, error);
    }
  }
}

migrate();
