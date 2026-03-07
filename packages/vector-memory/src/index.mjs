import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { deterministicEmbedding, coordinatesFromEmbedding, cosineSimilarity } from '@heady/shared/src/embedding.mjs';
import { randomId, nowIso } from '@heady/shared/src/crypto.mjs';
import { logger } from '@heady/shared/src/logger.mjs';

class FileMemoryStore {
  constructor({ dataDir }) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'memories.json');
    this.loaded = false;
    this.state = { memories: [] };
    this.mode = 'file';
  }

  async ensureReady() {
    if (this.loaded) return;
    await fs.mkdir(this.dataDir, { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this.state = JSON.parse(raw);
    } catch {
      await this.persist();
    }
    this.loaded = true;
  }

  async persist() {
    const temp = `${this.filePath}.tmp`;
    await fs.writeFile(temp, JSON.stringify(this.state, null, 2));
    await fs.rename(temp, this.filePath);
  }

  async upsertMemory({ userId, namespace = 'default', content, metadata = {}, id = randomId() }) {
    await this.ensureReady();
    const embedding = deterministicEmbedding(content);
    const point = coordinatesFromEmbedding(embedding);
    const timestamp = nowIso();
    const existingIndex = this.state.memories.findIndex((memory) => memory.id === id && memory.userId === userId);
    const record = {
      id,
      userId,
      namespace,
      content,
      embedding,
      ...point,
      metadata,
      createdAt: existingIndex >= 0 ? this.state.memories[existingIndex].createdAt : timestamp,
      updatedAt: timestamp
    };
    if (existingIndex >= 0) this.state.memories[existingIndex] = record;
    else this.state.memories.push(record);
    await this.persist();
    return this.sanitize(record);
  }

  sanitize(record, score = null) {
    return {
      id: record.id,
      userId: record.userId,
      namespace: record.namespace,
      content: record.content,
      x: record.x,
      y: record.y,
      z: record.z,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ...(score === null ? {} : { score })
    };
  }

  async listMemories({ userId, namespace = null, limit = 50 }) {
    await this.ensureReady();
    return this.state.memories
      .filter((memory) => memory.userId === userId && (!namespace || memory.namespace === namespace))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, limit)
      .map((memory) => this.sanitize(memory));
  }

  async timeline({ userId, namespace = null, limit = 100 }) {
    await this.ensureReady();
    return this.state.memories
      .filter((memory) => memory.userId === userId && (!namespace || memory.namespace === namespace))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(-limit)
      .map((memory) => this.sanitize(memory));
  }

  async searchMemories({ userId, namespace = null, query, limit = 10 }) {
    await this.ensureReady();
    const queryEmbedding = deterministicEmbedding(query);
    return this.state.memories
      .filter((memory) => memory.userId === userId && (!namespace || memory.namespace === namespace))
      .map((memory) => ({ memory, score: cosineSimilarity(queryEmbedding, memory.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ memory, score }) => this.sanitize(memory, Number(score.toFixed(6))));
  }

  async stats() {
    await this.ensureReady();
    return {
      mode: this.mode,
      totalMemories: this.state.memories.length
    };
  }
}

class PostgresMemoryStore {
  constructor({ databaseUrl }) {
    this.databaseUrl = databaseUrl;
    this.pool = new Pool({ connectionString: databaseUrl });
    this.mode = 'postgres';
    this.ready = false;
  }

  async ensureReady() {
    if (this.ready) return;
    await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS heady_memories (
        id uuid PRIMARY KEY,
        user_id text NOT NULL,
        namespace text NOT NULL DEFAULT 'default',
        content text NOT NULL,
        embedding vector(384) NOT NULL,
        position_x double precision NOT NULL,
        position_y double precision NOT NULL,
        position_z double precision NOT NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_heady_memories_user_namespace ON heady_memories(user_id, namespace)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_heady_memories_embedding ON heady_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)');
    this.ready = true;
  }

  vectorLiteral(vector) {
    return `[${vector.map((value) => Number(value).toFixed(8)).join(',')}]`;
  }

  rowToRecord(row) {
    return {
      id: row.id,
      userId: row.user_id,
      namespace: row.namespace,
      content: row.content,
      x: Number(row.position_x),
      y: Number(row.position_y),
      z: Number(row.position_z),
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(row.score === undefined ? {} : { score: Number(row.score) })
    };
  }

  async upsertMemory({ userId, namespace = 'default', content, metadata = {}, id = randomId() }) {
    await this.ensureReady();
    const embedding = deterministicEmbedding(content);
    const point = coordinatesFromEmbedding(embedding);
    const query = `
      INSERT INTO heady_memories (
        id, user_id, namespace, content, embedding, position_x, position_y, position_z, metadata, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5::vector,$6,$7,$8,$9::jsonb,now(),now())
      ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        position_x = EXCLUDED.position_x,
        position_y = EXCLUDED.position_y,
        position_z = EXCLUDED.position_z,
        metadata = EXCLUDED.metadata,
        updated_at = now()
      RETURNING *
    `;
    const result = await this.pool.query(query, [
      id,
      userId,
      namespace,
      content,
      this.vectorLiteral(embedding),
      point.x,
      point.y,
      point.z,
      JSON.stringify(metadata)
    ]);
    return this.rowToRecord(result.rows[0]);
  }

  async listMemories({ userId, namespace = null, limit = 50 }) {
    await this.ensureReady();
    const result = namespace
      ? await this.pool.query('SELECT * FROM heady_memories WHERE user_id = $1 AND namespace = $2 ORDER BY updated_at DESC LIMIT $3', [userId, namespace, limit])
      : await this.pool.query('SELECT * FROM heady_memories WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2', [userId, limit]);
    return result.rows.map((row) => this.rowToRecord(row));
  }

  async timeline({ userId, namespace = null, limit = 100 }) {
    await this.ensureReady();
    const result = namespace
      ? await this.pool.query('SELECT * FROM heady_memories WHERE user_id = $1 AND namespace = $2 ORDER BY created_at ASC LIMIT $3', [userId, namespace, limit])
      : await this.pool.query('SELECT * FROM heady_memories WHERE user_id = $1 ORDER BY created_at ASC LIMIT $2', [userId, limit]);
    return result.rows.map((row) => this.rowToRecord(row));
  }

  async searchMemories({ userId, namespace = null, query, limit = 10 }) {
    await this.ensureReady();
    const embedding = deterministicEmbedding(query);
    const vector = this.vectorLiteral(embedding);
    const sql = namespace
      ? `SELECT *, ROUND((1 - (embedding <=> $3::vector))::numeric, 6) AS score FROM heady_memories WHERE user_id = $1 AND namespace = $2 ORDER BY embedding <=> $3::vector LIMIT $4`
      : `SELECT *, ROUND((1 - (embedding <=> $2::vector))::numeric, 6) AS score FROM heady_memories WHERE user_id = $1 ORDER BY embedding <=> $2::vector LIMIT $3`;
    const params = namespace ? [userId, namespace, vector, limit] : [userId, vector, limit];
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => this.rowToRecord(row));
  }

  async stats() {
    await this.ensureReady();
    const result = await this.pool.query('SELECT COUNT(*)::int AS total FROM heady_memories');
    return {
      mode: this.mode,
      totalMemories: result.rows[0].total
    };
  }
}

export async function createMemoryStore({ databaseUrl = '', dataDir }) {
  if (databaseUrl) {
    try {
      const store = new PostgresMemoryStore({ databaseUrl });
      await store.ensureReady();
      logger.info('vector memory online', { mode: 'postgres' });
      return store;
    } catch (error) {
      logger.warn('postgres vector memory unavailable, falling back to file backend', { error: error.message });
    }
  }
  const fallback = new FileMemoryStore({ dataDir });
  await fallback.ensureReady();
  logger.info('vector memory online', { mode: 'file' });
  return fallback;
}
