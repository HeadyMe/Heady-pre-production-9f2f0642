# 🚀 HCFP CLI - Heady Continuous Full Pipeline Command Line Interface

## Overview

The HCFP CLI provides a unified command interface for the Heady Continuous Full Pipeline system, enabling intelligent self-aware orchestration with dynamic resource allocation through simple, powerful commands.

## 🎯 Quick Start

### Installation
```bash
cd /home/headyme/CascadeProjects/Heady
npm install
```

### Basic Usage
```bash
# Start HCFP Full Auto Mode with guaranteed success
npm run hcfp:auto-success

# Or use the CLI directly
./bin/hcfp auto-success

# Check status
npm run hcfp:status

# Stop the system
npm run hcfp:stop
```

## 📋 Available Commands

### 🚀 Main Commands

#### `hcfp auto-success`
Start HCFP Full Auto Mode with guaranteed success through intelligent self-aware orchestration.

```bash
hcfp auto-success [options]

Options:
  -c, --critique-interval <hours>    Self-critique interval in hours (default: 6)
  -v, --verbose                     Enable verbose logging
  --no-health                       Disable website health monitoring
  --no-critique                     Disable self-critique engine
```

**Example:**
```bash
# Start with default settings
hcfp auto-success

# Start with verbose logging and 3-hour critique interval
hcfp auto-success -v -c 3

# Start without health monitoring (for testing)
hcfp auto-success --no-health
```

#### `hcfp stop`
Stop HCFP Full Auto Mode gracefully.

```bash
hcfp stop
```

#### `hcfp status`
Get current HCFP Full Auto status.

```bash
hcfp status [options]

Options:
  -j, --json    Output status as JSON
```

**Example:**
```bash
# Human-readable status
hcfp status

# JSON status for automation
hcfp status --json
```

### 🔍 Monitoring Commands

#### `hcfp health`
Trigger immediate website health check.

```bash
hcfp health
```

#### `hcfp critique`
Trigger immediate self-critique analysis.

```bash
hcfp critique
```

### ⚡ Task Commands

#### `hcfp execute <type> <description>`
Execute a specific task through HCFP.

```bash
hcfp execute <type> <description> [options]

Options:
  -p, --priority <priority>    Task priority (low, normal, high, critical)
```

**Example:**
```bash
# Execute a code generation task
hcfp execute code_generation "Fix broken button handlers" -p high

# Execute a system optimization task
hcfp execute system_optimization "Improve database queries" -p normal
```

### ⚙️ Configuration Commands

#### `hcfp config`
Show current configuration paths and update times.

```bash
hcfp config
```

#### `hcfp --help`
Show help for all commands.

```bash
hcfp --help
hcfp <command> --help
```

## 🎯 NPM Scripts

For convenience, the following NPM scripts are available:

```bash
# Main commands
npm run hcfp:auto-success      # Start HCFP Full Auto Mode
npm run hcfp:stop             # Stop HCFP
npm run hcfp:status           # Get status
npm run hcfp:critique         # Trigger self-critique
npm run hcfp:health           # Trigger health check

# Generic CLI access
npm run hcfp                  # Access any hcfp command
```

## 📊 Status Information

The status command provides comprehensive information about:

### System Status
- **Running State**: Whether HCFP is currently running
- **ORS**: Current Operational Readiness Score
- **Active Tasks**: Number of currently executing tasks
- **Success Rate**: Percentage of successful task executions
- **Average Duration**: Mean task execution time

### Component Status
- **Engine**: Full Auto Engine status and metrics
- **Health Integration**: Website monitoring status
- **Critique Engine**: Self-critique and learning progress
- **AI Router**: Provider health and routing decisions

### Example Status Output
```
📊 HCFP FULL AUTO STATUS
========================================
🟢 Status: RUNNING
📊 ORS: 87
⚡ Active Tasks: 3
✅ Success Rate: 94.2%
⏱️ Avg Duration: 1250ms
🌐 Website Health: Monitored
🚨 ORS Impact: -5
🧠 Learning Progress: 73.2%
🔍 Patterns: 47
🔄 Adaptations: 12
```

## 🚀 Auto-Success Mode

The `auto-success` command enables the full power of HCFP:

### What Starts Automatically
1. **AI Router** - Intelligent provider selection and resource allocation
2. **Self-Critique Engine** - Continuous learning and optimization
3. **Website Health Integration** - Automatic error detection and healing
4. **Full Auto Engine** - Continuous beneficial task execution

### Intelligent Features
- **Self-Awareness**: System learns from its own performance
- **Dynamic Resource Allocation**: Optimal use of available resources
- **Deterministic Execution**: Reproducible results with full traceability
- **Auto-Healing**: Automatic detection and resolution of issues
- **Continuous Optimization**: Always improving based on performance data

### Operational Modes
The system automatically adjusts behavior based on ORS:

| ORS Range | Mode | Behavior |
|-----------|------|----------|
| 85-100 | Aggressive | Full optimization, experimental features |
| 70-84 | Normal | Standard operations with balanced optimization |
| 50-69 | Maintenance | Repair-only mode, reduced concurrency |
| 0-49 | Recovery | Emergency mode, minimal operations |

## 🔧 Configuration

### Main Configuration Files
- **Pipeline Config**: `configs/hcfullpipeline.yaml`
- **AI Router Config**: `configs/ai-routing.yaml`
- **Website Health Config**: Built into health integration

### Environment Variables
```bash
NODE_ENV=production          # Production mode
HCFP_DEBUG=true              # Enable debug logging
HCFP_CRITIQUE_INTERVAL=6     # Hours between critiques
HCFP_HEALTH_CHECK_INTERVAL=60 # Seconds between health checks
```

### Custom Configuration
You can customize behavior by editing the YAML configuration files:

```yaml
# configs/hcfullpipeline.yaml
profiles:
  full_auto:
    loop_interval_seconds: 60
    ors_thresholds:
      aggressive_build_min: 85
      normal_min: 70
      maintenance_min: 50
```

## 🚨 Error Handling

### Common Issues
1. **Port Already in Use**: Another process is using the required ports
2. **Missing Dependencies**: Required Node.js packages not installed
3. **Configuration Errors**: Invalid YAML syntax or missing files
4. **Permission Issues**: Insufficient permissions for file operations

### Troubleshooting
```bash
# Check if ports are in use
netstat -tulpn | grep :3300

# Verify dependencies
npm list

# Check configuration syntax
node -e "console.log(require('js-yaml').load(require('fs').readFileSync('configs/hcfullpipeline.yaml', 'utf8')))"

# Run with debug mode
hcfp auto-success -v
```

### Graceful Shutdown
The system handles shutdown gracefully:
- Completes running tasks
- Saves current state
- Cleans up resources
- Exits cleanly

## 📈 Monitoring and Logs

### Log Locations
- **Engine Logs**: `logs/hcfp-engine.log`
- **Health Logs**: `logs/website-health.log`
- **Critique Logs**: `logs/self-critique.log`

### Real-time Monitoring
```bash
# Follow logs in real-time
tail -f logs/hcfp-engine.log

# Monitor status continuously
watch -n 30 'npm run hcfp:status'
```

### Metrics Collection
The system automatically collects:
- Task execution metrics
- Resource utilization
- Error rates and patterns
- Performance trends
- Learning progress

## 🎯 Best Practices

### Production Usage
1. **Start with Default Settings**: Use default configuration initially
2. **Monitor ORS**: Watch Operational Readiness Score closely
3. **Check Status Regularly**: Use `hcfp status` to monitor system health
4. **Review Critiques**: Periodically trigger self-critique for insights
5. **Monitor Websites**: Keep eye on website health integration

### Development Usage
1. **Use Verbose Mode**: Enable `-v` for detailed logging
2. **Shorter Critique Intervals**: Use `-c 1` for frequent learning
3. **Disable Health Monitoring**: Use `--no-health` for faster startup
4. **Execute Test Tasks**: Use `hcfp execute` for testing

### Performance Optimization
1. **Adjust Intervals**: Tune check intervals based on workload
2. **Monitor Resources**: Keep eye on CPU and memory usage
3. **Review Logs**: Check for performance bottlenecks
4. **Optimize Configuration**: Adjust YAML settings for your environment

## 🔗 Integration Examples

### CI/CD Integration
```bash
#!/bin/bash
# Start HCFP in CI/CD pipeline
npm run hcfp:auto-success -- --no-health --critique-interval 1

# Execute build task
npm run hcfp:execute build "Build application" -p critical

# Wait for completion
sleep 300

# Check status
npm run hcfp:status --json > hcfp-status.json

# Stop HCFP
npm run hcfp:stop
```

### Monitoring Integration
```bash
#!/bin/bash
# Health check script
STATUS=$(npm run hcfp:status --json | jq -r '.engine.ors')

if [ "$STATUS" -lt 70 ]; then
  echo "ORS too low: $STATUS"
  npm run hcfp:critique
  exit 1
fi

echo "System healthy: ORS $STATUS"
```

## 🎉 Advanced Features

### Custom Task Types
You can define custom task types in the configuration:
```yaml
# In hcfullpipeline.yaml
custom_tasks:
  security_audit:
    ai_router_task: "deep_reasoning"
    priority: "high"
    timeout: 300000
```

### Batch Operations
```bash
# Execute multiple tasks
for task in "optimize database" "update cache" "check security"; do
  npm run hcfp:execute system_optimization "$task" -p normal
done
```

### Status Monitoring
```bash
# Continuous monitoring
while true; do
  clear
  npm run hcfp:status
  sleep 60
done
```

## 📚 API Reference

### Programmatic Usage
```javascript
const HCFPCLI = require('./bin/hcfp');

const cli = new HCFPCLI();

// Start auto-success mode
await cli.startFullAuto({ critiqueInterval: 6 });

// Get status
const status = await cli.getStatus();

// Trigger critique
await cli.triggerCritique();

// Stop gracefully
await cli.stopFullAuto();
```

### Event Handling
```javascript
// Listen to events
cli.engine.on('task_completed', (task) => {
  console.log(`Task completed: ${task.id}`);
});

cli.healthIntegration.on('critical_alert', (alert) => {
  console.log(`Critical alert: ${alert.type}`);
});
```

---

## 🎯 Summary

The HCFP CLI provides a powerful, unified interface for intelligent self-aware orchestration:

- **🚀 Auto-Success Mode**: One command to start the full system
- **📊 Real-time Status**: Comprehensive system monitoring
- **🔍 Health Monitoring**: Automatic website health checks
- **🧠 Self-Critique**: Continuous learning and optimization
- **⚡ Task Execution**: Direct task execution capabilities
- **🛡️ Graceful Control**: Safe start/stop operations

**Result**: Complete control over your intelligent orchestration system with simple, memorable commands!

---

*Heady Systems - Sacred Geometry AI Platform*  
*Version 2.0.0 - HCFP CLI*  
*Last Updated: 2025-02-19*
