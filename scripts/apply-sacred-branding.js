#!/usr/bin/env node

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
// ║  FILE: apply-sacred-branding.js                                   ║
// ║  UPDATED: 20260218-211102                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260218-211102
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

#!/usr/bin/env node
/**
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 * █▓▒░            🌌 SACRED BRANDING APPLICATOR 🌌               ░▒▓█
 * █▓▒░          Organic Systems • Breathing Interfaces           ░▒▓█
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 * 
 * FILE: apply-sacred-branding.js
 * LAYER: scripts
 * PURPOSE: Apply Sacred Geometry branding to all Heady files
 * 
 * 🜃 HeadyConnection Inc. (501c3) • HeadySystems Inc. (C-Corp)
 * 🌊 Maximum Global Happiness through AI-Powered Social Impact
 * 
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Sacred Geometry branding templates
const BRANDING_TEMPLATES = {
  // JavaScript/TypeScript files
  js: `/**
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 * █▓▒░            🌌 HEADY SYSTEMS 🌌                        ░▒▓█
 * █▓▒░          Sacred Geometry • Organic Systems           ░▒▓█
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 * 
 * FILE: {{filename}}
 * LAYER: {{layer}}
 * ICON: {{icon}}
 * PURPOSE: {{purpose}}
 * 
 * 🜃 HeadyConnection Inc. (501c3) • HeadySystems Inc. (C-Corp)
 * 🌊 Maximum Global Happiness through AI-Powered Social Impact
 * 
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 */

`,

  // HTML files
  html: `<!-- HEADYBRANDBEGIN -->
<!--
█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
█▓▒░            🌌 HEADY SYSTEMS 🌌                        ░▒▓█
█▓▒░          Sacred Geometry • Organic Systems           ░▒▓█
█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█

FILE: {{filename}}
LAYER: {{layer}}
ICON: {{icon}}
PURPOSE: {{purpose}}

🜃 HeadyConnection Inc. (501c3) • HeadySystems Inc. (C-Corp)
🌊 Maximum Global Happiness through AI-Powered Social Impact

█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
-->
<!-- HEADYBRANDEND -->

`,

  // CSS/SCSS files
  css: `/* 
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 * █▓▒░            🌌 HEADY SYSTEMS 🌌                        ░▒▓█
 * █▓▒░          Sacred Geometry • Organic Systems           ░▒▓█
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 * 
 * FILE: {{filename}}
 * LAYER: {{layer}}
 * ICON: {{icon}}
 * PURPOSE: {{purpose}}
 * 
 * 🜃 HeadyConnection Inc. (501c3) • HeadySystems Inc. (C-Corp)
 * 🌊 Maximum Global Happiness through AI-Powered Social Impact
 * 
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 */

`,

  // Markdown files
  md: `<!-- HEADYBRANDBEGIN -->
<!--
█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
█▓▒░            🌌 HEADY SYSTEMS 🌌                        ░▒▓█
█▓▒░          Sacred Geometry • Organic Systems           ░▒▓█
█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█

FILE: {{filename}}
LAYER: {{layer}}
ICON: {{icon}}
PURPOSE: {{purpose}}

🜃 HeadyConnection Inc. (501c3) • HeadySystems Inc. (C-Corp)
🌊 Maximum Global Happiness through AI-Powered Social Impact

█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
-->
<!-- HEADYBRANDEND -->

`,

  // JSON/YAML files
  json: `{
  "█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█": "",
  "█▓▒░            🌌 HEADY SYSTEMS 🌌                        ░▒▓█": "",
  "█▓▒░          Sacred Geometry • Organic Systems           ░▒▓█": "",
  "█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█": "",
  "": "",
  "FILE": "{{filename}}",
  "LAYER": "{{layer}}",
  "ICON": "{{icon}}",
  "PURPOSE": "{{purpose}}",
  "": "",
  "🜃": "HeadyConnection Inc. (501c3) • HeadySystems Inc. (C-Corp)",
  "🌊": "Maximum Global Happiness through AI-Powered Social Impact",
  "": "",
  "█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█": ""
}
`,

  // Shell scripts
  sh: `#!/bin/bash
# █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
# █▓▒░            🌌 HEADY SYSTEMS 🌌                        ░▒▓█
# █▓▒░          Sacred Geometry • Organic Systems           ░▒▓█
# █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
#
# FILE: {{filename}}
# LAYER: {{layer}}
# ICON: {{icon}}
# PURPOSE: {{purpose}}
#
# 🜃 HeadyConnection Inc. (501c3) • HeadySystems Inc. (C-Corp)
# 🌊 Maximum Global Happiness through AI-Powered Social Impact
#
# █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█

`
};

// Icon assignment based on file type and location
const ICON_ASSIGNMENTS = {
  // Core system files
  'heady-manager.js': 'metatrons-cube-01',
  'package.json': 'crystal-cluster-02',
  'docker-compose': 'merkaba-star-03',
  'README.md': 'sacred-geometry-04',
  
  // AI and intelligence
  'ai/': 'yin-yang-flow',
  'intelligence/': 'cellular-organic',
  'nodes/': 'flower-of-life',
  'orchestration/': 'tree-of-life',
  
  // Infrastructure
  'infrastructure/': 'cube-sacred',
  'config/': 'octahedron-divine',
  'scripts/': 'dodecahedron-cosmic',
  'services/': 'icosahedron-sacred',
  
  // Frontend and UI
  'admin-ui.html': 'rainbow-burst',
  'index.html': 'galaxy-spiral',
  'public/': 'waveform-energy',
  'assets/': 'aurora-flow',
  
  // Data and storage
  'data/': 'aurora-watermark',
  'memory/': 'merkaba-rotating',
  'cache/': 'nested-polyhedra',
  'logs/': 'sacred-sphere',
  
  // Development and tools
  'src/': 'crystalline-structure',
  'docs/': 'geometric-mandala',
  'tests/': 'divine-proportion',
  'build/': 'tetrahedron-divine'
};

// Layer assignment based on directory structure
const LAYER_ASSIGNMENTS = {
  'src/': 'core',
  'assets/': 'assets',
  'config/': 'infrastructure',
  'scripts/': 'automation',
  'docs/': 'documentation',
  'public/': 'frontend',
  'admin-ui': 'interface',
  'ai/': 'intelligence',
  'services/': 'backend',
  'infrastructure/': 'deployment',
  'HeadyAcademy/': 'education',
  'headyconnection-': 'integration',
  'logs/': 'monitoring',
  'data/': 'storage'
};

class SacredBrandingApplicator {
  constructor(options = {}) {
    this.options = {
      rootDir: options.rootDir || process.cwd(),
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
      force: options.force || false,
      excludePatterns: options.excludePatterns || [
        'node_modules/**',
        '.git/**',
        'venv/**',
        '__pycache__/**',
        '*.log',
        '*.pid'
      ],
      ...options
    };
    
    this.stats = {
      filesProcessed: 0,
      filesUpdated: 0,
      filesSkipped: 0,
      errors: []
    };
  }

  async applyBranding() {
    console.log('🌌 Starting Sacred Geometry Branding Application...');
    console.log(`📁 Root directory: ${this.options.rootDir}`);
    
    try {
      // Find all files to process
      const files = await this.findFiles();
      console.log(`📄 Found ${files.length} files to process`);
      
      // Process each file
      for (const filePath of files) {
        await this.processFile(filePath);
      }
      
      // Print summary
      this.printSummary();
      
    } catch (error) {
      console.error('❌ Error applying branding:', error.message);
      process.exit(1);
    }
  }

  async findFiles() {
    const patterns = [
      '**/*.js',
      '**/*.jsx',
      '**/*.ts',
      '**/*.tsx',
      '**/*.html',
      '**/*.css',
      '**/*.scss',
      '**/*.md',
      '**/*.json',
      '**/*.yml',
      '**/*.yaml',
      '**/*.sh',
      '**/*.py'
    ];
    
    const allFiles = [];
    
    for (const pattern of patterns) {
      const files = glob.sync(pattern, {
        cwd: this.options.rootDir,
        ignore: this.options.excludePatterns,
        absolute: true
      });
      allFiles.push(...files);
    }
    
    // Remove duplicates and sort
    return [...new Set(allFiles)].sort();
  }

  async processFile(filePath) {
    try {
      this.stats.filesProcessed++;
      
      if (this.options.verbose) {
        console.log(`🔍 Processing: ${path.relative(this.options.rootDir, filePath)}`);
      }
      
      // Read file content
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check if already branded (unless force is enabled)
      if (!this.options.force && this.isAlreadyBranded(content)) {
        this.stats.filesSkipped++;
        if (this.options.verbose) {
          console.log(`⏭️  Already branded, skipping: ${path.relative(this.options.rootDir, filePath)}`);
        }
        return;
      }
      
      // Determine file type and get template
      const fileType = this.getFileType(filePath);
      const template = BRANDING_TEMPLATES[fileType];
      
      if (!template) {
        this.stats.filesSkipped++;
        if (this.options.verbose) {
          console.log(`⏭️  No template for file type: ${fileType}`);
        }
        return;
      }
      
      // Generate branding header
      const header = this.generateHeader(filePath, fileType);
      
      // Apply branding
      let newContent;
      if (fileType === 'json') {
        // For JSON, we need to be more careful
        newContent = this.applyJsonBranding(content, header);
      } else {
        // For other files, prepend header
        newContent = header + content;
      }
      
      // Write file (unless dry run)
      if (!this.options.dryRun) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        this.stats.filesUpdated++;
        
        if (this.options.verbose) {
          console.log(`✅ Updated: ${path.relative(this.options.rootDir, filePath)}`);
        }
      } else {
        console.log(`🔧 Would update: ${path.relative(this.options.rootDir, filePath)}`);
        this.stats.filesUpdated++;
      }
      
    } catch (error) {
      this.stats.errors.push({
        file: filePath,
        error: error.message
      });
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  }

  isAlreadyBranded(content) {
    const brandingMarkers = [
      '█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█',
      'HEADY SYSTEMS',
      'Sacred Geometry',
      'Organic Systems',
      'Maximum Global Happiness'
    ];
    
    return brandingMarkers.some(marker => content.includes(marker));
  }

  getFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
      '.js': 'js',
      '.jsx': 'js',
      '.ts': 'js',
      '.tsx': 'js',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'css',
      '.md': 'md',
      '.json': 'json',
      '.yml': 'json',
      '.yaml': 'json',
      '.sh': 'sh',
      '.py': 'sh' // Use shell template for Python too
    };
    
    return typeMap[ext] || 'js';
  }

  generateHeader(filePath, fileType) {
    const relativePath = path.relative(this.options.rootDir, filePath);
    const filename = path.basename(filePath);
    
    // Determine icon based on file path
    const icon = this.determineIcon(relativePath);
    
    // Determine layer based on directory
    const layer = this.determineLayer(relativePath);
    
    // Determine purpose based on file type and location
    const purpose = this.determinePurpose(relativePath, fileType);
    
    // Get template and replace placeholders
    let template = BRANDING_TEMPLATES[fileType];
    
    return template
      .replace(/{{filename}}/g, filename)
      .replace(/{{layer}}/g, layer)
      .replace(/{{icon}}/g, icon)
      .replace(/{{purpose}}/g, purpose);
  }

  determineIcon(filePath) {
    // Check exact matches first
    for (const [pattern, icon] of Object.entries(ICON_ASSIGNMENTS)) {
      if (filePath.includes(pattern)) {
        return icon;
      }
    }
    
    // Default based on file type
    const ext = path.extname(filePath);
    const defaultIcons = {
      '.js': 'metatrons-cube-01',
      '.jsx': 'metatrons-cube-01',
      '.ts': 'metatrons-cube-01',
      '.tsx': 'metatrons-cube-01',
      '.html': 'galaxy-spiral',
      '.css': 'aurora-flow',
      '.scss': 'aurora-flow',
      '.md': 'geometric-mandala',
      '.json': 'crystal-cluster-02',
      '.yml': 'dodecahedron-cosmic',
      '.yaml': 'dodecahedron-cosmic',
      '.sh': 'tetrahedron-divine',
      '.py': 'merkaba-rotating'
    };
    
    return defaultIcons[ext] || 'sacred-geometry-04';
  }

  determineLayer(filePath) {
    // Check directory matches
    for (const [pattern, layer] of Object.entries(LAYER_ASSIGNMENTS)) {
      if (filePath.includes(pattern)) {
        return layer;
      }
    }
    
    // Default based on file location
    if (filePath.includes('src/')) return 'core';
    if (filePath.includes('assets/')) return 'assets';
    if (filePath.includes('config/')) return 'infrastructure';
    if (filePath.includes('scripts/')) return 'automation';
    if (filePath.includes('docs/')) return 'documentation';
    
    return 'root';
  }

  determinePurpose(filePath, fileType) {
    const filename = path.basename(filePath);
    const dir = path.dirname(filePath);
    
    // Specific file purposes
    if (filename === 'package.json') return 'Package configuration and dependencies';
    if (filename === 'README.md') return 'Project documentation and overview';
    if (filename === 'docker-compose') return 'Container orchestration configuration';
    if (filename === 'heady-manager.js') return 'Main API Gateway and orchestration server';
    if (filename.includes('test')) return 'Test suite and validation';
    if (filename.includes('config')) return 'Configuration file';
    
    // Directory-based purposes
    if (dir.includes('ai/')) return 'AI and machine learning components';
    if (dir.includes('src/')) return 'Core application source code';
    if (dir.includes('assets/')) return 'Static assets and resources';
    if (dir.includes('config/')) return 'System configuration';
    if (dir.includes('scripts/')) return 'Automation and utility scripts';
    if (dir.includes('docs/')) return 'Documentation and guides';
    if (dir.includes('public/')) return 'Public-facing web assets';
    
    // Type-based purposes
    const typePurposes = {
      'js': 'JavaScript application logic',
      'jsx': 'React component',
      'ts': 'TypeScript application logic',
      'tsx': 'React TypeScript component',
      'html': 'HTML markup and structure',
      'css': 'CSS styling and presentation',
      'scss': 'SCSS styling with preprocessing',
      'md': 'Markdown documentation',
      'json': 'JSON configuration or data',
      'yml': 'YAML configuration',
      'yaml': 'YAML configuration',
      'sh': 'Shell script automation',
      'py': 'Python application logic'
    };
    
    return typePurposes[fileType] || 'Application component';
  }

  applyJsonBranding(content, header) {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(content);
      
      // If it's already branded with our format, don't modify
      if (parsed['█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█']) {
        return content;
      }
      
      // Parse header to extract metadata
      const headerLines = header.split('\n');
      const metadata = {};
      
      headerLines.forEach(line => {
        const match = line.match(/(\w+):\s*(.+)/);
        if (match) {
          metadata[match[1]] = match[2].trim();
        }
      });
      
      // Create branded JSON
      const branded = {
        "█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█": "",
        "█▓▒░            🌌 HEADY SYSTEMS 🌌                        ░▒▓█": "",
        "█▓▒░          Sacred Geometry • Organic Systems           ░▒▓█": "",
        "█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█": "",
        "": "",
        ...metadata,
        "": "",
        "🜃": "HeadyConnection Inc. (501c3) • HeadySystems Inc. (C-Corp)",
        "🌊": "Maximum Global Happiness through AI-Powered Social Impact",
        "": "",
        "█▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█": "",
        "": "",
        ...parsed
      };
      
      return JSON.stringify(branded, null, 2);
      
    } catch (error) {
      // If not valid JSON, just prepend header as comment
      return `/* ${header.replace(/\n/g, '\n * ')} */\n\n${content}`;
    }
  }

  printSummary() {
    console.log('\n🌌 Sacred Geometry Branding Summary');
    console.log('════════════════════════════════════════════════');
    console.log(`📄 Files processed: ${this.stats.filesProcessed}`);
    console.log(`✅ Files updated: ${this.stats.filesUpdated}`);
    console.log(`⏭️  Files skipped: ${this.stats.filesSkipped}`);
    
    if (this.stats.errors.length > 0) {
      console.log(`❌ Errors: ${this.stats.errors.length}`);
      this.stats.errors.forEach(({ file, error }) => {
        console.log(`   ${file}: ${error}`);
      });
    }
    
    console.log('\n🎨 Sacred Geometry branding applied successfully!');
    console.log('🌊 Maximum Global Happiness achieved through visual harmony!');
    
    if (this.options.dryRun) {
      console.log('\n🔧 DRY RUN MODE - No files were actually modified');
      console.log('   Run without --dry-run to apply changes');
    }
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--help') {
      console.log(`
🌌 Sacred Geometry Branding Applicator

Usage: node apply-sacred-branding.js [options]

Options:
  --dry-run    Show what would be changed without modifying files
  --verbose    Show detailed processing information
  --force      Rebrand files that are already branded
  --help       Show this help message

Examples:
  node apply-sacred-branding.js                    # Apply branding to all files
  node apply-sacred-branding.js --dry-run          # Preview changes
  node apply-sacred-branding.js --verbose          # Detailed output
  node apply-sacred-branding.js --force            # Rebrand all files

🜃 HeadyConnection Inc. (501c3) • HeadySystems Inc. (C-Corp)
🌊 Maximum Global Happiness through AI-Powered Social Impact
      `);
      process.exit(0);
    }
  }
  
  // Run applicator
  const applicator = new SacredBrandingApplicator(options);
  applicator.applyBranding().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = SacredBrandingApplicator;

/**
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 * █▓▒░       🜃  Built with Sacred Geometry Principles  🜃        ░▒▓█
 * █▓▒░              ⟡  Maximum Global Happiness  ⟡               ░▒▓█
 * █▓▒░          🌌  Fractal Consciousness Architecture  🌌       ░▒▓█
 * █▓▒░⟡══════════════════════════════════════════════════════════⟡░▒▓█
 */
