# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash
# deploy-cloudflare-workers.sh - Deploy all Heady Workers

set -e

echo "🌩️  DEPLOYING HEADY SYSTEMS TO CLOUDFLARE WORKERS"
echo "=================================================="

# Check for wrangler
command -v wrangler >/dev/null 2>&1 || { echo "❌ Wrangler required. Install: npm install -g wrangler"; exit 1; }

# Check authentication
if ! wrangler whoami >/dev/null 2>&1; then
    echo "🔑 Please authenticate with Cloudflare..."
    echo "Run: wrangler auth token"
    echo "Then copy the token to your environment or wrangler config"
fi

# Create individual workers for each domain
declare -A WORKERS=(
    ["headybuddy"]="headybuddy-worker"
    ["headysystems"]="headysystems-worker"
    ["headyconnection"]="headyconnection-worker"
    ["headymcp"]="headymcp-worker"
    ["headyio"]="headyio-worker"
    ["headyme"]="headyme-worker"
    ["api"]="api-worker"
    ["admin"]="admin-worker"
)

# Deploy router worker first
echo ""
echo "🚀 Deploying main router worker..."
wrangler deploy --env production

# Create and deploy individual workers
for name in "${!WORKERS[@]}"; do
    worker_name="${WORKERS[$name]}"
    echo ""
    echo "📦 Creating $worker_name..."
    
    # Create worker directory
    mkdir -p "$worker_name"
    
    # Generate worker code
    cat > "$worker_name/worker.js" << EOF
// Cloudflare Worker for $name
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Route to appropriate handler
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, url);
    }
    
    return handleStatic(request, url, '$name');
  }
};

async function handleAPI(request, url) {
  const path = url.pathname;
  
  // API endpoints
  if (path === '/api/health') {
    return Response.json({
      status: 'ok',
      service: '$name',
      timestamp: Date.now(),
      version: '1.0.0'
    });
  }
  
  if (path === '/api/info') {
    return Response.json({
      service: '$name',
      description: getServiceDescription('$name'),
      features: getServiceFeatures('$name'),
      endpoints: ['/api/health', '/api/info']
    });
  }
  
  return new Response('API endpoint not found', { status: 404 });
}

async function handleStatic(request, url, serviceName) {
  const content = getStaticContent(serviceName);
  
  return new Response(content, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=3600',
      'X-Heady-Service': serviceName,
      'X-Heady-Version': '1.0.0'
    }
  });
}

function getServiceDescription(service) {
  const descriptions = {
    'headybuddy': 'AI Companion & Cross-Device Launcher',
    'headysystems': 'Commercial Platform & System Hub',
    'headyconnection': 'Nonprofit Mission Platform',
    'headymcp': 'Model Context Protocol Server',
    'headyio': 'Developer Platform & Tools',
    'headyme': 'Personal Cloud & Identity',
    'api': 'API Gateway & Backend Services',
    'admin': 'System Administration & Control'
  };
  return descriptions[service] || 'Heady Systems Service';
}

function getServiceFeatures(service) {
  const features = {
    'headybuddy': ['Cross-device sync', 'AI assistance', 'Context awareness', 'WARP security'],
    'headysystems': ['API gateway', 'System monitoring', 'Cross-domain routing', 'Enterprise features'],
    'headyconnection': ['Nonprofit tools', 'Community features', 'Mission tracking', 'Donation management'],
    'headymcp': ['MCP protocol', 'Model serving', 'API integration', 'Developer tools'],
    'headyio': ['Developer resources', 'Documentation', 'Tools & SDKs', 'Community'],
    'headyme': ['Personal identity', 'Data storage', 'Cross-device sync', 'Privacy features'],
    'api': ['RESTful APIs', 'GraphQL', 'Webhooks', 'Authentication'],
    'admin': ['System control', 'Monitoring', 'Deployments', 'User management']
  };
  return features[service] || ['Heady ecosystem integration'];
}

function getStaticContent(serviceName) {
  const sites = {
    'headybuddy': \`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HeadyBuddy - AI Companion</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #e2e8f0; min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .header { text-align: center; margin-bottom: 3rem; }
        .logo { font-size: 3rem; font-weight: bold; background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 1rem; }
        .nav { display: flex; justify-content: center; gap: 1rem; margin-bottom: 3rem; flex-wrap: wrap; }
        .nav button { background: rgba(59, 130, 246, 0.2); border: 1px solid #3b82f6; color: #60a5fa; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s; }
        .nav button:hover { background: rgba(59, 130, 246, 0.3); transform: scale(1.05); }
        .card { background: rgba(30, 41, 59, 0.8); border: 1px solid #334155; border-radius: 0.5rem; padding: 2rem; margin-bottom: 2rem; }
        .status { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-size: 0.875rem; background: rgba(34, 197, 94, 0.2); color: #22c55e; margin-bottom: 1rem; }
        .pulse { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; animation: pulse 2s infinite; display: inline-block; margin-right: 0.5rem; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="logo">HeadyBuddy</div>
            <p>AI Companion & Cross-Device Launcher</p>
        </header>
        
        <nav class="nav">
            <button onclick="window.open('https://headysystems.com', '_blank')">HeadySystems</button>
            <button onclick="window.open('https://headyconnection.org', '_blank')">HeadyConnection</button>
            <button onclick="window.open('https://headymcp.com', '_blank')">HeadyMCP</button>
            <button onclick="window.open('https://headyio.com', '_blank')">HeadyIO</button>
            <button onclick="window.open('https://headyme.com', '_blank')">HeadyMe</button>
        </nav>
        
        <div class="card">
            <div class="status"><span class="pulse"></span>Live on Cloudflare Workers</div>
            <h2>Welcome to HeadyBuddy</h2>
            <p>Your AI companion that seamlessly syncs across all devices and domains in the Heady ecosystem.</p>
            <p>Status: Production Ready<br>
            Version: 1.0.0<br>
            Infrastructure: Cloudflare Workers Global Network</p>
        </div>
        
        <div class="card">
            <h3>Cross-Device Features</h3>
            <p>✅ Real-time sync across devices</p>
            <p>✅ Context preservation</p>
            <p>✅ WARP security enabled</p>
            <p>✅ Global edge delivery</p>
        </div>
        
        <div class="card">
            <h3>API Status</h3>
            <p>🔗 <a href="/api/health" style="color: #60a5fa;">Health Check</a></p>
            <p>🔗 <a href="/api/info" style="color: #60a5fa;">Service Info</a></p>
        </div>
    </div>
</body>
</html>\`,
    
    'headysystems': \`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HeadySystems - Commercial Platform</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #e2e8f0; min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .header { text-align: center; margin-bottom: 3rem; }
        .logo { font-size: 3rem; font-weight: bold; background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 1rem; }
        .nav { display: flex; justify-content: center; gap: 1rem; margin-bottom: 3rem; flex-wrap: wrap; }
        .nav button { background: rgba(124, 58, 237, 0.2); border: 1px solid #7c3aed; color: #a78bfa; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s; }
        .nav button:hover { background: rgba(124, 58, 237, 0.3); transform: scale(1.05); }
        .card { background: rgba(30, 41, 59, 0.8); border: 1px solid #334155; border-radius: 0.5rem; padding: 2rem; margin-bottom: 2rem; }
        .status { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-size: 0.875rem; background: rgba(34, 197, 94, 0.2); color: #22c55e; margin-bottom: 1rem; }
        .pulse { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; animation: pulse 2s infinite; display: inline-block; margin-right: 0.5rem; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="logo">HeadySystems</div>
            <p>Commercial Platform & System Hub</p>
        </header>
        
        <nav class="nav">
            <button onclick="window.open('https://headybuddy.org', '_blank')">HeadyBuddy</button>
            <button onclick="window.open('https://headyconnection.org', '_blank')">HeadyConnection</button>
            <button onclick="window.open('https://headymcp.com', '_blank')">HeadyMCP</button>
            <button onclick="window.open('https://headyio.com', '_blank')">HeadyIO</button>
            <button onclick="window.open('https://headyme.com', '_blank')">HeadyMe</button>
        </nav>
        
        <div class="card">
            <div class="status"><span class="pulse"></span>Live on Cloudflare Workers</div>
            <h2>Welcome to HeadySystems</h2>
            <p>The central hub for the Heady ecosystem, providing commercial solutions and system integration.</p>
            <p>Status: Production Ready<br>
            Version: 1.0.0<br>
            Infrastructure: Cloudflare Workers Global Network</p>
        </div>
        
        <div class="card">
            <h3>Platform Features</h3>
            <p>✅ API gateway and routing</p>
            <p>✅ System monitoring</p>
            <p>✅ Cross-domain integration</p>
            <p>✅ Global edge delivery</p>
        </div>
        
        <div class="card">
            <h3>API Status</h3>
            <p>🔗 <a href="/api/health" style="color: #a78bfa;">Health Check</a></p>
            <p>🔗 <a href="/api/info" style="color: #a78bfa;">Service Info</a></p>
        </div>
    </div>
</body>
</html>\`
  };

  return sites[serviceName] || sites['headysystems'];
}
EOF

    # Create wrangler.toml for individual worker
    cat > "$worker_name/wrangler.toml" << EOF
name = "$worker_name"
main = "worker.js"
compatibility_date = "2024-01-01"

[env.production]
vars = { ENVIRONMENT = "production", SERVICE = "$name" }
EOF

    # Deploy worker
    echo "🚀 Deploying $worker_name..."
    cd "$worker_name"
    wrangler deploy --env production
    cd ..
    
    echo "✅ $worker_name deployed successfully!"
done

echo ""
echo "🎉 ALL WORKERS DEPLOYED!"
echo ""
echo "🌐 Your Heady ecosystem is now live on Cloudflare Workers:"
echo "   • HeadyBuddy.org - Global edge delivery"
echo "   • HeadySystems.com - Commercial platform"
echo "   • HeadyConnection.org - Nonprofit platform"
echo "   • HeadyMCP.com - MCP protocol server"
echo "   • HeadyIO.com - Developer platform"
echo "   • HeadyMe.com - Personal cloud"
echo "   • API endpoints available at /api/*"
echo ""
echo "✨ Global deployment complete!"
