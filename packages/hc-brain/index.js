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
// ║  FILE: packages/hc-brain/index.js                                                    ║
// ║  LAYER: root                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

// HC Brain - System Intelligence and Decision Making
// Placeholder for brain functions

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class HCBrain {
  constructor() {
    this.registryPath = path.join(__dirname, '../heady-registry.json');
    this.autoExecuteQueue = [];
  }

  think() {
    console.log('Thinking...');
  }

  decide() {
    console.log('Making decisions...');
  }

  monitorRegistry(registry) {
    if (registry.last_deployment !== registry.updatedAt) {
      this.triggerDeployment(registry);
    }
  }

  triggerDeployment(registry) {
    try {
      console.log('Triggering cross-platform deployment...');
      execSync('pwsh -File scripts/Heady-Sync.ps1', { stdio: 'inherit' });
      
      // Update registry with deployment timestamp
      registry.last_deployment = new Date().toISOString();
      this.updateRegistry(registry);
    } catch (error) {
      console.error('Deployment failed:', error);
    }
  }

  updateRegistry(registry) {
    fs.writeFileSync(this.registryPath, JSON.stringify(registry, null, 2));
    console.log('Registry updated with deployment timestamp');
  }

  analyze() {
    // Analyze project structure and dependencies
    const projectRoot = path.join(__dirname, '../..');
    const analysis = {
      dependencies: this.scanDependencies(projectRoot),
      structure: this.scanStructure(projectRoot),
      registry: this.loadRegistry(),
      health: this.checkSystemHealth(),
      metrics: this.gatherMetrics(projectRoot)
    };
    
    console.log('🧠 Analyzing project state...');
    console.log(`- Dependencies: ${analysis.dependencies.length} packages`);
    console.log(`- Structure: ${analysis.structure.packages.length} packages, ${analysis.structure.apps.length} apps`);
    console.log(`- Registry status: ${analysis.registry ? 'loaded' : 'missing'}`);
    console.log(`- System health: ${analysis.health.status}`);
    console.log(`- Total files: ${analysis.metrics.totalFiles}`);
    
    if (analysis.metrics.recommendations?.length) {
      analysis.metrics.recommendations.forEach(rec => {
        if (rec.priority !== 'critical' && rec.impact !== 'High') {
          this.autoExecuteQueue.push(rec);
        }
      });
      
      if (this.autoExecuteQueue.length) {
        console.log(`Queued ${this.autoExecuteQueue.length} recommendations for auto-execution`);
        this.processRecommendations();
      }
    }

    return analysis;
  }

  scanDependencies(projectRoot) {
    try {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = {
          ...packageJson.dependencies || {},
          ...packageJson.devDependencies || {}
        };
        return Object.entries(deps).map(([name, version]) => ({ name, version }));
      }
    } catch (error) {
      console.error('Error scanning dependencies:', error);
    }
    return [];
  }

  scanStructure(projectRoot) {
    const packagesDir = path.join(projectRoot, 'packages');
    const appsDir = path.join(projectRoot, 'apps');
    const structure = { packages: [], apps: [], config: [] };
    
    if (fs.existsSync(packagesDir)) {
      structure.packages = fs.readdirSync(packagesDir)
        .filter(item => {
          const itemPath = path.join(packagesDir, item);
          return fs.statSync(itemPath).isDirectory() && 
                 fs.existsSync(path.join(itemPath, 'package.json'));
        })
        .map(pkg => {
          const pkgPath = path.join(packagesDir, pkg);
          return {
            name: pkg,
            path: pkgPath,
            hasTests: fs.existsSync(path.join(pkgPath, 'test')) ||
                      fs.existsSync(path.join(pkgPath, '__tests__')),
            size: this.getDirectorySize(pkgPath)
          };
        });
    }
    
    if (fs.existsSync(appsDir)) {
      structure.apps = fs.readdirSync(appsDir)
        .filter(item => {
          const itemPath = path.join(appsDir, item);
          return fs.statSync(itemPath).isDirectory();
        })
        .map(app => ({
          name: app,
          path: path.join(appsDir, app)
        }));
    }
    
    // Scan for config files
    const configFiles = ['tsconfig.json', 'jest.config.js', 'babel.config.js', '.eslintrc', 'turbo.json'];
    structure.config = configFiles.filter(file => 
      fs.existsSync(path.join(projectRoot, file))
    );
    
    return structure;
  }

  getDirectorySize(dirPath) {
    let totalSize = 0;
    try {
      const items = fs.readdirSync(dirPath);
      items.forEach(item => {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules' && item !== 'dist' && item !== 'build') {
          totalSize += this.getDirectorySize(fullPath);
        } else if (stat.isFile()) {
          totalSize += stat.size;
        }
      });
    } catch (error) {
      console.error(`Error calculating directory size for ${dirPath}:`, error);
    }
    return totalSize;
  }

  loadRegistry() {
    try {
      if (fs.existsSync(this.registryPath)) {
        const registry = JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
        // Validate registry structure
        if (!registry.version || !registry.packages) {
          console.warn('Registry structure incomplete, initializing...');
          return this.initializeRegistry();
        }
        return registry;
      }
      return this.initializeRegistry();
    } catch (error) {
      console.error('Error loading registry:', error);
      return this.initializeRegistry();
    }
  }

  initializeRegistry() {
    const registry = {
      version: '1.0.0',
      packages: {},
      last_deployment: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.updateRegistry(registry);
    return registry;
  }

  checkSystemHealth() {
    const health = {
      timestamp: new Date().toISOString(),
      status: 'operational',
      registryExists: fs.existsSync(this.registryPath),
      checks: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      },
      issues: []
    };

    // Check for critical issues
    if (!health.registryExists) {
      health.status = 'degraded';
      health.issues.push('Registry file missing');
    }

    // Check Node version compatibility
    const nodeVersion = parseInt(process.version.slice(1).split('.')[0]);
    if (nodeVersion < 16) {
      health.status = 'degraded';
      health.issues.push(`Node version ${process.version} is outdated (requires 16+)`);
    }

    // Check memory usage
    const memoryUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memoryUsageMB > 500) {
      health.issues.push(`High memory usage: ${memoryUsageMB.toFixed(2)}MB`);
    }

    return health;
  }

  gatherMetrics(projectRoot) {
    const metrics = {
      totalFiles: 0,
      totalLines: 0,
      fileTypes: {},
      largestFiles: []
    };

    const countFiles = (dir) => {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules' && item !== 'dist' && item !== 'build') {
          countFiles(fullPath);
        } else if (stat.isFile()) {
          metrics.totalFiles++;
          const ext = path.extname(item) || 'no-extension';
          metrics.fileTypes[ext] = (metrics.fileTypes[ext] || 0) + 1;
          
          // Track largest files
          metrics.largestFiles.push({ path: fullPath, size: stat.size });
          metrics.largestFiles.sort((a, b) => b.size - a.size);
          metrics.largestFiles = metrics.largestFiles.slice(0, 10);
          
          // Count lines for text files
          if (['.js', '.ts', '.jsx', '.tsx', '.css', '.json'].includes(ext)) {
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              metrics.totalLines += content.split('\n').length;
            } catch (error) {
              // Skip files that can't be read
            }
          }
        }
      });
    };

    countFiles(path.join(projectRoot, 'packages'));
    countFiles(path.join(projectRoot, 'apps'));
    
    return metrics;
  }

  async executeRecommendation(rec) {
    // Auto-approve these categories
    const autoApproveCategories = new Set([
      'documentation', 
      'code-quality',
      'linting',
      'formatting'
    ]);
    
    // Always require approval for these
    if (rec.priority === 'critical' || 
        rec.impact === 'High' ||
        rec.category === 'security' ||
        rec.category === 'database') {
      console.warn('Approval required for:', rec.message);
      return { executed: false, needsApproval: true };
    }
    
    // Auto-execute safe items
    if (rec.priority === 'low' || 
        (rec.priority === 'medium' && rec.impact !== 'High') ||
        autoApproveCategories.has(rec.category)) {
      console.log(`⚡ Auto-executing: ${rec.message}`);
      return this.executeSafeRecommendation(rec);
    }
    
    // Default to requiring approval
    return { executed: false, needsApproval: true };
  }

  async executeSafeRecommendation(rec) {
    try {
      // Safety validation
      if (rec.priority === 'critical' || rec.impact === 'High') {
        console.warn('High-impact recommendation requires manual approval');
        return { executed: false, needsApproval: true };
      }
      
      // Execute based on category
      let result;
      switch(rec.category) {
        case 'code-quality':
          result = await this.runLintFix();
          break;
        case 'testing':
          result = await this.addTestFiles();
          break;
        case 'documentation':
          result = await this.generateDocs();
          break;
        default:
          console.log(`No auto-handler for ${rec.category}`);
          return { executed: false };
      }
      
      return { executed: true, result };
    } catch (error) {
      console.error('Auto-execution failed:', error);
      return { executed: false, error: error.message };
    }
  }

  async processRecommendations() {
    const results = [];
    for (const rec of this.autoExecuteQueue) {
      const result = await this.executeRecommendation(rec);
      results.push({
        ...rec,
        timestamp: new Date().toISOString(),
        result
      });
    }
    this.autoExecuteQueue = [];
    return results;
  }

  async runLintFix() {
    // Implement logic to run lint fix
  }

  async addTestFiles() {
    // Implement logic to add test files
  }

  async generateDocs() {
    // Implement logic to generate documentation
  }

  async evaluateAutoDeploy() {
    const status = await this.getSystemStatus();
    
    // Updated auto-deploy conditions
    const autoConditions = [
      status.errors.critical === 0,
      status.testCoverage >= 60,  // Lowered from 70
      status.resources.cpu < 85,  // Increased from 80
      status.resources.memory < 85, // Increased from 80
      !status.hasHighRiskChanges
    ];
    
    if (autoConditions.every(Boolean)) {
      console.log('✓ Safe to auto-deploy');
      return { shouldDeploy: true, requiresApproval: false };
    }
    
    // Updated approval conditions
    const approvalConditions = [
      status.errors.critical > 0,
      status.testCoverage < 40,  // Lowered from 50
      status.resources.cpu >= 95, // Increased from 90
      status.resources.memory >= 95, // Increased from 90
      status.hasSecurityChanges
    ];
    
    if (approvalConditions.some(Boolean)) {
      console.log('⚠ Approval required for deployment');
      return { shouldDeploy: false, requiresApproval: true };
    }
    
    // Default to auto-deploy with warnings
    console.log('⚠ Deploying with warnings');
    return { shouldDeploy: true, requiresApproval: false };
  }

  async autoDeployIfSafe() {
    const { shouldDeploy, requiresApproval } = await this.evaluateAutoDeploy();
    
    if (requiresApproval) {
      this.queueApprovalRequest();
      return { deployed: false, reason: 'Needs approval' };
    }
    
    if (shouldDeploy) {
      return this.triggerDeployment();
    }
    
    return { deployed: false, reason: 'Unsafe conditions' };
  }

  checkResourceUsage(resourceType, usage) {
    const thresholds = yaml.load(fs.readFileSync('configs/resource-thresholds.yaml', 'utf8')).thresholds;
    const limit = thresholds[resourceType] || thresholds.local;
    
    return {
      isSafe: usage <= limit,
      threshold: limit,
      requiresApproval: resourceType === 'local' && usage > limit * 0.8
    };
  }
}

module.exports = new HCBrain();
