'use strict';

/**
 * Heady™ Security Headers Middleware
 * Drop into: src/middleware/security-headers.js
 * Usage: app.use(securityHeaders())
 */

const helmet = require('helmet');

function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://*.headysystems.com",
          "https://*.headyme.com",
          "https://*.headyconnection.org",
          "https://*.headymcp.com",
          "https://*.headybuddy.org",
          "https://*.headyio.com",
          "https://*.headyapi.com",
          "https://*.headybot.com",
          "https://*.headyos.com",
        ],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    noSniff: true,
    xssFilter: true,
    hidePoweredBy: true,
  });
}

module.exports = { securityHeaders };
