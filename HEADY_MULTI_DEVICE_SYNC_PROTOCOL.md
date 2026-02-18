# Heady Multi-Device Synchronization and Configuration Protocol

## Overview
This protocol ensures consistent Heady development and operations setup across three desktop environments (VM, laptop, mini computer) and provides a foundation for mobile device integration. All configurations use network endpoints rather than localhost.

## 1. Canonical Backend and Registry Alignment

### Primary Backend Selection
Choose ONE canonical Heady backend for all devices:

**Environment Variables Template:**
```bash
# Primary Heady Backend (replace with your actual domain)
HEADY_API_BASE=https://your-heady-domain.com/api
HEADY_REGISTRY_BASE=https://your-heady-domain.com/registry
HEADY_WS_BASE=wss://your-heady-domain.com/ws

# Authentication
HEADY_API_KEY=your-api-key-here
HEADY_WORKSPACE=default

# Model Provider Configuration
ANTHROPIC_API_KEY=your-claude-key
OPENAI_API_KEY=your-openai-key (optional)

# External Services
RENDER_API_KEY=your-render-key
DATABASE_URL=your-db-connection-string
```

### Registry Configuration
Ensure all registry entries reference the canonical backend:

```json
{
  "services": {
    "heady-manager": {
      "endpoint": "${HEADY_API_BASE}",
      "status": "active",
      "version": "3.0.0"
    },
    "model-router": {
      "endpoint": "${HEADY_API_BASE}/models",
      "providers": ["anthropic", "openai", "local"],
      "default": "anthropic"
    },
    "mcp-gateway": {
      "endpoint": "${HEADY_API_BASE}/mcp",
      "servers": ["filesystem", "git", "render", "browser"]
    }
  }
}
```

## 2. Git Repository Configuration

### Standard Git Configuration
Apply to ALL three devices:

```bash
# Remote Configuration (update with your actual remotes)
git remote add origin https://github.com/HeadySystems/Heady.git
git remote add heady-me https://github.com/HeadySystems/HeadyMe.git
git remote add heady-sys https://github.com/HeadySystems/HeadySys.git
git remote add connection https://github.com/HeadySystems/HeadyConnection.git

# Branch Configuration
git checkout main
git branch --set-upstream-to=origin/main main
git config --global pull.rebase false
git config --global push.default simple
```

### Cross-Device Sync Script
Create `heady-sync.sh` for all devices:

```bash
#!/bin/bash
echo "Heady Multi-Device Sync"
echo "======================="

# Fetch all remotes
git fetch --all --prune

# Pull latest from origin
git pull origin main

# Sync submodules if any
git submodule update --init --recursive

# Update dependencies
npm install
pip install -r requirements.txt

# Verify configuration
echo "Configuration check:"
echo "HEADY_API_BASE: $HEADY_API_BASE"
echo "Current branch: $(git branch --show-current)"
echo "Latest commit: $(git log -1 --oneline)"
```

## 3. Windsurf Configuration

### Project-Level Configuration
Create `.windsurf/project.json` for ALL devices:

```json
{
  "name": "Heady Development",
  "version": "1.0.0",
  "assistant": {
    "default": "heady",
    "endpoint": "${HEADY_API_BASE}",
    "apiKey": "${HEADY_API_KEY}",
    "fallback": "claude"
  },
  "mcp": {
    "servers": [
      {
        "name": "heady-filesystem",
        "command": "node",
        "args": ["mcp-servers/filesystem-mcp.js"],
        "env": {
          "HEADY_API_BASE": "${HEADY_API_BASE}",
          "HEADY_API_KEY": "${HEADY_API_KEY}"
        }
      },
      {
        "name": "heady-git",
        "command": "node", 
        "args": ["mcp-servers/git-mcp.js"],
        "env": {
          "HEADY_API_BASE": "${HEADY_API_BASE}"
        }
      },
      {
        "name": "render-mcp",
        "command": "node",
        "args": ["mcp-servers/render-mcp-server.js"],
        "env": {
          "RENDER_API_KEY": "${RENDER_API_KEY}"
        }
      }
    ]
  },
  "tools": {
    "enabled": ["heady-chat", "heady-dev", "heady-voice", "heady-browser"],
    "claude": {
      "enabled": true,
      "priority": "high",
      "useFor": ["code-review", "complex-analysis", "documentation"]
    }
  }
}
```

### Device-Specific Settings
Create device identification without localhost:

```bash
# Device Identification (add to .bashrc or .zshrc)
export HEADY_DEVICE_ID=$(hostname)-$(whoami)
export HEADY_DEVICE_TYPE="desktop"  # or "vm", "laptop", "mini"

# Device-Specific Logging
export HEADY_LOG_PREFIX="[$HEADY_DEVICE_ID]"
```

## 4. HeadyStack Services Configuration

### Distribution Profile Selection
Choose ONE profile for all desktop devices:

**cloud-saas-api-only Profile:**
```yaml
# heady-stack-config.yaml
profile: cloud-saas-api-only
backend:
  endpoint: "${HEADY_API_BASE}"
  mode: remote
services:
  - heady-api
  - model-router
  - mcp-gateway
  - heady-rag
disabled:
  - local-database
  - local-model-runner
```

### Docker Configuration (if needed)
```yaml
# docker-compose.override.yml
version: '3.8'
services:
  heady-manager:
    environment:
      - HEADY_API_BASE=${HEADY_API_BASE}
      - HEADY_DEVICE_ID=${HEADY_DEVICE_ID}
    ports:
      - "3300:3300"  # Only for local health checks
    networks:
      - heady-network

networks:
  heady-network:
    driver: bridge
```

## 5. Claude Integration Verification

### Claude Configuration Check
Create `verify-claude.sh`:

```bash
#!/bin/bash
echo "Claude Integration Verification"
echo "==============================="

# Check environment variables
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ ANTHROPIC_API_KEY not set"
    exit 1
fi

# Test Claude availability
echo "Testing Claude endpoint..."
curl -s -X POST "${HEADY_API_BASE}/models/claude/test" \
  -H "Authorization: Bearer ${HEADY_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, test message"}' | jq .

# Check model router configuration
echo "Checking model router..."
curl -s "${HEADY_API_BASE}/models/config" | jq '.providers.anthropic'
```

### Usage Smoke Test
```bash
#!/bin/bash
# claude-smoke-test.sh
echo "Running Claude smoke test..."

# Test via API
RESPONSE=$(curl -s -X POST "${HEADY_API_BASE}/api/pipeline/claude" \
  -H "Authorization: Bearer ${HEADY_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"task": "analyze", "input": "Simple test input"}')

if echo "$RESPONSE" | jq -e '.provider == "anthropic"' > /dev/null; then
    echo "✅ Claude integration working"
else
    echo "❌ Claude integration failed"
    echo "$RESPONSE"
fi
```

## 6. Heady Browser and Buddy Configuration

### Cross-Device Browser Configuration
```json
{
  "heady-browser": {
    "version": "1.0.0",
    "backend": "${HEADY_API_BASE}",
    "workspace": "${HEADY_WORKSPACE}",
    "buddy": {
      "endpoint": "${HEADY_API_BASE}/buddy",
      "autoStart": true,
      "position": "sidebar"
    },
    "sync": {
      "tabs": true,
      "bookmarks": true,
      "history": true,
      "workspace": "${HEADY_WORKSPACE}"
    }
  }
}
```

### Buddy Widget Configuration
```json
{
  "heady-buddy": {
    "endpoint": "${HEADY_API_BASE}/buddy",
    "workspace": "${HEADY_WORKSPACE}",
    "device": "${HEADY_DEVICE_ID}",
    "features": {
      "chat": true,
      "voice": true,
      "automation": true,
      "impact": true
    },
    "ui": {
      "theme": "system",
      "position": "bottom-right"
    }
  }
}
```

## 7. Mobile Device Integration

### Mobile App Bundle Configuration
```bash
# Mobile deployment script
#!/bin/bash
echo "Deploying Heady Mobile Apps"

# Base configuration for all mobile apps
export HEADY_MOBILE_BASE="${HEADY_API_BASE}"
export HEADY_MOBILE_WORKSPACE="${HEADY_WORKSPACE}"

# Install core apps
adb install heady-chat.apk
adb install heady-voice.apk  
adb install heady-browser.apk

# Configure each app
adb shell am start -n com.heady.chat/.MainActivity \
  --es "api_base" "$HEADY_MOBILE_BASE" \
  --es "workspace" "$HEADY_MOBILE_WORKSPACE"

adb shell am start -n com.heady.voice/.MainActivity \
  --es "api_base" "$HEADY_MOBILE_BASE" \
  --es "workspace" "$HEADY_MOBILE_WORKSPACE"
```

### Mobile Configuration Template
```json
{
  "mobile-config": {
    "api_base": "${HEADY_API_BASE}",
    "workspace": "${HEADY_WORKSPACE}",
    "auth": {
      "method": "api_key",
      "key": "${HEADY_API_KEY}"
    },
    "features": {
      "offline": false,
      "sync": true,
      "notifications": true
    },
    "model_routing": {
      "default": "anthropic",
      "fallback": "local"
    }
  }
}
```

## 8. Health Monitoring and Validation

### System Health Check Script
Create `heady-health-check.sh`:

```bash
#!/bin/bash
echo "Heady System Health Check"
echo "========================"
echo "Device: $HEADY_DEVICE_ID"
echo "Timestamp: $(date)"
echo

# API Health
echo "🔍 API Health:"
curl -s "${HEADY_API_BASE}/health" | jq .

# Model Router
echo "🤖 Model Router:"
curl -s "${HEADY_API_BASE}/models/status" | jq .

# MCP Gateway
echo "🔌 MCP Gateway:"
curl -s "${HEADY_API_BASE}/mcp/status" | jq .

# Tool Usage
echo "🛠️ Tool Usage (last 24h):"
curl -s "${HEADY_API_BASE}/tools/usage?period=24h" | jq .

# Claude Status
echo "🧠 Claude Status:"
curl -s "${HEADY_API_BASE}/models/claude/status" | jq .

echo
echo "✅ Health check complete"
```

### Cross-Device Validation
Create `validate-multi-device.sh`:

```bash
#!/bin/bash
echo "Multi-Device Configuration Validation"
echo "===================================="

# Expected devices (update with your actual hostnames)
DEVICES=("vm-name" "laptop-name" "mini-name")

for device in "${DEVICES[@]}"; do
    echo "Checking $device..."
    
    # Check if device is reachable
    if ping -c 1 "$device" &> /dev/null; then
        echo "✅ $device reachable"
        
        # Check Heady API from device
        ssh "$device" "curl -s \${HEADY_API_BASE}/health | jq -r .status" | \
            grep -q "healthy" && echo "✅ $device Heady API healthy" || echo "❌ $device Heady API unhealthy"
    else
        echo "❌ $device unreachable"
    fi
    echo
done
```

## 9. Tool Usage Auditing

### Tool Usage Audit Script
Create `audit-tool-usage.sh`:

```bash
#!/bin/bash
echo "Heady Tool Usage Audit"
echo "====================="

# Get usage statistics
USAGE_DATA=$(curl -s "${HEADY_API_BASE}/tools/usage?period=7d")

# Check Claude usage specifically
CLAUDE_USAGE=$(echo "$USAGE_DATA" | jq '.tools.claude.usage_count')
echo "Claude usage (7 days): $CLAUDE_USAGE"

if [ "$CLAUDE_USAGE" -eq 0 ]; then
    echo "⚠️  Claude configured but unused"
    echo "Possible causes:"
    echo "  - Missing routing rules"
    echo "  - API key issues"
    echo "  - Cost constraints"
    echo "  - Feature flags disabled"
fi

# Check all tools
echo "All tools usage:"
echo "$USAGE_DATA" | jq -r '.tools | to_entries[] | "\(.key): \(.value.usage_count) calls"'

# Check cost vs value
echo "Cost analysis:"
curl -s "${HEADY_API_BASE}/tools/cost-analysis?period=7d" | jq .
```

## 10. Automated Sync and Maintenance

### Daily Sync Cron Job
```bash
# Add to crontab (crontab -e)
0 8 * * * /path/to/heady-sync.sh >> /var/log/heady-sync.log 2>&1
0 20 * * * /path/to/heady-health-check.sh >> /var/log/heady-health.log 2>&1
0 0 * * 0 /path/to/audit-tool-usage.sh >> /var/log/heady-audit.log 2>&1
```

### Configuration Drift Detection
Create `detect-drift.sh`:

```bash
#!/bin/bash
echo "Configuration Drift Detection"
echo "============================="

# Get expected configuration hash
EXPECTED_HASH=$(curl -s "${HEADY_API_BASE}/config/hash" | jq -r .hash)

# Compare with local
LOCAL_HASH=$(sha256sum ~/.config/heady/config.json | cut -d' ' -f1)

if [ "$EXPECTED_HASH" != "$LOCAL_HASH" ]; then
    echo "⚠️ Configuration drift detected"
    echo "Expected: $EXPECTED_HASH"
    echo "Local: $LOCAL_HASH"
    echo "Run: heady-sync.sh to resolve"
else
    echo "✅ Configuration in sync"
fi
```

## 11. Troubleshooting Guide

### Common Issues and Solutions

**Claude Not Being Used:**
1. Verify ANTHROPIC_API_KEY is set
2. Check model router configuration
3. Review cost constraints
4. Test with claude-smoke-test.sh

**Device Sync Issues:**
1. Verify Git remotes are correctly configured
2. Check network connectivity to backend
3. Run heady-sync.sh manually
4. Review device-specific environment variables

**MCP Server Connection Issues:**
1. Verify MCP server configuration in Windsurf
2. Check required API keys (RENDER_API_KEY)
3. Test MCP gateway health endpoint
4. Review server logs for connection errors

**Mobile App Connection Issues:**
1. Verify mobile apps can reach HEADY_API_BASE
2. Check authentication tokens
3. Test with mobile health check endpoint
4. Review network firewall settings

## 12. Implementation Checklist

### Pre-Implementation Checklist
- [ ] Choose canonical Heady backend domain
- [ ] Obtain all required API keys
- [ ] Configure DNS entries for backend
- [ ] Set up SSL certificates
- [ ] Verify network connectivity between devices

### Per-Device Setup Checklist
- [ ] Clone Heady repository
- [ ] Configure Git remotes
- [ ] Set up environment variables
- [ ] Install Windsurf configuration
- [ ] Run initial sync
- [ ] Verify Claude integration
- [ ] Test health checks
- [ ] Configure mobile apps (if applicable)

### Ongoing Maintenance Checklist
- [ ] Daily sync script running
- [ ] Weekly health checks
- [ ] Monthly tool usage audits
- [ ] Quarterly configuration reviews
- [ ] Annual security audits

This protocol ensures consistent, secure, and optimal Heady operation across all your devices while maximizing the value of your tool subscriptions, particularly Claude.
