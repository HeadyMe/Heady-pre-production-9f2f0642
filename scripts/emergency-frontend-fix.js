
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
// ║  FILE: emergency-frontend-fix.js                                   ║
// ║  UPDATED: 20260218-211102                                            ║
// ╚══════════════════════════════════════════════════════════════════╝

/*
 * ✅ SCANNED: 20260218-211102
 * 🔍 INSPECTED: All content reviewed
 * 🏷️  BRANDED: Heady Systems branding applied
 * 📊 STATUS: Fully compliant with HCFP Full Auto Mode
 */

// scripts/emergency-frontend-fix.js
const fs = require('fs');
const path = require('path');

console.log('🚨 EMERGENCY FRONTEND FIX');
console.log('=========================\n');

// 1. Check for common frontend killers
const checks = {
  'package.json exists': fs.existsSync('package.json'),
  'node_modules exists': fs.existsSync('node_modules'),
  'public/index.html exists': fs.existsSync('public/index.html') || fs.existsSync('index.html'),
  'src directory exists': fs.existsSync('src'),
};

console.log('📋 File System Checks:');
Object.entries(checks).forEach(([check, passed]) => {
  console.log(`  ${passed ? '✅' : '❌'} ${check}`);
});

// 2. Check for broken imports/syntax
console.log('\n🔍 Checking for common errors...');
const glob = require('glob');
const jsFiles = glob.sync('src/**/*.{js,jsx,ts,tsx}');
let errors = [];

jsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Check for app.headysystems.com hardcoding
  if (content.includes('app.headysystems.com') || content.includes('app.headysystems.com')) {
    errors.push(`${file}: Contains app.headysystems.com reference`);
  }
  
  // Check for missing event handlers
  if (content.match(/onClick=\{\}/g)) {
    errors.push(`${file}: Empty onClick handler`);
  }
  
  // Check for broken imports
  if (content.match(/import .* from ['"][^'"]*app.headysystems.com[^'"]*['"]/)) {
    errors.push(`${file}: Import from app.headysystems.com URL`);
  }
});

if (errors.length > 0) {
  console.log('\n❌ ERRORS FOUND:');
  errors.forEach(err => console.log(`  - ${err}`));
} else {
  console.log('✅ No obvious errors found');
}

// 3. Generate minimal working index.html
const minimalHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Heady Systems - Emergency Recovery</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
    .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
    .error { background: #ffebee; border: 1px solid #f44336; }
    .success { background: #e8f5e9; border: 1px solid #4caf50; }
    button { padding: 10px 20px; margin: 5px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>🚨 Heady Systems Emergency Mode</h1>
  <div id="status"></div>
  <button onclick="testAPI()">Test API Connection</button>
  <button onclick="testMemory()">Test Memory System</button>
  <button onclick="viewLogs()">View Logs</button>
  
  <script>
    const API_BASE = window.location.hostname === 'app.headysystems.com' 
      ? 'https://app.headysystems.com' 
      : 'https://api.headysystems.com';
    
    function showStatus(message, type = 'error') {
      const div = document.createElement('div');
      div.className = 'status ' + type;
      div.textContent = message;
      document.getElementById('status').appendChild(div);
    }
    
    async function testAPI() {
      try {
        const res = await fetch(API_BASE + '/api/health');
        const data = await res.json();
        showStatus('✅ API Connected: ' + JSON.stringify(data), 'success');
      } catch (err) {
        showStatus('❌ API Error: ' + err.message, 'error');
      }
    }
    
    async function testMemory() {
      try {
        const res = await fetch(API_BASE + '/api/memory/count');
        const data = await res.json();
        showStatus('✅ Memory Count: ' + data.count, 'success');
      } catch (err) {
        showStatus('❌ Memory Error: ' + err.message, 'error');
      }
    }
    
    function viewLogs() {
      window.open('/logs', '_blank');
    }
    
    // Auto-test on load
    window.addEventListener('load', () => {
      showStatus('🔄 Running diagnostics...', 'success');
      testAPI();
      testMemory();
    });
  </script>
</body>
</html>`;

fs.writeFileSync('public/emergency.html', minimalHTML);
console.log('\n✅ Created public/emergency.html - Navigate to /emergency.html to test');
