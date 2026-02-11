const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { pool } = require('../db');

// Register new user (admin only)
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, role, environment_access } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (email, username, password_hash, role, environment_access) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [email, username, hashedPassword, role, JSON.stringify(environment_access)]
    );
    
    res.status(201).json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.HEADY_API_KEY,
      { expiresIn: '8h' }
    );
    
    // Store session in database
    const sessionResult = await pool.query(
      'INSERT INTO sessions (user_id, token_hash, expiry, ip_address, user_agent, device_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [
        user.id,
        bcrypt.hashSync(token, 10),
        new Date(Date.now() + 8 * 60 * 60 * 1000),
        req.ip,
        req.get('User-Agent'),
        req.headers['x-device-id']
      ]
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        environment_access: user.environment_access
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Token refresh
router.post('/refresh', async (req, res) => {
  // Implementation would go here
});

// User logout
router.post('/logout', async (req, res) => {
  // Implementation would go here
});

module.exports = router;
