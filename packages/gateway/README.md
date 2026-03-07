# @heady/gateway

> API gateway with cross-domain auth, rate limiting, and service routing for the Heady™ AI Platform.

## Install

```bash
npm install @heady/gateway
```

## Quick Start

```ts
import { createGateway } from '@heady/gateway';

const gw = createGateway({ rateLimitRpm: 600 });

// Route a domain to a service
const service = gw.route('headyme.com');  // → 'command-center'

// Check rate limit
const { allowed, remaining } = gw.checkRateLimit('client-123');

// CORS headers
const headers = gw.getCorsHeaders('https://headyme.com');

// Status
const status = gw.getStatus();
```

## Features

- **9-domain routing** — headyme.com, headyio.com, headymcp.com, and more
- **Token-bucket rate limiting** per client
- **CORS management** with configurable origins
- **Request metrics** tracking

## License

Proprietary — © 2026 HeadySystems Inc.
