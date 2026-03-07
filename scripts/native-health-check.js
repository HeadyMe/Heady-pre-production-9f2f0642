'use strict';

/**
 * HeadyNativeServices — Health Check Script
 * Checks all services and reports status
 */

const http = require('http');

const SERVICES = [
  { name: 'HeadyGateway', url: 'http://localhost:3100/health' },
  { name: 'HeadyEmbed',   url: 'http://localhost:3101/health' },
  { name: 'HeadyInfer',   url: 'http://localhost:3102/health' },
  { name: 'HeadyVector',  url: 'http://localhost:3103/health' },
  { name: 'HeadyChain',   url: 'http://localhost:3104/health' },
  { name: 'HeadyCache',   url: 'http://localhost:3105/health' },
  { name: 'HeadyGuard',   url: 'http://localhost:3106/health' },
  { name: 'HeadyEval',    url: 'http://localhost:3107/health' },
];

function checkService(service) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get(service.url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const latency = Date.now() - start;
        try {
          const data = JSON.parse(body);
          resolve({
            name: service.name,
            status: res.statusCode === 200 ? '✅ HEALTHY' : '⚠️  DEGRADED',
            latency: `${latency}ms`,
            details: data.status || 'unknown',
          });
        } catch {
          resolve({
            name: service.name,
            status: '⚠️  DEGRADED',
            latency: `${latency}ms`,
            details: 'Invalid response',
          });
        }
      });
    });

    req.on('error', () => {
      resolve({
        name: service.name,
        status: '❌ DOWN',
        latency: '-',
        details: 'Connection refused',
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        name: service.name,
        status: '❌ TIMEOUT',
        latency: '>5000ms',
        details: 'Request timed out',
      });
    });
  });
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║       HeadyNativeServices — Health Check Report         ║');
  console.log('║              Sacred Geometry v3.0.0                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  const results = await Promise.all(SERVICES.map(checkService));

  const maxName = Math.max(...results.map(r => r.name.length));
  results.forEach(r => {
    console.log(`  ${r.name.padEnd(maxName + 2)} ${r.status.padEnd(14)} ${r.latency.padStart(8)}  ${r.details}`);
  });

  const healthy = results.filter(r => r.status.includes('HEALTHY')).length;
  console.log('');
  console.log(`  Summary: ${healthy}/${results.length} services healthy`);
  console.log('');

  process.exit(healthy === results.length ? 0 : 1);
}

main();
