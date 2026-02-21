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
  'heady-manager-headyconnection.headysystems.com': 'https://api.app.headyconnection.org',
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

class HeadyUrlResolver {
  constructor(options = {}) {
    this.strictMode = options.strictMode || false;
    this.logLevel = options.logLevel || 'warn';
    this.replacements = 0;
    this.violations = [];
  }

  // Core resolution function
  resolve(input, context = {}) {
    if (!input || typeof input !== 'string') return input;

    let resolved = input;
    let modified = false;

    // 1. Check for banned patterns
    for (const pattern of BANNED_PATTERNS) {
      if (pattern.test(resolved)) {
        const violation = {
          input: resolved,
          pattern: pattern.source,
          context,
          timestamp: new Date().toISOString()
        };
        this.violations.push(violation);
        
        if (this.logLevel === 'debug') {
          console.warn('🚨 BANNED URL DETECTED:', violation);
        }

        modified = true;
      }
    }

    // 2. Replace app.headysystems.com patterns with production domains
    resolved = resolved.replace(/https?:\/\/app.headysystems.com:(\d+)/gi, (match, port) => {
      const productionUrl = PORT_MAP[port] || 'https://app.headysystems.com';
      this.replacements++;
      return productionUrl;
    });

    // 3. Replace Render.com URLs with production domains
    resolved = resolved.replace(/https?:\/\/([\w-]+\.onrender\.com)/gi, (match, domain) => {
      const productionUrl = DOMAIN_MAP[domain] || 'https://app.headysystems.com';
      this.replacements++;
      return productionUrl;
    });

    // 4. Apply domain mappings
    for (const [internal, production] of Object.entries(DOMAIN_MAP)) {
      const regex = new RegExp(`https?:\/\/${internal}`, 'gi');
      if (regex.test(resolved)) {
        resolved = resolved.replace(regex, production);
        this.replacements++;
      }
    }

    // 5. Final cleanup - ensure HTTPS
    resolved = resolved.replace(/^http:/gi, 'https:');

    if (modified && this.strictMode) {
      throw new Error(`Banned URL detected in ${context.file || 'unknown'}: ${input}`);
    }

    return resolved;
  }

  // Environment variable sanitization
  sanitizeEnv(env = {}) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === 'string') {
        sanitized[key] = this.resolve(value, { type: 'env', key });
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  // Response body sanitization
  sanitizeResponse(responseBody, context = {}) {
    if (typeof responseBody === 'string') {
      return this.resolve(responseBody, { type: 'response', ...context });
    }
    
    if (typeof responseBody === 'object') {
      return this.sanitizeObject(responseBody, context);
    }

    return responseBody;
  }

  // Deep object sanitization with circular reference protection
  sanitizeObject(obj, context = {}, seen = new WeakSet()) {
    // Prevent infinite recursion
    if (seen.has(obj)) {
      return '[Circular Reference]';
    }
    seen.add(obj);
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, context, seen));
    }

    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          sanitized[key] = this.resolve(value, { type: 'object', key, ...context });
        } else if (typeof value === 'object') {
          sanitized[key] = this.sanitizeObject(value, context, seen);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    return obj;
  }

  // Middleware for Express/Node.js
  middleware() {
    return (req, res, next) => {
      // Sanitize request URL
      req.originalUrl = this.resolve(req.originalUrl, { 
        type: 'request', 
        method: req.method 
      });

      // Sanitize response body
      const originalSend = res.send;
      res.send = (data) => {
        const sanitized = this.sanitizeResponse(data, { 
          type: 'response', 
          url: req.originalUrl 
        });
        return originalSend.call(res, sanitized);
      };

      next();
    };
  }

  // Get statistics
  getStats() {
    return {
      replacements: this.replacements,
      violations: this.violations.length,
      lastViolation: this.violations[this.violations.length - 1],
      domainsConfigured: Object.keys(DOMAIN_MAP).length,
      portsConfigured: Object.keys(PORT_MAP).length
    };
  }

  // Reset statistics
  reset() {
    this.replacements = 0;
    this.violations = [];
  }

  // Validate configuration
  validateConfig() {
    const issues = [];

    // Check for duplicate ports
    const portValues = Object.values(PORT_MAP);
    const duplicatePorts = portValues.filter((url, index) => portValues.indexOf(url) !== index);
    if (duplicatePorts.length > 0) {
      issues.push(`Duplicate port mappings: ${duplicatePorts.join(', ')}`);
    }

    // Check for malformed URLs
    for (const [key, url] of Object.entries(DOMAIN_MAP)) {
      try {
        new URL(url);
      } catch {
        issues.push(`Invalid URL for ${key}: ${url}`);
      }
    }

    return issues;
  }
}

// Export singleton instance
const resolver = new HeadyUrlResolver({
  strictMode: process.env.HEADY_STRICT_MODE === 'true',
  logLevel: process.env.HEADY_LOG_LEVEL || 'warn'
});

// Disable require hook to prevent circular references during CLI operations
// To enable require hook, uncomment the section below and set environment variable:
// process.env.HEADY_ENABLE_REQUIRE_HOOK = 'true'

if (typeof require !== 'undefined' && process.env.HEADY_ENABLE_REQUIRE_HOOK === 'true') {
  const Module = require('module');
  const originalRequire = Module.prototype.require;

  Module.prototype.require = function(id) {
    const module = originalRequire.apply(this, arguments);
    
    // Sanitize module exports if they contain URLs
    if (module && typeof module === 'object') {
      return resolver.sanitizeObject(module, { type: 'module', id });
    }

    return module;
  };
}

// Export for use
module.exports = resolver;
module.exports.HeadyUrlResolver = HeadyUrlResolver;

// CLI usage
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');

  // Scan and fix all files
  const scanDirectory = (dir, extensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.env']) => {
    const files = [];
    
    const scan = (currentDir) => {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          scan(fullPath);
        } else if (stat.isFile() && extensions.includes(path.extname(item))) {
          files.push(fullPath);
        }
      }
    };
    
    scan(dir);
    return files;
  };

  const fixFiles = (directory = '.') => {
    console.log('🔍 Scanning for banned URLs...');
    const files = scanDirectory(directory);
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const resolved = resolver.resolve(content, { file });
        
        if (content !== resolved) {
          fs.writeFileSync(file, resolved);
          console.log(`✅ Fixed: ${file}`);
        }
      } catch (err) {
        console.error(`❌ Error processing ${file}:`, err.message);
      }
    }
    
    const stats = resolver.getStats();
    console.log('\n📊 Statistics:', stats);
  };

  // Run if called directly
  const args = process.argv.slice(2);
  if (args.includes('--fix')) {
    fixFiles(args.find(arg => arg !== '--fix') || '.');
  } else if (args.includes('--validate')) {
    const issues = resolver.validateConfig();
    if (issues.length > 0) {
      console.error('❌ Configuration issues:');
      issues.forEach(issue => console.error(`  - ${issue}`));
      process.exit(1);
    } else {
      console.log('✅ Configuration valid');
    }
  } else {
    console.log(`
🚀 Heady URL Resolver CLI

Usage:
  node lib/heady-url-resolver.js --fix [directory]  # Fix all files
  node lib/heady-url-resolver.js --validate         # Validate config

Environment Variables:
  HEADY_STRICT_MODE=true    # Throw errors on violations
  HEADY_LOG_LEVEL=debug      # Enable debug logging
    `);
  }
}
