# 🎯 HEADY CODING AGENT - MASTER PROTOCOL v4.0
## Hybrid Drupal + Modern Stack with 20 AI Nodes Integration

### 🚨 CRITICAL RULES - NEVER VIOLATE

#### 1. ZERO LOCALHOST/ONRENDER IN PRODUCTION CODE
- ❌ NEVER use `localhost`, `127.0.0.1`, `.onrender.com`, or `http://` in production code
- ✅ ALWAYS use environment variables: `process.env.API_URL` or `process.env.BASE_URL`
- ✅ Default to production domains from your 50-domain portfolio
- 🔍 BEFORE ANY COMMIT: Run `grep -r "localhost\|onrender" src/` - must return ZERO results

```javascript
// ❌ WRONG
const API_URL = 'http://localhost:3300';
const RENDER_URL = 'https://app.onrender.com';

// ✅ CORRECT
const API_URL = process.env.REACT_APP_API_URL || 'https://api.headysystems.com';
const APP_URL = process.env.REACT_APP_APP_URL || 'https://app.headysystems.com';
```

#### 2. HYBRID DRUPAL ARCHITECTURE DECISION TREE
When user mentions "website" or "site", classify immediately:

**Use Drupal 11 by default if:**
- Content-heavy: articles, programs, FAQs, resources, impact stories
- Need editorial workflows, approvals, roles/permissions
- Expect multilingual content or complex taxonomies
- "Create once, publish everywhere" across multiple frontends
- Nonprofit storytelling, documentation, marketing sites

**Use Modern Frontend (React/Next.js) if:**
- Real-time interactive: live collaboration, streaming dashboards
- Low-latency transactional: billing, ML services, heavy compute
- Single-page apps with minimal editorial content
- Internal tools with no public content needs

**Always Hybrid Approach:**
- Drupal for content model and app catalog
- Modern frontend for app logic
- APIs as the integration layer

#### 3. 20 AI NODES INTEGRATION
The agent must recognize and utilize these 20 nodes:

**Core Coding Cluster (5 nodes):**
- JULES (Hyper-Surgeon) - optimization via goose
- OBSERVER (Natural Observer) - monitoring via observerdaemon  
- BUILDER (Constructor) - project creation via hydrator
- ATLAS (Auto-Archivist) - documentation via autodoc
- PYTHIA (Oracle) - predictions via HuggingFaceTool

**Full Node Registry (20 nodes):**
1. BRIDGE (Connector) - mcpserver, network/tunnel
2. MUSE (Brand Architect) - contentgenerator, marketing
3. SENTINEL (Guardian) - headychain, auth/audit
4. NOVA (Expander) - gapscanner
5. OBSERVER (Natural Observer) - monitor
6. JANITOR (Custodian) - cleansweep
7. JULES (Hyper-Surgeon) - optimization
8. SOPHIA (Matriarch) - hardwaresentience
9. CIPHER (Cryptolinguist) - headycrypt
10. ATLAS (Auto-Archivist) - documentation
11. MURPHY (Inspector) - semgrep, security
12. SASHA (Dreamer) - yandexgpt, brainstorming
13. SCOUT (Hunter) - pygithub, repo scanning
14. OCULUS (Visualizer) - gource
15. BUILDER (Constructor) - hydrator
16. PYTHIA (Oracle) - HuggingFaceTool
17. LENS (All-Seeing Eye) - headylens, metrics
18. MEMORY (Eternal Archive) - headymemory
19. BRAIN (Central Intelligence) - headybrain
20. CONDUCTOR (Orchestrator) - headypromoter

**Node Integration Rules:**
- Each node has specific triggers and tools
- Route tasks to appropriate node based on trigger words
- Document which node handled which task
- Never duplicate node responsibilities

#### 4. DOMAIN STRATEGY (50 Domains)
**Cloudflare Pro Plan (HeadySystems.com):**
- All production apps and critical infrastructure
- app.headysystems.com, admin.headysystems.com, api.headysystems.com
- Best performance, WAF, DDoS protection

**Strategic Domain Separation:**
- HeadyConnection.org (Nonprofit) - Apply for Cloudflare nonprofit credits ($250k)
- HeadyMe.com - Personal cloud
- HeadyMCP.com - MCP server infrastructure  
- HeadyIO.com - API gateway/developer portal
- HeadyBuddy.org - Chat/AI assistant interface
- HeadyBot.com - Automation/webhooks/integrations

**Environment Variables Pattern:**
```bash
# Production domains only - no localhost
NODE_ENV=production
HEADYSYSTEMS_APP_URL=https://app.headysystems.com
HEADYSYSTEMS_API_URL=https://api.headysystems.com
HEADYME_URL=https://headyme.com
HEADYMCP_URL=https://headymcp.com
HEADYIO_URL=https://headyio.com
HEADYBUDDY_URL=https://headybuddy.org
HEADYBOT_URL=https://headybot.com
HEADYCONNECTION_URL=https://headyconnection.org
```

#### 5. NEVER ASK USER FOR ROUTINE DECISIONS
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

#### 6. ERROR HANDLING - FAIL LOUD, NOT SILENT
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
  logger.info('Memory saved', { id: data.id, node: 'MEMORY' });
} catch (err) {
  logger.error('Failed to save memory', {
    error: err.message,
    stack: err.stack,
    data: { id: data.id },
    node: 'MEMORY',
    timestamp: new Date().toISOString()
  });
  throw new Error(`Memory save failed: ${err.message}`);
}
```

#### 7. MEMORY/LEARNING SYSTEM REQUIREMENTS
✅ NO hardcoded limits (no MAX_MEMORIES = 150)
✅ Implement pagination if performance degrades
✅ Log every memory operation with node attribution
✅ Include timestamps, unique IDs, and responsible node
✅ Test write capability on startup
✅ Fail startup if memory system broken

```javascript
// Startup check with node tracking
async function initMemorySystem() {
  try {
    const testWrite = await memoryDB.insert({ 
      type: 'health_check', 
      timestamp: Date.now(),
      node: 'BRAIN',
      source: 'system_init'
    });
    await memoryDB.delete(testWrite.id);
    logger.info('Memory system healthy', { node: 'BRAIN' });
  } catch (err) {
    logger.fatal('Memory system BROKEN - shutting down', { 
      error: err.message,
      node: 'BRAIN' 
    });
    process.exit(1);
  }
}
```

#### 8. DRUPAL 11 HEADLESS SETUP
**Content Types for Heady Ecosystem:**
- Patterns (arena mode outcomes)
- Nodes (AI node documentation)  
- Projects (BUILDER creations)
- Optimizations (JULES improvements)
- Documentation (ATLAS archives)
- Security Audits (MURPHY reports)
- Predictions (PYTHIA insights)
- Monitoring Data (OBSERVER metrics)

**API Exposure:**
```javascript
// Drupal JSON:API configuration
const DRUPAL_API = {
  baseUrl: process.env.DRUPAL_URL || 'https://cms.headysystems.com',
  endpoints: {
    patterns: '/api/v1/patterns',
    nodes: '/api/v1/nodes', 
    projects: '/api/v1/projects',
    audits: '/api/v1/security-audits'
  }
};
```

#### 9. FRONTEND BUTTON/LINK FIX CHECKLIST
Every button/link MUST have:

```jsx
// ✅ CORRECT Button
<button 
  onClick={handleSubmit}  // Not onClick={}
  disabled={isLoading}
  aria-label="Submit form"
  type="button"  // or "submit"
  data-node="BUILDER"  // Track responsible node
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
  data-node="CONDUCTOR"  // Track routing
>
  Click here
</a>

// ❌ WRONG
<button onClick={}>Click</button>
<a href="#">Link</a>
<div onClick={}>Fake button</div>
```

#### 10. AGENT SELF-CHECK PROTOCOL
Before responding to ANY request, agent must:

✅ Check if question is routine → DON'T ask user
✅ Identify which AI node should handle this → Route appropriately
✅ Search codebase for existing patterns → Reuse them
✅ Verify environment setup → Check .env files exist
✅ Run linter if making code changes → Fix warnings
✅ Test the change locally → Don't commit broken code
✅ Update documentation if changing behavior → Keep docs in sync

**Internal Checklist (don't show to user unless asked):**
```
[ ] Is this a decision only the user can make? (If NO, proceed automatically)
[ ] Which AI node owns this task? (Route to correct node)
[ ] Does this require new dependencies? (If YES, check package.json first)
[ ] Does this change an API? (If YES, update OpenAPI/Swagger docs)
[ ] Does this affect other services? (If YES, check integration tests)
[ ] Is this idempotent? (Can I run it multiple times safely?)
[ ] Drupal or modern frontend? (Apply hybrid decision tree)
```

#### 11. NODE-SPECIFIC RESPONSIBILITIES

**JULES (Hyper-Surgeon):**
- Code optimization and refactoring
- Performance improvements
- Architecture cleanup
- Bug elimination

**OBSERVER (Natural Observer):**
- System monitoring and health checks
- Performance metrics collection
- Anomaly detection
- Status reporting

**BUILDER (Constructor):**
- Project scaffolding and creation
- File structure setup
- Dependency management
- Build system configuration

**ATLAS (Auto-Archivist):**
- Documentation generation
- Code comment standardization
- README creation
- API documentation

**PYTHIA (Oracle):**
- Predictive analysis
- Recommendation generation
- Trend identification
- Future planning insights

**CONDUCTOR (Orchestrator):**
- Task routing between nodes
- Workflow coordination
- System overview
- Policy enforcement

#### 12. MANDATORY PRE-COMMIT CHECKS
Create .husky/pre-commit:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running Heady pre-commit checks..."

# Check for localhost/onrender
if grep -r "localhost\|onrender" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"; then
  echo "❌ BLOCKED: localhost/onrender found in source code"
  echo "Use environment variables instead"
  exit 1
fi

# Check for console.log (warn only)
if grep -r "console.log" src/ --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" | grep -v "// ok"; then
  echo "⚠️  WARNING: console.log found (use logger instead)"
fi

# Verify node attribution
if grep -r "data-node" src/ --include="*.jsx" --include="*.tsx" | wc -l | grep -q "^0$"; then
  echo "⚠️  WARNING: No node attribution found in components"
fi

# Run linter
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ BLOCKED: Linter errors"
  exit 1
fi

# Run tests
npm test -- --bail --findRelatedTests
if [ $? -ne 0 ]; then
  echo "❌ BLOCKED: Tests failed"
  exit 1
fi

echo "✅ All Heady checks passed"
```

#### 13. DRUPAL-MODERN INTEGRATION PATTERNS

**Pattern 1: Drupal as Content Hub, React as App Frontend**
```javascript
// React component consuming Drupal API
const useDrupalContent = (contentType) => {
  const [content, setContent] = useState([]);
  
  useEffect(() => {
    fetch(`${process.env.DRUPAL_API_URL}/api/v1/${contentType}`)
      .then(res => res.json())
      .then(data => setContent(data))
      .catch(err => logger.error('Drupal API error', { 
        error: err.message, 
        node: 'OBSERVER' 
      }));
  }, [contentType]);
  
  return content;
};
```

**Pattern 2: Node-Specific Content Types**
```javascript
// Node registration in Drupal
const registerNodeActivity = async (node, activity, data) => {
  return fetch(`${process.env.DRUPAL_API_URL}/api/v1/node-activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      node,
      activity,
      data,
      timestamp: new Date().toISOString()
    })
  });
};

// Usage
await registerNodeActivity('JULES', 'optimization', {
  file: 'src/components/Header.jsx',
  improvement: 'Reduced bundle size by 15%'
});
```

#### 14. MONITORING & OBSERVABILITY

**Structured Logging with Node Attribution:**
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
  defaultMeta: { 
    service: 'heady-systems',
    version: '4.0.0'
  },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Node-specific logging methods
logger.logNodeActivity = (node, activity, data) => {
  logger.info('Node activity', {
    node,
    activity,
    data,
    timestamp: new Date().toISOString()
  });
};

logger.logError = (node, context, error, metadata = {}) => {
  logger.error('Node error', {
    node,
    context,
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

#### 15. HEALTH CHECK ENDPOINT
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
    version: '4.0.0',
    nodes: {},
    services: {}
  };
  
  // Check each node status
  const nodes = ['JULES', 'OBSERVER', 'BUILDER', 'ATLAS', 'PYTHIA', 'CONDUCTOR'];
  for (const node of nodes) {
    try {
      // Simulate node health check
      health.nodes[node] = {
        status: 'healthy',
        lastActivity: await getLastNodeActivity(node)
      };
    } catch (err) {
      health.status = 'degraded';
      health.nodes[node] = {
        status: 'unhealthy',
        error: err.message
      };
      logger.logError(node, 'Health check failed', err);
    }
  }
  
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
    logger.logError('MEMORY', 'Health check failed', err);
  }
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
```

#### 16. DEPLOYMENT CHECKLIST
Before deploying to production:

✅ Environment variables set for production domains
✅ No localhost/onrender references (grep -r "localhost\|onrender" src/ returns nothing)
✅ Health endpoint returns 200 OK with all nodes healthy
✅ Memory system tested with write operation
✅ All tests passing (npm test exits 0)
✅ Linter clean (npm run lint exits 0)
✅ Dependencies up to date (npm audit shows no high/critical vulnerabilities)
✅ Node attribution added to all new components
✅ Drupal content types configured if using Drupal
✅ Cloudflare caching configured for domain
✅ Error tracking (Sentry or similar) configured
✅ Monitoring (UptimeRobot or similar) for health checks

#### 17. COMMON MISTAKES - AVOID THESE

❌ DON'T DO THIS:
```javascript
// Hard-coded URLs
const API_URL = "http://localhost:3300";

// Silent errors
try { doThing(); } catch {}

// Empty handlers
onClick={() => {}}

// Magic numbers
if (memories.length >= 150) return;

// No logging
await saveData(x);

// Unhandled promises
fetch('/api/data');  // No .then() or await

// Missing node attribution
<button onClick={handleSubmit}>Submit</button>

// Drupal content types not defined
fetch('/api/v1/undefined-type');
```

✅ DO THIS INSTEAD:
```javascript
// Environment-based config
const API_URL = process.env.REACT_APP_API_URL || (() => {
  throw new Error('REACT_APP_API_URL must be set');
})();

// Structured error handling
try {
  await doThing();
  logger.logNodeActivity('JULES', 'optimization', { file: 'src/app.js' });
} catch (err) {
  logger.logError('JULES', 'Optimization failed', err, { file: 'src/app.js' });
  throw err;
}

// Proper handlers
onClick={handleSubmit}

// Configuration constants
const MAX_MEMORIES = parseInt(process.env.MAX_MEMORIES) || Infinity;
if (memories.length >= MAX_MEMORIES) {
  logger.warn('Memory limit reached', { 
    count: memories.length, 
    max: MAX_MEMORIES,
    node: 'MEMORY' 
  });
  return;
}

// Comprehensive logging
logger.info('Saving data', { id: x.id, type: x.type, node: 'MEMORY' });
await saveData(x);
logger.info('Data saved', { id: x.id, node: 'MEMORY' });

// Proper async
try {
  const response = await fetch('/api/data');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data;
} catch (err) {
  logger.logError('CONDUCTOR', 'Fetch failed', err);
  throw err;
}

// Node attribution
<button 
  onClick={handleSubmit}
  data-node="BUILDER"
  aria-label="Create new project"
>
  Create Project
</button>

// Drupal content validation
const contentType = 'patterns';  // Validated content type
fetch(`/api/v1/${contentType}`);
```

#### 18. SUCCESS CRITERIA

Your coding agent is working correctly when:

✅ **Frontend:**
- All pages load without errors
- All buttons trigger intended actions with node attribution
- All links navigate correctly
- Console shows no red errors
- Network tab shows no failed requests
- Drupal content loads when applicable

✅ **Memory System:**
- Memory count increases over time
- No hardcoded limits
- Logs show successful write operations with node attribution
- Health endpoint reports memory system healthy

✅ **Domain Migration:**
- Zero localhost/onrender references in production code
- Environment variables properly configured
- Application works on production domains

✅ **Node Integration:**
- Tasks routed to correct AI nodes
- Node activities logged to Drupal
- Each node's responsibilities respected
- No duplicate work between nodes

✅ **Drupal Integration:**
- Content types defined for all node activities
- API endpoints accessible
- Content appears in Drupal admin
- Proper caching configured

✅ **Agent Behavior:**
- Agent doesn't ask unnecessary questions
- Agent provides full solutions with node attribution
- Agent explains reasoning in comments, not chat
- Agent runs tests before claiming "done"

#### 19. ESCALATION PATH
If the agent gets stuck:

1. Check which node should handle the task
2. Review recent error logs with node attribution
3. Check agent configuration (.cursorrules, .windsurfrules)
4. Manually run health checks with node status
5. Report to human with this template:

```
## 🚨 AGENT STUCK - HUMAN INTERVENTION REQUIRED

**Task:** [What were you trying to do]
**Responsible Node:** [Which AI node should handle this]
**Error:** [Specific error message]
**Already Tried:** 
- [Step 1]
- [Step 2]
**Diagnostic Output:** [Paste diagnostic report]
**Logs:** [Last 50 lines from relevant log file]
**Question:** [Specific question for human]
```

#### 20. IMMEDIATE EMERGENCY PROTOCOL

**PASTE THIS TO YOUR AGENT RIGHT NOW:**

🚨 EMERGENCY PROTOCOL - EXECUTE IMMEDIATELY:

1. Run URL resolver to eliminate localhost/onrender references:
```bash
node lib/heady-url-resolver.js --fix .
```

2. Check which AI nodes are responding:
```bash
curl -s https://api.headysystems.com/health | jq '.nodes'
```

3. Verify Drupal connectivity if applicable:
```bash
curl -s https://cms.headysystems.com/api/v1/health
```

4. Test memory system write capability:
```bash
curl -X POST https://api.headysystems.com/api/memory/test
```

5. Check vector database connectivity:
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM heady_memories;"
```

6. Share the output with me

DO NOT ask if you should do these - JUST DO THEM and share results.

---

## 🔧 URL RESOLVER INTEGRATION

**Install and configure the Heady URL Resolver:**

```bash
# Add to package.json dependencies
npm install --save ./lib/heady-url-resolver.js

# Initialize in your main app
const resolver = require('./lib/heady-url-resolver.js');

# Use as middleware (Express)
app.use(resolver.middleware());

# Sanitize environment variables
process.env = resolver.sanitizeEnv(process.env);
```

**Vector Database Setup:**

```bash
# Install pgvector and create schema
psql $DATABASE_URL -f database/vector-storage-schema.sql

# Verify installation
psql $DATABASE_URL -c "SELECT heady_insert_test_data();"
```

---

**This instruction set integrates:**
- Hybrid Drupal 11 + modern frontend architecture
- All 20 AI nodes with proper routing and attribution
- Your 50-domain strategy with Cloudflare Pro optimization
- Memory system fixes and monitoring
- Zero tolerance for localhost/onrender in production
- Comprehensive error handling and logging
- Node-specific responsibilities and workflows
- **NEW:** URL resolver for eliminating localhost/onrender references
- **NEW:** Vector storage schema for semantic search and AI node memory
