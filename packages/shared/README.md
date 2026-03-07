# @heady-ai/shared

Shared utilities, configuration, cryptography, embedding, and logging modules for the Heady AI Platform.

## Modules

| Module | Description |
|--------|-------------|
| `config.mjs` | Centralized configuration with environment validation |
| `crypto.mjs` | AES-256-GCM encryption/decryption for secrets |
| `embedding.mjs` | Text embedding provider abstraction |
| `logger.mjs` | Structured logging with Pino |
| `index.mjs` | Re-exports all modules |

## Usage

```js
import { config, encrypt, decrypt, getEmbedding, logger } from '@heady-ai/shared';

// Config
const dbUrl = config.get('DATABASE_URL');

// Crypto
const encrypted = await encrypt('my-secret', key);
const decrypted = await decrypt(encrypted, key);

// Embedding
const vector = await getEmbedding('Hello world');

// Logger
logger.info({ event: 'boot' }, 'Service started');
```

## License

UNLICENSED — © 2026 HeadySystems Inc.
