// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██║  ██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: deterministic-config-manager.js               ║
// ║  UPDATED: 20260219-220000                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * 🔒 Deterministic Configuration Manager
 * 
 * Ensures reproducible, versioned, and auditable configuration management
 * for HCFP Full Auto Mode with intelligent routing and self-awareness
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class DeterministicConfigManager extends EventEmitter {
  constructor(configPath = '/home/headyme/CascadeProjects/Heady/configs') {
    super();
    
    this.configPath = configPath;
    this.configVersions = new Map();
    this.activeConfigs = new Map();
    this.configHashes = new Map();
    this.rollbackStack = [];
    this.determinismSeed = 42;
    
    // Configuration files to manage
    this.managedConfigs = [
      'ai-routing.yaml',
      'hcfullpipeline.yaml',
      'resource-policies.yaml',
      'system-components.yaml'
    ];
  }

  async initialize() {
    await this.loadAllConfigs();
    await this.validateConfigIntegrity();
    console.log('🔒 Deterministic Config Manager initialized');
  }

  /**
   * Calculate SHA-256 hash of configuration content
   */
  calculateConfigHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Generate deterministic seed based on config hash and timestamp
   */
  generateDeterministicSeed(configHash, timestamp = Date.now()) {
    const combined = configHash + timestamp.toString();
    return parseInt(crypto.createHash('md5').update(combined).digest('hex').substring(0, 8), 16);
  }

  /**
   * Load all managed configurations with versioning
   */
  async loadAllConfigs() {
    for (const configFile of this.managedConfigs) {
      try {
        const filePath = path.join(this.configPath, configFile);
        const content = await fs.readFile(filePath, 'utf-8');
        const hash = this.calculateConfigHash(content);
        
        // Parse YAML/JSON content
        let config;
        try {
          // Try JSON first
          config = JSON.parse(content);
        } catch (e) {
          // If not JSON, assume YAML (simplified - in production use yaml parser)
          config = this.parseSimpleYaml(content);
        }
        
        const version = config.version || '1.0.0';
        const timestamp = config.last_updated || new Date().toISOString();
        
        this.configVersions.set(configFile, {
          version,
          timestamp,
          hash,
          content,
          config
        });
        
        this.configHashes.set(configFile, hash);
        this.activeConfigs.set(configFile, config);
        
        console.log(`✅ Loaded config: ${configFile} (v${version}, hash: ${hash.substring(0, 8)})`);
        
      } catch (error) {
        console.error(`❌ Failed to load config ${configFile}:`, error.message);
        throw new Error(`Configuration load failed for ${configFile}`);
      }
    }
  }

  /**
   * Simple YAML parser for basic configurations
   */
  parseSimpleYaml(content) {
    const config = {};
    const lines = content.split('\n');
    let currentSection = config;
    const sectionStack = [config];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Handle sections
      if (trimmed.endsWith(':') && !trimmed.includes(' ')) {
        const sectionName = trimmed.slice(0, -1);
        currentSection[sectionName] = {};
        sectionStack.push(currentSection[sectionName]);
        currentSection = currentSection[sectionName];
        continue;
      }
      
      // Handle key-value pairs
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        let value = trimmed.substring(colonIndex + 1).trim();
        
        // Handle different value types
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value === 'true' || value === 'false') {
          value = value === 'true';
        } else if (!isNaN(value)) {
          value = Number(value);
        } else if (value.startsWith('[') && value.endsWith(']')) {
          value = value.slice(1, -1).split(',').map(v => v.trim().replace(/['"]/g, ''));
        }
        
        currentSection[key] = value;
      }
    }
    
    return config;
  }

  /**
   * Validate configuration integrity and consistency
   */
  async validateConfigIntegrity() {
    const validationResults = [];
    
    for (const [configFile, versionInfo] of this.configVersions) {
      const validation = {
        file: configFile,
        valid: true,
        issues: [],
        warnings: []
      };
      
      // Check for required fields
      const config = versionInfo.config;
      
      if (configFile === 'ai-routing.yaml') {
        if (!config.providers || Object.keys(config.providers).length === 0) {
          validation.issues.push('No providers configured');
        }
        if (!config.tasks || Object.keys(config.tasks).length === 0) {
          validation.issues.push('No tasks configured');
        }
        if (!config.defaults) {
          validation.warnings.push('Missing default configuration');
        }
      }
      
      if (configFile === 'hcfullpipeline.yaml') {
        if (!config.profiles || !config.profiles.full_auto) {
          validation.issues.push('Missing full_auto profile');
        }
        if (!config.stages) {
          validation.issues.push('No pipeline stages configured');
        }
      }
      
      // Check for hash consistency
      const currentContent = await fs.readFile(path.join(this.configPath, configFile), 'utf-8');
      const currentHash = this.calculateConfigHash(currentContent);
      if (currentHash !== versionInfo.hash) {
        validation.issues.push('Configuration hash mismatch - file modified externally');
      }
      
      validation.valid = validation.issues.length === 0;
      validationResults.push(validation);
    }
    
    // Report validation results
    const validCount = validationResults.filter(r => r.valid).length;
    console.log(`📊 Config validation: ${validCount}/${validationResults.length} valid`);
    
    for (const result of validationResults) {
      if (!result.valid) {
        console.error(`❌ ${result.file}:`, result.issues);
      }
      if (result.warnings.length > 0) {
        console.warn(`⚠️  ${result.file}:`, result.warnings);
      }
    }
    
    return validationResults;
  }

  /**
   * Update configuration with deterministic versioning
   */
  async updateConfig(configFile, updates, options = {}) {
    const {
      version = null,
      reason = 'Configuration update',
      validateBeforeSave = true,
      createBackup = true
    } = options;
    
    if (!this.managedConfigs.includes(configFile)) {
      throw new Error(`Configuration file ${configFile} is not managed`);
    }
    
    const currentConfig = this.activeConfigs.get(configFile);
    const currentVersion = this.configVersions.get(configFile);
    
    if (!currentConfig || !currentVersion) {
      throw new Error(`Configuration ${configFile} not loaded`);
    }
    
    // Create backup if requested
    if (createBackup) {
      await this.createBackup(configFile, currentVersion);
    }
    
    // Apply updates
    const updatedConfig = this.deepMerge(currentConfig, updates);
    
    // Add version information
    const newVersion = version || this.incrementVersion(currentVersion.version);
    updatedConfig.version = newVersion;
    updatedConfig.last_updated = new Date().toISOString();
    updatedConfig.update_reason = reason;
    
    // Validate before save if requested
    if (validateBeforeSave) {
      const validation = await this.validateSingleConfig(configFile, updatedConfig);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.issues.join(', ')}`);
      }
    }
    
    // Serialize and save
    const content = this.serializeConfig(updatedConfig, configFile.endsWith('.yaml'));
    const newHash = this.calculateConfigHash(content);
    
    const filePath = path.join(this.configPath, configFile);
    await fs.writeFile(filePath, content, 'utf-8');
    
    // Update internal state
    const versionInfo = {
      version: newVersion,
      timestamp: updatedConfig.last_updated,
      hash: newHash,
      content,
      config: updatedConfig
    };
    
    this.configVersions.set(configFile, versionInfo);
    this.configHashes.set(configFile, newHash);
    this.activeConfigs.set(configFile, updatedConfig);
    
    // Update determinism seed
    this.determinismSeed = this.generateDeterministicSeed(newHash);
    
    console.log(`✅ Updated ${configFile} to v${newVersion} (hash: ${newHash.substring(0, 8)})`);
    
    // Emit change event
    this.emit('configChanged', {
      file: configFile,
      oldVersion: currentVersion.version,
      newVersion,
      hash: newHash,
      reason
    });
    
    return versionInfo;
  }

  /**
   * Deep merge objects for configuration updates
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Increment semantic version
   */
  incrementVersion(currentVersion) {
    const parts = currentVersion.split('.').map(Number);
    parts[2]++; // Increment patch version
    return parts.join('.');
  }

  /**
   * Serialize configuration to YAML or JSON
   */
  serializeConfig(config, isYaml = true) {
    if (isYaml) {
      return this.toYaml(config);
    } else {
      return JSON.stringify(config, null, 2);
    }
  }

  /**
   * Convert object to YAML (simplified)
   */
  toYaml(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    let yaml = '';
    
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;
      
      if (typeof value === 'object' && !Array.isArray(value)) {
        yaml += `${spaces}${key}:\n${this.toYaml(value, indent + 1)}`;
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        for (const item of value) {
          yaml += `${spaces}  - ${item}\n`;
        }
      } else if (typeof value === 'string') {
        yaml += `${spaces}${key}: "${value}"\n`;
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }
    
    return yaml;
  }

  /**
   * Create backup of current configuration
   */
  async createBackup(configFile, versionInfo) {
    const backupDir = path.join(this.configPath, 'backups');
    await fs.mkdir(backupDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `${configFile}.v${versionInfo.version}.${timestamp}.backup`;
    const backupPath = path.join(backupDir, backupFile);
    
    await fs.writeFile(backupPath, versionInfo.content, 'utf-8');
    
    // Add to rollback stack
    this.rollbackStack.push({
      file: configFile,
      version: versionInfo.version,
      backupPath,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 10 backups per config
    await this.cleanupBackups(configFile, backupDir, 10);
    
    console.log(`💾 Created backup: ${backupFile}`);
  }

  /**
   * Cleanup old backups
   */
  async cleanupBackups(configFile, backupDir, keepCount) {
    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files
        .filter(f => f.startsWith(configFile) && f.endsWith('.backup'))
        .map(f => ({
          name: f,
          path: path.join(backupDir, f),
          mtime: fs.stat(path.join(backupDir, f)).then(s => s.mtime)
        }));
      
      if (backupFiles.length > keepCount) {
        // Sort by modification time and remove oldest
        const sorted = await Promise.all(
          backupFiles.map(async f => ({ ...f, mtime: await f.mtime }))
        );
        sorted.sort((a, b) => a.mtime - b.mtime);
        
        const toRemove = sorted.slice(0, -keepCount);
        for (const file of toRemove) {
          await fs.unlink(file.path);
          console.log(`🗑️  Removed old backup: ${file.name}`);
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup backups:', error.message);
    }
  }

  /**
   * Rollback configuration to previous version
   */
  async rollback(configFile, targetVersion = null) {
    const rollbackEntry = this.rollbackStack
      .filter(r => r.file === configFile)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    
    if (!rollbackEntry) {
      throw new Error(`No rollback available for ${configFile}`);
    }
    
    const backupContent = await fs.readFile(rollbackEntry.backupPath, 'utf-8');
    const filePath = path.join(this.configPath, configFile);
    
    // Restore backup
    await fs.writeFile(filePath, backupContent, 'utf-8');
    
    // Reload configuration
    await this.loadAllConfigs();
    
    console.log(`🔄 Rolled back ${configFile} to v${rollbackEntry.version}`);
    
    return rollbackEntry;
  }

  /**
   * Get current determinism seed
   */
  getDeterminismSeed() {
    return this.determinismSeed;
  }

  /**
   * Get configuration version information
   */
  getConfigVersion(configFile) {
    return this.configVersions.get(configFile);
  }

  /**
   * Get all configuration versions
   */
  getAllConfigVersions() {
    const versions = {};
    for (const [file, versionInfo] of this.configVersions) {
      versions[file] = {
        version: versionInfo.version,
        timestamp: versionInfo.timestamp,
        hash: versionInfo.hash.substring(0, 8)
      };
    }
    return versions;
  }

  /**
   * Validate single configuration
   */
  async validateSingleConfig(configFile, config) {
    const validation = {
      file: configFile,
      valid: true,
      issues: [],
      warnings: []
    };
    
    // Basic validation logic
    if (configFile === 'ai-routing.yaml') {
      if (!config.providers || Object.keys(config.providers).length === 0) {
        validation.issues.push('No providers configured');
      }
      if (!config.tasks || Object.keys(config.tasks).length === 0) {
        validation.issues.push('No tasks configured');
      }
    }
    
    validation.valid = validation.issues.length === 0;
    return validation;
  }

  /**
   * Export configuration state for reproducibility
   */
  async exportState() {
    const state = {
      timestamp: new Date().toISOString(),
      determinismSeed: this.determinismSeed,
      configVersions: this.getAllConfigVersions(),
      rollbackStack: this.rollbackStack.map(r => ({
        file: r.file,
        version: r.version,
        timestamp: r.timestamp
      }))
    };
    
    const exportPath = path.join(this.configPath, 'state-export.json');
    await fs.writeFile(exportPath, JSON.stringify(state, null, 2), 'utf-8');
    
    console.log(`📤 Exported state to ${exportPath}`);
    return state;
  }
}

module.exports = { DeterministicConfigManager };
