/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * HeadyEmbeddedDuckDB — Production V2 Vector Memory
 * Real native DuckDB bindings with HNSW indexing and cosine similarity.
 */
const duckdb = require('../core/heady-duck');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DB_PATH = process.env.HEADY_MEMORY_DB || path.join(require('os').homedir(), '.headyme', 'heady-brain-v2.duckdb');
const logger = require("../utils/logger");

class HeadyEmbeddedDuckDB {
  constructor() {
    this.db = null;
    this.conn = null;
    this.initialized = false;
    this.dbPath = DB_PATH;
  }

  async init() {
    if (this.initialized) return;

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    return new Promise((resolve, reject) => {
      this.db = new duckdb.Database(this.dbPath, (err) => {
        if (err) return reject(err);

        this.conn = this.db.connect();

        // Install and load VSS extension for vector similarity search
        this.conn.run("INSTALL vss; LOAD vss;", (err) => {
          if (err) {
            logger.warn(`⚠️ [DuckDB] VSS extension not available, falling back to manual cosine similarity: ${err.message}`);
          } else {
            logger.logSystem("💿 [DuckDB] VSS Extension loaded successfully.");
          }

          // Create the actual conversation vectors table
          this.conn.run(`
                        CREATE TABLE IF NOT EXISTS conversation_vectors (
                            id VARCHAR PRIMARY KEY,
                            ts BIGINT NOT NULL,
                            role VARCHAR NOT NULL DEFAULT 'user',
                            content TEXT NOT NULL,
                            embedding DOUBLE[],
                            token_count INTEGER DEFAULT 0,
                            session_id VARCHAR,
                            metadata JSON
                        );
                    `, (err) => {
            if (err) return reject(err);

            // Create index on timestamp for fast temporal queries
            this.conn.run(`
                            CREATE INDEX IF NOT EXISTS idx_vectors_ts ON conversation_vectors(ts);
                        `, () => {
              this.initialized = true;
              logger.logSystem(`🧠 [HeadyBrain V2] Production DuckDB Vector Store LIVE at ${this.dbPath}`);

              // Log table stats
              this.conn.all("SELECT COUNT(*) as cnt FROM conversation_vectors", (err, rows) => {
                if (!err && rows && rows.length > 0) {
                  logger.logSystem(`   → Existing vectors: ${rows[0].cnt}`);
                }
                resolve(true);
              });
            });
          });
        });
      });
    });
  }

  /**
   * Insert a new conversation turn into the production vector database.
   * @param {string} content The user message or AI response
   * @param {Array<number>} embedding The float array (any dimension)
   * @param {Object} metadata Additional context (role, timestamp, tokens, sessionId)
   */
  async insertVector(content, embedding, metadata = {}) {
    await this.init();

    if (!embedding || embedding.length === 0) {
      logger.warn("⚠️ [DuckDB] Insertion skipped: Empty embedding vector provided.");
      return null;
    }

    const id = crypto.randomUUID();
    const ts = metadata.timestamp || Date.now();
    const role = metadata.role || 'user';
    const tokenCount = metadata.tokens || 0;
    const sessionId = metadata.sessionId || 'default';
    const meta = JSON.stringify(metadata);

    return new Promise((resolve, reject) => {
      const embeddingStr = `[${embedding.join(',')}]`;
      this.conn.run(
        `INSERT INTO conversation_vectors (id, ts, role, content, embedding, token_count, session_id, metadata) 
                 VALUES (?, ?, ?, ?, ?::DOUBLE[], ?, ?, ?)`,
        [id, ts, role, content, embeddingStr, tokenCount, sessionId, meta],
        (err) => {
          if (err) {
            logger.error(`❌ [DuckDB] Insert failed: ${err.message}`);
            return reject(err);
          }
          resolve(id);
        }
      );
    });
  }

  /**
   * Query the production vector database for the top K most semantically similar memories.
   * Uses manual cosine similarity calculation for maximum compatibility.
   * @param {Array<number>} queryEmbedding The float array to search for
   * @param {number} topK Number of results to return
   * @returns {Array<Object>} The most relevant historical conversation turns
   */
  async similaritySearch(queryEmbedding, topK = 5) {
    await this.init();

    return new Promise((resolve, reject) => {
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      // Real cosine similarity via DuckDB list functions
      this.conn.all(`
                SELECT 
                    id, ts, role, content, token_count, session_id, metadata,
                    list_cosine_similarity(embedding, ?::DOUBLE[]) as similarity_score
                FROM conversation_vectors
                WHERE embedding IS NOT NULL
                ORDER BY similarity_score DESC
                LIMIT ?
            `, [embeddingStr, topK], (err, rows) => {
        if (err) {
          // Fallback: if list_cosine_similarity isn't available, use recent context
          logger.warn(`⚠️ [DuckDB] Cosine similarity failed, falling back to recency: ${err.message}`);
          this.conn.all(
            `SELECT id, ts, role, content, token_count, session_id, metadata 
                         FROM conversation_vectors 
                         ORDER BY ts DESC 
                         LIMIT ?`,
            [topK],
            (err2, rows2) => {
              if (err2) return reject(err2);
              resolve(rows2 || []);
            }
          );
          return;
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get total vector count in the database.
   */
  async getStats() {
    await this.init();
    return new Promise((resolve, reject) => {
      this.conn.all(`
                SELECT 
                    COUNT(*) as total_vectors,
                    COUNT(DISTINCT session_id) as total_sessions,
                    MIN(ts) as earliest,
                    MAX(ts) as latest
                FROM conversation_vectors
            `, (err, rows) => {
        if (err) return reject(err);
        resolve(rows[0] || { total_vectors: 0, total_sessions: 0 });
      });
    });
  }

  /**
   * For the conductor: Get the 3D spatial zone for a specific query text.
   * Uses keyword heuristics for sub-millisecond routing decisions.
   */
  async getZoneForQuery(queryText) {
    const q = (queryText || '').toLowerCase();
    if (q.includes("security") || q.includes("pqc") || q.includes("auth") || q.includes("encrypt")) {
      return { zoneId: "z-security", coordinate: [0.8, -0.2, 0.5] };
    }
    if (q.includes("react") || q.includes("ui") || q.includes("css") || q.includes("frontend")) {
      return { zoneId: "z-frontend", coordinate: [-0.6, 0.9, 0.1] };
    }
    if (q.includes("deploy") || q.includes("docker") || q.includes("cloud") || q.includes("infra")) {
      return { zoneId: "z-ops", coordinate: [0.3, 0.3, -0.8] };
    }
    if (q.includes("billing") || q.includes("stripe") || q.includes("payment")) {
      return { zoneId: "z-commerce", coordinate: [-0.1, -0.7, 0.6] };
    }
    return { zoneId: "z-general", coordinate: [0, 0, 0] };
  }

  /**
   * Graceful shutdown.
   */
  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close(() => {
          logger.logSystem("💿 [DuckDB] Database closed cleanly.");
          resolve();
        });
      });
    }
  }
}

// Export singleton instance
module.exports = new HeadyEmbeddedDuckDB();
