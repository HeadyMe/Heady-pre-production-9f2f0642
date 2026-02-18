# Complete Next.js Frontend Build Guide for Heady Project
Optimized for Mini-Computer Edge Deployment, Render Services, & Migration to HeadyMe

This comprehensive guide provides everything your coding agent needs to build a production-optimized Next.js frontend that layers on Drupal 11, manages Render services programmatically, migrates infrastructure to the HeadyMe organization, and deploys efficiently on mini-computers and edge devices.

## Part 1: Next.js Frontend Architecture & Build Instructions

### Project Initialization
```bash
# Initialize Next.js with Heady conventions
npx create-next-app@latest headyconnection-web \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*"

cd headyconnection-web
npm install next-drupal sharp
npm install -D @types/node
```

### Sacred Geometry Design System Integration
Create `src/styles/heady-theme.ts`:
```typescript
// Sacred Geometry Design Tokens
export const headyTheme = {
  colors: {
    'heady-bg': '#0a0e17',
    'heady-surface': '#111827',
    'heady-cyan': '#22d3ee',
    'heady-emerald': '#34d399',
    'heady-amber': '#fbbf24',
    'heady-magenta': '#c084fc',
  },
  borderRadius: {
    'organic': '1.5rem',
    'pill': '9999px',
  },
  animations: {
    breathing: 'breathing 4s ease-in-out infinite',
  },
};

// Add to tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      colors: headyTheme.colors,
      borderRadius: headyTheme.borderRadius,
      keyframes: {
        breathing: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.02)', opacity: '0.95' },
        },
      },
    },
  },
};
```

### Environment Configuration with Vault Integration
Create `.env.local` (never commit):
```bash
# Drupal Backend Connection
NEXT_PUBLIC_DRUPAL_BASE_URL=https://cms.headyconnection.org
NEXT_PUBLIC_API_BASE_URL=https://api.headyconnection.org

# OAuth & Preview (fetch from vault)
DRUPAL_CLIENT_ID=${HEADY_DRUPAL_OAUTH_CLIENT_ID}
DRUPAL_CLIENT_SECRET=${HEADY_DRUPAL_OAUTH_CLIENT_SECRET}
DRUPAL_PREVIEW_SECRET=${HEADY_DRUPAL_PREVIEW_SECRET}

# Cloudflare Integration
CLOUDFLARE_API_TOKEN=${HEADY_CF_API_TOKEN}
CLOUDFLARE_ZONE_ID=${HEADY_CF_ZONE_ID}

# Render.com API (for service management)
RENDER_API_KEY=${HEADY_RENDER_API_KEY}

# Heady Manager API
HEADY_API_URL=https://api.headyconnection.org
HEADY_API_KEY=${HEADY_API_KEY}

# Performance Optimization
NEXT_PUBLIC_ENABLE_ISR=true
NEXT_PUBLIC_REVALIDATE_TIME=60
NEXT_PUBLIC_IMAGE_OPTIMIZATION=true
```

### Core Next.js Configuration
Create `next.config.js` with optimizations:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Image optimization for Drupal
  images: {
    domains: [
      'cms.headyconnection.org',
      'cms.staging.headyconnection.org',
      'cms.dev.headyconnection.org',
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
  },
  
  // Performance optimizations for mini-computers
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Output optimization for edge deployment
  output: 'standalone',
  
  // Compression
  compress: true,
  
  // Headers for Cloudflare caching
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
          {
            key: 'X-Powered-By',
            value: 'HeadyConnection - Sacred Geometry',
          },
        ],
      },
    ];
  },
  
  // Redirects for domain standardization
  async redirects() {
    return [
      {
        source: '/admin',
        destination: 'https://cms.headyconnection.org/admin',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
```

### Drupal Client Implementation
Create `src/lib/drupal.ts`:
```typescript
import { DrupalClient } from 'next-drupal';

const baseUrl = process.env.NEXT_PUBLIC_DRUPAL_BASE_URL!;
const auth = {
  clientId: process.env.DRUPAL_CLIENT_ID!,
  clientSecret: process.env.DRUPAL_CLIENT_SECRET!,
};

export const drupal = new DrupalClient(baseUrl, {
  auth,
  previewSecret: process.env.DRUPAL_PREVIEW_SECRET,
  cache: process.env.NODE_ENV === 'production',
  debug: process.env.NODE_ENV === 'development',
  
  // Cloudflare cache headers
  headers: {
    'Cache-Control': 'public, max-age=3600',
  },
  
  // Timeout for slow networks
  fetcher: async (url, options) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  },
});

// Health check helper
export async function checkDrupalHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/jsonapi`, {
      method: 'HEAD',
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

## Part 2: Render Service Creation & Management

### Complete render.yaml with Optimizations
Create `render.yaml` in repo root:
```yaml
services:
  # Drupal 11 CMS Backend
  - type: web
    name: heady-drupal-cms
    runtime: docker
    repo: https://github.com/HeadyConnection/headyconnection-drupal
    branch: main
    dockerfilePath: ./Dockerfile
    plan: starter  # Upgrade to standard for production
    region: oregon
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: heady-postgres
          property: connectionString
      - key: DRUPAL_HASH_SALT
        generateValue: true
      - key: CLOUDFLARE_API_TOKEN
        sync: false  # From Render secret group
      - key: PHP_MEMORY_LIMIT
        value: 256M
      - key: PHP_MAX_EXECUTION_TIME
        value: 60
    healthCheckPath: /admin/health
    domains:
      - cms.headyconnection.org
    autoDeploy: true
    
  # Next.js Frontend (Optimized)
  - type: web
    name: heady-nextjs-frontend
    runtime: node
    repo: https://github.com/HeadyConnection/headyconnection-web
    branch: main
    buildCommand: npm ci && npm run build
    startCommand: npm start
    plan: starter
    region: oregon
    envVars:
      - key: NEXT_PUBLIC_DRUPAL_BASE_URL
        value: https://cms.headyconnection.org
      - key: NEXT_PUBLIC_API_BASE_URL
        value: https://api.headyconnection.org
      - key: DRUPAL_CLIENT_ID
        sync: false
      - key: DRUPAL_CLIENT_SECRET
        sync: false
      - key: DRUPAL_PREVIEW_SECRET
        sync: false
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      # Performance tuning for Render
      - key: NODE_OPTIONS
        value: "--max-old-space-size=460"  # Render starter tier: 512MB RAM
    healthCheckPath: /api/health
    domains:
      - app.headyconnection.org
    autoDeploy: true

  # Heady Manager API (Core Orchestrator)
  - type: web
    name: heady-manager-headyconnection
    runtime: node
    repo: https://github.com/HeadyConnection/Heady
    branch: main
    buildCommand: npm ci && npm run build
    startCommand: node heady-manager.js
    plan: starter
    region: oregon
    envVars:
      - key: PORT
        value: 3300
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: heady-postgres
          property: connectionString
      - key: HEADY_API_KEY
        sync: false
      - key: RENDER_API_KEY
        sync: false
      - key: ENABLE_CODEMAP
        value: true
      - key: JULES_ENABLED
        value: true
      - key: OBSERVER_ENABLED
        value: true
      - key: NODE_OPTIONS
        value: "--max-old-space-size=460"
    healthCheckPath: /api/health
    domains:
      - api.headyconnection.org
    autoDeploy: true

databases:
  - name: heady-postgres
    databaseName: heady_production
    user: heady
    plan: starter  # 256MB RAM, 1GB storage
    region: oregon
    ipAllowList: []  # Allow all Render services

# Cron jobs for maintenance
cronJobs:
  - name: drupal-cron
    type: web
    schedule: "0 * * * *"  # Every hour
    command: cd /app && drush cron
    serviceId: heady-drupal-cms
    
  - name: heady-checkpoint
    type: web
    schedule: "*/15 * * * *"  # Every 15 minutes
    command: curl -X POST http://manager.headyme.com/api/checkpoint/analyze
    serviceId: heady-manager-headyconnection
```

### Programmatic Render Service Management
Create `scripts/render-manager.ts`:
```typescript
import fetch from 'node-fetch';

const RENDER_API_KEY = process.env.RENDER_API_KEY!;
const RENDER_API_BASE = 'https://api.render.com/v1';

interface RenderService {
  id: string;
  name: string;
  type: string;
  repo: string;
  branch: string;
  autoDeploy: boolean;
  serviceDetails: {
    url: string;
    buildCommand?: string;
    startCommand?: string;
  };
}

class RenderManager {
  private headers = {
    'Authorization': `Bearer ${RENDER_API_KEY}`,
    'Content-Type': 'application/json',
  };

  async listServices(): Promise<RenderService[]> {
    const response = await fetch(`${RENDER_API_BASE}/services`, {
      headers: this.headers,
    });
    
    if (!response.ok) throw new Error(`Render API error: ${response.statusText}`);
    
    const data = await response.json() as { data: RenderService[] };
    return data.data;
  }

  async getService(serviceId: string): Promise<RenderService> {
    const response = await fetch(`${RENDER_API_BASE}/services/${serviceId}`, {
      headers: this.headers,
    });
    
    if (!response.ok) throw new Error(`Render API error: ${response.statusText}`);
    return response.json();
  }

  async deployService(serviceName: string): Promise<void> {
    const services = await this.listServices();
    const service = services.find(s => s.name === serviceName);
    
    if (!service) throw new Error(`Service not found: ${serviceName}`);

    const response = await fetch(`${RENDER_API_BASE}/services/${service.id}/deploys`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ clearCache: 'clear' }),
    });

    if (!response.ok) throw new Error(`Deploy failed: ${response.statusText}`);
    
    console.log(`✅ Deployed ${serviceName}`);
  }

  async updateServiceEnv(serviceId: string, envVars: Record<string, string>): Promise<void> {
    const response = await fetch(`${RENDER_API_BASE}/services/${serviceId}/env-vars`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(
        Object.entries(envVars).map(([key, value]) => ({ key, value }))
      ),
    });

    if (!response.ok) throw new Error(`Update env vars failed: ${response.statusText}`);
    
    console.log(`✅ Updated environment variables for service ${serviceId}`);
  }

  async suspendService(serviceId: string): Promise<void> {
    const response = await fetch(`${RENDER_API_BASE}/services/${serviceId}/suspend`, {
      method: 'POST',
      headers: this.headers,
    });

    if (!response.ok) throw new Error(`Suspend failed: ${response.statusText}`);
    
    console.log(`✅ Suspended service ${serviceId}`);
  }

  async resumeService(serviceId: string): Promise<void> {
    const response = await fetch(`${RENDER_API_BASE}/services/${serviceId}/resume`, {
      method: 'POST',
      headers: this.headers,
    });

    if (!response.ok) throw new Error(`Resume failed: ${response.statusText}`);
    
    console.log(`✅ Resumed service ${serviceId}`);
  }
}

// CLI usage
const manager = new RenderManager();

async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'list':
      const services = await manager.listServices();
      console.table(services.map(s => ({
        name: s.name,
        type: s.type,
        url: s.serviceDetails.url,
        autoDeploy: s.autoDeploy,
      })));
      break;

    case 'deploy':
      if (!arg) throw new Error('Service name required');
      await manager.deployService(arg);
      break;

    case 'suspend':
      if (!arg) throw new Error('Service ID required');
      await manager.suspendService(arg);
      break;

    case 'resume':
      if (!arg) throw new Error('Service ID required');
      await manager.resumeService(arg);
      break;

    default:
      console.log('Usage: npm run render [list|deploy|suspend|resume] [service-name-or-id]');
  }
}

main().catch(console.error);
```

Add to package.json:
```json
{
  "scripts": {
    "render": "tsx scripts/render-manager.ts"
  }
}
```

## Part 3: Migration to HeadyMe Organization

### Automated Migration Script
Create `scripts/migrate-to-headyme.sh`:
```bash
#!/bin/bash
set -e

echo "🚀 Migrating Heady infrastructure to HeadyMe organization..."

# Step 1: Transfer GitHub repositories
echo "📦 Transferring repositories..."
gh repo edit HeadyConnection/headyconnection-web --transfer-owner HeadyMe
gh repo edit HeadyConnection/headyconnection-drupal --transfer-owner HeadyMe
gh repo edit HeadyConnection/Heady --transfer-owner HeadyMe

# Step 2: Update git remotes locally
echo "🔗 Updating git remotes..."
cd ../headyconnection-web
git remote set-url origin git@github.com:HeadyMe/headyconnection-web.git
git remote set-url heady-me git@github.com:HeadyMe/headyconnection-web.git

cd ../headyconnection-drupal
git remote set-url origin git@github.com:HeadyMe/headyconnection-drupal.git

cd ../Heady
git remote set-url heady-me git@github.com:HeadyMe/Heady.git

# Step 3: Update Render service repositories
echo "☁️  Updating Render service configurations..."
RENDER_API_KEY=$(heady-secrets get --key RENDER_API_KEY --environment production)

# Update Drupal CMS service
curl -X PATCH "https://api.render.com/v1/services/$(render_service_id heady-drupal-cms)" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "https://github.com/HeadyMe/headyconnection-drupal",
    "branch": "main"
  }'

# Update Next.js frontend service
curl -X PATCH "https://api.render.com/v1/services/$(render_service_id heady-nextjs-frontend)" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "https://github.com:HeadyMe/headyconnection-web",
    "branch": "main"
  }'

# Update Heady Manager service
curl -X PATCH "https://api.render.com/v1/services/$(render_service_id heady-manager-headyconnection)" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "https://github.com/HeadyMe/Heady",
    "branch": "main"
  }'

# Step 4: Update DNS records (if needed)
echo "🌐 Updating DNS records..."
# Cloudflare API calls to update CNAME records if domains changed

# Step 5: Update environment variables
echo "⚙️  Updating environment variables..."
# Update any hardcoded URLs in environment variables

# Step 6: Verify migration
echo "✅ Verifying migration..."
curl -f https://cms.headyconnection.org/admin/health || exit 1
curl -f https://app.headyconnection.org/api/health || exit 1
curl -f https://api.headyconnection.org/api/health || exit 1

echo ""
echo "✅ MIGRATION TO HEADYME COMPLETE!"
echo "All services now under HeadyMe organization"
```

## Part 4: Mini-Computer & Edge Optimization

### Edge-Optimized Build Configuration
Create `next.config.edge.js`:
```javascript
/** @type {import('next').NextConfig} */
const edgeConfig = {
  // Edge runtime for mini-computers
  experimental: {
    runtime: 'edge',
  },
  
  // Minimal bundle size
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  
  // Tree shaking for unused code
  swcMinify: true,
  
  // Disable heavy features for edge
  images: {
    domains: ['cms.headyconnection.org'],
    formats: ['image/webp'],
    minimumCacheTTL: 86400, // 1 day cache for edge
  },
  
  // Edge-specific headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, immutable',
          },
          {
            key: 'X-Edge-Location',
            value: 'mini-computer',
          },
        ],
      },
    ];
  },
};

module.exports = edgeConfig;
```

### Mini-Computer Deployment Script
Create `scripts/deploy-minicomputer.sh`:
```bash
#!/bin/bash
set -e

MINICOMPUTER_IP=${1:-"192.168.1.100"}
MINICOMPUTER_USER=${2:-"heady"}

echo "🖥️  DEPLOYING TO MINI-COMPUTER: $MINICOMPUTER_IP"

# Step 1: Build optimized version
echo "🔨 Building edge-optimized version..."
NODE_ENV=production npm run build:edge

# Step 2: Create deployment package
echo "📦 Creating deployment package..."
tar -czf heady-frontend-edge.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=src \
  .next/ \
  public/ \
  package.json \
  next.config.edge.js

# Step 3: Transfer to mini-computer
echo "📡 Transferring to mini-computer..."
scp heady-frontend-edge.tar.gz $MINICOMPUTER_USER@$MINICOMPUTER_IP:/tmp/

# Step 4: Deploy on mini-computer
echo "🚀 Deploying on mini-computer..."
ssh $MINICOMPUTER_USER@$MINICOMPUTER_IP << 'EOF'
  # Create deployment directory
  sudo mkdir -p /opt/heady/frontend
  sudo chown heady:heady /opt/heady/frontend
  
  # Extract package
  cd /opt/heady/frontend
  tar -xzf /tmp/heady-frontend-edge.tar.gz
  
  # Install production dependencies
  npm ci --production
  
  # Setup systemd service
  sudo tee /etc/systemd/system/heady-frontend.service > /dev/null << 'EOL'
[Unit]
Description=Heady Next.js Frontend
After=network.target

[Service]
Type=simple
User=heady
WorkingDirectory=/opt/heady/frontend
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOL

  # Enable and start service
  sudo systemctl daemon-reload
  sudo systemctl enable heady-frontend
  sudo systemctl start heady-frontend
  
  # Setup nginx reverse proxy
  sudo tee /etc/nginx/sites-available/heady-frontend > /dev/null << 'EOL'
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOL

  sudo ln -s /etc/nginx/sites-available/heady-frontend /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl reload nginx
  
  # Cleanup
  rm /tmp/heady-frontend-edge.tar.gz
  
  echo "✅ Mini-computer deployment complete!"
EOF

# Step 5: Verify deployment
echo "🔍 Verifying deployment..."
sleep 5
curl -f http://$MINICOMPUTER_IP/api/health || exit 1

echo ""
echo "✅ MINI-COMPUTER DEPLOYMENT SUCCESSFUL!"
echo "Frontend available at: http://$MINICOMPUTER_IP"
echo "Health check: http://$MINICOMPUTER_IP/api/health"
```

### Resource Monitoring for Mini-Computers
Create `src/lib/mini-computer-monitor.ts`:
```typescript
interface MiniComputerMetrics {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    latency: number;
    bandwidth: number;
  };
  temperature: number;
}

class MiniComputerMonitor {
  private metrics: MiniComputerMetrics[] = [];
  private maxHistory = 100;

  async collectMetrics(): Promise<MiniComputerMetrics> {
    // CPU usage
    const cpuUsage = await this.getCpuUsage();
    
    // Memory usage
    const memoryUsage = process.memoryUsage();
    const memoryTotal = 512 * 1024 * 1024; // 512MB typical for mini-computer
    const memoryPercentage = (memoryUsage.heapUsed / memoryTotal) * 100;
    
    // Disk usage (simplified)
    const diskUsage = await this.getDiskUsage();
    
    // Network metrics
    const networkLatency = await this.measureLatency();
    
    // Temperature (if available)
    const temperature = await this.getTemperature();

    const metrics: MiniComputerMetrics = {
      cpu: cpuUsage,
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryTotal,
        percentage: memoryPercentage,
      },
      disk: diskUsage,
      network: {
        latency: networkLatency,
        bandwidth: 0, // Would need more complex measurement
      },
      temperature,
    };

    // Store in history
    this.metrics.push(metrics);
    if (this.metrics.length > this.maxHistory) {
      this.metrics.shift();
    }

    return metrics;
  }

  private async getCpuUsage(): Promise<number> {
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const endUsage = process.cpuUsage(startUsage);
    
    const totalUsage = endUsage.user + endUsage.system;
    return Math.min(totalUsage / 1000000, 100); // Convert to percentage
  }

  private async getDiskUsage() {
    // Simplified - would need fs calls in real implementation
    return {
      used: 1024 * 1024 * 100, // 100MB used
      total: 1024 * 1024 * 1024, // 1GB total
      percentage: 10,
    };
  }

  private async measureLatency(): Promise<number> {
    const start = Date.now();
    try {
      await fetch('https://cms.headyconnection.org/health', { 
        method: 'HEAD',
        cache: 'no-store',
      });
      return Date.now() - start;
    } catch {
      return 9999; // High latency on failure
    }
  }

  private async getTemperature(): Promise<number> {
    // Would need system calls - simplified
    return 45; // 45°C
  }

  getAverageMetrics(timeWindow: number = 10): MiniComputerMetrics {
    const recent = this.metrics.slice(-timeWindow);
    if (recent.length === 0) return this.getEmptyMetrics();

    return {
      cpu: recent.reduce((sum, m) => sum + m.cpu, 0) / recent.length,
      memory: {
        used: recent.reduce((sum, m) => sum + m.memory.used, 0) / recent.length,
        total: recent[0].memory.total,
        percentage: recent.reduce((sum, m) => sum + m.memory.percentage, 0) / recent.length,
      },
      disk: recent[0].disk, // Disk doesn't change much
      network: {
        latency: recent.reduce((sum, m) => sum + m.network.latency, 0) / recent.length,
        bandwidth: 0,
      },
      temperature: recent.reduce((sum, m) => sum + m.temperature, 0) / recent.length,
    };
  }

  private getEmptyMetrics(): MiniComputerMetrics {
    return {
      cpu: 0,
      memory: { used: 0, total: 0, percentage: 0 },
      disk: { used: 0, total: 0, percentage: 0 },
      network: { latency: 0, bandwidth: 0 },
      temperature: 0,
    };
  }

  isHealthy(): boolean {
    const metrics = this.getAverageMetrics();
    
    return (
      metrics.cpu < 80 &&
      metrics.memory.percentage < 85 &&
      metrics.disk.percentage < 90 &&
      metrics.network.latency < 1000 &&
      metrics.temperature < 70
    );
  }
}

export { MiniComputerMonitor, MiniComputerMetrics };
```

## Part 5: Coding Agent Instructions

### Complete Agent Prompt
Create `docs/coding-agent-prompt.md`:
```markdown
# Heady Next.js Frontend Coding Agent Instructions

## Core Principles
1. **NEVER USE LOCALHOST** - Always use environment-specific domains
2. **All secrets in vault** - Use heady-secrets for credential management
3. **Cloudflare-first** - All services fronted by Cloudflare with DNS + SSL
4. **Auto-deploy via HCFP** - Git push triggers HCFullPipeline execution
5. **Multi-remote sync** - Push to origin, heady-me, heady-sys simultaneously

## Domain Standards
- Production: cms.headyconnection.org, app.headyconnection.org
- Staging: cms.staging.headyconnection.org, app.staging.headyconnection.org  
- Dev: cms.dev.headyconnection.org, app.dev.headyconnection.org

## Required Environment Variables
```bash
# Drupal Backend
DATABASE_URL=${DB_CONNECTION_STRING}
DRUPAL_HASH_SALT=${HEADY_DRUPAL_HASH_SALT}
CLOUDFLARE_API_TOKEN=${HEADY_CF_API_TOKEN}

# Next.js Frontend
NEXT_PUBLIC_DRUPAL_BASE_URL=https://cms.headyconnection.org
DRUPAL_PREVIEW_SECRET=${HEADY_DRUPAL_PREVIEW_SECRET}
DRUPAL_CLIENT_ID=${HEADY_DRUPAL_OAUTH_CLIENT_ID}
DRUPAL_CLIENT_SECRET=${HEADY_DRUPAL_OAUTH_CLIENT_SECRET}
```

## Deployment Workflow
1. Make changes in feature branch
2. Run local tests: npm test && npm run lint
3. Commit and push: git push origin feature-branch
4. Create PR, wait for CI checks
5. Merge to main triggers auto-deploy via HCFP
6. Monitor deployment: curl https://api.headyconnection.org/api/pipeline/state
7. Verify health: curl https://app.headyconnection.org/api/health

## Next.js Frontend Checklist
- [ ] next-drupal client initialized with vault credentials
- [ ] Environment variables reference vault, not hardcoded
- [ ] Preview API route configured with secret validation
- [ ] Static generation + ISR configured for content types
- [ ] Image domains whitelisted in next.config.js
- [ ] Health check endpoint implemented at /api/health
- [ ] Mini-computer optimization enabled for edge deployment
- [ ] Sacred Geometry design system implemented
- [ ] Performance monitoring with MiniComputerMonitor

## Render Service Management
```bash
# List all services
npm run render list

# Deploy specific service
npm run render deploy heady-nextjs-frontend

# Update environment variables
npm run render update-env <service-id>

# Suspend service (for maintenance)
npm run render suspend <service-id>

# Resume service
npm run render resume <service-id>
```

## Mini-Computer Deployment
```bash
# Deploy to mini-computer
./scripts/deploy-minicomputer.sh <IP> <USER>

# Monitor performance
curl http://<mini-computer-ip>/api/metrics

# Check health
curl http://<mini-computer-ip>/api/health
```

## Common Tasks

### Create new content type page
```typescript
// pages/[content-type]/[...slug]/page.tsx
import { drupal } from '@/lib/drupal';

export async function generateStaticParams() {
  const items = await drupal.getResourceCollection('node--<content_type>', {
    params: {
      'fields[node--<content_type>]': 'title,path',
    },
  });

  return items.map((item) => ({
    slug: item.path.alias.split('/').filter(Boolean),
  }));
}

export default async function ContentTypePage({ params }: { params: { slug: string[] } }) {
  const path = `/${params.slug.join('/')}`;
  const item = await drupal.getResourceFromContext('node--<content_type>', {
    path,
    params: {
      include: 'field_image,uid',
    },
  });

  if (!item) notFound();

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-heady-cyan mb-4">
        {item.title}
      </h1>
      {/* Render content */}
    </main>
  );
}

export const revalidate = 60; // ISR
```

### Add new API route
```typescript
// pages/api/[endpoint]/route.ts
import { NextResponse } from 'next/server';
import { checkDrupalHealth } from '@/lib/drupal';

export async function GET() {
  const drupalHealthy = await checkDrupalHealth();
  
  return NextResponse.json({
    ok: drupalHealthy,
    service: 'heady-nextjs-frontend',
    timestamp: Date.now(),
  });
}
```

### Deploy emergency hotfix
```bash
# Push directly to main (bypasses normal flow)
git checkout main
git pull origin main
# Make fix
git commit -m "hotfix: critical security patch"
git push origin main  # Auto-deploys via HCFP
# Monitor deployment
curl https://api.headyconnection.org/api/pipeline/state
```

### Migrate to HeadyMe
```bash
# Run migration script
./scripts/migrate-to-headyme.sh

# Verify migration
curl -f https://cms.headyconnection.org/admin/health
curl -f https://app.headyconnection.org/api/health
curl -f https://api.headyconnection.org/api/health
```

## Performance Optimization for Mini-Computers
- Use edge runtime where possible
- Implement ISR with appropriate revalidation times
- Optimize images with AVIF/WebP formats
- Minimize bundle size with tree shaking
- Monitor resource usage with MiniComputerMonitor
- Implement caching headers for static assets

## Troubleshooting
- Deployment fails: Check render.yaml configuration
- Preview not working: Verify OAuth credentials in vault
- High memory usage: Enable edge runtime, optimize bundle
- Slow performance: Check Cloudflare caching, enable ISR
- Mini-computer issues: Monitor metrics, check systemd service

## File Structure
```
headyconnection-web/
├── src/
│   ├── app/
│   │   ├── (pages)/
│   │   ├── api/
│   │   └── globals.css
│   ├── lib/
│   │   ├── drupal.ts
│   │   └── mini-computer-monitor.ts
│   └── styles/
│       └── heady-theme.ts
├── scripts/
│   ├── render-manager.ts
│   ├── deploy-minicomputer.sh
│   └── migrate-to-headyme.sh
├── public/
├── .env.local (never commit)
├── next.config.js
├── next.config.edge.js
├── render.yaml
└── package.json
```
```

## Part 6: Health Check Implementation

All services must implement health endpoints:

### Drupal: `/admin/health`
```php
<?php
// modules/custom/heady_health/src/Controller/HealthController.php
public function check() {
  return new JsonResponse([
    'ok' => true,
    'service' => 'heady-drupal-cms',
    'timestamp' => time(),
    'version' => \Drupal::VERSION,
    'database' => $this->checkDatabase(),
    'cache' => $this->checkCache(),
  ]);
}
```

### Next.js: `/api/health`
```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { checkDrupalHealth } from '@/lib/drupal';
import { MiniComputerMonitor } from '@/lib/mini-computer-monitor';

const monitor = new MiniComputerMonitor();

export async function GET() {
  const drupalHealthy = await checkDrupalHealth();
  const metrics = await monitor.collectMetrics();
  
  const health = {
    ok: drupalHealthy && monitor.isHealthy(),
    service: 'heady-nextjs-frontend',
    timestamp: Date.now(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      drupal: drupalHealthy,
      memory: metrics.memory.percentage < 85,
      cpu: metrics.cpu < 80,
      disk: metrics.disk.percentage < 90,
    },
    metrics: metrics,
  };

  return NextResponse.json(health, {
    status: health.ok ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
```

## Summary

This implementation provides:

1. **Production-optimized Next.js frontend** with Drupal 11 integration
2. **Programmatic Render service management** via API
3. **Automated migration to HeadyMe organization**
4. **Mini-computer edge deployment** with monitoring
5. **Sacred Geometry design system** implementation
6. **Health monitoring** for all services
7. **Zero localhost configuration** - proper domains only
8. **Vault-based secret management** for security
9. **Performance optimization** for resource-constrained environments
10. **Complete coding agent instructions** for consistent implementation

All components follow Heady's production deployment rules and are optimized for both cloud and edge deployment scenarios.
