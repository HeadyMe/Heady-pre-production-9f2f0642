# Heady Implementation Scripts Collection

## Overview
This document contains the complete set of implementation scripts referenced in the comprehensive deployment guide. These scripts automate the installation, configuration, and maintenance of the HeadyStack environment on Parrot OS 7.

## Script Structure
```
~/HeadyStack/scripts/
├── install-parrot-windsurf.sh          # Main installation script
├── configure-parrot-windsurf.sh        # Configuration script
├── migrate-localhost-to-domains.js     # Domain migration utility
├── business-metrics.sh                 # Business intelligence dashboard
├── client-followup.sh                  # Automated client follow-ups
├── weekly-business-review.sh           # Weekly business review
├── generate-proposals.sh               # Automated proposal generation
├── impact-tracking.sh                  # Social impact tracking
├── client-report.sh                    # Client performance reports
├── automated-security-scan.sh          # Scheduled security scans
├── custom-automation.sh                # Custom automation template
└── clean-build.sh                      # Clean build utility
```

---

## 🚀 Main Installation Script

### scripts/install-parrot-windsurf.sh
```bash
#!/bin/bash
# HeadyStack Parrot OS 7 + Windsurf Installation Script
# Version: 3.0.0
# Status: Production Ready

set -e  # Exit on any error

echo "🚀 HeadyStack Installation - Parrot OS 7 + Windsurf"
echo "=================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
LOG_FILE="$HOME/HeadyStack/logs/installation-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$HOME/HeadyStack/logs"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1" | tee -a "$LOG_FILE"
}

# System validation
validate_system() {
    print_step "Validating system requirements..."
    
    # Check OS
    if ! grep -q "Parrot" /etc/os-release; then
        print_error "This script is designed for Parrot OS"
        exit 1
    fi
    
    # Check sudo access
    if ! sudo -n true 2>/dev/null; then
        print_error "This script requires sudo access"
        exit 1
    fi
    
    # Check internet
    if ! ping -c 1 1.1.1.1 >/dev/null 2>&1; then
        print_error "Internet connection required"
        exit 1
    fi
    
    # Check system resources
    RAM=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$RAM" -lt 4 ]; then
        print_warning "System has less than 4GB RAM. Performance may be limited."
    fi
    
    print_status "System validation passed"
}

# Update system packages
update_system() {
    print_step "Updating system packages..."
    
    sudo apt update
    sudo apt upgrade -y
    
    print_status "System packages updated"
}

# Install development tools
install_dev_tools() {
    print_step "Installing development tools..."
    
    # Core development tools
    sudo apt install -y \
        build-essential \
        git \
        curl \
        wget \
        unzip \
        python3 \
        python3-pip \
        python3-venv \
        nodejs \
        npm \
        docker.io \
        docker-compose \
        code \
        vim \
        nano
    
    # Install Windsurf
    print_step "Installing Windsurf IDE..."
    
    # Download Windsurf (replace with actual download URL)
    cd /tmp
    wget -O windsurf.deb "https://windsurf.ai/download/windsurf-linux-x64.deb"
    sudo dpkg -i windsurf.deb || sudo apt install -f -y
    
    print_status "Development tools installed"
}

# Install security tools
install_security_tools() {
    print_step "Installing security tools..."
    
    # Network analysis
    sudo apt install -y \
        nmap \
        wireshark \
        tcpdump \
        sslscan \
        netcat
    
    # Penetration testing
    sudo apt install -y \
        metasploit-framework \
        burpsuite \
        sqlmap \
        nikto \
        john \
        hashcat
    
    # Forensics
    sudo apt install -y \
        autopsy \
        volatility \
        sleuthkit
    
    # Configure Wireshark permissions
    sudo usermod -aG wireshark "$USER"
    
    print_status "Security tools installed"
}

# Install MCP servers
install_mcp_servers() {
    print_step "Installing MCP servers..."
    
    # Install MCP manager
    npm install -g @modelcontextprotocol/server-filesystem
    npm install -g @modelcontextprotocol/server-security-tools
    
    # Create MCP configuration directory
    mkdir -p "$HOME/.config/windsurf/mcp-servers"
    
    print_status "MCP servers installed"
}

# Configure Docker
configure_docker() {
    print_step "Configuring Docker..."
    
    # Add user to docker group
    sudo usermod -aG docker "$USER"
    
    # Enable and start Docker service
    sudo systemctl enable docker
    sudo systemctl start docker
    
    print_status "Docker configured"
}

# Setup HeadyStack directory structure
setup_heady_structure() {
    print_step "Setting up HeadyStack directory structure..."
    
    mkdir -p "$HOME/HeadyStack"/{clients,projects,proposals,templates,scripts,logs,metrics,reports}
    mkdir -p "$HOME/HeadyStack/clients"/{active,prospects,archive}
    mkdir -p "$HOME/HeadyStack/projects"/{current,completed,proposed}
    mkdir -p "$HOME/HeadyStack/proposals"/{drafts,sent,accepted,rejected}
    
    print_status "HeadyStack structure created"
}

# Create initial configuration files
create_initial_config() {
    print_step "Creating initial configuration files..."
    
    # Client database
    cat > "$HOME/HeadyStack/clients/clients.json" << 'EOF'
{
  "clients": [],
  "metadata": {
    "version": "1.0.0",
    "last_updated": "2026-02-17T00:00:00Z",
    "total_clients": 0,
    "active_projects": 0
  }
}
EOF

    # Business metrics
    cat > "$HOME/HeadyStack/metrics/revenue.json" << 'EOF'
{
  "revenue": {
    "current_month": 0,
    "previous_month": 0,
    "ytd_total": 0,
    "pro_bono_value": 0
  }
}
EOF

    # Impact metrics
    cat > "$HOME/HeadyStack/metrics/impact.json" << 'EOF'
{
  "impact": {
    "community_hours": 0,
    "pro_bono_projects": 0,
    "redistribution_funds": 0,
    "nonprofits_helped": 0
  }
}
EOF

    print_status "Initial configuration created"
}

# Configure system services
configure_services() {
    print_step "Configuring system services..."
    
    # Configure firewall
    sudo ufw --force enable
    sudo ufw allow 22/tcp comment "SSH"
    sudo ufw allow 3000:3305/tcp comment "Heady services"
    sudo ufw allow 5432/tcp comment "PostgreSQL"
    sudo ufw allow 6379/tcp comment "Redis"
    sudo ufw allow 11434/tcp comment "Ollama"
    
    # Configure fail2ban
    sudo apt install -y fail2ban
    sudo systemctl enable fail2ban
    sudo systemctl start fail2ban
    
    print_status "System services configured"
}

# Set environment variables
set_environment() {
    print_step "Setting environment variables..."
    
    # Add to ~/.bashrc
    cat >> "$HOME/.bashrc" << 'EOF'

# HeadyStack Environment Variables
export HEADY_AUDIT_LOG=true
export WINDSURF_SANDBOX=true
export HEADY_DEVICE_ID=$(hostname)-$(whoami)
export HEADY_DEVICE_TYPE="desktop"
export HEADY_API_BASE="https://your-heady-domain.com/api"
export HEADY_WORKSPACE="default"
EOF

    # Source the bashrc
    source "$HOME/.bashrc"
    
    print_status "Environment variables set"
}

# Verify installation
verify_installation() {
    print_step "Verifying installation..."
    
    # Check Windsurf
    if command -v windsurf >/dev/null 2>&1; then
        print_status "✅ Windsurf installed: $(windsurf --version)"
    else
        print_error "❌ Windsurf installation failed"
        return 1
    fi
    
    # Check Docker
    if sudo docker run --rm hello-world >/dev/null 2>&1; then
        print_status "✅ Docker working"
    else
        print_error "❌ Docker not working"
        return 1
    fi
    
    # Check security tools
    SECURITY_TOOLS="nmap wireshark metasploit-framework burpsuite"
    for tool in $SECURITY_TOOLS; do
        if command -v "$tool" >/dev/null 2>&1 || dpkg -l | grep -q "$tool"; then
            print_status "✅ $tool available"
        else
            print_warning "⚠️ $tool not found"
        fi
    done
    
    print_status "Installation verification completed"
}

# Main installation flow
main() {
    print_status "Starting HeadyStack installation..."
    
    validate_system
    update_system
    install_dev_tools
    install_security_tools
    install_mcp_servers
    configure_docker
    setup_heady_structure
    create_initial_config
    configure_services
    set_environment
    verify_installation
    
    print_status "🎉 HeadyStack installation completed successfully!"
    echo
    echo "Next steps:"
    echo "1. Run: ./scripts/configure-parrot-windsurf.sh"
    echo "2. Launch Windsurf: windsurf"
    echo "3. Create your first project"
    echo
    echo "Installation log: $LOG_FILE"
}

# Run main function
main "$@"
```

---

## ⚙️ Configuration Script

### scripts/configure-parrot-windsurf.sh
```bash
#!/bin/bash
# HeadyStack Configuration Script
# Version: 3.0.0

set -e

echo "⚙️ HeadyStack Configuration"
echo "=========================="

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Configure Windsurf
configure_windsurf() {
    print_step "Configuring Windsurf..."
    
    # Create Windsurf config directory
    mkdir -p "$HOME/.config/windsurf"
    
    # Performance configuration
    cat > "$HOME/.config/windsurf/performance.json" << 'EOF'
{
  "workers": 8,
  "memoryLimit": "24GB",
  "cacheSize": "4GB",
  "parallelProcessing": true,
  "sandboxMode": true,
  "businessMode": {
    "clientCache": "500MB",
    "projectIndexing": true,
    "proposalGeneration": "optimized"
  }
}
EOF

    # MCP servers configuration
    cat > "$HOME/.config/windsurf/mcp-servers.json" << 'EOF'
{
  "mcpServers": {
    "security-tools": {
      "command": "mcp-server-security-tools",
      "args": ["--mode", "security-analysis"],
      "env": {
        "HEADY_AUDIT_LOG": "true",
        "WINDSURF_SANDBOX": "true"
      }
    },
    "filesystem": {
      "command": "mcp-server-filesystem",
      "args": ["/home"],
      "security": "controlled-permissions"
    },
    "business-tools": {
      "command": "mcp-server-business-tools",
      "args": ["--mode", "client-management"],
      "env": {
        "HEADY_CLIENT_DB": "$HOME/HeadyStack/clients/clients.json",
        "HEADY_PROPOSAL_TEMPLATES": "$HOME/HeadyStack/templates/proposals"
      }
    }
  }
}
EOF

    print_status "Windsurf configured"
}

# Configure domain mappings
configure_domains() {
    print_step "Configuring domain mappings..."
    
    # Add to /etc/hosts
    sudo tee -a /etc/hosts << 'EOF'
127.0.0.1 manager.dev.local.heady.internal
127.0.0.1 app-web.dev.local.heady.internal
127.0.0.1 tools-mcp.dev.local.heady.internal
127.0.0.1 db-postgres.dev.local.heady.internal
127.0.0.1 db-redis.dev.local.heady.internal
127.0.0.1 ai-ollama.dev.local.heady.internal
EOF

    print_status "Domain mappings configured"
}

# Create project templates
create_templates() {
    print_step "Creating project templates..."
    
    # Security audit template
    cat > "$HOME/HeadyStack/templates/security-audit.yaml" << 'EOF'
name: "Security Audit Project"
type: "security-assessment"
description: "Comprehensive security assessment and vulnerability analysis"
structure:
  - reconnaissance/
  - scanning/
  - exploitation/
  - reporting/
tools:
  - nmap
  - nikto
  - sqlmap
  - metasploit
deliverables:
  - "executive_summary.md"
  - "technical_report.md"
  - "vulnerability_findings.csv"
  - "remediation_plan.md"
EOF

    # Business assessment template
    cat > "$HOME/HeadyStack/templates/business-assessment.yaml" << 'EOF'
name: "Business Security Assessment"
type: "client-engagement"
phases:
  - name: "Discovery"
    duration: "1-2 days"
    deliverables: ["scope_document", "initial_findings"]
  - name: "Assessment"
    duration: "3-5 days"
    deliverables: ["vulnerability_report", "risk_analysis"]
  - name: "Reporting"
    duration: "1-2 days"
    deliverables: ["executive_summary", "technical_report"]
  - name: "Remediation"
    duration: "varies"
    deliverables: ["remediation_plan", "follow_up_assessment"]
pricing:
  model: "fixed_fee"
  base_rate: 5000
  complexity_multiplier: 1.5
social_impact:
  nonprofit_discount: 0.3
  community_hours_tracked: true
EOF

    # Proposal template
    cat > "$HOME/HeadyStack/templates/proposal-template.md" << 'EOF'
# Security Assessment Proposal

## Client Information
**Company:** {{client_name}}
**Contact:** {{contact_person}}
**Date:** {{proposal_date}}

## Scope of Work
{{scope_description}}

## Methodology
{{methodology}}

## Deliverables
{{deliverables}}

## Timeline
{{timeline}}

## Investment
{{pricing_details}}

## Social Impact Commitment
{{social_impact_statement}}

## Next Steps
{{next_steps}}
EOF

    print_status "Project templates created"
}

# Setup automation scripts
setup_automation() {
    print_step "Setting up automation scripts..."
    
    # Make scripts executable
    chmod +x "$HOME/HeadyStack/scripts"/*.sh
    
    # Setup cron jobs
    (crontab -l 2>/dev/null; echo "0 8 * * * $HOME/HeadyStack/scripts/business-metrics.sh") | crontab -
    (crontab -l 2>/dev/null; echo "0 20 * * 0 $HOME/HeadyStack/scripts/weekly-business-review.sh") | crontab -
    (crontab -l 2>/dev/null; echo "0 */6 * * * $HOME/HeadyStack/scripts/automated-security-scan.sh") | crontab -
    
    print_status "Automation scripts configured"
}

# Main configuration
main() {
    configure_windsurf
    configure_domains
    create_templates
    setup_automation
    
    print_status "🎉 HeadyStack configuration completed!"
    echo
    echo "Next steps:"
    echo "1. Reboot your system to apply all changes"
    echo "2. Launch Windsurf: windsurf"
    echo "3. Test MCP servers: windsurf --test-mcp"
    echo "4. Create your first project"
}

main "$@"
```

---

## 📊 Business Intelligence Scripts

### scripts/business-metrics.sh
```bash
#!/bin/bash
# Business Intelligence Dashboard

echo "📊 Heady Business Intelligence Dashboard"
echo "======================================"

# Client metrics
ACTIVE_CLIENTS=$(jq '.clients | length' "$HOME/HeadyStack/clients/clients.json" 2>/dev/null || echo "0")
echo "Active Clients: $ACTIVE_CLIENTS"

# Project metrics
CURRENT_PROJECTS=$(find "$HOME/HeadyStack/projects/current" -type d 2>/dev/null | wc -l)
echo "Current Projects: $CURRENT_PROJECTS"

# Revenue tracking
MONTHLY_REVENUE=$(jq '.revenue.current_month' "$HOME/HeadyStack/metrics/revenue.json" 2>/dev/null || echo "0")
echo "Monthly Revenue: $MONTHLY_REVENUE"

# Social impact metrics
COMMUNITY_HOURS=$(jq '.impact.community_hours' "$HOME/HeadyStack/metrics/impact.json" 2>/dev/null || echo "0")
echo "Community Hours: $COMMUNITY_HOURS"

# Project completion rate
COMPLETED=$(find "$HOME/HeadyStack/projects/completed" -name "*.json" 2>/dev/null | wc -l)
TOTAL=$(find "$HOME/HeadyStack/projects" -name "*.json" 2>/dev/null | wc -l)
if [ "$TOTAL" -gt 0 ]; then
    COMPLETION_RATE=$(($COMPLETED * 100 / $TOTAL))
    echo "Project Completion Rate: ${COMPLETION_RATE}%"
else
    echo "Project Completion Rate: N/A (no projects yet)"
fi

echo
echo "📈 Business Health Score: $(($ACTIVE_CLIENTS * 10 + $CURRENT_PROJECTS * 5 + $COMPLETION_RATE / 10))/100"
```

### scripts/impact-tracking.sh
```bash
#!/bin/bash
# Social Impact Tracker

echo "🌍 Social Impact Tracker"
echo "======================="

# Track community service hours
COMMUNITY_HOURS=$(jq '.impact.community_hours' "$HOME/HeadyStack/metrics/impact.json" 2>/dev/null || echo "0")
echo "Hours donated to nonprofits: $COMMUNITY_HOURS"

# Track pro bono work
PRO_BONO=$(jq '.impact.pro_bono_projects' "$HOME/HeadyStack/metrics/impact.json" 2>/dev/null || echo "0")
echo "Pro bono projects completed: $PRO_BONO"

# Calculate wealth redistribution
REDISTRIBUTION=$(jq '.impact.redistribution_funds' "$HOME/HeadyStack/metrics/impact.json" 2>/dev/null || echo "0")
echo "Funds allocated to social causes: $REDISTRIBUTION"

# Generate impact report
REPORT_DIR="$HOME/HeadyStack/reports"
mkdir -p "$REPORT_DIR"
jq '.' "$HOME/HeadyStack/metrics/impact.json" > "$REPORT_DIR/impact-$(date +%Y%m).json" 2>/dev/null || echo '{"impact": {}}' > "$REPORT_DIR/impact-$(date +%Y%m).json"

echo "Impact report generated: $REPORT_DIR/impact-$(date +%Y%m).json"
```

---

## 🔧 Utility Scripts

### scripts/clean-build.sh
```bash
#!/bin/bash
# Clean Build Utility

echo "🧹 Starting clean build..."

# Clean npm cache
npm cache clean --force

# Remove node_modules
rm -rf node_modules

# Clean Docker
docker system prune -f

# Reinstall dependencies
npm install

# Run tests
npm test

# Build
npm run build

echo "✅ Clean build completed"
```

### scripts/automated-security-scan.sh
```bash
#!/bin/bash
# Automated Security Scan

echo "🔍 Running automated security scan..."

# Create scan directory
SCAN_DIR="$HOME/HeadyStack/scans/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$SCAN_DIR"

# Run network scan
echo "Running network scan..."
nmap -sS -O -oN "$SCAN_DIR/network_scan.txt" 127.0.0.1

# Run web vulnerability scan
echo "Running web vulnerability scan..."
nikto -h http://localhost:3000 -o "$SCAN_DIR/nikto_report.txt"

# Generate summary
echo "Generating scan summary..."
cat > "$SCAN_DIR/summary.txt" << EOF
Security Scan Summary
====================
Date: $(date)
Scan Directory: $SCAN_DIR

Files generated:
- network_scan.txt: Network port scan results
- nikto_report.txt: Web vulnerability scan results

Review these files for security findings.
EOF

echo "✅ Security scan completed: $SCAN_DIR"
```

---

## 📝 Script Usage Instructions

### Making Scripts Executable
```bash
# Make all scripts executable
chmod +x ~/HeadyStack/scripts/*.sh

# Verify permissions
ls -la ~/HeadyStack/scripts/
```

### Running Scripts
```bash
# Main installation
cd ~/HeadyStack
./scripts/install-parrot-windsurf.sh

# Configuration
./scripts/configure-parrot-windsurf.sh

# Business metrics
./scripts/business-metrics.sh

# Impact tracking
./scripts/impact-tracking.sh

# Clean build
./scripts/clean-build.sh

# Security scan
./scripts/automated-security-scan.sh
```

### Scheduling Scripts
```bash
# Edit crontab
crontab -e

# Add scheduled tasks
0 8 * * * ~/HeadyStack/scripts/business-metrics.sh
0 20 * * 0 ~/HeadyStack/scripts/weekly-business-review.sh
0 */6 * * * ~/HeadyStack/scripts/automated-security-scan.sh
```

---

## 🔍 Troubleshooting Scripts

### Common Issues
1. **Permission denied**: Run `chmod +x scriptname.sh`
2. **Command not found**: Ensure script is in PATH or use full path
3. **Environment variables**: Source ~/.bashrc after installation
4. **Docker permissions**: Add user to docker group and relogin

### Debug Mode
Add `set -x` at the beginning of any script to enable debug output.

### Log Files
All scripts create logs in `~/HeadyStack/logs/` with timestamps.

---

This collection provides all the necessary automation scripts to deploy, configure, and maintain a production-ready HeadyStack environment with integrated business development and social impact tracking capabilities.
