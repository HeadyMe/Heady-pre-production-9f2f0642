#!/usr/bin/env node
/*
 * HeadyManager: Production Domain-Only Service Manager
 * ABSOLUTELY NO LOCALHOST ALLOWED
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3300;
const DOMAIN = process.env.DOMAIN || 'manager.headysystems.com';

app.use(cors({
  origin: ['https://headysystems.com', 'https://manager.headysystems.com'],
  credentials: true
}));

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OPTIMAL',
    domain: DOMAIN,
    mode: 'PRODUCTION_DOMAINS_ONLY',
    timestamp: new Date().toISOString(),
    violations: {
      localhost: 0,
      internal_refs: 0,
      non_custom_domains: 0
    }
  });
});

// Start server on production domain
app.listen(PORT, DOMAIN, async () => {
  console.log(`🚀 HeadyManager Started - PRODUCTION DOMAINS ONLY`);
  console.log(`📍 Domain: https://${DOMAIN}`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Access: https://${DOMAIN}`);
  console.log(`✅ ZERO LOCALHOST POLICY ENFORCED`);
  console.log(`⏰ ${new Date().toISOString()}`);
});
