---
name: heady-deployment
description: Deploy, monitor, scale, and maintain services using HeadyDeploy, HeadyOps, HeadyHealth, HeadyMaid, and HeadyMaintenance.
---

# Heady Deployment Skill

Use this skill for the **full service lifecycle** — deploying, monitoring, scaling, health-checking, and cleaning up Heady services.

## Tools Overview

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `mcp_Heady_heady_deploy` | Deploy/restart/check service status | Shipping new code or restarting services |
| `mcp_Heady_heady_ops` | Infrastructure, scaling, monitoring | Scaling up/down, infrastructure changes |
| `mcp_Heady_heady_health` | Health checks for all services | Before/after deployments, routine checks |
| `mcp_Heady_heady_maid` | Cleanup and scheduling | Clearing caches, scheduling maintenance |
| `mcp_Heady_heady_maintenance` | Backups, updates, restores | System maintenance operations |

## Tool Details

### HeadyDeploy — `mcp_Heady_heady_deploy`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `action` | enum | **required** | `deploy`, `restart`, `status`, `logs`, `scale` |
| `service` | string | optional | Target service name |
| `config` | object | optional | Additional configuration |

### HeadyOps — `mcp_Heady_heady_ops`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `action` | enum | **required** | `deploy`, `infrastructure`, `monitor`, `scale` |
| `service` | string | optional | Target service |
| `config` | object | optional | Deployment or infra configuration |

### HeadyHealth — `mcp_Heady_heady_health`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `service` | enum | `all` | `all`, `brain`, `manager`, `hcfp`, `mcp` |

### HeadyMaid — `mcp_Heady_heady_maid`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `action` | enum | **required** | `clean`, `schedule`, `status` |
| `target` | string | optional | Target directory, service, or resource |
| `schedule` | string | optional | Cron expression |

### HeadyMaintenance — `mcp_Heady_heady_maintenance`

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `action` | enum | `status` | `status`, `backup`, `update`, `restore` |
| `service` | string | optional | Target service |

## Deployment Lifecycle

### Standard Deploy Flow

```
1. mcp_Heady_heady_health(service="all")               # Pre-deploy health check
2. mcp_Heady_heady_deploy(action="deploy", service="X") # Deploy
3. mcp_Heady_heady_deploy(action="status", service="X") # Verify status
4. mcp_Heady_heady_health(service="all")               # Post-deploy health check
5. mcp_Heady_heady_deploy(action="logs", service="X")   # Check logs for errors
```

### Scale and Monitor

```
1. mcp_Heady_heady_ops(action="monitor", service="X")   # Check current load
2. mcp_Heady_heady_ops(action="scale", service="X", config={"instances": 3})
3. mcp_Heady_heady_ops(action="monitor", service="X")   # Verify scaling
```

### Maintenance Cycle

```
1. mcp_Heady_heady_maintenance(action="backup")          # Backup before changes
2. mcp_Heady_heady_maintenance(action="update")          # Apply updates
3. mcp_Heady_heady_maid(action="clean", target="logs")   # Cleanup
4. mcp_Heady_heady_maintenance(action="status")          # Final status
```

## Tips

- **Always health-check before AND after deploys** — catch issues early
- **Check logs after deploy** — success status doesn't mean no errors in the application
- **Use `heady_maid` for scheduled cleanup** — don't let logs and caches grow unbounded
- **Backup before updates** — `mcp_Heady_heady_maintenance(action="backup")` is your safety net
