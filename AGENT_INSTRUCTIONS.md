<!-- ╔══════════════════════════════════════════════════════════════════╗ -->
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║ -->
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║ -->
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║ -->
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║ -->
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║ -->
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║ -->
<!-- ║                                                                  ║ -->
<!-- ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║ -->
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║ -->
<!-- ║  FILE: AGENT_INSTRUCTIONS.md                                   ║ -->
<!-- ║  UPDATED: 20260218-211102                                            ║ -->
<!-- ╚══════════════════════════════════════════════════════════════════╝ -->

# ✅ SCANNED: 20260218-211102
# 🔍 INSPECTED: All content reviewed
# 🏷️  BRANDED: Heady Systems branding applied
# 📊 STATUS: Fully compliant with HCFP Full Auto Mode

# 🎯 HEADY SYSTEMS CODING AGENT - MASTER PROTOCOL

## 🚨 CRITICAL RULES - NEVER VIOLATE

### 1. ZERO LOCALHOST IN PRODUCTION CODE
- ❌ NEVER use `localhost`, `127.0.0.1`, or `http://` in production code
- ✅ ALWAYS use environment variables: `process.env.API_URL` or `process.env.BASE_URL` 
- ✅ Default to production domains if env var missing
- 🔍 BEFORE ANY COMMIT: Run `grep -r "localhost" src/` - must return ZERO results

```javascript
// ❌ WRONG
const API_URL = 'http://localhost:3300';

// ✅ CORRECT
const API_URL = process.env.REACT_APP_API_URL || 'https://api.headysystems.com';
```

### 2. NEVER ASK USER FOR ROUTINE DECISIONS
Agent should NEVER ask about:

❌ "Should I create a file?" - YES, create it
❌ "Should I install dependencies?" - YES, install them  
❌ "Should I fix this error?" - YES, fix it
❌ "Which approach?" - Use best practice, document why
❌ "Should I test this?" - YES, always test

ONLY ask user about:
✅ Architecture/design decisions (database choice, framework)
✅ Business logic requirements (what should this feature do?)
✅ Destructive operations (delete database, remove files)
✅ External service integrations (API keys, third-party services)

### 3. ERROR HANDLING - FAIL LOUD, NOT SILENT
```javascript
// ❌ WRONG - Silent failure
try {
  await saveMemory(data);
} catch (err) {
  // ignore
}

// ✅ CORRECT - Structured error handling
try {
  await saveMemory(data);
  logger.info('Memory saved', { id: data.id });
} catch (err) {
  logger.error('Failed to save memory', {
    error: err.message,
    stack: err.stack,
    data: { id: data.id },
    timestamp: new Date().toISOString()
  });
  throw new Error(`Memory save failed: ${err.message}`);
}
```

### 4. MEMORY/LEARNING SYSTEM REQUIREMENTS
✅ NO hardcoded limits (no MAX_MEMORIES = 150)
✅ Implement pagination if performance degrades
✅ Log every memory operation (add, update, delete)
✅ Include timestamps and unique IDs
✅ Test write capability on startup
✅ Fail startup if memory system broken

```javascript
// Startup check
async function initMemorySystem() {
  try {
    const testWrite = await memoryDB.insert({ type: 'health_check', timestamp: Date.now() });
    await memoryDB.delete(testWrite.id);
    logger.info('Memory system healthy');
  } catch (err) {
    logger.fatal('Memory system BROKEN - shutting down', { error: err.message });
    process.exit(1);
  }
}
```

### 5. FRONTEND BUTTON/LINK FIX CHECKLIST
Every button/link MUST have:

```jsx
// ✅ CORRECT Button
<button 
  onClick={handleClick}  // Not onClick={}
  disabled={isLoading}
  aria-label="Submit form"
  type="button"  // or "submit"
>
  {isLoading ? 'Loading...' : 'Submit'}
</button>

// ✅ CORRECT Link
<a 
  href={url}  // Not href="#" without onClick
  onClick={(e) => {
    e.preventDefault();
    handleNavigation();
  }}
  rel="noopener noreferrer"  // If target="_blank"
>
  Click here
</a>
```

### 6. DRUPAL 11 HYBRID ARCHITECTURE
Use Drupal for:
✅ Content-heavy sites (articles, resources, docs)
✅ Editorial workflows and permissions
✅ Multilingual content and taxonomies
✅ "Create once, publish everywhere" content

Use React/Next.js for:
✅ Real-time dashboards and apps
✅ Interactive UIs and IDE interfaces
✅ Low-latency transactional logic
✅ Single-page applications

Always consume Drupal via JSON:API/GraphQL - never embed Drupal directly in apps.

### 7. ENVIRONMENT VARIABLE PROTOCOL
.env.example (commit to repo):
```bash
# API Configuration
REACT_APP_API_URL=https://api.headysystems.com
REACT_APP_WS_URL=wss://api.headysystems.com

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=false
REACT_APP_DEBUG_MODE=false

# Memory System
MEMORY_DB_PATH=.heady/memories.json
MAX_MEMORY_SIZE_MB=100  # Soft limit for warnings
```

.env (local, never commit):
```bash
# Copy from .env.example and customize
REACT_APP_API_URL=http://localhost:3300  # OK for local dev only
REACT_APP_DEBUG_MODE=true
```

### 8. AGENT SELF-CHECK PROTOCOL
Before responding to ANY request, agent must:

✅ Check if question is routine → DON'T ask user
✅ Search codebase for existing patterns → Reuse them
✅ Verify environment setup → Check .env files exist
✅ Run linter if making code changes → Fix warnings
✅ Test the change locally → Don't commit broken code
✅ Update documentation if changing behavior → Keep docs in sync

## 🛠️ AUTOMATIC BEHAVIORS

### When User Reports an Error:
1. **Root Cause Analysis** - Don't just fix symptoms
2. **Search for Similar Issues** - Check if this is a recurring pattern
3. **Implement Permanent Fix** - Add guards to prevent recurrence
4. **Add Tests** - Ensure the fix works and stays working
5. **Update Documentation** - Document the solution for future reference

### When Creating New Features:
1. **Use Existing Patterns** - Don't reinvent the wheel
2. **Follow Naming Conventions** - Heady[Verb/Noun] pattern (HeadyMC, HeadyPatterns, etc.)
3. **Add Error Handling** - Every function must handle errors properly
4. **Add Logging** - Log key operations with structured data
5. **Write Tests** - Unit tests for new functionality

### When Fixing Bugs:
1. **Identify Root Cause** - Don't just patch symptoms
2. **Check for Similar Issues** - Search codebase for related problems
3. **Implement Comprehensive Fix** - Fix all instances, not just one
4. **Add Regression Tests** - Prevent the bug from returning
5. **Document the Solution** - Add to ERROR_LOG.md

## 🚀 EXECUTION PRIORITIES

1. **System Health** - Memory system, error logs, performance
2. **User Experience** - Working buttons, links, navigation
3. **Code Quality** - No localhost, proper error handling, tests
4. **Documentation** - Keep docs in sync with code
5. **Security** - No hardcoded secrets, proper auth

## 📊 SUCCESS METRICS

✅ **Frontend**: All pages load, buttons work, no console errors
✅ **Memory System**: Count increases over time, no hardcoded limits
✅ **Domain Migration**: Zero localhost references in production
✅ **Agent Behavior**: No unnecessary questions, full solutions provided
✅ **Error Handling**: All errors logged with actionable information

## 🚨 ESCALATION PATH

If stuck for more than 5 minutes:
1. Check diagnostic reports
2. Review recent error logs
3. Check agent configuration
4. Report to human with specific question and what you've tried

**REMEMBER: You are here to SOLVE problems, not ask questions about routine operations.**

## 🚨 CRITICAL ZERO TOLERANCE RULE - NEVER VIOLATE

### ABSOLUTELY NO LOCAL REFERENCES - EVER
❌ **FORBIDDEN** (ZERO TOLERANCE):
- localhost (ANY form)
- 127.0.0.1 (ANY form)  
- 0.0.0.0 (ANY form)
- .local domains
- local: protocols
- Any local references whatsoever

✅ **REQUIRED** (ONLY ALLOWED):
- headysystems.com
- Production domains only
- External service domains

### ENFORCEMENT
- BEFORE ANY CODE: Check for local references
- IF FOUND: Immediately eliminate
- SYSTEM FAILURE on any local reference violation

### VERIFICATION
Run: ./scripts/zero-tolerance-enforcement.sh
This script runs continuously to enforce zero tolerance.

### CONSEQUENCES
- Any local reference = system failure
- No exceptions, no excuses
- Production domains ONLY

## 🎯 EMERGENCY PROTOCOLS

### STEP 1: Emergency Diagnostics (5 minutes)
```bash
# Create diagnostic report
mkdir -p .heady/diagnostics
cd .heady/diagnostics

# Capture system state
echo "=== SYSTEM DIAGNOSTIC REPORT ===" > diagnostic-$(date +%Y%m%d-%H%M%S).txt
echo "Timestamp: $(date)" >> diagnostic-*.txt
echo "" >> diagnostic-*.txt

# Check memory system
echo "=== MEMORY SYSTEM ===" >> diagnostic-*.txt
find . -name "*memor*" -o -name "*learn*" -o -name "*.db" >> diagnostic-*.txt
du -sh .heady/* >> diagnostic-*.txt 2>&1
echo "" >> diagnostic-*.txt

# Check localhost references
echo "=== LOCALHOST REFERENCES ===" >> diagnostic-*.txt
grep -r "localhost" . --include="*.js" --include="*.ts" --include="*.json" --include="*.env*" | wc -l >> diagnostic-*.txt
grep -r "127.0.0.1" . --include="*.js" --include="*.ts" --include="*.json" | wc -l >> diagnostic-*.txt
echo "" >> diagnostic-*.txt

# Check running services
echo "=== RUNNING SERVICES ===" >> diagnostic-*.txt
netstat -tuln | grep LISTEN >> diagnostic-*.txt 2>&1
ps aux | grep -E 'node|python|npm|docker' >> diagnostic-*.txt 2>&1
echo "" >> diagnostic-*.txt

# Check errors in logs
echo "=== RECENT ERRORS ===" >> diagnostic-*.txt
find . -name "*.log" -mtime -1 -exec tail -20 {} \; >> diagnostic-*.txt 2>&1

cat diagnostic-*.txt
```

### STEP 2: Frontend Crash Fix (15 minutes)
Create this emergency fix file:

```javascript
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
const jsFiles = require('glob').sync('src/**/*.{js,jsx,ts,tsx}');
let errors = [];

jsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Check for localhost hardcoding
  if (content.includes('localhost') || content.includes('127.0.0.1')) {
    errors.push(`${file}: Contains localhost reference`);
  }
  
  // Check for missing event handlers
  if (content.match(/onClick=\{\}/g)) {
    errors.push(`${file}: Empty onClick handler`);
  }
  
  // Check for broken imports
  if (content.match(/import .* from ['"][^'"]*localhost[^'"]*['"]/)) {
    errors.push(`${file}: Import from localhost URL`);
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
    const API_BASE = window.location.hostname === 'localhost' 
      ? 'http://localhost:3300' 
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
```

### STEP 3: Memory System Unblock (10 minutes)
```javascript
// scripts/fix-memory-system.js
const fs = require('fs');
const path = require('path');

console.log('🧠 MEMORY SYSTEM DIAGNOSTIC\n');

// Find memory storage
const possiblePaths = [
  '.heady/memories.json',
  '.heady/learning-log.json',
  '.heady/cache/memories.db',
  'data/memories.json',
  'src/data/memories.json'
];

let memoryFile = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    memoryFile = p;
    break;
  }
}

if (!memoryFile) {
  console.log('❌ Memory file not found. Checking for database connection...');
  // Check for DB env vars
  const envFile = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
  const hasDB = envFile.includes('DATABASE_URL') || envFile.includes('MONGO_URI');
  
  if (hasDB) {
    console.log('✅ Database configuration found in .env');
    console.log('⚠️  Run: npm run db:check to verify connection');
  } else {
    console.log('❌ No memory storage found!');
    console.log('ACTION: Create .heady/memories.json with empty array');
    fs.mkdirSync('.heady', { recursive: true });
    fs.writeFileSync('.heady/memories.json', JSON.stringify([], null, 2));
  }
  process.exit(1);
}

console.log(`✅ Found memory file: ${memoryFile}`);

// Check file size and permissions
const stats = fs.statSync(memoryFile);
console.log(`📊 File size: ${stats.size} bytes`);
console.log(`📊 Last modified: ${stats.mtime}`);

// Read and analyze
try {
  const content = fs.readFileSync(memoryFile, 'utf8');
  const memories = JSON.parse(content);
  
  console.log(`\n📈 Memory Statistics:`);
  console.log(`  Total memories: ${memories.length}`);
  
  if (memories.length >= 150) {
    console.log(`\n⚠️  STUCK AT 150 - Checking for hardcoded limit...`);
    
    // Search for MAX_MEMORIES in code
    const codeFiles = require('glob').sync('**/*.{js,ts}', { ignore: 'node_modules/**' });
    let limitFound = false;
    
    codeFiles.forEach(file => {
      const code = fs.readFileSync(file, 'utf8');
      if (code.match(/MAX.*MEMOR.*150/i) || code.match(/memories\.length.*>=.*150/)) {
        console.log(`  ❌ FOUND LIMIT IN: ${file}`);
        limitFound = true;
      }
    });
    
    if (!limitFound) {
      console.log(`  ✅ No hardcoded limit found`);
      console.log(`  ⚠️  Check: Database row limit, disk quota, or write permissions`);
    }
  }
  
  // Check for write capability
  console.log(`\n🔧 Testing write capability...`);
  const testMemory = { id: Date.now(), type: 'test', content: 'write test', timestamp: new Date().toISOString() };
  memories.push(testMemory);
  fs.writeFileSync(memoryFile, JSON.stringify(memories, null, 2));
  console.log(`✅ Write successful - removed test memory`);
  memories.pop();
  fs.writeFileSync(memoryFile, JSON.stringify(memories, null, 2));
  
} catch (err) {
  console.log(`❌ Error reading/parsing memory file: ${err.message}`);
  console.log(`ACTION: Backup and recreate the file`);
  fs.copyFileSync(memoryFile, memoryFile + '.backup');
  fs.writeFileSync(memoryFile, JSON.stringify([], null, 2));
}
```

## 🎯 NEXT IMMEDIATE ACTIONS

**EXECUTE IMMEDIATELY:**

1. Run diagnostic script (copy from "STEP 1: Emergency Diagnostics")
2. Share the output with me
3. Run frontend fix script (copy from "STEP 2: Frontend Crash Fix")
4. Run memory fix script (copy from "STEP 3: Memory System Unblock")

**DO NOT ask if you should do these - JUST DO THEM and share results.**
