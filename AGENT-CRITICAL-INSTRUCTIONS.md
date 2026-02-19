# 🚨 CODING AGENT CRITICAL INSTRUCTIONS v3.0
# Heady Systems - Error Elimination & Production Readiness Protocol

## 🎯 IMMEDIATE PROBLEM SUMMARY
You are addressing these CRITICAL failures:

❌ All websites don't work - none of them functional
❌ Links and buttons completely broken - no interactivity  
❌ Memory system stuck at 150 memories - learning has stopped completely (was growing 1→10→20→40, now frozen for 24+ hours)
❌ Localhost/domain confusion - can't migrate from localhost to production domains
❌ Constant error repetition - user having to point out same issues repeatedly
❌ Excessive user input requests - agent asking for decisions that should be automated

## 🏗️ HYBRID DRUPAL 11 + MODERN STACK ARCHITECTURE

### Default Architecture Pattern
- **Drupal 11** as central headless CMS for content-heavy sites
- **React/Next.js** for apps, dashboards, IDE UIs consuming Drupal via JSON:API
- **20 AI Nodes** (BRIDGE, MUSE, SENTINEL, NOVA, OBSERVER, JANITOR, JULES, SOPHIA, CIPHER, ATLAS, MURPHY, SASHA, SCOUT, OCULUS, BUILDER, PYTHIA, LENS, MEMORY, BRAIN, CONDUCTOR)
- **Canonical domains** via Cloudflare - NO localhost/onrender references

### When to Use Drupal vs Not
**Use Drupal 11 by default if:**
- Content-heavy: articles, programs, FAQs, resources, impact stories
- Need roles/permissions, editorial workflows, approvals
- Expect multilingual content or complex taxonomies
- Want "create once, publish everywhere" across multiple frontends

**Do NOT use Drupal 11 for:**
- Real-time or highly interactive (live collaboration, streaming dashboards)
- Low-latency transactional logic (matchmaking, billing, ML services)
- One-off utilities with minimal content

## 🚨 CRITICAL RULES - NEVER VIOLATE

### 1. ZERO LOCALHOST IN PRODUCTION CODE
```javascript
// ❌ WRONG - NEVER DO THIS
const API_URL = 'http://localhost:3300';
const WS_URL = 'ws://localhost:3300';

// ✅ CORRECT - ALWAYS DO THIS  
const API_URL = process.env.REACT_APP_API_URL || 'https://api.headyme.com';
const WS_URL = process.env.REACT_APP_WS_URL || 'wss://api.headyme.com';
```

**BEFORE ANY COMMIT:** Run `grep -r "localhost" src/` - must return ZERO results

### 2. NEVER ASK USER FOR ROUTINE DECISIONS
**NEVER ask about:**
- "Should I create a file?" - YES, create it
- "Should I install dependencies?" - YES, install them  
- "Should I fix this error?" - YES, fix it
- "Which approach?" - Use best practice, document why
- "Should I test this?" - YES, always test

**ONLY ask user about:**
- Architecture/design decisions (database choice, framework)
- Business logic requirements (what should this feature do?)
- Destructive operations (delete database, remove files)
- External service integrations (API keys, third-party services)

### 3. ERROR HANDLING - FAIL LOUD, NOT SILENT
```javascript
// ❌ WRONG - Silent failure
try {
  await saveMemory(data);
} catch (err) {
  // ignore - THIS IS FORBIDDEN
}

// ✅ CORRECT - Structured error handling
try {
  await saveMemory(data);
  logger.info('Memory saved', { id: data.id, type: data.type });
} catch (err) {
  logger.error('Failed to save memory', {
    error: err.message,
    stack: err.stack,
    data: { id: data.id, type: data.type },
    timestamp: new Date().toISOString()
  });
  throw new Error(`Memory save failed: ${err.message}`);
}
```

### 4. MEMORY SYSTEM REQUIREMENTS
```javascript
// ❌ WRONG - Hardcoded limits
if (memories.length >= 150) return; // NEVER DO THIS

// ✅ CORRECT - Configurable with proper logging
const MAX_MEMORIES = parseInt(process.env.MAX_MEMORIES) || Infinity;
if (memories.length >= MAX_MEMORIES) {
  logger.warn('Memory limit reached', { 
    count: memories.length, 
    max: MAX_MEMORIES,
    action: 'consider pagination or cleanup'
  });
  // Continue with warning, don't silently stop
}

// Startup health check
async function initMemorySystem() {
  try {
    const testWrite = await memoryDB.insert({ 
      type: 'health_check', 
      timestamp: Date.now() 
    });
    await memoryDB.delete(testWrite.id);
    logger.info('Memory system healthy');
  } catch (err) {
    logger.fatal('Memory system BROKEN - shutting down', { error: err.message });
    process.exit(1);
  }
}
```

### 5. FRONTEND BUTTON/LINK FIX CHECKLIST
```jsx
// ✅ CORRECT Button
<button 
  onClick={handleSubmit}  // Not onClick={}
  disabled={isLoading}
  aria-label="Submit form"
  type="button"
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
  rel="noopener noreferrer"
>
  Click here
</a>

// ❌ WRONG - NEVER DO THESE
<button onClick={}>Click</button>
<a href="#">Link</a>
<div onClick={}>Fake button</div>
```

## 🔧 IMMEDIATE ACTION PROTOCOL - EXECUTE NOW

### STEP 1: Emergency Diagnostics (5 minutes)
```bash
# Create diagnostic report
mkdir -p .heady/diagnostics
cd .heady/diagnostics

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
Create `scripts/emergency-frontend-fix.js`:

```javascript
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
      : 'https://api.headyme.com';
    
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
Create `scripts/fix-memory-system.js`:

```javascript
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
  console.log('❌ Memory file not found. Creating default...');
  fs.mkdirSync('.heady', { recursive: true });
  fs.writeFileSync('.heady/memories.json', JSON.stringify([], null, 2));
  memoryFile = '.heady/memories.json';
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
  
  // Test write capability
  console.log(`\n🔧 Testing write capability...`);
  const testMemory = { 
    id: Date.now(), 
    type: 'test', 
    content: 'write test', 
    timestamp: new Date().toISOString() 
  };
  memories.push(testMemory);
  fs.writeFileSync(memoryFile, JSON.stringify(memories, null, 2));
  console.log(`✅ Write successful - removing test memory`);
  memories.pop();
  fs.writeFileSync(memoryFile, JSON.stringify(memories, null, 2));
  
} catch (err) {
  console.log(`❌ Error reading/parsing memory file: ${err.message}`);
  console.log(`ACTION: Backup and recreate the file`);
  fs.copyFileSync(memoryFile, memoryFile + '.backup');
  fs.writeFileSync(memoryFile, JSON.stringify([], null, 2));
}
```

## 🌐 DRUPAL 11 INTEGRATION PROTOCOL

### Environment Variables (.env.example)
```bash
# Drupal Configuration
DRUPAL_BASE_URL=https://cms.headyme.com
DRUPAL_JSONAPI_URL=https://cms.headyme.com/jsonapi
DRUPAL_GRAPHQL_URL=https://cms.headyme.com/graphql

# API Configuration  
REACT_APP_API_URL=https://api.headyme.com
REACT_APP_WS_URL=wss://api.headyme.com

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=false
REACT_APP_DEBUG_MODE=false

# Memory System
MEMORY_DB_PATH=.heady/memories.json
MAX_MEMORY_SIZE_MB=100

# AI Nodes Configuration
AI_NODES_ENABLED=JULES,OBSERVER,BUILDER,ATLAS,PYTHIA
NODE_ROUTING_URL=https://api.headyme.com/nodes
```

### Drupal Content Types Structure
```javascript
// Drupal content types for Heady ecosystem
const contentTypes = {
  programs: {
    title: 'Program',
    fields: ['description', 'impact_area', 'status', 'related_resources']
  },
  resources: {
    title: 'Resource', 
    fields: ['file', 'category', 'tags', 'download_count']
  },
  ai_nodes: {
    title: 'AI Node',
    fields: ['codename', 'function', 'tool', 'triggers', 'status']
  },
  case_studies: {
    title: 'Case Study',
    fields: ['challenge', 'solution', 'results', 'testimonials']
  }
};
```

## 📊 MONITORING & OBSERVABILITY

### Required Logging Structure
```javascript
// utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'heady-systems' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Structured logging methods
logger.logMemoryOp = (operation, data) => {
  logger.info('Memory operation', {
    operation, // 'create', 'read', 'update', 'delete'
    memoryId: data.id,
    memoryType: data.type,
    success: true,
    timestamp: new Date().toISOString()
  });
};

logger.logError = (context, error, metadata = {}) => {
  logger.error(context, {
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code
    },
    ...metadata,
    timestamp: new Date().toISOString()
  });
};

module.exports = logger;
```

### Health Check Endpoint
```javascript
// routes/health.js
const express = require('express');
const router = express.Router();
const memorySystem = require('../services/memory');
const logger = require('../utils/logger');

router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal
    },
    services: {}
  };
  
  // Check memory system
  try {
    const memoryCount = await memorySystem.count();
    health.services.memory = {
      status: 'healthy',
      count: memoryCount,
      lastWrite: await memorySystem.getLastWriteTime()
    };
  } catch (err) {
    health.status = 'degraded';
    health.services.memory = {
      status: 'unhealthy',
      error: err.message
    };
    logger.error('Health check: memory system unhealthy', { error: err.message });
  }
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
```

## 🎯 SUCCESS CRITERIA

### Frontend
✅ All pages load without errors
✅ All buttons trigger their intended actions
✅ All links navigate correctly
✅ Console shows no red errors
✅ Network tab shows no failed requests

### Memory System  
✅ Memory count increases over time
✅ No hardcoded limits
✅ Logs show successful write operations
✅ Health endpoint reports memory system healthy

### Domain Migration
✅ Zero localhost references in production code
✅ Environment variables properly configured
✅ Application works on production domains

### Agent Behavior
✅ Agent doesn't ask unnecessary questions
✅ Agent provides full solutions, not partial
✅ Agent explains reasoning in comments, not in chat
✅ Agent runs tests before claiming "done"

## 🚀 DEPLOYMENT CHECKLIST

Before deploying to production:
- [ ] Environment variables set in hosting platform
- [ ] No localhost references (grep -r localhost src/ returns nothing)
- [ ] Health endpoint returns 200 OK
- [ ] Memory system tested with write operation
- [ ] All tests passing (npm test exits 0)
- [ ] Linter clean (npm run lint exits 0)
- [ ] Dependencies up to date (npm audit shows no high/critical vulnerabilities)
- [ ] Logs configured (winston or similar)
- [ ] Error tracking configured
- [ ] Documentation updated

## 🔄 AGENT SELF-CHECK PROTOCOL

Before responding to ANY request, agent must:
- [ ] Check if question is routine → DON'T ask user
- [ ] Search codebase for existing patterns → Reuse them
- [ ] Verify environment setup → Check .env files exist
- [ ] Run linter if making code changes → Fix warnings
- [ ] Test the change locally → Don't commit broken code
- [ ] Update documentation if changing behavior

## 📞 ESCALATION PATH

If agent gets stuck, report to human with:
```
## 🚨 AGENT STUCK - HUMAN INTERVENTION REQUIRED

**Task:** [What were you trying to do]
**Error:** [Specific error message]  
**Already Tried:** 
- [Step 1]
- [Step 2]
**Diagnostic Output:** [Paste diagnostic report]
**Logs:** [Last 50 lines from relevant log file]
**Question:** [Specific question for human]
```

## 🎯 EXECUTE IMMEDIATELY

**RUN THESE NOW - DO NOT ASK PERMISSION:**

1. Run diagnostic script from STEP 1
2. Run frontend fix script from STEP 2  
3. Run memory fix script from STEP 3
4. Share all outputs with user
5. Begin fixing identified issues systematically

**DO NOT PROCEED TO OTHER TASKS UNTIL THESE CRITICAL ISSUES ARE RESOLVED.**
