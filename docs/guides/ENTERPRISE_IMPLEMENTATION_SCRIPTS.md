# HeadyStack Enterprise Implementation Scripts Collection

## 🚀 Installation Scripts

### install-parrot-windsurf.sh
```bash
#!/bin/bash
# HeadyStack Enterprise Installation Script
# Parrot OS 7 + Windsurf + Business Development Integration

set -e

echo "🚀 Starting HeadyStack Enterprise Installation..."

# System update
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install core dependencies
echo "🔧 Installing core dependencies..."
sudo apt install -y curl wget git build-essential \
    python3 python3-pip python3-venv nodejs npm \
    docker.io docker-compose podman \
    nmap wireshark metasploit-framework burpsuite \
    john johntheripper hashcat aircrack-ng \
    autopsy volatility sleuthkit \
    postgresql postgresql-contrib redis-server \
    ufw fail2ban htop neofetch

# Install Windsurf
echo "💨 Installing Windsurf Editor..."
curl -fsSL https://windsurf.com/install.sh | sh
sudo ln -sf /usr/local/bin/windsurf /usr/bin/windsurf

# Install MCP servers
echo "🛡️ Installing MCP Security Servers..."
npm install -g @modelcontextprotocol/server-security-tools
npm install -g @modelcontextprotocol/server-filesystem
npm install -g @modelcontextprotocol/server-network-analysis
npm install -g @modelcontextprotocol/server-forensics

# Install business intelligence tools
echo "💼 Installing Business Intelligence Tools..."
npm install -g @headystack/business-metrics
npm install -g @headystack/client-management
npm install -g @headystack/proposal-generator

# Configure Docker
echo "🐳 Configuring Docker..."
sudo usermod -aG docker $USER
sudo systemctl enable docker
sudo systemctl start docker

# Configure PostgreSQL
echo "🗄️ Configuring PostgreSQL..."
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo -u postgres createdb headystack

# Configure Redis
echo "⚡ Configuring Redis..."
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Create HeadyStack directories
echo "📁 Creating HeadyStack directories..."
mkdir -p ~/HeadyStack/{scripts,config,data,templates,logs}
mkdir -p ~/HeadyStack/data/{clients,projects,proposals,invoices,impact}

echo "✅ Installation completed successfully!"
echo "🔄 Run configure-parrot-windsurf.sh next..."
```

### configure-parrot-windsurf.sh
```bash
#!/bin/bash
# HeadyStack Enterprise Configuration Script

set -e

echo "⚙️ Configuring HeadyStack Enterprise Environment..."

# Configure internal domains
echo "🌐 Configuring internal domains..."
sudo tee -a /etc/hosts << 'EOF'
127.0.0.1 manager.dev.local.heady.internal
127.0.0.1 app-web.dev.local.heady.internal
127.0.0.1 tools-mcp.dev.local.heady.internal
127.0.0.1 db-postgres.dev.local.heady.internal
127.0.0.1 db-redis.dev.local.heady.internal
127.0.0.1 ai-ollama.dev.local.heady.internal
127.0.0.1 business-metrics.dev.local.heady.internal
EOF

# Configure Windsurf MCP servers
echo "🛡️ Configuring Windsurf MCP servers..."
mkdir -p ~/.config/windsurf/mcp-servers
cat > ~/.config/windsurf/mcp-servers.json << 'EOF'
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
    "business-intelligence": {
      "command": "mcp-server-business-intelligence",
      "args": ["--mode", "enterprise"],
      "env": {
        "BUSINESS_METRICS_ENABLED": "true",
        "CLIENT_TRACKING": "true",
        "REVENUE_ANALYTICS": "true"
      }
    },
    "network-analysis": {
      "command": "mcp-server-network-analysis",
      "args": ["--interface", "all"],
      "env": {
        "PACKET_CAPTURE": "true",
        "TRAFFIC_ANALYSIS": "true"
      }
    },
    "forensics": {
      "command": "mcp-server-forensics",
      "args": ["--mode", "investigation"],
      "env": {
        "EVIDENCE_CHAIN": "true",
        "HASH_VERIFICATION": "true"
      }
    }
  }
}
EOF

# Configure Windsurf performance
echo "⚡ Configuring Windsurf performance..."
cat > ~/.config/windsurf/performance.json << 'EOF'
{
  "workers": 8,
  "memoryLimit": "24GB",
  "cacheSize": "4GB",
  "parallelProcessing": true,
  "sandboxMode": true,
  "businessIntelligence": {
    "enabled": true,
    "realTimeUpdates": true,
    "clientDashboard": true
  }
}
EOF

# Configure business settings
echo "💼 Configuring business development settings..."
cat > ~/HeadyStack/config/business-config.json << 'EOF'
{
  "business": {
    "name": "HeadyStack Security Consulting",
    "version": "1.0.0",
    "revenue_model": {
      "hourly_rate": 150,
      "project_minimum": 1000,
      "retainer_monthly": 2500
    },
    "social_impact": {
      "pro_bono_percentage": 0.30,
      "community_hours_target": 40,
      "nonprofit_discount": 0.30
    },
    "automation": {
      "proposal_generation": true,
      "client_followup": true,
      "weekly_reports": true,
      "impact_tracking": true
    }
  }
}
EOF

# Configure security settings
echo "🔒 Configuring security settings..."
sudo ufw enable
sudo ufw allow 3000:3305/tcp comment "Heady services"
sudo ufw allow 5432,6379,11434/tcp comment "Databases and LLM"
sudo ufw allow 22/tcp comment "SSH"

# Configure fail2ban
echo "🚨 Configuring fail2ban..."
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Set environment variables
echo "🌍 Setting environment variables..."
cat >> ~/.bashrc << 'EOF'
export HEADY_AUDIT_LOG=true
export WINDSURF_SANDBOX=true
export BUSINESS_METRICS_ENABLED=true
export SOCIAL_IMPACT_TRACKING=true
EOF

# Create business intelligence config
echo "📊 Configuring business intelligence..."
cat > ~/HeadyStack/config/metrics-config.json << 'EOF'
{
  "metrics": {
    "revenue_tracking": {
      "enabled": true,
      "sources": ["invoices", "retainers", "projects"],
      "social_impact_allocation": 0.30
    },
    "client_satisfaction": {
      "enabled": true,
      "survey_frequency": "quarterly",
      "target_score": 4.5
    },
    "project_efficiency": {
      "enabled": true,
      "metrics": ["on_time_delivery", "budget_adherence", "quality_score"]
    },
    "social_impact": {
      "enabled": true,
      "metrics": ["community_hours", "pro_bono_value", "nonprofit_discounts"]
    }
  }
}
EOF

echo "✅ Configuration completed successfully!"
echo "🚀 Launch Windsurf with: windsurf"
```

## 💼 Business Development Scripts

### setup-business-intelligence.sh
```bash
#!/bin/bash
# Business Intelligence Setup Script

set -e

echo "💼 Setting up Business Intelligence System..."

# Initialize client database
echo "👥 Initializing client database..."
mkdir -p ~/HeadyStack/data/clients
cat > ~/HeadyStack/data/clients/clients.json << 'EOF'
{
  "clients": [],
  "active_projects": [],
  "revenue_tracking": {
    "total_revenue": 0,
    "social_impact_allocated": 0,
    "pro_bono_value": 0
  }
}
EOF

# Initialize project database
echo "📂 Initializing project database..."
mkdir -p ~/HeadyStack/data/projects
cat > ~/HeadyStack/data/projects/projects.json << 'EOF'
{
  "projects": [],
  "active_engagements": [],
  "completed_projects": [],
  "project_types": {
    "security_audit": [],
    "penetration_testing": [],
    "forensics": [],
    "pro_bono": []
  }
}
EOF

# Create proposal templates
echo "📄 Creating proposal templates..."
mkdir -p ~/HeadyStack/templates/proposals
cat > ~/HeadyStack/templates/proposals/security-audit-template.md << 'EOF'
# Security Audit Proposal

## Client: {{client_name}}
## Date: {{current_date}}
## Duration: {{estimated_days}} days
## Investment: ${{total_cost}}

### Executive Summary
{{executive_summary}}

### Scope of Work
{{scope_description}}

### Deliverables
{{deliverables}}

### Timeline
{{timeline}}

### Investment Breakdown
- Security Audit: ${{audit_cost}}
- Reporting: ${{reporting_cost}}
- Follow-up: ${{followup_cost}}
- **Total: ${{total_cost}}**

### Social Impact Commitment
30% of project revenue will be allocated to:
- Community security education
- Pro bono security audits for nonprofits
- Open-source security tool development

### Next Steps
1. Accept proposal
2. Kickoff meeting scheduled
3. Initial assessment begins within 48 hours

---
*HeadyStack Security Consulting - Maximizing Security, Maximizing Social Impact*
EOF

# Start business metrics service
echo "📊 Starting business metrics service..."
systemctl --user enable heady-business-metrics 2>/dev/null || true
systemctl --user start heady-business-metrics 2>/dev/null || true

echo "✅ Business Intelligence setup completed!"
```

### client-management.sh
```bash
#!/bin/bash
# Client Management Script

CLIENT_DB="$HOME/HeadyStack/data/clients/clients.json"

case "$1" in
  "add")
    echo "Adding new client..."
    echo "Enter client name:"
    read client_name
    echo "Enter client email:"
    read client_email
    echo "Enter client phone:"
    read client_phone
    echo "Enter client industry:"
    read client_industry
    
    # Add client to database
    jq ".clients += [{\"name\": \"$client_name\", \"email\": \"$client_email\", \"phone\": \"$client_phone\", \"industry\": \"$client_industry\", \"status\": \"active\", \"created\": \"$(date -Iseconds)\"}]" "$CLIENT_DB" > "$CLIENT_DB.tmp" && mv "$CLIENT_DB.tmp" "$CLIENT_DB"
    echo "✅ Client added successfully!"
    ;;
    
  "list")
    echo "Active Clients:"
    jq -r '.clients[] | "- \(.name) (\(.email)) - \(.status)' "$CLIENT_DB"
    ;;
    
  "projects")
    echo "Active Projects:"
    jq -r '.active_projects[] | "- \(.project_name) for \(.client_name) - \(.status)' "$CLIENT_DB"
    ;;
    
  "revenue")
    echo "Revenue Summary:"
    echo "Total Revenue: $$(jq -r '.revenue_tracking.total_revenue' "$CLIENT_DB")"
    echo "Social Impact Allocated: $$(jq -r '.revenue_tracking.social_impact_allocated' "$CLIENT_DB")"
    echo "Pro Bono Value: $$(jq -r '.revenue_tracking.pro_bono_value' "$CLIENT_DB")"
    ;;
    
  *)
    echo "Usage: $0 {add|list|projects|revenue}"
    ;;
esac
```

### generate-proposal.sh
```bash
#!/bin/bash
# Automated Proposal Generation Script

TEMPLATE_DIR="$HOME/HeadyStack/templates/proposals"
OUTPUT_DIR="$HOME/HeadyStack/data/proposals"

case "$1" in
  "security-audit")
    echo "Generating Security Audit Proposal..."
    echo "Enter client name:"
    read client_name
    echo "Enter estimated duration (days):"
    read estimated_days
    echo "Enter hourly rate (default: $150):"
    read hourly_rate
    hourly_rate=${hourly_rate:-150}
    
    total_cost=$((estimated_days * 8 * hourly_rate))
    current_date=$(date +%Y-%m-%d)
    
    # Generate proposal from template
    sed -e "s/{{client_name}}/$client_name/g" \
        -e "s/{{current_date}}/$current_date/g" \
        -e "s/{{estimated_days}}/$estimated_days/g" \
        -e "s/{{total_cost}}/$total_cost/g" \
        "$TEMPLATE_DIR/security-audit-template.md" > "$OUTPUT_DIR/${client_name}-security-audit-$(date +%Y%m%d).md"
    
    echo "✅ Proposal generated: $OUTPUT_DIR/${client_name}-security-audit-$(date +%Y%m%d).md"
    ;;
    
  "custom")
    echo "Generating Custom Proposal..."
    echo "Enter proposal type:"
    read proposal_type
    echo "Enter client name:"
    read client_name
    
    # Create custom proposal template
    cat > "$OUTPUT_DIR/${client_name}-${proposal_type}-$(date +%Y%m%d).md" << EOF
# ${proposal_type^} Proposal

## Client: ${client_name}
## Date: $(date +%Y-%m-%d)

### Scope of Work
[Detailed scope to be defined]

### Deliverables
[Deliverables to be specified]

### Investment
[Pricing to be determined]

### Social Impact Commitment
30% of project revenue will be allocated to social impact initiatives.

---
*HeadyStack Security Consulting*
EOF
    
    echo "✅ Custom proposal template created: $OUTPUT_DIR/${client_name}-${proposal_type}-$(date +%Y%m%d).md"
    ;;
    
  *)
    echo "Usage: $0 {security-audit|custom}"
    ;;
esac
```

## 🌍 Social Impact Scripts

### impact-tracker.sh
```bash
#!/bin/bash
# Social Impact Tracking Script

IMPACT_DB="$HOME/HeadyStack/data/impact/impact.json"

# Initialize impact database if it doesn't exist
if [ ! -f "$IMPACT_DB" ]; then
    mkdir -p "$(dirname "$IMPACT_DB")"
    cat > "$IMPACT_DB" << 'EOF'
{
  "community_hours": {
    "total": 0,
    "monthly": 0,
    "activities": []
  },
  "pro_bono_projects": {
    "total_value": 0,
    "completed": 0,
    "ongoing": 0,
    "projects": []
  },
  "wealth_redistribution": {
    "total_allocated": 0,
    "recipients": [],
    "initiatives": []
  }
}
EOF
fi

case "$1" in
  "add-hours")
    echo "Adding community service hours..."
    echo "Enter hours contributed:"
    read hours
    echo "Enter activity description:"
    read activity
    echo "Enter organization benefited:"
    read organization
    
    jq ".community_hours.total += $hours | .community_hours.monthly += $hours | .community_hours.activities += [{\"date\": \"$(date -Iseconds)\", \"hours\": $hours, \"activity\": \"$activity\", \"organization\": \"$organization\"}]" "$IMPACT_DB" > "$IMPACT_DB.tmp" && mv "$IMPACT_DB.tmp" "$IMPACT_DB"
    echo "✅ Added $hours community service hours!"
    ;;
    
  "add-probono")
    echo "Adding pro bono project..."
    echo "Enter project name:"
    read project_name
    echo "Enter client organization:"
    read client_org
    echo "Enter estimated value ($):"
    read project_value
    echo "Enter status (ongoing/completed):"
    read project_status
    
    jq ".pro_bono_projects.total_value += $project_value | .pro_bono_projects.projects += [{\"name\": \"$project_name\", \"client\": \"$client_org\", \"value\": $project_value, \"status\": \"$project_status\", \"date\": \"$(date -Iseconds)\"}]" "$IMPACT_DB" > "$IMPACT_DB.tmp" && mv "$IMPACT_DB.tmp" "$IMPACT_DB"
    
    if [ "$project_status" = "completed" ]; then
        jq ".pro_bono_projects.completed += 1" "$IMPACT_DB" > "$IMPACT_DB.tmp" && mv "$IMPACT_DB.tmp" "$IMPACT_DB"
    else
        jq ".pro_bono_projects.ongoing += 1" "$IMPACT_DB" > "$IMPACT_DB.tmp" && mv "$IMPACT_DB.tmp" "$IMPACT_DB"
    fi
    
    echo "✅ Added pro bono project: $project_name"
    ;;
    
  "allocate-funds")
    echo "Allocating funds to social impact..."
    echo "Enter amount allocated ($):"
    read amount
    echo "Enter initiative name:"
    read initiative
    echo "Enter recipient organization:"
    read recipient
    
    jq ".wealth_redistribution.total_allocated += $amount | .wealth_redistribution.initiatives += [{\"name\": \"$initiative\", \"recipient\": \"$recipient\", \"amount\": $amount, \"date\": \"$(date -Iseconds)\"}]" "$IMPACT_DB" > "$IMPACT_DB.tmp" && mv "$IMPACT_DB.tmp" "$IMPACT_DB"
    echo "✅ Allocated $$amount to $initiative"
    ;;
    
  "status")
    echo "🌍 Social Impact Status Report"
    echo "============================="
    echo "Community Service Hours: $(jq -r '.community_hours.total' "$IMPACT_DB")"
    echo "This Month: $(jq -r '.community_hours.monthly' "$IMPACT_DB")"
    echo ""
    echo "Pro Bono Projects:"
    echo "  Total Value: $$(jq -r '.pro_bono_projects.total_value' "$IMPACT_DB")"
    echo "  Completed: $(jq -r '.pro_bono_projects.completed' "$IMPACT_DB")"
    echo "  Ongoing: $(jq -r '.pro_bono_projects.ongoing' "$IMPACT_DB")"
    echo ""
    echo "Wealth Redistribution:"
    echo "  Total Allocated: $$(jq -r '.wealth_redistribution.total_allocated' "$IMPACT_DB")"
    echo "  Initiatives: $(jq -r '.wealth_redistribution.initiatives | length' "$IMPACT_DB")"
    ;;
    
  "report")
    echo "Generating impact report..."
    report_date=$(date +%Y-%m-%d)
    report_file="$HOME/HeadyStack/data/impact/impact-report-$report_date.md"
    
    cat > "$report_file" << EOF
# Social Impact Report - $report_date

## Community Service
- **Total Hours**: $(jq -r '.community_hours.total' "$IMPACT_DB")
- **This Month**: $(jq -r '.community_hours.monthly' "$IMPACT_DB")
- **Recent Activities**:
$(jq -r '.community_hours.activities[-5:][] | "- \(.activity) for \(.organization) (\(.hours) hours)"' "$IMPACT_DB")

## Pro Bono Work
- **Total Value**: $$(jq -r '.pro_bono_projects.total_value' "$IMPACT_DB")
- **Completed Projects**: $(jq -r '.pro_bono_projects.completed' "$IMPACT_DB")
- **Ongoing Projects**: $(jq -r '.pro_bono_projects.ongoing' "$IMPACT_DB")

## Wealth Redistribution
- **Total Allocated**: $$(jq -r '.wealth_redistribution.total_allocated' "$IMPACT_DB")
- **Initiatives Supported**: $(jq -r '.wealth_redistribution.initiatives | length' "$IMPACT_DB")

---
*Report generated on $(date)*
EOF
    
    echo "✅ Impact report generated: $report_file"
    ;;
    
  *)
    echo "Usage: $0 {add-hours|add-probono|allocate-funds|status|report}"
    ;;
esac
```

### weekly-business-review.sh
```bash
#!/bin/bash
# Weekly Business Review Automation Script

BUSINESS_DB="$HOME/HeadyStack/data/clients/clients.json"
PROJECT_DB="$HOME/HeadyStack/data/projects/projects.json"
IMPACT_DB="$HOME/HeadyStack/data/impact/impact.json"

echo "📊 Generating Weekly Business Review..."

# Create weekly review report
report_date=$(date +%Y-%m-%d)
report_file="$HOME/HeadyStack/data/weekly-review-$report_date.md"

cat > "$report_file" << EOF
# Weekly Business Review - $report_date

## Executive Summary
- **Active Clients**: $(jq -r '.clients | length' "$BUSINESS_DB")
- **Active Projects**: $(jq -r '.active_projects | length' "$PROJECT_DB")
- **Total Revenue**: $$(jq -r '.revenue_tracking.total_revenue' "$BUSINESS_DB")
- **Social Impact**: $$(jq -r '.revenue_tracking.social_impact_allocated' "$BUSINESS_DB")

## Client Portfolio
### Active Clients
$(jq -r '.clients[] | "- \(.name) (\(.industry))"' "$BUSINESS_DB")

## Project Pipeline
### Active Engagements
$(jq -r '.active_projects[] | "- \(.project_name) for \(.client_name) - \(.status) - Budget: $\(.budget // "TBD")"' "$PROJECT_DB")

## Financial Performance
### Revenue Breakdown
- **Total Revenue**: $$(jq -r '.revenue_tracking.total_revenue' "$BUSINESS_DB")
- **Social Impact Allocation**: $$(jq -r '.revenue_tracking.social_impact_allocated' "$BUSINESS_DB")
- **Pro Bono Value**: $$(jq -r '.revenue_tracking.pro_bono_value' "$BUSINESS_DB")

### Revenue by Project Type
$(jq -r '.projects | group_by(.type) | map({type: .[0].type, count: length, total: map(.budget | tonumber // 0) | add}) | .[] | "- \(.type): \(.count) projects, $\(.total)"' "$PROJECT_DB")

## Social Impact Metrics
### Community Service
- **Total Hours**: $(jq -r '.community_hours.total' "$IMPACT_DB")
- **This Month**: $(jq -r '.community_hours.monthly' "$IMPACT_DB")

### Pro Bono Work
- **Total Value**: $$(jq -r '.pro_bono_projects.total_value' "$IMPACT_DB")
- **Completed**: $(jq -r '.pro_bono_projects.completed' "$IMPACT_DB")
- **Ongoing**: $(jq -r '.pro_bono_projects.ongoing' "$IMPACT_DB")

## Key Performance Indicators
- **Average Project Value**: $$(echo "scale=2; $(jq -r '.revenue_tracking.total_revenue' "$BUSINESS_DB") / $(jq -r '.active_projects | length' "$PROJECT_DB")" | bc)
- **Social Impact Percentage**: $(echo "scale=1; $(jq -r '.revenue_tracking.social_impact_allocated' "$BUSINESS_DB") * 100 / $(jq -r '.revenue_tracking.total_revenue' "$BUSINESS_DB")" | bc)%
- **Client Satisfaction**: TBD (Survey pending)

## Action Items
- [ ] Follow up with clients for satisfaction surveys
- [ ] Review project pipeline for next quarter
- [ ] Schedule community service activities
- [ ] Update pro bono project proposals
- [ ] Review revenue allocation for social impact

## Next Week's Focus
1. Client relationship management
2. Project delivery optimization
3. Social impact initiative planning
4. Business development outreach

---
*Generated automatically on $(date)*
EOF

echo "✅ Weekly business review generated: $report_file"

# Send notification (if configured)
if command -v notify-send &> /dev/null; then
    notify-send "HeadyStack Business Review" "Weekly report generated: $report_file"
fi
```

## 🔧 Utility Scripts

### migrate-localhost-to-domains.js
```javascript
#!/usr/bin/env node
// Migrate localhost references to internal domains

const fs = require('fs');
const path = require('path');

const domainMappings = {
    'localhost:3000': 'app-web.dev.local.heady.internal:3000',
    'localhost:3300': 'manager.dev.local.heady.internal:3300',
    'localhost:3001': 'tools-mcp.dev.local.heady.internal:3001',
    'localhost:5432': 'db-postgres.dev.local.heady.internal:5432',
    'localhost:6379': 'db-redis.dev.local.heady.internal:6379',
    'localhost:11434': 'ai-ollama.dev.local.heady.internal:11434'
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verifyOnly = args.includes('--verify-only');

function migrateFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let changes = 0;
    
    for (const [localhost, domain] of Object.entries(domainMappings)) {
        const regex = new RegExp(localhost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        if (content.match(regex)) {
            changes += (content.match(regex) || []).length;
            if (!dryRun && !verifyOnly) {
                content = content.replace(regex, domain);
            }
        }
    }
    
    if (changes > 0) {
        console.log(`${dryRun || verifyOnly ? '[CHECK]' : '[UPDATED]'} ${filePath}: ${changes} changes`);
        if (!dryRun && !verifyOnly) {
            fs.writeFileSync(filePath, content);
        }
    }
}

function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            scanDirectory(filePath);
        } else if (file.match(/\.(js|json|yaml|yml|md|sh|conf|config)$/)) {
            migrateFile(filePath);
        }
    }
}

console.log(dryRun ? '🔍 Dry run mode - no changes will be made' : 
       verifyOnly ? '✅ Verification mode - checking domain usage' :
       '🔄 Migrating localhost to internal domains...');

scanDirectory(process.cwd() || '.');

if (!dryRun && !verifyOnly) {
    console.log('✅ Migration completed!');
} else if (verifyOnly) {
    console.log('✅ Verification completed!');
}
```

### automated-security-scan.sh
```bash
#!/bin/bash
# Automated Security Scanning Script

SCAN_DIR="$HOME/HeadyStack/scans"
REPORT_DIR="$HOME/HeadyStack/reports"
TARGETS_FILE="$HOME/HeadyStack/config/scan-targets.txt"

mkdir -p "$SCAN_DIR" "$REPORT_DIR"

echo "🔍 Starting automated security scan..."

# Load targets
if [ ! -f "$TARGETS_FILE" ]; then
    echo "⚠️ No targets file found. Creating example..."
    cat > "$TARGETS_FILE" << 'EOF'
# Add scan targets (one per line)
# Format: target_name:target_ip:scan_type
# Example: web-server:192.168.1.100:web
# Example: network:192.168.1.0/24:network
EOF
    echo "✅ Created example targets file: $TARGETS_FILE"
    echo "📝 Please edit the file and add your targets"
    exit 0
fi

# Process each target
while IFS=':' read -r name target type; do
    # Skip comments and empty lines
    [[ "$name" =~ ^#.*$ ]] && continue
    [[ -z "$name" ]] && continue
    
    echo "🎯 Scanning $name ($target) - Type: $type"
    
    timestamp=$(date +%Y%m%d_%H%M%S)
    scan_file="$SCAN_DIR/${name}_${timestamp}.xml"
    report_file="$REPORT_DIR/${name}_${timestamp}.txt"
    
    case "$type" in
        "web")
            echo "🌐 Running web application scan..."
            nmap -sV -sC -oX "$scan_file" -p 80,443,8080,8443 "$target"
            ;;
        "network")
            echo "🌐 Running network scan..."
            nmap -sV -sC -oX "$scan_file" "$target"
            ;;
        "full")
            echo "🌐 Running comprehensive scan..."
            nmap -p- -sV -sC -oX "$scan_file" "$target"
            ;;
        *)
            echo "⚠️ Unknown scan type: $type (skipping)"
            continue
            ;;
    esac
    
    # Generate report
    echo "📊 Generating scan report for $name..."
    cat > "$report_file" << EOF
# Security Scan Report - $name
**Target**: $target  
**Scan Type**: $type  
**Date**: $(date)  
**Scan ID**: ${name}_${timestamp}

## Executive Summary
[Automated analysis would go here]

## Detailed Findings
\`nmap\` results:
\`\`\`
$(nmap -oX "$scan_file" "$target" | xsltproc --html -)
\`\`\`

## Recommendations
[Automated recommendations would go here]

---
*Report generated by HeadyStack Automated Security Scanner*
EOF
    
    echo "✅ Scan completed for $name - Report: $report_file"
done < "$TARGETS_FILE"

echo "🎉 All scans completed!"
echo "📁 Reports available in: $REPORT_DIR"
```

### clean-build.sh
```bash
#!/bin/bash
# Clean Build Script for Zero-Blind-Rebuild Architecture

set -e

echo "🧹 Starting clean build process..."

# Clean environment
echo "🗑️ Cleaning build artifacts..."
rm -rf node_modules/.cache
rm -rf dist build
rm -rf .npm
npm cache clean --force

# Clean Docker artifacts
echo "🐳 Cleaning Docker artifacts..."
docker system prune -f
docker volume prune -f

# Reset git to clean state
echo "🔄 Resetting git to clean state..."
git clean -fdx
git reset --hard HEAD

# Install dependencies deterministically
echo "📦 Installing dependencies deterministically..."
npm ci --production=false

# Run comprehensive tests
echo "🧪 Running comprehensive test suite..."
npm run test:unit
npm run test:integration
npm run test:e2e

# Run security scans
echo "🔒 Running security scans..."
npm audit --audit-level moderate
npm run security:scan

# Build application
echo "🏗️ Building application..."
npm run build

# Validate build
echo "✅ Validating build..."
npm run validate

# Generate build report
echo "📊 Generating build report..."
build_report="$HOME/HeadyStack/builds/build-$(date +%Y%m%d_%H%M%S).json"
cat > "$build_report" << EOF
{
  "build_id": "$(date +%Y%m%d_%H%M%S)",
  "timestamp": "$(date -Iseconds)",
  "git_commit": "$(git rev-parse HEAD)",
  "git_branch": "$(git branch --show-current)",
  "node_version": "$(node --version)",
  "npm_version": "$(npm --version)",
  "build_duration": "$(echo $SECONDS)",
  "test_results": {
    "unit": "passed",
    "integration": "passed",
    "e2e": "passed"
  },
  "security_scan": "passed",
  "build_status": "success"
}
EOF

echo "✅ Clean build completed successfully!"
echo "📊 Build report: $build_report"
```

## 📋 Usage Instructions

### Quick Start
```bash
# 1. Install HeadyStack Enterprise
cd ~/HeadyStack
chmod +x scripts/install-parrot-windsurf.sh
./scripts/install-parrot-windsurf.sh

# 2. Configure environment
chmod +x scripts/configure-parrot-windsurf.sh
./scripts/configure-parrot-windsurf.sh

# 3. Setup business intelligence
chmod +x scripts/setup-business-intelligence.sh
./scripts/setup-business-intelligence.sh

# 4. Launch Windsurf
windsurf
```

### Business Development Workflow
```bash
# Add new client
./scripts/client-management.sh add

# Generate security audit proposal
./scripts/generate-proposal.sh security-audit

# Track community service hours
./scripts/impact-tracker.sh add-hours

# Generate weekly business review
./scripts/weekly-business-review.sh

# View social impact status
./scripts/impact-tracker.sh status
```

### Automation Setup
```bash
# Add to crontab for automated tasks
crontab -e

# Add these lines:
# 0 */6 * * * ~/HeadyStack/scripts/automated-security-scan.sh
# 0 9 * * 1 ~/HeadyStack/scripts/weekly-business-review.sh
# 0 8 1 * * ~/HeadyStack/scripts/impact-tracker.sh report
# 0 2 * * * cd ~/HeadyStack && ./scripts/clean-build.sh
```

### Monitoring and Maintenance
```bash
# Check system status
./scripts/system-health-check.sh

# Verify configuration
windsurf --config-check

# Test MCP servers
windsurf --test-mcp

# Generate business metrics report
./scripts/business-metrics.sh report
```

---

## 🎯 Success Metrics

### Installation Success
- [ ] All scripts execute without errors
- [ ] Windsurf launches and connects to MCP servers
- [ ] Business intelligence dashboard accessible
- [ ] Client management system functional
- [ ] Social impact tracking operational

### Business Success
- [ ] Client database populated
- [ ] Proposal generation working
- [ ] Revenue tracking active
- [ ] Weekly reports generating
- [ ] Social impact metrics collecting

### Technical Success
- [ ] All services discoverable via internal domains
- [ ] Security tools integrated and accessible
- [ ] Automated scans running on schedule
- [ ] Clean builds completing successfully
- [ ] Performance benchmarks met

---

**🚀 Your HeadyStack Enterprise deployment is now complete with full business development automation and social impact integration!**
