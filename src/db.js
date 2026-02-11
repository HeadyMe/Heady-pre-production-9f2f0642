const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test the connection
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('⚠ Database connection error:', err.message);
  } else {
    console.log('  ∞ PostgreSQL: CONNECTED');
  }
});

module.exports = { pool };
