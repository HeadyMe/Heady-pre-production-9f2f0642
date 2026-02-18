#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# 🚀 HEADY LOCAL INFRASTRUCTURE SETUP SCRIPT
# ═══════════════════════════════════════════════════════════════
# Setup Cloudflare tunnel and local Docker infrastructure

set -e

echo "🧠 Setting up Heady Local Infrastructure with Async Orchestration..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE} $1"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "CHECKING PREREQUISITES"
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if cloudflared is installed
    if ! command -v cloudflared &> /dev/null; then
        print_warning "cloudflared is not installed. Installing..."
        install_cloudflared
    fi
    
    # Check if curl is installed
    if ! command -v curl &> /dev/null; then
        print_error "curl is not installed. Please install curl first."
        exit 1
    fi
    
    print_status "✅ All prerequisites checked"
}

# Install cloudflared
install_cloudflared() {
    print_status "Installing cloudflared..."
    
    # Detect architecture
    ARCH=$(uname -m)
    case $ARCH in
        x86_64)
            ARCH="amd64"
            ;;
        aarch64|arm64)
            ARCH="arm64"
            ;;
        *)
            print_error "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac
    
    # Download and install cloudflared
    wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$ARCH.deb
    sudo dpkg -i cloudflared-linux-$ARCH.deb
    rm cloudflared-linux-$ARCH.deb
    
    print_status "✅ cloudflared installed successfully"
}

# Setup environment variables
setup_environment() {
    print_header "SETTING UP ENVIRONMENT"
    
    # Create .env.local if it doesn't exist
    if [ ! -f .env.local ]; then
        print_status "Creating .env.local file..."
        cat > .env.local << EOF
# Heady Local Environment Configuration
HEADY_SECRET_API_KEY=your-heady-api-key-here
OPENAI_KEY=your-openai-key-here
ANTHROPIC_KEY=your-anthropic-key-here
GOOGLE_AI_KEY=your-google-ai-key-here
REDIS_PASSWORD=redis-secure-password-123
DB_PASSWORD=headypass

# Cloudflare Tunnel Configuration
CLOUDFLARE_ACCOUNT_ID=your-account-id-here
CLOUDFLARE_TUNNEL_SECRET=your-tunnel-secret-here

# Domain Configuration
BASE_DOMAIN=headysystems.com
CONDUCTOR_DOMAIN=conductor.headysystems.com
SOUL_DOMAIN=soul.headysystems.com
MCP_DOMAIN=mcp.headysystems.com
WEB_DOMAIN=web.headysystems.com
BUDDY_DOMAIN=buddy.headysystems.com
LENS_DOMAIN=lens.headysystems.com
VINCI_DOMAIN=vinci.headysystems.com
STATIC_DOMAIN=static.headysystems.com
HEALTH_DOMAIN=health.headysystems.com
EOF
        print_warning "Please edit .env.local with your actual API keys and configuration"
    else
        print_status ".env.local already exists"
    fi
}

# Setup Cloudflare Tunnel
setup_cloudflare_tunnel() {
    print_header "SETTING UP CLOUDFLARE TUNNEL"
    
    # Load environment variables
    if [ -f .env.local ]; then
        export $(cat .env.local | grep -v '^#' | xargs)
    else
        print_error ".env.local file not found. Please run setup_environment first."
        exit 1
    fi
    
    # Check if already authenticated
    if [ ! -f ~/.cloudflared/cert.pem ]; then
        print_status "Authenticating with Cloudflare..."
        cloudflared tunnel login
    else
        print_status "Already authenticated with Cloudflare"
    fi
    
    # Create tunnel if it doesn't exist
    TUNNEL_NAME="heady-main-tunnel"
    if ! cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
        print_status "Creating tunnel: $TUNNEL_NAME"
        cloudflared tunnel create "$TUNNEL_NAME"
    else
        print_status "Tunnel $TUNNEL_NAME already exists"
    fi
    
    # Get tunnel credentials
    TUNNEL_UUID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $2}')
    print_status "Tunnel UUID: $TUNNEL_UUID"
    
    # Create credentials file
    mkdir -p cloudflared
    cat > cloudflared/credentials.json << EOF
{
  "AccountTag": "${CLOUDFLARE_ACCOUNT_ID}",
  "TunnelSecret": "${CLOUDFLARE_TUNNEL_SECRET}",
  "TunnelID": "${TUNNEL_UUID}"
}
EOF
    
    # Setup DNS records for all domains
    DOMAINS=(
        "$CONDUCTOR_DOMAIN"
        "$SOUL_DOMAIN"
        "$MCP_DOMAIN"
        "$WEB_DOMAIN"
        "$BUDDY_DOMAIN"
        "$LENS_DOMAIN"
        "$VINCI_DOMAIN"
        "$STATIC_DOMAIN"
        "$HEALTH_DOMAIN"
    )
    
    for domain in "${DOMAINS[@]}"; do
        print_status "Setting up DNS for $domain"
        cloudflared tunnel route dns "$TUNNEL_NAME" "$domain"
    done
    
    print_status "✅ Cloudflare Tunnel setup complete"
}

# Build and start services
start_services() {
    print_header "STARTING HEADY SERVICES"
    
    # Create necessary directories
    mkdir -p logs
    mkdir -p scripts
    mkdir -p data/{conductor,soul,vinci,redis,postgres,storage}
    
    # Create init-db.sql if it doesn't exist
    if [ ! -f scripts/init-db.sql ]; then
        print_status "Creating database initialization script..."
        mkdir -p scripts
        cat > scripts/init-db.sql << EOF
-- Heady Database Initialization
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create tables for orchestration
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resource_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(100) NOT NULL,
    cpu_limit FLOAT NOT NULL,
    memory_limit INT NOT NULL,
    priority_level INT DEFAULT 80,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attention_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(100),
    component_focused VARCHAR(100),
    attention_level FLOAT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_resource_allocations_service ON resource_allocations(service_name);
CREATE INDEX IF NOT EXISTS idx_attention_patterns_user ON attention_patterns(user_id);
EOF
    fi
    
    # Start services with Docker Compose
    print_status "Starting Heady services with Docker Compose..."
    docker-compose -f docker-compose.local.yml up -d
    
    # Wait for services to be healthy
    print_status "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    check_service_health
}

# Check service health
check_service_health() {
    print_header "CHECKING SERVICE HEALTH"
    
    services=(
        "heady-conductor:8000"
        "heady-soul:8001"
        "heady-mcp:8002"
        "heady-web:3000"
        "heady-buddy:8003"
        "heady-lens:8004"
        "heady-vinci:8005"
    )
    
    for service in "${services[@]}"; do
        service_name=$(echo $service | cut -d':' -f1)
        port=$(echo $service | cut -d':' -f2)
        
        print_status "Checking $service_name..."
        
        # Check if container is running
        if docker ps --format "table {{.Names}}" | grep -q "$service_name"; then
            # Check health endpoint
            if curl -f -s "http://localhost:$port/health" > /dev/null 2>&1; then
                print_status "✅ $service_name is healthy"
            else
                print_warning "⚠️  $service_name is running but health check failed"
            fi
        else
            print_error "❌ $service_name is not running"
        fi
    done
}

# Test Cloudflare Tunnel connectivity
test_tunnel_connectivity() {
    print_header "TESTING CLOUDFLARE TUNNEL CONNECTIVITY"
    
    # Load environment variables
    if [ -f .env.local ]; then
        export $(cat .env.local | grep -v '^#' | xargs)
    fi
    
    # Test each domain
    domains=(
        "$CONDUCTOR_DOMAIN"
        "$SOUL_DOMAIN"
        "$MCP_DOMAIN"
        "$WEB_DOMAIN"
        "$BUDDY_DOMAIN"
        "$LENS_DOMAIN"
        "$VINCI_DOMAIN"
    )
    
    for domain in "${domains[@]}"; do
        print_status "Testing $domain..."
        
        # Test HTTPS connectivity
        if curl -f -s "https://$domain/health" > /dev/null 2>&1; then
            print_status "✅ $domain is accessible via HTTPS"
        else
            print_warning "⚠️  $domain is not accessible via HTTPS yet (DNS propagation may take time)"
        fi
    done
}

# Display next steps
display_next_steps() {
    print_header "SETUP COMPLETE - NEXT STEPS"
    
    echo -e "${GREEN}🎉 Heady Local Infrastructure setup complete!${NC}"
    echo
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "1. Edit .env.local with your actual API keys"
    echo "2. Verify all services are running: docker-compose -f docker-compose.local.yml ps"
    echo "3. Check service logs: docker-compose -f docker-compose.local.yml logs -f [service-name]"
    echo "4. Test domains: curl https://conductor.headysystems.com/health"
    echo "5. Run training: npm run train:orchestration"
    echo
    echo -e "${BLUE}🌐 Access Points:${NC}"
    echo "- HeadyConductor: https://conductor.headysystems.com"
    echo "- HeadySoul: https://soul.headysystems.com"
    echo "- HeadyMCP: https://mcp.headysystems.com"
    echo "- HeadyWeb: https://web.headysystems.com"
    echo "- HeadyBuddy: https://buddy.headysystems.com"
    echo "- HeadyLens: https://lens.headysystems.com"
    echo "- HeadyVinci: https://vinci.headysystems.com"
    echo
    echo -e "${BLUE}🔧 Management Commands:${NC}"
    echo "- View logs: docker-compose -f docker-compose.local.yml logs -f"
    echo "- Restart services: docker-compose -f docker-compose.local.yml restart"
    echo "- Stop services: docker-compose -f docker-compose.local.yml down"
    echo "- Update services: docker-compose -f docker-compose.local.yml pull && docker-compose -f docker-compose.local.yml up -d"
    echo
    echo -e "${BLUE}📊 Resource Allocation:${NC}"
    echo "- Baseline: 90% resource allocation for autonomous operations"
    echo "- Peak: 100% resource allocation for user interactions"
    echo "- Context Switching: Max 2 concurrent high-priority workflows"
    echo "- Attention Tracking: Enabled for proactive resource escalation"
}

# Main execution
main() {
    print_header "HEADY LOCAL INFRASTRUCTURE SETUP"
    
    check_prerequisites
    setup_environment
    setup_cloudflare_tunnel
    start_services
    test_tunnel_connectivity
    display_next_steps
    
    print_status "🚀 Setup complete! Heady is ready for async orchestration."
}

# Run main function
main "$@"
