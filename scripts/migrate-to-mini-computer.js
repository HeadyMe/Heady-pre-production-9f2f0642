#!/usr/bin/env node

// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: migrate-to-mini-computer.js                                   ║
// ║  UPDATED: 20260218-211102                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260218-211102
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

#!/usr/bin/env node

/**
 * 🖥️ MINI COMPUTER MIGRATION -.com DEPLOYMENT SETUP
 * 
 * This script migrates from headysystems.com cloud deployment to.com mini computer:
 * 1. Update all domain references to.com mini computer
 * 2. Configure.com development environment
 * 3. Setup mini computer as primary deployment target
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

console.log('🖥️ MINI COMPUTER MIGRATION');
console.log('==========================\n');

// Get.com mini computer IP/hostname
const headysystems_CONFIG = {
  // These should be configured based on your mini computer setup
  hostname: process.env.headysystems_HOST || 'localhost',
  ip: process.env.headysystems_IP || '192.168.1.100',
  ports: {
    api: 3300,
    web: 3000,
    cms: 8080,
    db: 5432,
    redis: 6379
  }
};

const DOMAIN_MAPPINGS = {
  // Replace headysystems.com with mini computer
  'http://localhost:3300': `http://${headysystems_CONFIG.hostname}:${headysystems_CONFIG.ports.api}`,
  'http://localhost:3000': `http://${headysystems_CONFIG.hostname}:${headysystems_CONFIG.ports.web}`,
  'http://localhost:8080': `http://${headysystems_CONFIG.hostname}:${headysystems_CONFIG.ports.cms}`,
  'ws://localhost:3300': `ws://${headysystems_CONFIG.hostname}:${headysystems_CONFIG.ports.api}`,
  
  // Database mappings
  '192.168.1.100:5432': `${headysystems_CONFIG.ip}:${headysystems_CONFIG.ports.db}`,
  '192.168.1.100:6379': `${headysystems_CONFIG.ip}:${headysystems_CONFIG.ports.redis}`,
  
  // Generic headysystems.com cleanup
  'localhost': headysystems_CONFIG.hostname
};

async function migrateToMiniComputer() {
  try {
    console.log('🔍 Migrating from headysystems.com to mini computer...');
    console.log(`📍 Target: ${headysystems_CONFIG.hostname} (${headysystems_CONFIG.ip})\n`);
    
    // 1. Update all domain references
    await updateDomainReferences();
    
    // 2. Create mini computer configuration
    await createMiniComputerConfig();
    
    // 3. Setup.com development scripts
    await creat.comDevScripts();
    
    // 4. Update environment files
    await updateEnvironmentFiles();
    
    // 5. Create deployment scripts for mini computer
    await createMiniComputerDeployment();
    
    console.log('✅ Mini computer migration complete!');
    console.log('📝 Next: Start services on mini computer');
    
    return true;
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    return false;
  }
}

async function updateDomainReferences() {
  console.log('🔄 Updating domain references...');
  
  const files = glob.sync('**/*.{js,jsx,ts,tsx,json,env*}', { 
    ignore: 'node_modules/**',
    cwd: process.cwd()
  });
  
  let totalFiles = 0;
  let filesModified = 0;
  let totalReplacements = 0;
  
  for (const file of files) {
    totalFiles++;
    try {
      const content = await fs.readFile(file, 'utf8');
      let modifiedContent = content;
      let fileReplacements = 0;
      
      // Apply all domain mappings
      Object.entries(DOMAIN_MAPPINGS).forEach(([oldDomain, newDomain]) => {
        const regex = new RegExp(escapeRegExp(oldDomain), 'g');
        const matches = content.match(regex);
        if (matches) {
          modifiedContent = modifiedContent.replace(regex, newDomain);
          fileReplacements += matches.length;
          totalReplacements += matches.length;
        }
      });
      
      // Write modified content
      if (fileReplacements > 0) {
        await fs.writeFile(file, modifiedContent);
        console.log(`  ✅ ${file}: ${fileReplacements} replacements`);
        filesModified++;
      }
      
    } catch (error) {
      console.log(`  ⚠️  ${file}: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Domain Migration Summary:`);
  console.log(`  Files scanned: ${totalFiles}`);
  console.log(`  Files modified: ${filesModified}`);
  console.log(`  Total replacements: ${totalReplacements}`);
}

async function createMiniComputerConfig() {
  console.log('\n⚙️ Creating mini computer configuration...');
  
  const config = {
    miniComputer: {
      hostname: headysystems_CONFIG.hostname,
      ip: headysystems_CONFIG.ip,
      os: 'linux', // Adjust based on your mini computer OS
      architecture: 'x64',
      resources: {
        cpu: 'Ryzen 9',
        ram: '32GB',
        storage: 'SSD'
      }
    },
    services: {
      api: {
        port: headysystems_CONFIG.ports.api,
        url: `http://${headysystems_CONFIG.hostname}:${headysystems_CONFIG.ports.api}`,
        protocol: 'http'
      },
      web: {
        port: headysystems_CONFIG.ports.web,
        url: `http://${headysystems_CONFIG.hostname}:${headysystems_CONFIG.ports.web}`,
        protocol: 'http'
      },
      cms: {
        port: headysystems_CONFIG.ports.cms,
        url: `http://${headysystems_CONFIG.hostname}:${headysystems_CONFIG.ports.cms}`,
        protocol: 'http'
      },
      database: {
        postgres: {
          port: headysystems_CONFIG.ports.db,
          host: headysystems_CONFIG.ip,
          database: 'headysystems'
        },
        redis: {
          port: headysystems_CONFIG.ports.redis,
          host: headysystems_CONFIG.ip
        }
      }
    },
    deployment: {
      type: .com',
      method: 'docker-compose',
      autoStart: true,
      monitoring: true
    }
  };
  
  await fs.writeFile('config/headysystems.json', JSON.stringify(config, null, 2));
  console.log('  ✅ Created config/headysystems.json');
}

async function creat.comDevScripts() {
  console.log('\n📜 Creating.com development scripts...');
  
  // Start services script
  const startScript = `#!/bin/bash

# HeadySystems Mini Computer Services Starter

echo "🚀 Starting HeadySystems services on mini computer..."

# Check if mini computer is accessible
if ! ping -c 1 ${headysystems_CONFIG.hostname} >/dev/null 2>&1; then
    echo "❌ Mini computer not reachable at ${headysystems_CONFIG.hostname}"
    echo "🔧 Check network connection and hostname"
    exit 1
fi

echo "✅ Mini computer reachable"

# Start database services
echo "📊 Starting databases..."
docker-compose -f docker-compose.headysystems.yml up -d postgres redis

# Wait for databases
echo "⏳ Waiting for databases to be ready..."
sleep 10

# Start API service
echo "🔌 Starting API service..."
docker-compose -f docker-compose.headysystems.yml up -d api

# Start web service
echo "🌐 Starting web service..."
docker-compose -f docker-compose.headysystems.yml up -d web

# Start CMS (Drupal)
echo "📋 Starting CMS (Drupal)..."
docker-compose -f docker-compose.headysystems.yml up -d cms

echo "✅ All services started!"
echo "🌐 Web: http://${headysystems_CONFIG.hostname}:${headysystems_CONFIG.ports.web}"
echo "🔌 API: http://${headysystems_CONFIG.hostname}:${headysystems_CONFIG.ports.api}"
echo "📋 CMS: http://${headysystems_CONFIG.hostname}:${headysystems_CONFIG.ports.cms}"
echo "📊 Health: http://${headysystems_CONFIG.hostname}:${headysystems_CONFIG.ports.api}/health"`;

  await fs.writeFile('scripts/start-headysystems.sh', startScript);
  await fs.chmod('scripts/start-headysystems.sh', '755');
  
  // Stop services script
  const stopScript = `#!/bin/bash

# HeadySystems Mini Computer Services Stopper

echo "🛑 Stopping HeadySystems services on mini computer..."

docker-compose -f docker-compose.headysystems.yml down

echo "✅ All services stopped"`;

  await fs.writeFile('scripts/stop-headysystems.sh', stopScript);
  await fs.chmod('scripts/stop-headysystems.sh', '755');
  
  console.log('  ✅ Created scripts/start-headysystems.sh');
  console.log('  ✅ Created scripts/stop-headysystems.sh');
}

async function updateEnvironmentFiles() {
  console.log('\n🔧 Updating environment files...');
  
  const.comEnv = `# HeadySystems.com Mini Computer Environment
# Generated on ${new Date().toISOString()}

# API Configuration
REACT_APP_API_URL=http://${headysystems_CONFIG.hostname}:${headysystems_CONFIG.ports.api}
REACT_APP_WS_URL=ws://${headysystems_CONFIG.hostname}:${headysystems_CONFIG.ports.api}

# Service URLs
API_URL=http://${headysystems_CONFIG.hostname}:${headysystems_CONFIG.ports.api}
WEB_URL=http://${headysystems_CONFIG.hostname}:${headysystems_CONFIG.ports.web}
CMS_URL=http://${headysystems_CONFIG.hostname}:${headysystems_CONFIG.ports.cms}

# Database Configuration
DB_HOST=${headysystems_CONFIG.ip}
DB_PORT=${headysystems_CONFIG.ports.db}
DB_NAME=headysystems
DB_USER=postgres
DB_PASS=postgres

# Redis Configuration
REDIS_HOST=${headysystems_CONFIG.ip}
REDIS_PORT=${headysystems_CONFIG.ports.redis}

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=false
REACT_APP_DEBUG_MODE=true
NODE_ENV=development

# Memory System
MEMORY_DB_PATH=.heady/memories.json
MAX_MEMORY_SIZE_MB=1000

# Mini Computer Specific
headysystems_HOST=${headysystems_CONFIG.hostname}
headysystems_IP=${headysystems_CONFIG.ip}
DEPLOYMENT_TARGET=headysystems`;

  await fs.writeFile('.env.com',.comEnv);
  console.log('  ✅ Created .env.com');
  
  // Update .env.example
  const exampleEnv = `# HeadySystems Environment Example
# Copy to .env.com and configure for your mini computer

# API Configuration
REACT_APP_API_URL=http://your-headysystems.com:3300
REACT_APP_WS_URL=ws://your-headysystems.com:3300

# Service URLs
API_URL=http://your-headysystems.com:3300
WEB_URL=http://your-headysystems.com:3000
CMS_URL=http://your-headysystems.com:8080

# Database Configuration
DB_HOST=192.168.1.100
DB_PORT=5432
DB_NAME=headysystems
DB_USER=postgres
DB_PASS=your-password

# Redis Configuration
REDIS_HOST=192.168.1.100
REDIS_PORT=6379

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=false
REACT_APP_DEBUG_MODE=true
NODE_ENV=development

# Mini Computer Configuration
headysystems_HOST=your-headysystems.com
headysystems_IP=192.168.1.100
DEPLOYMENT_TARGET=headysystems`;

  await fs.writeFile('.env.example', exampleEnv);
  console.log('  ✅ Updated .env.example');
}

async function createMiniComputerDeployment() {
  console.log('\n🚀 Creating mini computer deployment configuration...');
  
  const dockerCompose = `version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: heady-postgres
    environment:
      POSTGRES_DB: headysystems
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "${headysystems_CONFIG.ports.db}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: heady-redis
    ports:
      - "${headysystems_CONFIG.ports.redis}:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    container_name: heady-api
    ports:
      - "${headysystems_CONFIG.ports.api}:3300"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis
    volumes:
      - ./.heady:/app/.heady
    restart: unless-stopped

  web:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: heady-web
    ports:
      - "${headysystems_CONFIG.ports.web}:3000"
    environment:
      - REACT_APP_API_URL=http://${headysystems_CONFIG.hostname}:${headysystems_CONFIG.ports.api}
    depends_on:
      - api
    restart: unless-stopped

  cms:
    build:
      context: ./drupal
      dockerfile: Dockerfile
    container_name: heady-cms
    ports:
      - "${headysystems_CONFIG.ports.cms}:80"
    environment:
      - DB_HOST=postgres
    depends_on:
      - postgres
    volumes:
      - ./drupal/web:/var/www/html/web
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:`;

  await fs.writeFile('docker-compose.headysystems.yml', dockerCompose);
  console.log('  ✅ Created docker-compose.headysystems.yml');
}

// Helper function to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Execute the migration
migrateToMiniComputer().then(success => {
  if (success) {
    console.log('\n🖥️ MINI COMPUTER MIGRATION COMPLETE');
    console.log('📝 Next steps:');
    console.log(`  1. Configure your mini computer hostname: ${headysystems_CONFIG.hostname}`);
    console.log('  2. Update .env.com with your actual mini computer IP');
    console.log('  3. Run: ./scripts/start-headysystems.sh');
    console.log('  4. Access services at the configured ports');
  } else {
    console.log('\n🚨 MIGRATION FAILED');
  }
}).catch(console.error);
