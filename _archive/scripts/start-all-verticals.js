const { execSync } = require('child_process');
const VERTICALS = [
  'heady-buddy-portal', 'heady-maestro', 'heady-jules', 'heady-observer', 
  'heady-builder', 'heady-atlas', 'heady-pythia', 'heady-montecarlo', 
  'heady-patterns', 'heady-critique', 'heady-imagine', 'heady-stories', 
  'heady-sentinel', 'heady-vinci', 'heady-kinetics', 'heady-metrics', 
  'heady-logs', 'heady-traces', 'heady-desktop', 'heady-mobile', 
  'heady-chrome', 'heady-vscode', 'heady-jetbrains', 'heady-slack', 
  'heady-github-integration'
];

let basePort = 9100;
for (const v of VERTICALS) {
  const port = basePort++;
  console.log(`Starting ${v} on port ${port}...`);
  try {
    execSync(`pm2 delete vert-${v} 2>/dev/null || true`);
    execSync(`pm2 start npx --name vert-${v} -- serve /home/headyme/sites/${v}/dist -l ${port} -s --no-clipboard`);
  } catch(e) {
    console.error(`Failed to start ${v}: ${e.message}`);
  }
}
execSync('pm2 save');
console.log('All verticals started successfully.');
