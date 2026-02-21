#!/usr/bin/env node

// ╔══════════════════════════════════════════════════════════════════╗

/**
 * 🌐 headysystems.com ELIMINATION - PRODUCTION DOMAIN MIGRATION
 * 
 * This script removes all localhost references and replaces with production domains
 * following the heady.systems domain architecture.
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

console.log('🌐 LOCALHOST ELIMINATION - PRODUCTION DOMAIN MIGRATION');
console.log('===============================================\n');

const DOMAIN_MAPPINGS = {
  // API mappings - app.headysystems.com to production domains
  'http://api.headysystems.com:3300': 'http://api.headysystems.com:3300',
  'https://api.headysystems.com:3300': 'https://api.headysystems.com:3300',
  'wss://api.headysystems.com:3300': 'wss://api.headysystems.com:3300',
  'api.headysystems.com:3300': 'api.headysystems.com:3300',
  
  // Web mappings - app.headysystems.com to production domains
  'http://app.headysystems.com:3000': 'http://app.headysystems.com:3000',
  'https://app.headysystems.com:3000': 'https://app.headysystems.com:3000',
  'app.headysystems.com:3000': 'app.headysystems.com:3000',
  
  // Database mappings - app.headysystems.com to internal domains
  'db.headysystems.com:5432': 'db.headysystems.com:5432',
  'cache.headysystems.com:6379': 'cache.headysystems.com:6379',
  
  // Generic app.headysystems.com cleanup
  'http://app.headysystems.com': 'http://app.headysystems.com',
  'https://app.headysystems.com': 'https://app.headysystems.com',
  'app.headysystems.com': 'app.headysystems.com'
};

async function eliminateLocalhost() {
  try {
    console.log('🔍 Scanning for app.headysystems.com references...');
    
    // Get all relevant files
    const filePatterns = [
      'src/**/*.js',
      'src/**/*.jsx', 
      'src/**/*.ts',
      'src/**/*.tsx',
      'src/**/*.json',
      'config/**/*.js',
      'config/**/*.json',
      'scripts/**/*.js',
      'public/**/*.js',
      'public/**/*.json',
      '.env.example',
      'package.json'
    ];
    
    let totalFiles = 0;
    let filesWithLocalhost = 0;
    let totalReplacements = 0;
    
    for (const pattern of filePatterns) {
      const files = glob.sync(pattern, { ignore: 'node_modules/**' });
      totalFiles += files.length;
      
      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf8');
          let modifiedContent = content;
          let fileReplacements = 0;
          
          // Apply all domain mappings
          Object.entries(DOMAIN_MAPPINGS).forEach(([oldRef, newDomain]) => {
            const regex = new RegExp(escapeRegExp(oldRef), 'g');
            const matches = content.match(regex);
            if (matches) {
              modifiedContent = modifiedContent.replace(regex, newDomain);
              fileReplacements += matches.length;
              totalReplacements += matches.length;
            }
          });
          
          // If file was modified, write it back
          if (fileReplacements > 0) {
            await fs.writeFile(file, modifiedContent);
            console.log(`  ✅ ${file}: ${fileReplacements} replacements`);
            filesWithLocalhost++;
          }
          
        } catch (error) {
          console.log(`  ⚠️  ${file}: ${error.message}`);
        }
      }
    }
    
    console.log(`\n📊 MIGRATION SUMMARY:`);
    console.log(`  Files scanned: ${totalFiles}`);
    console.log(`  Files modified: ${filesWithLocalhost}`);
    console.log(`  Total replacements: ${totalReplacements}`);
    
    // Create verification script
    const verificationScript = `#!/bin/bash
# 🌐 headysystems.com VERIFICATION SCRIPT
echo "🔍 Checking for remaining localhost references..."
if grep -r "localhost" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "❌ headysystems.com STILL FOUND - MANUAL CLEANUP REQUIRED"
  exit 1
else
  echo "✅ ALL headysystems.com REFERENCES ELIMINATED"
fi

echo "🔍 Checking for headysystems.com references..."
if grep -r "headysystems.com" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "❌ headysystems.com STILL FOUND - MANUAL CLEANUP REQUIRED"
  exit 1
else
  echo "✅ ALL headysystems.com REFERENCES ELIMINATED"
fi

echo "🎉 PRODUCTION DOMAIN MIGRATION COMPLETE"
`;
    
    await fs.writeFile('scripts/verify-no-localhost.sh', verificationScript);
    await fs.chmod('scripts/verify-no-localhost.sh', '755');
    
    console.log(`\n✅ Created verification script: scripts/verify-no-localhost.sh`);
    console.log(`\n🚀 headysystems.com ELIMINATION COMPLETE`);
    console.log(`📝 Next: Run ./scripts/verify-no-localhost.sh to verify`);
    
    return totalReplacements > 0;
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    return false;
  }
}

// Helper function to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Execute the migration
eliminateLocalhost().then(success => {
  if (success) {
    console.log('\n🌐 READY FOR PRODUCTION DEPLOYMENT');
  } else {
    console.log('\n🚨 MIGRATION FAILED - MANUAL INTERVENTION REQUIRED');
  }
}).catch(console.error);
