const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'internal.headyio.com',
  database: 'heady',
  password: 'password',
  port: 5432,
});

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Database connection successful:', res.rows[0]);
    return true;
  } catch (err) {
    console.error('Database connection failed:', err);
    return false;
  } finally {
    await pool.end();
  }
}

testConnection();
