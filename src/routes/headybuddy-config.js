const express = require('express');
const router = express.Router();

// HeadyBuddy shared configuration
const config = {
  theme: {
    primaryColor: '#4F46E5',
    secondaryColor: '#10B981',
    fontFamily: 'Inter, sans-serif'
  },
  features: {
    voiceCommands: true,
    crossDeviceSync: true,
    adaptiveCards: true
  },
  syncEndpoint: 'https://api.heady.internal/sync'
};

router.get('/', (req, res) => {
  res.json(config);
});

module.exports = router;
