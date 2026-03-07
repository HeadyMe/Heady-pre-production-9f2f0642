# Migrating to Modular Architecture

## Overview

This guide helps migrate existing HeadySystems services to the new modular monorepo architecture.

## Migration Strategy

### Phase 1: Package Extraction (Weeks 1-2)

Extract shared code into packages:

1. **@headysystems/core** ← `utils/logger.ts`, `utils/errors.ts`
2. **@headysystems/types** ← `types/**/*.ts`
3. **@headysystems/redis** ← Redis connection logic
4. **@headysystems/mcp** ← MCP protocol implementation

### Phase 2: Service Modularization (Weeks 3-4)

Convert services to use workspace packages:

```bash
# Before
import { logger } from '../../utils/logger';

# After
import { HeadyLogger } from '@headysystems/core';
```

### Phase 3: Build System Migration (Week 5)

1. Add Turborepo pipeline configuration
2. Replace npm with pnpm workspaces
3. Configure incremental builds

### Phase 4: CI/CD Update (Week 6)

Update GitHub Actions:

```yaml
name: Deploy Services
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test
      - run: pnpm deploy
```

## Breaking Changes

### Import Paths

| Old | New |
|-----|-----|
| `import { logger } from './logger'` | `import { HeadyLogger } from '@headysystems/core'` |
| `import { Task } from './types'` | `import { Task } from '@headysystems/types'` |
| `import Redis from 'ioredis'` | `import { HeadyRedisPool } from '@headysystems/redis'` |

### Configuration

Old `.env` structure:
```
NODE_ENV=production
PORT=3000
REDIS_URL=redis://localhost:6379
```

New configuration (Zod validated):
```typescript
import { loadConfig, BaseServiceConfigSchema } from '@headysystems/core';

const config = loadConfig(BaseServiceConfigSchema);
// Fully typed and validated!
```

### Error Handling

Old:
```typescript
throw new Error('Service unavailable');
```

New:
```typescript
import { ServiceUnavailableError } from '@headysystems/core';
throw new ServiceUnavailableError('heady-brain');
```

## Testing Migration

Old test structure:
```
services/heady-brain/
├── src/
└── tests/
    └── brain.test.ts
```

New test structure:
```
services/heady-brain/
├── src/
│   ├── routes/
│   │   ├── chat.ts
│   │   └── __tests__/
│   │       └── chat.test.ts
```

## Rollback Plan

If migration fails:

1. **Git revert**: All changes are in a single PR
2. **Service-by-service rollback**: Each service can revert independently
3. **Blue-green deployment**: Keep old services running during migration

## Support

Questions? Contact:
- **Slack**: #heady-architecture
- **Email**: eric@headysystems.com
