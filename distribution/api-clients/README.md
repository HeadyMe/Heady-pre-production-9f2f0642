<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: distribution/api-clients/README.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Heady API Client SDKs

Official SDK packages for integrating with the Heady API from any language.

## Available SDKs

| Language | Package | Install | Status |
|----------|---------|---------|--------|
| **JavaScript/TypeScript** | `@heady/sdk` | `npm install @heady/sdk` | Planned |
| **Python** | `heady-sdk` | `pip install heady-sdk` | Planned |
| **Go** | `heady-go` | `go get github.com/headysystems/heady-go` | Planned |
| **CLI** | `heady-cli` | `npm install -g @heady/cli` | Planned |

## Quick Start (All SDKs)

```javascript
// JavaScript
import { HeadyClient } from '@heady/sdk';
const heady = new HeadyClient({ apiKey: process.env.HEADY_API_KEY });
const response = await heady.chat('Hello, Heady!');
```

```python
# Python
from heady import HeadyClient
heady = HeadyClient(api_key=os.environ['HEADY_API_KEY'])
response = heady.chat('Hello, Heady!')
```

```go
// Go
client := heady.NewClient(os.Getenv("HEADY_API_KEY"))
response, _ := client.Chat("Hello, Heady!")
```

```bash
# CLI
heady chat "Hello, Heady!"
heady summarize https://example.com
heady status
```

## Authentication

All SDKs use the same authentication:
- **API Key:** Set `HEADY_API_KEY` environment variable
- **OAuth:** For user-scoped access (web/mobile apps)
- **Local:** No auth needed when hitting localhost

## API Base URLs

| Environment | URL |
|-------------|-----|
| Local | `http://manager.dev.local.heady.internal:3300` |
| Cloud (HeadySystems) | `https://api.headyio.com` |
| Cloud (HeadyMe) | `https://api.headyio.com` |

---
*HeadySystems / HeadyConnection — Sacred Geometry Architecture*
 