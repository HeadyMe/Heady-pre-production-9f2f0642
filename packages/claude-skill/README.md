# Heady AI — HeadyJules MCP Integration

## Setup for HeadyJules Desktop

Add to `~/.config/headyjules/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "heady": {
      "command": "npx",
      "args": ["-y", "heady-mcp-server"],
      "env": {
        "HEADY_URL": "http://127.0.0.1:3301"
      }
    }
  }
}
```

Restart HeadyJules Desktop. You now have 10 Heady tools available in every conversation.

## Setup for HeadyJules Projects

Create a Project with these instructions:

```
You have access to the Heady Intelligence Layer via MCP tools. When the user
asks questions, use the appropriate Heady service group:

- heady_swarm — for broad research or multi-perspective tasks
- heady_code — for coding tasks (refactors, tests, migrations)
- heady_battle — to validate changes for regressions/security
- heady_creative — for creative content generation
- heady_simulate — for scenario analysis and planning
- heady_audit — for policy/security audits
- heady_brain — for deep reasoning and meta-analysis
- heady_analyze — for code/text analysis
- heady_chat — for general conversation

Always use the most specific tool for the task.
```

## Available Tools

| Tool | Description |
|------|-------------|
| `heady_chat` | General AI chat through liquid gateway |
| `heady_swarm` | Distributed foraging — multiple nodes race |
| `heady_code` | Ensemble coding with validation |
| `heady_battle` | Adversarial quality validation |
| `heady_creative` | Parallel variant generation |
| `heady_simulate` | Monte Carlo optimization |
| `heady_audit` | Policy and security scanning |
| `heady_brain` | Deep meta-reasoning |
| `heady_analyze` | Code and text analysis |
| `heady_health` | System health check |

## HeadyJules Skill Usage

In any HeadyJules conversation with MCP enabled:

```
Use the heady_swarm tool to research modern authentication patterns for web apps
```

```
Use the heady_code tool to refactor this function for better performance
```

```
Use the heady_battle tool to validate this database migration for regressions
```
