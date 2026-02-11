// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/routes/vm-token-routes.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
const express = require('express');
const router = express.Router();
const { createAppAuth } = require('@octokit/auth-app');
const fetch = require('node-fetch');

module.exports = (secretsManager) => {
  router.post('/token', async (req, res) => {
    const { soulToken } = req.body;
    
    // Validate Soul-Token with Cloudflare Worker
    try {
      const workerResponse = await fetch('https://heartbeat.heady.systems/validate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${process.env.HEADY_API_KEY}`
        },
        body: JSON.stringify({ token: soulToken })
      });
      
      if (!workerResponse.ok) {
        return res.status(403).json({ error: 'Invalid or revoked Soul-Token' });
      }
    } catch (error) {
      console.error('Heartbeat validation failed:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
    
    // Get GitHub App credentials
    const appId = secretsManager.getSecret('github_app_id')?.value;
    const privateKey = secretsManager.getSecret('github_app_private_key')?.value;
    const installationId = secretsManager.getSecret('github_app_installation_id')?.value;
    
    if (!appId || !privateKey || !installationId) {
      return res.status(500).json({ error: 'GitHub App not configured' });
    }
    
    // Generate GitHub installation token
    try {
      const auth = createAppAuth({
        appId,
        privateKey,
        installationId,
      });
      
      const { token } = await auth({ type: 'installation' });
      res.json({ token });
    } catch (error) {
      console.error('GitHub token creation failed:', error);
      res.status(500).json({ error: 'Failed to create GitHub token' });
    }
  });
  
  return router;
};
