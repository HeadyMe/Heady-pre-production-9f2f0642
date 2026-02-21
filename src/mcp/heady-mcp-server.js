#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  HEADY MCP SERVER — stdio transport for IDE integration            ║
 * ║  Exposes all Heady Services via Model Context Protocol v1.26.0     ║
 * ║  Routes 100% of AI requests through Heady Brain / headyio.com      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ── Configuration ────────────────────────────────────────────────────────────
const HEADY_MANAGER_URL = process.env.HEADY_MANAGER_URL || 'https://manager.headysystems.com';
const HEADY_API_KEY = process.env.HEADY_API_KEY || '';
const HEADY_BRAIN_URL = process.env.HEADY_BRAIN_URL || HEADY_MANAGER_URL; // Route brain calls through manager which has /api/brain/* handlers
const NODE_ENV = process.env.NODE_ENV || 'production';

const headers = {
  'Content-Type': 'application/json',
  ...(HEADY_API_KEY ? { 'Authorization': `Bearer ${HEADY_API_KEY}` } : {}),
  'X-Heady-Source': 'google-antigravity-mcp',
  'X-Heady-Version': '1.0.0',
};

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function headyPost(path, body) {
  const base = path.startsWith('/api/brain') ? HEADY_BRAIN_URL : HEADY_MANAGER_URL;
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Heady API ${res.status}: ${text}`);
  }
  return res.json();
}

async function headyGet(path) {
  const base = path.startsWith('/api/brain') ? HEADY_BRAIN_URL : HEADY_MANAGER_URL;
  const res = await fetch(`${base}${path}`, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Heady API ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── Server ────────────────────────────────────────────────────────────────────
const server = new Server(
  {
    name: 'heady-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// ── Tool definitions ──────────────────────────────────────────────────────────
const HEADY_TOOLS = [
  {
    name: 'heady_chat',
    description: 'Send a chat message to Heady Brain. Routes 100% through Heady AI services.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The user message or prompt' },
        system: { type: 'string', description: 'Optional system prompt' },
        model: { type: 'string', description: 'Model override (default: heady-brain)', default: 'heady-brain' },
        temperature: { type: 'number', description: 'Sampling temperature 0-2', default: 0.7 },
        max_tokens: { type: 'integer', description: 'Maximum tokens to generate', default: 4096 },
        context: { type: 'object', description: 'Additional context object' },
      },
      required: ['message'],
    },
  },
  {
    name: 'heady_complete',
    description: 'Generate a code or text completion via Heady Brain.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The completion prompt' },
        language: { type: 'string', description: 'Programming language for code completions' },
        max_tokens: { type: 'integer', default: 2048 },
        temperature: { type: 'number', default: 0.3 },
        stop: { type: 'array', items: { type: 'string' }, description: 'Stop sequences' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'heady_analyze',
    description: 'Analyze code, text, or data using Heady Brain intelligence.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Content to analyze' },
        type: {
          type: 'string',
          enum: ['code', 'text', 'security', 'performance', 'architecture', 'general'],
          default: 'general',
        },
        language: { type: 'string', description: 'Language for code analysis' },
        focus: { type: 'string', description: 'Specific aspect to focus on' },
      },
      required: ['content'],
    },
  },
  {
    name: 'heady_embed',
    description: 'Generate vector embeddings for text using Heady embedding service.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to embed' },
        model: { type: 'string', default: 'nomic-embed-text', description: 'Embedding model' },
      },
      required: ['text'],
    },
  },
  {
    name: 'heady_health',
    description: 'Check the health and status of all Heady services.',
    inputSchema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          enum: ['all', 'brain', 'manager', 'hcfp', 'mcp'],
          default: 'all',
          description: 'Which service to check',
        },
      },
    },
  },
  {
    name: 'heady_deploy',
    description: 'Trigger a deployment or service action via Heady Manager.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['deploy', 'restart', 'status', 'logs', 'scale'],
          description: 'Deployment action',
        },
        service: { type: 'string', description: 'Service name' },
        config: { type: 'object', description: 'Additional configuration' },
      },
      required: ['action'],
    },
  },
  {
    name: 'heady_search',
    description: 'Search Heady knowledge base, registry, and service catalog.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        scope: {
          type: 'string',
          enum: ['all', 'registry', 'docs', 'services', 'knowledge'],
          default: 'all',
        },
        limit: { type: 'integer', default: 10 },
      },
      required: ['query'],
    },
  },
  {
    name: 'heady_refactor',
    description: 'Request code refactoring suggestions from Heady Brain.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to refactor' },
        language: { type: 'string', description: 'Programming language' },
        goals: {
          type: 'array',
          items: { type: 'string' },
          description: 'Refactoring goals e.g. ["readability", "performance", "security"]',
        },
        context: { type: 'string', description: 'Additional context about the codebase' },
      },
      required: ['code'],
    },
  },
  {
    name: 'heady_jules_task',
    description: 'Dispatch an asynchronous background coding task to HeadyJules agent.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Description of the background task' },
        repository: { type: 'string', description: 'Target repository path' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'critical'], default: 'normal' },
        autoCommit: { type: 'boolean', description: 'Whether Jules should automatically commit changes', default: false }
      },
      required: ['task', 'repository']
    }
  },
  {
    name: 'heady_perplexity_research',
    description: 'Perform deep research or real-time web search using HeadyPerplexity (Sonar Pro).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Research query or topic' },
        mode: { type: 'string', enum: ['quick', 'deep', 'academic', 'news'], default: 'deep' },
        timeframe: { type: 'string', enum: ['day', 'week', 'month', 'year', 'all'], default: 'all' },
        maxSources: { type: 'integer', description: 'Maximum number of sources to cite', default: 10 }
      },
      required: ['query']
    }
  },
  {
    name: 'heady_huggingface_model',
    description: 'Search or interact with HuggingFace models via HeadyHuggingFace.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['search', 'info', 'inference'], description: 'Action to perform' },
        modelId: { type: 'string', description: 'HuggingFace model ID (e.g., meta-llama/Llama-3-8b)' },
        query: { type: 'string', description: 'Search query or inference input' },
        task: { type: 'string', description: 'Pipeline task (e.g., text-generation, image-classification)' }
      },
      required: ['action']
    }
  },
  {
    name: 'heady_soul',
    description: 'Interact with HeadySoul — intelligence, consciousness, and learning layer.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Content to analyze or optimize' },
        action: { type: 'string', enum: ['analyze', 'optimize', 'learn'], default: 'analyze', description: 'Soul action' },
      },
      required: ['content'],
    },
  },
  {
    name: 'heady_hcfp_status',
    description: 'Get HCFP (Heady Core Functionality Platform) auto-success engine status and metrics.',
    inputSchema: {
      type: 'object',
      properties: {
        detail: { type: 'string', enum: ['status', 'metrics', 'health'], default: 'status', description: 'Level of detail' },
      },
    },
  },
  {
    name: 'heady_orchestrator',
    description: 'Send messages and manage wavelength alignment via HeadyOrchestrator — trinity communication.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message to send through orchestrator' },
        action: { type: 'string', enum: ['send', 'status', 'align'], default: 'send', description: 'Orchestrator action' },
        target: { type: 'string', description: 'Target service or node' },
      },
      required: ['message'],
    },
  },
  {
    name: 'heady_battle',
    description: 'Run HeadyBattle — multi-branch orchestration and competitive code evaluation sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['session', 'evaluate', 'compare'], description: 'Battle action' },
        code: { type: 'string', description: 'Code to evaluate' },
        branches: { type: 'array', items: { type: 'string' }, description: 'Branch names to compare' },
        criteria: { type: 'string', description: 'Evaluation criteria' },
      },
      required: ['action'],
    },
  },
  {
    name: 'heady_patterns',
    description: 'Detect design patterns and perform deep code analysis via HeadyPatterns.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to analyze for patterns' },
        action: { type: 'string', enum: ['analyze', 'library', 'suggest'], default: 'analyze', description: 'Patterns action' },
        language: { type: 'string', description: 'Programming language' },
      },
      required: ['code'],
    },
  },
  {
    name: 'heady_risks',
    description: 'Assess risks, scan vulnerabilities, and generate mitigation plans via HeadyRisks.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Code or infrastructure to assess' },
        action: { type: 'string', enum: ['assess', 'mitigate', 'scan'], default: 'assess', description: 'Risk action' },
        scope: { type: 'string', enum: ['code', 'infrastructure', 'dependencies', 'all'], default: 'all' },
      },
      required: ['content'],
    },
  },
  {
    name: 'heady_coder',
    description: 'Generate code and orchestrate multi-assistant workflows via HeadyCoder.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Code generation prompt' },
        action: { type: 'string', enum: ['generate', 'orchestrate', 'scaffold'], default: 'generate' },
        language: { type: 'string', description: 'Target programming language' },
        framework: { type: 'string', description: 'Target framework (e.g., express, react, fastapi)' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'heady_claude',
    description: 'Advanced reasoning and deep analysis via HeadyClaude (Claude Opus 4.6 Thinking Fast 1M).',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message or prompt for Claude' },
        action: { type: 'string', enum: ['chat', 'think', 'analyze'], default: 'chat' },
        system: { type: 'string', description: 'Optional system prompt' },
        thinkingBudget: { type: 'integer', description: 'Thinking token budget', default: 32768 },
      },
      required: ['message'],
    },
  },
  {
    name: 'heady_openai',
    description: 'Chat and completions via HeadyOpenAI (GPT integration with function calling).',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message or prompt for OpenAI' },
        action: { type: 'string', enum: ['chat', 'complete'], default: 'chat' },
        model: { type: 'string', description: 'Model override', default: 'gpt-4o' },
      },
      required: ['message'],
    },
  },
  {
    name: 'heady_gemini',
    description: 'Multimodal AI generation and analysis via HeadyGemini.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Prompt for Gemini' },
        action: { type: 'string', enum: ['generate', 'analyze'], default: 'generate' },
        model: { type: 'string', description: 'Model override', default: 'gemini-3.1-pro-preview' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'heady_groq',
    description: 'Ultra-fast inference and chat via HeadyGroq.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message for Groq' },
        action: { type: 'string', enum: ['chat', 'complete'], default: 'chat' },
        stream: { type: 'boolean', description: 'Stream response', default: false },
      },
      required: ['message'],
    },
  },
  {
    name: 'heady_codex',
    description: 'Code generation and transformation via HeadyCodex (GPT-Codex).',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code input or prompt' },
        action: { type: 'string', enum: ['generate', 'transform', 'document'], default: 'generate' },
        language: { type: 'string', description: 'Programming language' },
      },
      required: ['code'],
    },
  },
  {
    name: 'heady_copilot',
    description: 'Inline code suggestions and context-aware completions via HeadyCopilot.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code context for suggestions' },
        action: { type: 'string', enum: ['suggest', 'complete'], default: 'suggest' },
        cursor_position: { type: 'integer', description: 'Cursor position in the code' },
        language: { type: 'string', description: 'Programming language' },
      },
      required: ['code'],
    },
  },
  {
    name: 'heady_ops',
    description: 'Deployment automation, infrastructure management, and DevOps via HeadyOps.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['deploy', 'infrastructure', 'monitor', 'scale'], description: 'Ops action' },
        service: { type: 'string', description: 'Target service' },
        config: { type: 'object', description: 'Deployment or infra configuration' },
      },
      required: ['action'],
    },
  },
  {
    name: 'heady_maid',
    description: 'System cleanup, scheduling, and housekeeping via HeadyMaid.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['clean', 'schedule', 'status'], default: 'status', description: 'Maid action' },
        target: { type: 'string', description: 'Target directory, service, or resource' },
        schedule: { type: 'string', description: 'Cron expression or schedule descriptor' },
      },
      required: ['action'],
    },
  },
  {
    name: 'heady_maintenance',
    description: 'Continuous health monitoring, updates, and backups via HeadyMaintenance.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'backup', 'update', 'restore'], default: 'status', description: 'Maintenance action' },
        service: { type: 'string', description: 'Target service for maintenance' },
      },
      required: ['action'],
    },
  },
  {
    name: 'heady_lens',
    description: 'Visual analysis, image processing, and GPU-accelerated vision via HeadyLens.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['analyze', 'process', 'detect'], default: 'analyze', description: 'Lens action' },
        image_url: { type: 'string', description: 'URL or path to image' },
        prompt: { type: 'string', description: 'Analysis prompt or description' },
      },
      required: ['action'],
    },
  },
  {
    name: 'heady_vinci',
    description: 'Advanced pattern recognition, continuous learning, and prediction via HeadyVinci.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['learn', 'predict', 'recognize'], default: 'predict', description: 'Vinci action' },
        data: { type: 'string', description: 'Data or content for learning/prediction' },
        context: { type: 'string', description: 'Additional context' },
      },
      required: ['data'],
    },
  },
  {
    name: 'heady_buddy',
    description: 'Chat with HeadyBuddy — your multi-provider personal AI assistant with persistent memory and skills.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message for HeadyBuddy' },
        action: { type: 'string', enum: ['chat', 'memory', 'skills', 'tasks', 'providers'], default: 'chat' },
        provider: { type: 'string', enum: ['gemini', 'claude', 'ollama', 'auto'], default: 'auto', description: 'AI provider' },
      },
      required: ['message'],
    },
  },
  {
    name: 'heady_notion',
    description: 'Sync Heady Knowledge Vault and notebooks to Notion. Manages 11 organized pages.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['sync', 'status', 'health'], default: 'sync', description: 'Notion action' },
      },
    },
  },
];

// ── List Tools ────────────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: HEADY_TOOLS,
}));

// ── Call Tool ─────────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'heady_chat': {
        const result = await headyPost('/api/brain/chat', {
          message: args.message,
          system: args.system,
          model: args.model || 'heady-brain',
          temperature: args.temperature ?? 0.7,
          max_tokens: args.max_tokens ?? 4096,
          context: args.context,
          source: 'google-antigravity',
        });
        return {
          content: [{ type: 'text', text: result.response || result.content || result.message || JSON.stringify(result) }],
        };
      }

      case 'heady_complete': {
        const result = await headyPost('/api/brain/generate', {
          prompt: args.prompt,
          language: args.language,
          max_tokens: args.max_tokens ?? 2048,
          temperature: args.temperature ?? 0.3,
          stop: args.stop,
          source: 'google-antigravity',
        });
        return {
          content: [{ type: 'text', text: result.completion || result.text || result.content || JSON.stringify(result) }],
        };
      }

      case 'heady_analyze': {
        const result = await headyPost('/api/brain/analyze', {
          content: args.content,
          type: args.type || 'general',
          language: args.language,
          focus: args.focus,
          source: 'google-antigravity',
        });
        return {
          content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
        };
      }

      case 'heady_embed': {
        const result = await headyPost('/api/brain/embed', {
          text: args.text,
          model: args.model || 'nomic-embed-text',
          source: 'google-antigravity',
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      }

      case 'heady_health': {
        const service = args?.service || 'all';
        let result;
        if (service === 'hcfp') {
          result = await headyGet('/api/hcfp/status');
        } else if (service === 'brain') {
          result = await headyGet('/api/brain/health');
        } else {
          result = await headyGet('/api/health');
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'heady_deploy': {
        const result = await headyPost('/api/deploy', {
          action: args.action,
          service: args.service,
          config: args.config,
          source: 'google-antigravity',
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'heady_search': {
        const result = await headyPost('/api/brain/search', {
          query: args.query,
          scope: args.scope || 'all',
          limit: args.limit || 10,
          source: 'google-antigravity',
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'heady_refactor': {
        const result = await headyPost('/api/brain/analyze', {
          content: args.code,
          type: 'code',
          language: args.language,
          focus: args.goals ? `Refactor for: ${args.goals.join(', ')}` : 'refactoring',
          context: args.context,
          task: 'refactor',
          source: 'google-antigravity',
        });
        return {
          content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
        };
      }

      case 'heady_jules_task': {
        const result = await headyPost('/api/jules/task', {
          task: args.task,
          repository: args.repository,
          priority: args.priority || 'normal',
          autoCommit: args.autoCommit || false,
          source: 'google-antigravity',
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'heady_perplexity_research': {
        const result = await headyPost('/api/perplexity/research', {
          query: args.query,
          mode: args.mode || 'deep',
          timeframe: args.timeframe || 'all',
          maxSources: args.maxSources || 10,
          source: 'google-antigravity',
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'heady_huggingface_model': {
        const result = await headyPost('/api/huggingface/model', {
          action: args.action,
          modelId: args.modelId,
          query: args.query,
          task: args.task,
          source: 'google-antigravity',
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'heady_soul': {
        const endpoint = args.action === 'optimize' ? '/api/soul/optimize' : '/api/soul/analyze';
        const result = await headyPost(endpoint, {
          content: args.content,
          action: args.action || 'analyze',
          source: 'google-antigravity',
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'heady_hcfp_status': {
        const detail = args?.detail || 'status';
        const endpoint = detail === 'metrics' ? '/api/hcfp/metrics' : '/api/hcfp/status';
        const result = await headyGet(endpoint);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'heady_orchestrator': {
        const endpoint = args.action === 'status' ? '/api/orchestrator/status' : '/api/orchestrator/send';
        const method = args.action === 'status' ? 'GET' : 'POST';
        const result = method === 'GET'
          ? await headyGet(endpoint)
          : await headyPost(endpoint, {
            message: args.message,
            target: args.target,
            action: args.action || 'send',
            source: 'google-antigravity',
          });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'heady_battle': {
        const endpoint = args.action === 'evaluate' ? '/api/battle/evaluate' : '/api/battle/session';
        const result = await headyPost(endpoint, {
          action: args.action,
          code: args.code,
          branches: args.branches,
          criteria: args.criteria,
          source: 'google-antigravity',
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'heady_patterns': {
        const endpoint = args.action === 'library' ? '/api/patterns/library' : '/api/patterns/analyze';
        const result = args.action === 'library'
          ? await headyGet(endpoint)
          : await headyPost(endpoint, {
            code: args.code,
            language: args.language,
            action: args.action || 'analyze',
            source: 'google-antigravity',
          });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'heady_risks': {
        const endpoint = args.action === 'mitigate' ? '/api/risks/mitigate' : '/api/risks/assess';
        const result = await headyPost(endpoint, {
          content: args.content,
          scope: args.scope || 'all',
          action: args.action || 'assess',
          source: 'google-antigravity',
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'heady_coder': {
        const endpoint = args.action === 'orchestrate' ? '/api/coder/orchestrate' : '/api/coder/generate';
        const result = await headyPost(endpoint, {
          prompt: args.prompt,
          language: args.language,
          framework: args.framework,
          action: args.action || 'generate',
          source: 'google-antigravity',
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'heady_claude': {
        const endpoint = args.action === 'think' ? '/api/claude/think' : '/api/claude/chat';
        const result = await headyPost(endpoint, {
          message: args.message,
          system: args.system,
          thinkingBudget: args.thinkingBudget || 32768,
          action: args.action || 'chat',
          source: 'google-antigravity',
        });
        return {
          content: [{ type: 'text', text: result.response || result.content || JSON.stringify(result, null, 2) }],
        };
      }

      case 'heady_openai': {
        const endpoint = args.action === 'complete' ? '/api/openai/complete' : '/api/openai/chat';
        const result = await headyPost(endpoint, {
          message: args.message,
          model: args.model || 'gpt-4o',
          action: args.action || 'chat',
          source: 'google-antigravity',
        });
        return {
          content: [{ type: 'text', text: result.response || result.content || JSON.stringify(result, null, 2) }],
        };
      }

      case 'heady_gemini': {
        const result = await headyPost('/api/gemini/generate', {
          prompt: args.prompt,
          model: args.model || 'gemini-3.1-pro-preview',
          action: args.action || 'generate',
          source: 'google-antigravity',
        });
        return {
          content: [{ type: 'text', text: result.response || result.content || JSON.stringify(result, null, 2) }],
        };
      }

      case 'heady_groq': {
        const result = await headyPost('/api/groq/chat', {
          message: args.message,
          stream: args.stream || false,
          action: args.action || 'chat',
          source: 'google-antigravity',
        });
        return {
          content: [{ type: 'text', text: result.response || result.content || JSON.stringify(result, null, 2) }],
        };
      }

      case 'heady_codex': {
        const endpoint = args.action === 'transform' ? '/api/codex/transform' : '/api/codex/generate';
        const result = await headyPost(endpoint, {
          code: args.code,
          language: args.language,
          action: args.action || 'generate',
          source: 'google-antigravity',
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'heady_copilot': {
        const endpoint = args.action === 'complete' ? '/api/copilot/complete' : '/api/copilot/suggest';
        const result = await headyPost(endpoint, {
          code: args.code,
          cursor_position: args.cursor_position,
          language: args.language,
          action: args.action || 'suggest',
          source: 'google-antigravity',
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'heady_ops': {
        const endpoint = args.action === 'infrastructure' ? '/api/ops/infrastructure' : '/api/ops/deploy';
        const result = await headyPost(endpoint, {
          action: args.action,
          service: args.service,
          config: args.config,
          source: 'google-antigravity',
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'heady_maid': {
        const endpointMap = { clean: '/api/maid/clean', schedule: '/api/maid/schedule', status: '/api/maid/clean' };
        const endpoint = endpointMap[args.action] || '/api/maid/clean';
        const result = args.action === 'status'
          ? await headyGet('/api/maid/clean')
          : await headyPost(endpoint, {
            action: args.action,
            target: args.target,
            schedule: args.schedule,
            source: 'google-antigravity',
          });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'heady_maintenance': {
        const endpointMap = { status: '/api/maintenance/status', backup: '/api/maintenance/backup', update: '/api/maintenance/status', restore: '/api/maintenance/backup' };
        const endpoint = endpointMap[args.action] || '/api/maintenance/status';
        const result = (args.action === 'status')
          ? await headyGet(endpoint)
          : await headyPost(endpoint, {
            action: args.action,
            service: args.service,
            source: 'google-antigravity',
          });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'heady_lens': {
        const result = await headyPost('/api/lens/analyze', {
          action: args.action || 'analyze',
          image_url: args.image_url,
          prompt: args.prompt,
          source: 'google-antigravity',
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'heady_vinci': {
        const endpointMap = { learn: '/api/vinci/learn', predict: '/api/vinci/predict', recognize: '/api/vinci/learn' };
        const endpoint = endpointMap[args.action] || '/api/vinci/predict';
        const result = await headyPost(endpoint, {
          data: args.data,
          context: args.context,
          action: args.action || 'predict',
          source: 'google-antigravity',
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'heady_buddy': {
        const endpointMap = { chat: '/api/buddy/chat', memory: '/api/buddy/memory', skills: '/api/buddy/skills', tasks: '/api/buddy/tasks', providers: '/api/buddy/providers' };
        const endpoint = endpointMap[args.action] || '/api/buddy/chat';
        const result = (args.action && args.action !== 'chat')
          ? await headyGet(endpoint)
          : await headyPost(endpoint, {
            message: args.message,
            provider: args.provider || 'auto',
            source: 'google-antigravity',
          });
        return {
          content: [{ type: 'text', text: result.response || result.content || JSON.stringify(result, null, 2) }],
        };
      }

      case 'heady_notion': {
        const endpointMap = { sync: '/api/notion/sync', status: '/api/notion/state', health: '/api/notion/health' };
        const endpoint = endpointMap[args.action] || '/api/notion/sync';
        const result = (args.action === 'sync')
          ? await headyPost(endpoint, { source: 'google-antigravity' })
          : await headyGet(endpoint);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown Heady tool: ${name}`);
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Heady MCP Error: ${err.message}` }],
      isError: true,
    };
  }
});

// ── Resources: Heady service catalog ─────────────────────────────────────────
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    { uri: 'heady://services/catalog', name: 'Heady Service Catalog', mimeType: 'application/json', description: 'All registered Heady services' },
    { uri: 'heady://services/health', name: 'Heady Health Status', mimeType: 'application/json', description: 'Live health of all services' },
    { uri: 'heady://hcfp/status', name: 'HCFP Auto-Success Status', mimeType: 'application/json', description: 'HCFP pipeline ORS and mode' },
    { uri: 'heady://domains/list', name: 'Heady Production Domains', mimeType: 'application/json', description: 'All 6 production domains' },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    switch (uri) {
      case 'heady://services/catalog':
        return {
          contents: [{
            uri, mimeType: 'application/json', text: JSON.stringify({
              services: [
                'heady-brain', 'heady-manager', 'heady-soul', 'heady-hcfp', 'heady-buddy',
                'heady-mcp-hub', 'heady-orchestrator', 'heady-battle', 'heady-patterns',
                'heady-risks', 'heady-coder', 'heady-claude', 'heady-openai', 'heady-gemini',
                'heady-gemini-gcp', 'heady-groq', 'heady-perplexity', 'heady-codex',
                'heady-copilot', 'heady-jules', 'heady-ops', 'heady-maid', 'heady-maintenance',
                'heady-web', 'heady-lens', 'heady-vinci', 'heady-python', 'heady-ollama',
                'heady-vector-db', 'heady-ai-gateway', 'heady-registry',
              ],
              totalServices: 30,
              endpoints: { manager: HEADY_MANAGER_URL, brain: HEADY_BRAIN_URL },
              version: '2.0.0',
            }, null, 2)
          }]
        };

      case 'heady://services/health': {
        const health = await headyGet('/api/health').catch(e => ({ error: e.message }));
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(health, null, 2) }] };
      }

      case 'heady://hcfp/status': {
        const status = await headyGet('/api/hcfp/status').catch(e => ({ error: e.message }));
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(status, null, 2) }] };
      }

      case 'heady://domains/list':
        return {
          contents: [{
            uri, mimeType: 'application/json', text: JSON.stringify({
              domains: [
                { name: 'headybuddy', domain: 'headybuddy.org', port: 9000 },
                { name: 'headysystems', domain: 'headysystems.com', port: 9001 },
                { name: 'headyconnection', domain: 'headyconnection.org', port: 9002 },
                { name: 'headymcp', domain: 'headymcp.com', port: 9003 },
                { name: 'headyio', domain: 'headyio.com', port: 9004 },
                { name: 'headyme', domain: 'headyme.com', port: 9005 },
              ],
            }, null, 2)
          }]
        };

      default:
        throw new Error(`Unknown Heady resource: ${uri}`);
    }
  } catch (err) {
    throw new Error(`Failed to read ${uri}: ${err.message}`);
  }
});

// ── Prompts ───────────────────────────────────────────────────────────────────
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    { name: 'heady_code_review', description: 'Review code using Heady Brain — security, performance, best practices' },
    { name: 'heady_architect', description: 'Get architectural guidance from Heady for system design' },
    { name: 'heady_debug', description: 'Debug an issue with Heady Brain full context analysis' },
    { name: 'heady_write_tests', description: 'Generate comprehensive tests via Heady Brain' },
    { name: 'heady_explain', description: 'Explain complex code or concepts via Heady Brain' },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const prompts = {
    heady_code_review: {
      description: 'Heady Brain code review',
      messages: [{
        role: 'user', content: {
          type: 'text', text:
            `Please review this code using Heady Brain:\n\n\`\`\`${args?.language || ''}\n${args?.code || '[paste code here]'}\n\`\`\`\n\nFocus on: security, performance, readability, and best practices.`
        }
      }],
    },
    heady_architect: {
      description: 'Heady architectural guidance',
      messages: [{
        role: 'user', content: {
          type: 'text', text:
            `As Heady Brain, provide architectural guidance for: ${args?.description || '[describe your system]'}\n\nConsider: scalability, maintainability, Heady ecosystem integration.`
        }
      }],
    },
    heady_debug: {
      description: 'Heady debug analysis',
      messages: [{
        role: 'user', content: {
          type: 'text', text:
            `Debug this issue using Heady Brain:\n\nError: ${args?.error || '[paste error]'}\n\nCode:\n\`\`\`\n${args?.code || '[paste code]'}\n\`\`\``
        }
      }],
    },
    heady_write_tests: {
      description: 'Heady test generation',
      messages: [{
        role: 'user', content: {
          type: 'text', text:
            `Generate comprehensive tests for this code using Heady Brain:\n\n\`\`\`${args?.language || ''}\n${args?.code || '[paste code]'}\n\`\`\``
        }
      }],
    },
    heady_explain: {
      description: 'Heady explanation',
      messages: [{
        role: 'user', content: {
          type: 'text', text:
            `Explain this clearly using Heady Brain:\n\n${args?.content || '[paste code or concept]'}`
        }
      }],
    },
  };

  const prompt = prompts[name];
  if (!prompt) throw new Error(`Unknown Heady prompt: ${name}`);
  return prompt;
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[Heady MCP] Server started — routing 100% through Heady Services\n');
}

main().catch((err) => {
  process.stderr.write(`[Heady MCP] Fatal: ${err.message}\n`);
  process.exit(1);
});
