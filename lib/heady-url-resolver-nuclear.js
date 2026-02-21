// ============================================================
// HEADY URL RESOLVER — THE NUCLEAR OPTION
// ============================================================
// DROP THIS INTO YOUR MONOREPO ROOT: lib/heady-url-resolver.js
// This module intercepts and kills app.headysystems.com/127.x/.headysystems.com
// at EVERY layer: env vars, runtime requests, response bodies.
// ============================================================

const BANNED_PATTERNS = [
  /https?:\/\/app.headysystems.com(:\d+)?/gi,
  /https?:\/\/127\.0\.0\.1(:\d+)?/gi,
  /https?:\/\/0\.0\.0\.0(:\d+)?/gi,
  /https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?/gi,
  /https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?/gi,
  /https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?/gi,
  /https?:\/\/[\w-]+\.onrender\.com/gi,
  /https?:\/\/[\w-]+\.onrender\.com(:\d+)?/gi,
];

// Canonical domain map — SINGLE SOURCE OF TRUTH
const DOMAIN_MAP = {
  // Service-to-domain mapping (internal name → production URL)
  'heady-manager':    'https://api.app.headysystems.com',
  'heady-api':        'https://api.headysystems.com',
  'heady-connection':  'https://api.headyconnection.org',
  'heady-app':        'https://app.headysystems.com',
  'heady-admin':      'https://admin.headysystems.com',
  'heady-buddy':      'https://headybuddy.org',
  'heady-drupal-mcp': 'https://drupal.headysystems.com',
  'heady-vector':     'https://vector.headysystems.com',
  'qdrant':           'https://vector.headysystems.com',
  'vector-db':        'https://vector.headysystems.com',
  'vector-storage':    'https://vector.headysystems.com',

  // Render.com → Production rewrites
  'heady-manager-headysystems.headysystems.com':    'https://api.app.headysystems.com',
  'heady-manager-headyme.headysystems.com':         'https://api.app.headysystems.com/me',
  'heady-manager-headyconnection.headysystems.com': 'https://api.headyconnection.org',
};

// Port-to-service mapping (what runs where locally)
const PORT_MAP = {
  3000: 'https://app.headysystems.com',
  3001: 'https://admin.headysystems.com',
  3300: 'https://api.headysystems.com',
  6333: 'https://vector.headysystems.com',
  6334: 'https://vector.headysystems.com',
  8000: 'https://api.headysystems.com',
  8001: 'https://api.headyconnection.org',
  8080: 'https://drupal.headysystems.com',
};

/**
 * Sanitize a single URL by replacing banned patterns with canonical domains
 */
function resolveUrl(url) {
  if (!url || typeof url !== 'string') return url;
  
  let resolved = url;
  
  // Replace banned patterns
  for (const pattern of BANNED_PATTERNS) {
    resolved = resolved.replace(pattern, (match) => {
      console.log(`🔥 HEADY URL RESOLVER: Killing banned URL "${match}"`);
      
      // Extract port if present
      const portMatch = match.match(/:(\d+)/);
      const port = portMatch ? parseInt(portMatch[1]) : null;
      
      // Map port to service
      if (port && PORT_MAP[port]) {
        return PORT_MAP[port];
      }
      
      // Map hostname to service
      for (const [internal, production] of Object.entries(DOMAIN_MAP)) {
        if (match.includes(internal)) {
          return production;
        }
      }
      
      // Default fallback
      return 'https://api.headysystems.com';
    });
  }
  
  return resolved;
}

/**
 * Sanitize all environment variables at boot time
 * Call this BEFORE any other imports or app initialization
 */
function sanitizeEnvironment() {
  console.log('🔥 HEADY URL RESOLVER: Sanitizing environment variables...');
  
  let changes = 0;
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      const resolved = resolveUrl(value);
      if (resolved !== value) {
        process.env[key] = resolved;
        changes++;
        console.log(`🔥 ENV VAR ${key}: ${value} → ${resolved}`);
      }
    }
  }
  
  console.log(`🔥 Environment sanitization complete: ${changes} variables changed`);
  return changes;
}

/**
 * Express middleware to sanitize all JSON response bodies
 */
function headyUrlMiddleware() {
  return (req, res, next) => {
    // Store original res.json
    const originalJson = res.json;
    
    // Override res.json to sanitize output
    res.json = function(data) {
      if (data && typeof data === 'object') {
        const sanitized = sanitizeObject(data);
        return originalJson.call(this, sanitized);
      }
      return originalJson.call(this, data);
    };
    
    next();
  };
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj, seen = new WeakSet()) {
  if (seen.has(obj)) return obj; // Prevent infinite recursion
  seen.add(obj);
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, seen));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = resolveUrl(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value, seen);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * CLI tool to fix existing files
 */
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  
  const args = process.argv.slice(2);
  if (args[0] === 'fix') {
    const targetDir = args[1] || process.cwd();
    console.log(`🔥 Scanning and fixing files in: ${targetDir}`);
    
    const files = fs.readdirSync(targetDir, { recursive: true });
    let fixedFiles = 0;
    
    for (const file of files) {
      if (typeof file === 'string' && file.match(/\.(js|json|yaml|yml|md|sql)$/)) {
        const filePath = path.join(targetDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const resolved = resolveUrl(content);
          
          if (resolved !== content) {
            fs.writeFileSync(filePath, resolved, 'utf8');
            console.log(`🔥 Fixed: ${filePath}`);
            fixedFiles++;
          }
        } catch (e) {
          // Skip files we can't read
        }
      }
    }
    
    console.log(`🔥 Complete: ${fixedFiles} files fixed`);
  }
}

module.exports = {
  resolveUrl,
  sanitizeEnvironment,
  headyUrlMiddleware,
  sanitizeObject,
  BANNED_PATTERNS,
  DOMAIN_MAP,
  PORT_MAP
};
