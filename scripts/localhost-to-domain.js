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
// ║  FILE: scripts/localhost-to-domain.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const fs = require('fs');
const path = require('path');

const yaml = require('js-yaml');

// Load service-discovery.yaml dynamically
function loadServiceDiscovery() {
  const discoveryPath = path.join(__dirname, '..', 'configs', 'service-discovery.yaml');
  if (!fs.existsSync(discoveryPath)) {
    console.warn('⚠️  service-discovery.yaml not found, using hardcoded mappings');
    return null;
  }
  try {
    const content = fs.readFileSync(discoveryPath, 'utf8');
    return yaml.load(content);
  } catch (err) {
    console.warn(`⚠️  Failed to load service-discovery.yaml: ${err.message}`);
    return null;
  }
}

const serviceDiscovery = loadServiceDiscovery();

const LOCALHOST_PATTERNS = [
  /localhost:?(\d+)?/g,
  /127\.0\.0\.1:?(\d+)?/g,
  /0\.0\.0\.0:?(\d+)?/g,
  /\[::\]:?(\d+)?/g,
  /::1:?(\d+)?/g,
];

// Build replacements from service-discovery.yaml or use hardcoded fallback
function buildReplacements() {
  const replacements = {};
  
  if (serviceDiscovery && serviceDiscovery.services) {
    // Build from YAML
    for (const [serviceName, config] of Object.entries(serviceDiscovery.services)) {
      const patterns = [
        `localhost:${config.port}`,
        `127.0.0.1:${config.port}`,
        `0.0.0.0:${config.port}`,
        `::1:${config.port}`,
      ];
      
      const target = `${config.host}:${config.port}`;
      
      for (const pattern of patterns) {
        replacements[pattern] = target;
      }
      
      // Also map just localhost without port for common services
      if (config.port === 3300) {
        replacements['localhost'] = config.host;
        replacements['127.0.0.1'] = config.host;
      }
    }
  } else {
    // Hardcoded fallback
    Object.assign(replacements, {
      'localhost:3300': 'manager.dev.local.heady.internal:3300',
      '127.0.0.1:3300': 'manager.dev.local.heady.internal:3300',
      '0.0.0.0:3300': 'manager.dev.local.heady.internal:3300',
      'localhost:5432': 'db-postgres.dev.local.heady.internal:5432',
      '127.0.0.1:5432': 'db-postgres.dev.local.heady.internal:5432',
      'localhost:6379': 'db-redis.dev.local.heady.internal:6379',
      '127.0.0.1:6379': 'db-redis.dev.local.heady.internal:6379',
      'localhost:3000': 'app-web.dev.local.heady.internal:3000',
      'https://app.headysystems.com': 'app-web.dev.local.heady.internal:3000',
      'localhost:3001': 'tools-mcp.dev.local.heady.internal:3001',
      'localhost:11434': 'ai-ollama.dev.local.heady.internal:11434',
      'localhost:3301': 'app-buddy.dev.local.heady.internal:3301',
      'localhost:3303': 'io-voice.dev.local.heady.internal:3303',
    });
  }
  
  return replacements;
}

const REPLACEMENTS = buildReplacements();

const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  '__pycache__',
  '.next',
  'dist',
  'build',
  'coverage',
  '.heady_cache',
];

const EXCLUDED_FILES = [
  'service-discovery.yaml',
  'localhost-inventory.json',
  'service-discovery.json',
  'localhost-to-domain.js', // Don't modify this script
  'heady-registry.json', // Preserve registry
];

function shouldProcessFile(filePath) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath);
  
  // Only process certain file types
  const validExts = ['.js', '.ts', '.jsx', '.tsx', '.json', '.yaml', '.yml', '.md', '.html', '.py', '.go', '.sh', '.ps1', '.bat'];
  if (!validExts.includes(ext)) return false;
  
  // Skip excluded files
  if (EXCLUDED_FILES.includes(base)) return false;
  
  // Skip package-lock.json (too large and auto-generated)
  if (base === 'package-lock.json') return false;
  
  return true;
}

function findAndReplace(content, filePath) {
  let modified = content;
  let changes = [];
  
  for (const [oldPattern, newPattern] of Object.entries(REPLACEMENTS)) {
    const regex = new RegExp(oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = modified.match(regex);
    
    if (matches) {
      changes.push({
        file: filePath,
        old: oldPattern,
        new: newPattern,
        count: matches.length,
      });
      modified = modified.replace(regex, newPattern);
    }
  }
  
  return { content: modified, changes };
}

function processDirectory(dir, dryRun = false) {
  const results = {
    processed: 0,
    modified: 0,
    changes: [],
    errors: [],
  };
  
  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.includes(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile() && shouldProcessFile(fullPath)) {
        try {
          results.processed++;
          const content = fs.readFileSync(fullPath, 'utf8');
          const { content: modified, changes } = findAndReplace(content, fullPath);
          
          if (changes.length > 0) {
            results.modified++;
            results.changes.push(...changes);
            
            if (!dryRun) {
              fs.writeFileSync(fullPath, modified, 'utf8');
              console.log(`✅ Updated: ${fullPath}`);
            } else {
              console.log(`🔍 Would update: ${fullPath} (${changes.length} replacements)`);
            }
          }
        } catch (err) {
          results.errors.push({ file: fullPath, error: err.message });
        }
      }
    }
  }
  
  walk(dir);
  return results;
}

function generateHostsFile() {
  const hosts = [
    '# Heady Internal DNS - localhost replacement',
    '# Generated by localhost-to-domain migration tool',
    '',
    '127.0.0.1 manager.dev.local.heady.internal',
    '127.0.0.1 api.dev.local.heady.internal',
    '127.0.0.1 orchestrator.dev.local.heady.internal',
    '',
    '127.0.0.1 db-postgres.dev.local.heady.internal',
    '127.0.0.1 db-redis.dev.local.heady.internal',
    '',
    '127.0.0.1 ai-ollama.dev.local.heady.internal',
    '127.0.0.1 ai-rag.dev.local.heady.internal',
    '127.0.0.1 tools-mcp.dev.local.heady.internal',
    '',
    '127.0.0.1 app-web.dev.local.heady.internal',
    '127.0.0.1 app-buddy.dev.local.heady.internal',
    '127.0.0.1 bridge-browser.dev.local.heady.internal',
    '127.0.0.1 io-voice.dev.local.heady.internal',
    '',
    '127.0.0.1 svc-billing.dev.local.heady.internal',
    '127.0.0.1 svc-telemetry.dev.local.heady.internal',
    '',
    '127.0.0.1 admin-postgres.dev.local.heady.internal',
    '127.0.0.1 admin-redis.dev.local.heady.internal',
    '127.0.0.1 debug-manager.dev.local.heady.internal',
    '',
    '127.0.0.1 discovery.dev.local.heady.internal',
    '127.0.0.1 dns.dev.local.heady.internal',
    '',
    '# Service Catalog Services',
    '127.0.0.1 conductor.dev.local.heady.internal',
    '127.0.0.1 brain.dev.local.heady.internal',
    '127.0.0.1 supervisor.dev.local.heady.internal',
    '127.0.0.1 sync.dev.local.heady.internal',
    '127.0.0.1 autobuild.dev.local.heady.internal',
    '',
    '# Cloud deployments (external, not localhost)',
    '# cloud-me.heady.io - HeadyMe cloud',
    '# cloud-sys.heady.io - HeadySystems cloud',
    '# cloud-conn.heady.io - HeadyConnection cloud',
  ];
  
  return hosts.join('\n');
}

// CLI
const args = process.argv.slice(2);
const command = args[0] || 'help';
const target = args[1] || './distribution';
const dryRun = args.includes('--dry-run') || args.includes('-d');

switch (command) {
  case 'inventory':
    console.log('🔍 Scanning for localhost references...');
    const results = processDirectory(path.resolve(target), true);
    
    console.log('\n📊 Inventory Results:');
    console.log(`  Files processed: ${results.processed}`);
    console.log(`  Files with localhost: ${results.modified}`);
    console.log(`  Total replacements needed: ${results.changes.reduce((sum, c) => sum + c.count, 0)}`);
    
    if (results.changes.length > 0) {
      console.log('\n📝 Changes needed:');
      results.changes.forEach(c => {
        console.log(`  ${c.file}: ${c.old} → ${c.new} (${c.count}x)`);
      });
    }
    break;
    
  case 'migrate':
    if (dryRun) {
      console.log('🔍 Dry run - no changes will be made\n');
    } else {
      console.log('🚀 Migrating localhost to internal domains...\n');
    }
    
    const migrateResults = processDirectory(path.resolve(target), dryRun);
    
    console.log('\n📊 Migration Results:');
    console.log(`  Files processed: ${migrateResults.processed}`);
    console.log(`  Files modified: ${migrateResults.modified}`);
    console.log(`  Total replacements: ${migrateResults.changes.reduce((sum, c) => sum + c.count, 0)}`);
    
    if (!dryRun) {
      console.log('\n✅ Migration complete!');
      console.log('\nNext steps:');
      console.log('  1. Run: node scripts/localhost-to-domain.js hosts > C:\\Windows\\System32\\drivers\\etc\\hosts (admin)');
      console.log('  2. Or manually add entries from hosts file below to your system hosts file');
    }
    break;
    
  case 'hosts':
    console.log(generateHostsFile());
    break;
    
  case 'help':
  default:
    console.log('Usage: node localhost-to-domain.js <command> [target] [options]');
    console.log('');
    console.log('Commands:');
    console.log('  inventory [dir]    Scan for localhost references (dry run)');
    console.log('  migrate [dir]      Replace localhost with domain names');
    console.log('  hosts              Generate hosts file content');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run, -d      Show changes without applying');
    console.log('');
    console.log('Examples:');
    console.log('  node localhost-to-domain.js inventory ./distribution');
    console.log('  node localhost-to-domain.js migrate ./distribution --dry-run');
    console.log('  node localhost-to-domain.js migrate ./src');
    console.log('  node localhost-to-domain.js hosts > hosts.txt');
    break;
}
