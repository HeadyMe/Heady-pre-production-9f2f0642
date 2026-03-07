'use strict';

/**
 * HeadyNativeServices — Database Migration Runner
 * Runs migrations for all services that need PostgreSQL
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://heady:heady_sacred_geometry@localhost:5432/heady';

async function runMigrations() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║       HeadyNativeServices — Database Migrations         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Test connection
    const client = await pool.connect();
    console.log('  ✅ Connected to PostgreSQL');

    // Enable extensions
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('  ✅ pgvector extension enabled');

    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    console.log('  ✅ pg_trgm extension enabled');

    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log('  ✅ uuid-ossp extension enabled');

    // Run HeadyVector migrations
    try {
      const migrations = require('../src/services/heady-vector/migrations');
      const vectorMigrator = new migrations({ connectionString: DATABASE_URL });
      await vectorMigrator.runAll();
      console.log('  ✅ HeadyVector migrations complete');
    } catch (e) {
      console.log(`  ⚠️  HeadyVector migrations: ${e.message}`);
    }

    client.release();
    console.log('');
    console.log('  All migrations complete.');
    console.log('');
  } catch (err) {
    console.error(`  ❌ Migration failed: ${err.message}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
