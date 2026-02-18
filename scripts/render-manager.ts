/**
 * ═══════════════════════════════════════════════════════════════
# 🎯 RENDER SERVICE MANAGER - Programmatic Control
 * ═══════════════════════════════════════════════════════════════
 * Manage Render.com services programmatically
 */

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
