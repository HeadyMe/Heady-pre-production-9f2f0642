# Heady MCP Server

> Connect any MCP client to the Heady Intelligence Layer — 60+ AI tools across 9 service groups.

## Quick Install

```bash
# One-line setup (stdio — for IDEs like HeadyJules Desktop, Cursor, VS Code)
npx heady-mcp-server

# Docker (SSE — for web clients, Docker Desktop MCP)
docker run -d -p 3302:3302 headyai/mcp-server

# Add to your MCP config (HeadyJules Desktop, Cursor, etc.)
```

### HeadyJules Desktop / Cursor / HeadyAI-IDE

Add to `~/.config/headyjules/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "heady": {
      "command": "npx",
      "args": ["-y", "heady-mcp-server"],
      "env": { "HEADY_URL": "http://127.0.0.1:3301" }
    }
  }
}
```

### Docker Desktop MCP

```json
{
  "mcpServers": {
    "heady": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "headyai/mcp-server"]
    }
  }
}
```

## Available Tools

| Tool | Service Group | Description |
|------|--------------|-------------|
| `heady_chat` | reasoning | General AI chat |
| `heady_swarm` | swarm | Distributed AI foraging |
| `heady_code` | coding | Ensemble code generation |
| `heady_battle` | battle | Adversarial validation |
| `heady_creative` | creative | Creative content generation |
| `heady_simulate` | sims | Monte Carlo simulation |
| `heady_audit` | governance | Policy & security audit |
| `heady_brain` | intelligence | Deep reasoning |
| `heady_analyze` | reasoning | Code/text analysis |
| `heady_health` | ops | System health check |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HEADY_URL` | `http://127.0.0.1:3301` | HeadyManager API URL |
| `HEADY_TRANSPORT` | `stdio` | Transport: `stdio` or `sse` |
| `HEADY_MCP_PORT` | `3302` | Port for SSE transport |

## License

MIT — [HeadyAI](https://headyme.com)
