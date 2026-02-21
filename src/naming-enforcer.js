
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: naming-enforcer.js                                   ║
// ║  UPDATED: 20260218-211102                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260218-211102
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

/**
 * 🏷️ HEADY NAMING STANDARDS ENFORCER
 * All names MUST follow Heady conventions
 */

class HeadyNamingEnforcer {
  constructor() {
    this.VALID_PREFIXES = ['Heady', 'HC', 'heady', 'hc'];
    this.VALID_NODE_NAMES = [
      'BRIDGE', 'BRAIN', 'CONDUCTOR', 'SOPHIA', 'SENTINEL',
      'MURPHY', 'JANITOR', 'JULES', 'OBSERVER', 'MUSE',
      'NOVA', 'CIPHER', 'ATLAS', 'SASHA', 'SCOUT',
      'OCULUS', 'BUILDER', 'PYTHIA', 'LENS', 'MEMORY'
    ];
    
    this.VALID_DOMAINS = [
      'headysystems.com',
      'headybuddy.org',
      'headycheck.com',
      'headyio.com',
      'headymcp.com',
      'headybot.com',
      'headycloud.com',
      'headyconnection.com',
      'headyos.com',
      'headyme.com',
      'manager.headyme.com',
      'chat.headyme.com'
    ];

    this.violations = [];
    this.autoFixed = 0;
  }

  enforceClassName(name) {
    // Must start with Heady
    if (!name.startsWith('Heady') && !name.startsWith('HC')) {
      this.violations.push({ type: 'class', name, reason: 'Missing Heady prefix' });
      this.autoFixed++;
      return `Heady${name}`;
    }
    return name;
  }

  enforceFileName(name) {
    // Must start with heady or hc
    if (!name.startsWith('heady') && !name.startsWith('hc') && !name.includes('heady')) {
      this.violations.push({ type: 'file', name, reason: 'Missing heady prefix' });
      this.autoFixed++;
      return `heady-${name}`;
    }
    return name;
  }

  enforceVariableName(name) {
    // Must use camelCase with heady prefix or be a node name
    if (this.VALID_NODE_NAMES.includes(name.toUpperCase())) {
      return name;
    }
    if (!name.includes('heady') && !name.includes('hc')) {
      this.violations.push({ type: 'variable', name, reason: 'Missing heady prefix' });
      this.autoFixed++;
      return `heady${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    }
    return name;
  }

  enforceFunctionName(name) {
    // Functions should start with heady or be descriptive with heady context
    if (!name.includes('heady') && !name.includes('hc') && !name.startsWith('_')) {
      this.violations.push({ type: 'function', name, reason: 'Missing heady context' });
      this.autoFixed++;
      return `heady${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    }
    return name;
  }

  enforceDirectoryName(name) {
    // Directories should follow Heady naming
    if (!name.startsWith('heady') && !name.startsWith('hc') && !name.includes('heady')) {
      this.violations.push({ type: 'directory', name, reason: 'Missing heady prefix' });
      this.autoFixed++;
      return `heady-${name}`;
    }
    return name;
  }

  validateDomain(domain) {
    return this.VALID_DOMAINS.includes(domain);
  }

  validateNodeName(name) {
    return this.VALID_NODE_NAMES.includes(name.toUpperCase());
  }

  enforceUrlStructure(url) {
    // Enforce proper Heady domain structure
    if (url.includes('headyme.com') && url.includes('/admin') && !url.includes('admin-ui.html')) {
      this.violations.push({ type: 'url', url, reason: 'Admin UI should be at headyme.com/admin-ui.html' });
      this.autoFixed++;
      return url.replace(/\/admin.*$/, '/admin-ui.html');
    }
    
    if (url.includes('api.headyme.com') && !url.startsWith('https://')) {
      this.violations.push({ type: 'url', url, reason: 'API should use https://api.headyme.com' });
      this.autoFixed++;
      return 'https://api.headyme.com' + (url.split('api.headyme.com')[1] || '');
    }
    
    return url;
  }

  enforceEnvironmentNaming(env) {
    // Environment variables should use HEADY_ prefix
    if (!env.startsWith('HEADY_') && !env.startsWith('NODE_')) {
      this.violations.push({ type: 'env', env, reason: 'Missing HEADY_ prefix' });
      this.autoFixed++;
      return `HEADY_${env}`;
    }
    return env;
  }

  scanAndFixCode(code, context = 'unknown') {
    let headyFixedCode = code;
    
    // Fix class Headynames
    headyFixedCode = headyFixedCode.replace(/class\s+(\w+)/g, (match, className) => {
      const headyFixed = this.enforceClassName(className);
      return match.replace(className, headyFixed);
    });
    
    // Fix function headyNames
    headyFixedCode = headyFixedCode.replace(/function\s+(\w+)/g, (match, funcName) => {
      const headyFixed = this.enforceFunctionName(funcName);
      return match.replace(funcName, headyFixed);
    });
    
    // Fix variable declarations
    headyFixedCode = headyFixedCode.replace(/(?:const|let|var)\s+(\w+)/g, (match, varName) => {
      const headyFixed = this.enforceVariableName(varName);
      return match.replace(varName, headyFixed);
    });
    
    return headyFixedCode;
  }

  getReport() {
    return {
      totalViolations: this.violations.length,
      autoFixed: this.autoFixed,
      violations: this.violations.slice(-50),
      status: this.violations.length === 0 ? 'COMPLIANT' : 'VIOLATIONS_FOUND',
      validPrefixes: this.VALID_PREFIXES,
      validNodeNames: this.VALID_NODE_NAMES,
      validDomains: this.VALID_DOMAINS
    };
  }

  resetViolations() {
    this.violations = [];
    this.autoFixed = 0;
    console.log('[NamingEnforcer] Violations reset');
  }

  /**
   * Scan and fix entire directory
   */
  async scanDirectory(dir) {
    const headyFs = require('fs').promises;
    const headyPath = require('path');
    
    try {
      const headyEntries = await headyFs.readdir(dir, { withFileTypes: true });
      
      for (const headyEntry of headyEntries) {
        const headyFullPath = headyPath.join(dir, headyEntry.name);
        
        if (headyEntry.isDirectory()) {
          await this.scanDirectory(headyFullPath);
        } else if (headyEntry.name.match(/\.(js|ts|jsx|tsx)$/)) {
          await this.scanFile(headyFullPath);
        }
      }
    } catch (err) {
      // Skip unreadable directories
    }
  }

  async scanFile(filePath) {
    const headyFs = require('fs').promises;
    
    try {
      const headyContent = await headyFs.readFile(filePath, 'utf8');
      const headyFixed = this.scanAndFixCode(headyContent, filePath);
      
      if (headyContent !== headyFixed) {
        await headyFs.writeFile(filePath, headyFixed, 'utf8');
        console.log(`[NamingEnforcer] Auto-fixed file: ${filePath}`);
      }
    } catch (err) {
      // Skip unreadable files
    }
  }
}

module.exports = { HeadyNamingEnforcer };
