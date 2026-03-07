'use strict';

/**
 * Heady™ Hardened Rate Limiter — Fibonacci-Tier System
 * Drop into: src/resilience/rate-limiter-hardened.js
 */

const rateLimit = require('express-rate-limit');

const PHI = 1.6180339887;

// Fibonacci-stepped rate limits per tier
const TIERS = {
  free:       { windowMs: 60000, max: 13,  description: 'Free tier' },
  starter:    { windowMs: 60000, max: 21,  description: 'Starter plan' },
  pro:        { windowMs: 60000, max: 34,  description: 'Pro plan' },
  business:   { windowMs: 60000, max: 55,  description: 'Business plan' },
  enterprise: { windowMs: 60000, max: 89,  description: 'Enterprise plan' },
  internal:   { windowMs: 60000, max: 233, description: 'Internal services' },
  pilot:      { windowMs: 60000, max: 55,  description: 'Pilot partners' },
};

function createRateLimiter(tier = 'free', options = {}) {
  const config = TIERS[tier] || TIERS.free;
  
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    
    keyGenerator: (req) => {
      return req.headers['x-api-key'] || req.user?.id || req.ip;
    },
    
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path.startsWith('/health');
    },
    
    handler: (req, res) => {
      res.status(429).json({
        error: 'Rate limit exceeded',
        tier,
        limit: config.max,
        windowMs: config.windowMs,
        retryAfter: Math.ceil(config.windowMs / 1000),
        phi: PHI,
        message: `Upgrade to a higher tier for more requests. Current: ${config.description}`,
      });
    },
    
    ...options,
  });
}

// Per-endpoint limiter for sensitive operations
function createEndpointLimiter(maxPerMinute = 5) {
  return rateLimit({
    windowMs: 60000,
    max: maxPerMinute,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${req.ip}:${req.path}`,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Endpoint rate limit exceeded',
        path: req.path,
        retryAfter: 60,
      });
    },
  });
}

module.exports = { createRateLimiter, createEndpointLimiter, TIERS };
