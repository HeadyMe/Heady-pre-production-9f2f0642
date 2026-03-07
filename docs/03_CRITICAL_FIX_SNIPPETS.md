# Critical fix snippets

## Remove committed MCP token

Use an environment variable in local editor config instead of storing a live bearer token in tracked config.

```json
{
  "servers": {
    "heady": {
      "type": "sse",
      "url": "https://heady.headyme.com/sse",
      "headers": {
        "Authorization": "Bearer ${env:HEADY_MCP_TOKEN}"
      }
    }
  }
}
```

The current tracked developer config in the monorepo shows a bearer token in `.vscode/mcp.json`, which should be removed and rotated immediately ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).

## Fix hardcoded Cloudflare script pattern

```js
const fetch = require('node-fetch');

const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;

if (!token || !zoneId) {
  throw new Error('Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID');
}
```

The main monorepo currently includes operational scripts that should follow environment-based credential access instead of committed values ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).

## Fail closed on admin mutation auth

```js
_requireAdminMutation(req, res, next) {
  const expectedAdminToken = process.env.ADMIN_TOKEN || process.env.HEADY_ADMIN_TOKEN || '';

  if (process.env.NODE_ENV === 'production' && !expectedAdminToken) {
    return res.status(503).json({ error: 'Admin mutation auth is not configured' });
  }

  if (!expectedAdminToken) {
    return next();
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (token !== expectedAdminToken) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  return next();
}
```

This closes the current dangerous fallback pattern where missing admin-token configuration can allow privileged routes to continue in production if not guarded elsewhere ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).

## Fix canary rollback

```bash
# capture stable revision before shifting traffic
STABLE_REV=$(gcloud run services describe "$CLOUD_RUN_SERVICE_PRODUCTION" \
  --region="$REGION" \
  --format="value(status.traffic[0].revisionName)")

# on canary failure
gcloud run services update-traffic "$CLOUD_RUN_SERVICE_PRODUCTION" \
  --region="$REGION" \
  --to-revisions="${STABLE_REV}=100"
```

This is safer than rolling traffic to `--to-latest`, because latest can still be the broken canary revision ([Heady-pre-production-9f2f0642](https://github.com/HeadyMe/Heady-pre-production-9f2f0642)).

## Add periodic vector memory persistence

```js
const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'vector-memory.jsonl');

async function persistVectorMemorySafe(vectorMemory, logger) {
  try {
    await vectorMemory.persist(SNAPSHOT_PATH);
    logger.info({ snapshot: SNAPSHOT_PATH }, 'Vector memory snapshot complete');
  } catch (err) {
    logger.warn({ err: err.message }, 'Vector memory snapshot failed');
  }
}

setInterval(() => {
  persistVectorMemorySafe(vectorMemory, logger);
}, 76000);

process.on('SIGTERM', async () => {
  await persistVectorMemorySafe(vectorMemory, logger);
  process.exit(0);
});
```

The current memory design is compelling, but RAM-only state without automatic snapshotting leaves a major durability gap for a platform that claims persistent intelligence and continuity ([README.md](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/README.md)).
