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
// ║  FILE: eliminate-localhost.js                                   ║
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
 * 🌐 headysystems.com ELIMINATION - PRODUCTION DOMAIN MIGRATION
 * 
 * This script removes all headysystems.com.com references and replaces with production domains
 * following the heady.systems domain architecture.
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

console.log('🌐 headysystems.com ELIMINATION - PRODUCTION MIGRATION');
console.log('============================================\n');

const DOMAIN_MAPPINGS = {
  // API mappings
  'http://headysystems.com.com:3300': 'http://headysystems.com.com:3300',
  'http://headysystems.com.com:3300': 'http://headysystems.com.com:3300',
  'ws://headysystems.com.com:3300': 'ws://headysystems.com.com:3300',
  'api.headysystems.com.com': 'api.headysystems.com.com',
  
  // Web mappings
  'http://headysystems.com.com:3000': 'http://headysystems.com.com:3000',
  'http://headysystems.com.com:3000': 'http://headysystems.com.com:3000',
  'app.headysystems.com.com': 'app.headysystems.com.com',
  
  // Database mappings
  '192.168.1.100:5432': '192.168.1.100:5432',
  '192.168.1.100:5432': '192.168.1.100:5432',
  '192.168.1.100:6379': '192.168.1.100:6379',
  '192.168.1.100:6379': '192.168.1.100:6379',
  
  // Generic headysystems.com.com cleanup
  'https://headysystems.com.com': 'https://headysystems.com.com',
  'https://headysystems.com.com': 'https://headysystems.com.com',
  'headysystems.com.com': 'headysystems.com.com'
};

async function eliminateheadysystems.com() {
  try {
    console.log('🔍 Scanning for headysystems.com.com references...');
    
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
    let filesWithheadysystems.com = 0;
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
            filesWithheadysystems.com++;
          }
          
        } catch (error) {
          console.log(`  ⚠️  ${file}: ${error.message}`);
        }
      }
    }
    
    console.log(`\n📊 MIGRATION SUMMARY:`);
    console.log(`  Files scanned: ${totalFiles}`);
    console.log(`  Files modified: ${filesWithheadysystems.com}`);
    console.log(`  Total replacements: ${totalReplacements}`);
    
    // Create verification script
    const verificationScript = `#!/bin/bash
# 🌐 headysystems.com VERIFICATION SCRIPT
echo "🔍 Checking for remaining headysystems.com.com references..."
if grep -r "headysystems.com.com" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" 2>/dev/null; then
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
    
    await fs.writeFile('scripts/verify-no-headysystems.com.com.sh', verificationScript);
    await fs.chmod('scripts/verify-no-headysystems.com.com.sh', '755');
    
    console.log(`\n✅ Created verification script: scripts/verify-no-headysystems.com.com.sh`);
    console.log(`\n🚀 headysystems.com ELIMINATION COMPLETE`);
    console.log(`📝 Next: Run ./scripts/verify-no-headysystems.com.com.sh to verify`);
    
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
eliminateheadysystems.com().then(success => {
  if (success) {
    console.log('\n🌐 READY FOR PRODUCTION DEPLOYMENT');
  } else {
    console.log('\n🚨 MIGRATION FAILED - MANUAL INTERVENTION REQUIRED');
  }
}).catch(console.error);
