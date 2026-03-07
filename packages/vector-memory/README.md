# @heady/vector-memory

> 3D vector memory store with cosine-similarity search for the Heady™ AI Platform.

## Install

```bash
npm install @heady/vector-memory
```

## API

```js
const { VectorMemoryStore } = require('@heady/vector-memory');

const store = new VectorMemoryStore();

// Store a 3D vector with embedding
store.store('user-1', {
  x: 0.5, y: 1.2, z: -0.3,
  embedding: [0.1, 0.2, 0.3],
  metadata: { topic: 'ai' },
  timestamp: Date.now()
});

// Query by cosine similarity
const results = store.query('user-1', [0.1, 0.2, 0.3], 5);

// Get stats
const stats = store.getStats('user-1');
```

## Features

- **3D spatial indexing** with x/y/z coordinates
- **Cosine similarity** search across embeddings
- **Per-user memory isolation**
- **Octant-based statistics**

## License

Proprietary — © 2026 HeadySystems Inc.
