<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Contributing to Heady

## Project Structure
See [SYSTEM-MAP.md](SYSTEM-MAP.md) for full architecture.

## Development
```bash
# Start everything
./heady-launcher.sh

# HeadyBuddy only
cd HeadyBuddy && npm start

# Deploy edge proxy
cd cloudflare-workers && wrangler deploy
```

## Commit Format
```
<component>: <description> — <date YYYYMMDD-HHMM>
```
Examples:
- `HeadyBuddy: add fact extraction — 20260222-1940`
- `edge-proxy: security headers — 20260222-1935`

## Testing
- Run `curl localhost:4800/health` to verify HeadyBuddy
- Run `curl https://heady-edge-proxy.emailheadyconnection.workers.dev/health` for edge proxy
