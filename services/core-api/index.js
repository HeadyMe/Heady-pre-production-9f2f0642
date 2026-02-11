// Core API Service
const express = require('express');
const router = express.Router();

// Health endpoint
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: "core-api",
    version: "1.0.0",
    ts: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Other endpoints will be added here

module.exports = router;
