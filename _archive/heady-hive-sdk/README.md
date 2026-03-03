# Heady Hive SDK

> The official SDK for the Heady AI ecosystem — connect to Brain, Battle, Creative, MCP, and 40+ services.

[![Version](https://img.shields.io/badge/version-1.0.0-6366f1)](https://headyio.com)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

## Quick Start

```javascript
const { HeadyClient } = require("heady-hive-sdk");
const heady = new HeadyClient({ url: "https://headyme.com", apiKey: "your-key" });

// Chat with Brain
const reply = await heady.brain.chat("Analyze my architecture");

// Validate through Battle
const result = await heady.battle.validate("Added caching layer");

// Generate creative content
const art = await heady.creative.generate("sacred geometry banner");
```

## Installation

```bash
npm install heady-hive-sdk
```

Or use locally:
```bash
cd ~/Heady && node -e "const sdk = require('./heady-hive-sdk'); console.log(sdk.version);"
```

## CLI

```bash
heady chat "Hello Brain!"         # Chat with HeadyBrain
heady analyze "function foo(){}"  # Analyze code
heady health                      # System health check
heady status                      # Auto-success engine (155 tasks)
heady battle "Added auth layer"   # Validate a change
heady creative "logo design"      # Generate creative content
heady search "MCP protocol"       # Search knowledge base
heady mcp                         # List all MCP tools
heady openai                      # OpenAI bridge health
heady gcloud                      # Google Cloud bridge health
```

## SDK Modules

### HeadyClient — Main Entry Point

```javascript
const heady = new HeadyClient({
  url: "https://headyme.com",  // or http://localhost:3301
  apiKey: "your-api-key",
  timeout: 30000               // 30 second timeout
});

await heady.health();      // System health check
await heady.autoSuccess(); // 155-task engine status
await heady.info();        // Full system info
```

### HeadyBrain — AI Reasoning

```javascript
// Chat (multi-model, best picked automatically)
const reply = await heady.brain.chat("Explain MCP protocol", {
  model: "heady-brain",
  temperature: 0.3,
  maxTokens: 2048
});

// Code analysis
const analysis = await heady.brain.analyze(codeString, { type: "security" });

// Vector embeddings
const vectors = await heady.brain.embed("search query text");

// Knowledge search
const results = await heady.brain.search("liquid architecture", { limit: 10 });

// Code refactoring
const suggestions = await heady.brain.refactor(code, { goals: ["performance"] });
```

### HeadyBattle — Competitive Validation

```javascript
// Validate a change (must score > 0.80)
const result = await heady.battle.validate("Added rate limiting", {
  mode: "standard",
  minScore: 0.80
});

// Arena Mode — solutions compete
const arena = await heady.battle.arena(
  ["solution-a.js", "solution-b.js"],
  { rounds: 3, metrics: ["quality", "performance", "safety"] }
);

// Monte Carlo simulation
const sim = await heady.battle.simulate("Deploy new auth", { iterations: 1000 });

// Leaderboard
const leaderboard = await heady.battle.leaderboard({ limit: 10 });
```

### HeadyCreative — Creative Engine

```javascript
// Generate content
const image = await heady.creative.generate("sacred geometry logo", {
  type: "text",
  outputType: "image"
});

// Remix multiple inputs
const remix = await heady.creative.remix(["image1.png", "image2.png"], {
  style: "blend"
});

// List available pipelines
const pipelines = await heady.creative.pipelines();

// Canvas operations
const canvas = await heady.creative.canvas("create", { width: 1920, height: 1080 });
```

### HeadyMCP — MCP Protocol Hub

```javascript
// List all 30+ MCP tools
const tools = await heady.mcp.listTools();

// Call any tool directly
const result = await heady.mcp.callTool("heady_analyze", { content: code });

// Deep scan (3D vector context)
const scan = await heady.mcp.deepScan("Map architecture patterns");

// Research via Perplexity
const research = await heady.mcp.research("MCP protocol best practices");

// Register upstream MCP server
heady.mcp.addUpstream("github", { url: "localhost:3002", transport: "stdio" });
```

### HeadyAuth — Multi-Method Authentication

```javascript
// Standard login
await heady.auth.login("admin", "password");

// Device authentication
await heady.auth.deviceAuth("device-uuid", { name: "my-laptop" });

// Cloudflare WARP (365-day tokens)
await heady.auth.warpAuth(warpToken);

// Google OAuth
const url = await heady.auth.googleAuthUrl("https://myapp.com/callback");
await heady.auth.googleCallback(authCode);

// Token management
await heady.auth.verify();
await heady.auth.refresh();
const sessions = await heady.auth.sessions();

// State
console.log(heady.auth.isAuthenticated); // true
console.log(heady.auth.tier);            // "admin"
```

### HeadyEvents — Real-Time SSE Streaming

```javascript
// Connect to event stream
heady.events.connect({ autoReconnect: true });

// Listen for specific events
heady.events.on("task:complete", (data) => console.log("Task done:", data));
heady.events.on("battle:result", (data) => console.log("Battle:", data));
heady.events.on("connected", () => console.log("SSE connected"));
heady.events.on("error", (err) => console.error("SSE error:", err));

// Disconnect
heady.events.disconnect();
```

### OpenAI Bridge

```javascript
const { OpenAIBridge } = require("heady-hive-sdk");
const openai = new OpenAIBridge({ apiKey: process.env.OPENAI_API_KEY });

// Create an assistant with file search
const assistant = await openai.createAssistant("Heady Helper",
  "You analyze the Heady codebase",
  { model: "gpt-4o" }
);

// File search / RAG
const results = await openai.fileSearch("How does auto-success work?");

// Embeddings ($0.02/1M tokens)
const embeddings = await openai.embed("search text", {
  model: "text-embedding-3-small"
});

// Batch API (50% cheaper)
const batch = await openai.batchSubmit({ fileId: "file-abc123" });
const status = await openai.batchStatus(batch.id);
```

### Google Cloud Bridge

```javascript
const { GCloudBridge } = require("heady-hive-sdk");
const gcloud = new GCloudBridge({ apiKey: process.env.GCLOUD_API_KEY });

// Vision AI (OCR, labels, objects)
const vision = await gcloud.vision(imageBase64, ["LABEL_DETECTION", "TEXT_DETECTION"]);
const ocr = await gcloud.ocr(imageBase64);

// NLP
const sentiment = await gcloud.sentiment("Heady is amazing!");
const entities = await gcloud.entities("HeadyMCP runs on port 3301");

// Translation (100+ languages)
const translated = await gcloud.translate("Hello world", "es");

// Text-to-Speech (Neural2 voices)
const audio = await gcloud.tts("Welcome to Heady", { voice: "en-US-Neural2-J" });

// BigQuery
const results = await gcloud.query("SELECT * FROM analytics.events LIMIT 10");

// Vertex AI predictions
const prediction = await gcloud.predict("endpoint-id", [{ input: "data" }]);
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | System health |
| POST | `/api/brain/chat` | Chat with Brain |
| POST | `/api/brain/analyze` | Analyze content |
| POST | `/api/brain/embed` | Generate embeddings |
| POST | `/api/battle/validate` | Validate changes |
| POST | `/api/battle/arena` | Arena competition |
| POST | `/api/creative/generate` | Creative generation |
| GET | `/api/auto-success/status` | 155-task engine |
| GET | `/api/conductor/health` | Orchestrator health |
| POST | `/api/auth/login` | Authentication |
| GET | `/api/mcp/tools` | List MCP tools |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `HEADY_URL` | Manager URL (default: `http://localhost:3301`) |
| `HEADY_API_KEY` | API key for authentication |
| `OPENAI_API_KEY` | OpenAI API key (for bridge) |
| `GCLOUD_API_KEY` | Google Cloud API key (for bridge) |
| `GCLOUD_PROJECT_ID` | Google Cloud project ID |

## Architecture

```
Your App
  └── HeadyClient (SDK)
        ├── HeadyBrain     → /api/brain/*
        ├── HeadyBattle    → /api/battle/*
        ├── HeadyCreative  → /api/creative/*
        ├── HeadyMCP       → /api/mcp/*
        ├── HeadyAuth      → /api/auth/*
        ├── HeadyEvents    → /api/events/stream (SSE)
        ├── OpenAIBridge   → api.openai.com
        └── GCloudBridge   → *.googleapis.com
```

## License

MIT © 2026 Heady Project
