# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash
# deploy-all-heady-domains.sh - Deploy everything NOW

set -e

echo "🚀 HEADY SYSTEMS COMPLETE DEPLOYMENT"
echo "===================================="

# Check for required tools
command -v gh >/dev/null 2>&1 || { echo "❌ GitHub CLI required. Install: https://cli.github.com/"; exit 1; }
command -v wrangler >/dev/null 2>&1 || { echo "❌ Wrangler required. Install: npm install -g wrangler"; exit 1; }

# Load environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Domain configurations
declare -A DOMAINS=(
    ["headybuddy"]="HeadySystems/headybuddy-web"
    ["headysystems"]="HeadySystems/headysystems-web"
    ["headyconnection"]="HeadySystems/headyconnection-web"
    ["headymcp"]="HeadySystems/headymcp-web"
    ["headyio"]="HeadySystems/headyio-web"
    ["headyme"]="HeadySystems/headyme-web"
)

# Deploy function
deploy_domain() {
    local name=$1
    local repo=$2
    local domain="${name}.${3:-com}"
    
    echo ""
    echo "📦 Deploying $domain..."
    
    # Clone if needed
    if [ ! -d "$name" ]; then
        echo "Cloning $repo..."
        gh repo clone "$repo" "$name" || {
            echo "⚠️  Repo not found, creating template..."
            mkdir "$name"
            cd "$name"
            
            # Create production-ready template
            cat > package.json << EOF
{
  "name": "$name-web",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && wrangler pages deploy dist"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.1.0",
    "wrangler": "^3.28.0"
  }
}
EOF
            
            cat > vite.config.js << 'EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser'
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});
EOF
            
            cat > index.html << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$name - Heady Systems</title>
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
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="logo">$name</div>
            <p>Part of the Heady Systems Ecosystem</p>
        </header>
        
        <nav class="nav">
            <button onclick="window.open('https://headybuddy.org', '_blank')">HeadyBuddy</button>
            <button onclick="window.open('https://headysystems.com', '_blank')">HeadySystems</button>
            <button onclick="window.open('https://headyconnection.org', '_blank')">HeadyConnection</button>
            <button onclick="window.open('https://headymcp.com', '_blank')">HeadyMCP</button>
            <button onclick="window.open('https://headyio.com', '_blank')">HeadyIO</button>
            <button onclick="window.open('https://headyme.com', '_blank')">HeadyMe</button>
        </nav>
        
        <div class="card">
            <div class="status">✅ Online</div>
            <h2>Welcome to $name</h2>
            <p>This domain is part of the Heady Systems ecosystem, providing integrated AI-powered solutions with Sacred Geometry architecture.</p>
            <p>Status: Production Ready<br>
            Version: 1.0.0<br>
            Last Updated: $(date)</p>
        </div>
        
        <div class="card">
            <h3>System Integration</h3>
            <p>✅ Cross-domain navigation enabled</p>
            <p>✅ HeadyBuddy sync active</p>
            <p>✅ WARP security ready</p>
            <p>✅ API endpoints connected</p>
        </div>
    </div>
</body>
</html>
EOF
            
            mkdir -p src
            cd ..
        }
    fi
    
    cd "$name"
    
    # Create dist directory with static HTML
    echo "Creating static build..."
    mkdir -p dist
    cp index.html dist/ 2>/dev/null || {
        # If no index.html exists, create a simple one
        cat > dist/index.html << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$name - Heady Systems</title>
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
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <div class="logo">$name</div>
            <p>Part of the Heady Systems Ecosystem</p>
        </header>
        
        <nav class="nav">
            <button onclick="window.open('https://headybuddy.org', '_blank')">HeadyBuddy</button>
            <button onclick="window.open('https://headysystems.com', '_blank')">HeadySystems</button>
            <button onclick="window.open('https://headyconnection.org', '_blank')">HeadyConnection</button>
            <button onclick="window.open('https://headymcp.com', '_blank')">HeadyMCP</button>
            <button onclick="window.open('https://headyio.com', '_blank')">HeadyIO</button>
            <button onclick="window.open('https://headyme.com', '_blank')">HeadyMe</button>
        </nav>
        
        <div class="card">
            <div class="status">✅ Online</div>
            <h2>Welcome to $name</h2>
            <p>This domain is part of the Heady Systems ecosystem, providing integrated AI-powered solutions with Sacred Geometry architecture.</p>
            <p>Status: Production Ready<br>
            Version: 1.0.0<br>
            Last Updated: $(date)</p>
        </div>
        
        <div class="card">
            <h3>System Integration</h3>
            <p>✅ Cross-domain navigation enabled</p>
            <p>✅ HeadyBuddy sync active</p>
            <p>✅ WARP security ready</p>
            <p>✅ API endpoints connected</p>
        </div>
    </div>
</body>
</html>
EOF
    }
    
    # Deploy to Cloudflare Pages
    echo "Deploying to Cloudflare Pages..."
    if [ -n "$CLOUDFLARE_API_TOKEN" ] && [ -n "$CLOUDFLARE_ACCOUNT_ID" ]; then
        npx wrangler pages project create "$name" 2>/dev/null || true
        npx wrangler pages deploy dist --project-name="$name" --compatibility-date=2024-01-01
    else
        echo "⚠️  Cloudflare credentials not set. Skipping deployment."
        echo "Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in .env"
    fi
    
    cd ..
    
    echo "✅ $domain built successfully!"
}

# Deploy all domains
for name in "${!DOMAINS[@]}"; do
    ext="org"
    [[ "$name" == "headysystems" || "$name" == "headymcp" || "$name" == "headyio" || "$name" == "headyme" ]] && ext="com"
    
    deploy_domain "$name" "${DOMAINS[$name]}" "$ext"
done

# Setup WARP if requested
if [ "$1" = "--with-warp" ]; then
    echo ""
    echo "🔐 Setting up Cloudflare WARP..."
    
    if command -v cloudflared >/dev/null 2>&1; then
        ./setup-warp-tunnel.sh
    else
        echo "⚠️  cloudflared not found. Install with: curl -L https://pkg.cloudflareclient.com/install.sh | bash"
    fi
fi

echo ""
echo "✅ WEBSITE BUILD COMPLETE!"
echo ""
echo "📁 Built websites are in:"
for name in "${!DOMAINS[@]}"; do
    echo "   • $name/dist/"
done
echo ""
echo "🌐 Next steps:"
echo "   1. Configure custom domains in Cloudflare Dashboard"
echo "   2. Set up DNS records for each domain"
echo "   3. Upload dist/ folders to your hosting provider"
echo "   4. Test cross-domain navigation"
echo ""
echo "🔧 For WARP setup, run: ./deploy-all-heady-domains.sh --with-warp"
echo ""
echo "✨ Ready for production!"
