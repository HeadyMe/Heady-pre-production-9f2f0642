'use strict';

/**
 * HeadyInfer — Configuration
 * Centralizes all env-var driven configuration for the inference gateway.
 */

const PHI = 1.618033988749895;

const config = {
  // ─── Server ──────────────────────────────────────────────────────────────
  port: parseInt(process.env.HEADY_INFER_PORT || '3102', 10),
  env:  process.env.NODE_ENV || 'development',
  serviceName: 'heady-infer',
  version: '1.0.0',

  // ─── Provider API Keys ────────────────────────────────────────────────────
  providers: {
    anthropic: {
      apiKey:    process.env.ANTHROPIC_API_KEY || '',
      baseUrl:   process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
      enabled:   !!process.env.ANTHROPIC_API_KEY,
      timeout:   parseInt(process.env.ANTHROPIC_TIMEOUT || '30000', 10),
      models: {
        default:  'claude-3-5-sonnet-20241022',
        fast:     'claude-3-haiku-20240307',
        powerful: 'claude-3-opus-20240229',
        sonnet:   'claude-3-5-sonnet-20241022',
        haiku:    'claude-3-haiku-20240307',
        opus:     'claude-3-opus-20240229',
      },
      // USD per 1M tokens
      pricing: {
        'claude-3-5-sonnet-20241022': { input: 3.00,  output: 15.00 },
        'claude-3-opus-20240229':     { input: 15.00, output: 75.00 },
        'claude-3-haiku-20240307':    { input: 0.25,  output: 1.25  },
      },
    },

    openai: {
      apiKey:    process.env.OPENAI_API_KEY || '',
      baseUrl:   process.env.OPENAI_BASE_URL || 'https://api.openai.com',
      orgId:     process.env.OPENAI_ORG_ID || '',
      enabled:   !!process.env.OPENAI_API_KEY,
      timeout:   parseInt(process.env.OPENAI_TIMEOUT || '30000', 10),
      models: {
        default:  'gpt-4o',
        fast:     'gpt-4o-mini',
        powerful: 'o1',
        gpt4o:    'gpt-4o',
        mini:     'gpt-4o-mini',
        o1:       'o1',
      },
      pricing: {
        'gpt-4o':      { input: 2.50,  output: 10.00 },
        'gpt-4o-mini': { input: 0.15,  output: 0.60  },
        'o1':          { input: 15.00, output: 60.00 },
      },
    },

    google: {
      apiKey:    process.env.GOOGLE_AI_API_KEY || '',
      baseUrl:   process.env.GOOGLE_AI_BASE_URL || 'https://generativelanguage.googleapis.com',
      enabled:   !!process.env.GOOGLE_AI_API_KEY,
      timeout:   parseInt(process.env.GOOGLE_TIMEOUT || '30000', 10),
      models: {
        default: 'gemini-2.0-flash',
        fast:    'gemini-2.0-flash',
        pro:     'gemini-1.5-pro',
      },
      pricing: {
        'gemini-2.0-flash': { input: 0.075, output: 0.30  },
        'gemini-1.5-pro':   { input: 1.25,  output: 5.00  },
      },
    },

    groq: {
      apiKey:    process.env.GROQ_API_KEY || '',
      baseUrl:   process.env.GROQ_BASE_URL || 'https://api.groq.com/openai',
      enabled:   !!process.env.GROQ_API_KEY,
      timeout:   parseInt(process.env.GROQ_TIMEOUT || '15000', 10),
      models: {
        default:  'llama-3.1-70b-versatile',
        fast:     'llama-3.1-8b-instant',
        powerful: 'llama-3.1-70b-versatile',
        mixtral:  'mixtral-8x7b-32768',
      },
      pricing: {
        'llama-3.1-70b-versatile': { input: 0.59,  output: 0.79  },
        'llama-3.1-8b-instant':    { input: 0.05,  output: 0.08  },
        'mixtral-8x7b-32768':      { input: 0.24,  output: 0.24  },
      },
    },

    local: {
      baseUrl:  process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      enabled:  process.env.OLLAMA_ENABLED === 'true',
      timeout:  parseInt(process.env.OLLAMA_TIMEOUT || '60000', 10),
      models: {
        default: process.env.OLLAMA_DEFAULT_MODEL || 'llama3.1',
      },
      pricing: {
        // Local models cost nothing
        default: { input: 0, output: 0 },
      },
    },
  },

  // ─── Circuit Breaker ─────────────────────────────────────────────────────
  circuitBreaker: {
    failureThreshold:  parseInt(process.env.CB_FAILURE_THRESHOLD || '5', 10),
    successThreshold:  parseInt(process.env.CB_SUCCESS_THRESHOLD || '2', 10),
    timeout:           parseInt(process.env.CB_TIMEOUT || '60000', 10),     // ms before HALF_OPEN
    halfOpenProbeMax:  parseInt(process.env.CB_HALF_OPEN_PROBES || '3', 10),
    phiBackoffBase:    parseInt(process.env.CB_PHI_BACKOFF_BASE || '5000', 10),
    phiBackoffMax:     parseInt(process.env.CB_PHI_BACKOFF_MAX || '300000', 10),
  },

  // ─── Response Cache ───────────────────────────────────────────────────────
  cache: {
    enabled:      process.env.CACHE_ENABLED !== 'false',
    maxSize:      parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),        // entries
    defaultTTL:   parseInt(process.env.CACHE_DEFAULT_TTL || '3600000', 10), // 1 hour ms
    bypassAboveTemp: parseFloat(process.env.CACHE_BYPASS_TEMP || '0'),      // skip cache if temp > 0
    ttlByModel: {
      'claude-3-haiku-20240307':    1800000,  // 30 min
      'gpt-4o-mini':                1800000,
      'llama-3.1-8b-instant':       3600000,  // 1 hr
      'gemini-2.0-flash':           3600000,
    },
  },

  // ─── Cost / Budget ────────────────────────────────────────────────────────
  budget: {
    dailyCap:       parseFloat(process.env.BUDGET_DAILY_CAP   || '50'),    // USD
    monthlyCap:     parseFloat(process.env.BUDGET_MONTHLY_CAP || '500'),   // USD
    alertThresholds: [0.5, 0.75, 0.9, 1.0],
    autoDowngrade:  process.env.BUDGET_AUTO_DOWNGRADE !== 'false',
    perProvider: {
      anthropic: parseFloat(process.env.BUDGET_ANTHROPIC || '20'),
      openai:    parseFloat(process.env.BUDGET_OPENAI    || '20'),
      google:    parseFloat(process.env.BUDGET_GOOGLE    || '10'),
      groq:      parseFloat(process.env.BUDGET_GROQ      || '5'),
      local:     Infinity,
    },
  },

  // ─── Racing ───────────────────────────────────────────────────────────────
  racing: {
    enabled:          process.env.RACING_ENABLED !== 'false',
    maxConcurrent:    parseInt(process.env.RACING_MAX_CONCURRENT || '3', 10),
    timeout:          parseInt(process.env.RACING_TIMEOUT || '10000', 10),
    minWinRate:       parseFloat(process.env.RACING_MIN_WIN_RATE || '0.1'),
    weightDecay:      parseFloat(process.env.RACING_WEIGHT_DECAY || '0.95'),
  },

  // ─── Request deduplication ────────────────────────────────────────────────
  dedup: {
    enabled:    process.env.DEDUP_ENABLED !== 'false',
    windowMs:   parseInt(process.env.DEDUP_WINDOW_MS || '5000', 10),
  },

  // ─── Timeouts ─────────────────────────────────────────────────────────────
  timeouts: {
    default:   parseInt(process.env.DEFAULT_TIMEOUT || '30000', 10),
    stream:    parseInt(process.env.STREAM_TIMEOUT  || '120000', 10),
    health:    parseInt(process.env.HEALTH_TIMEOUT  || '5000', 10),
  },

  // ─── Logging ──────────────────────────────────────────────────────────────
  logging: {
    level:        process.env.LOG_LEVEL || 'info',
    auditEnabled: process.env.AUDIT_LOG_ENABLED !== 'false',
    prettyPrint:  process.env.NODE_ENV !== 'production',
  },

  // ─── Sacred Geometry ──────────────────────────────────────────────────────
  phi: PHI,

  // ─── Default routing matrix (overridden by router.js) ─────────────────────
  defaultRouting: {
    code_generation:  ['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o',           'groq/llama-3.1-70b-versatile'],
    code_review:      ['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o',           'google/gemini-1.5-pro'],
    architecture:     ['anthropic/claude-3-opus-20240229',     'openai/o1',               'anthropic/claude-3-5-sonnet-20241022'],
    research:         ['google/gemini-1.5-pro',                'anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o'],
    quick_task:       ['groq/llama-3.1-8b-instant',            'openai/gpt-4o-mini',      'google/gemini-2.0-flash'],
    creative:         ['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o',           'google/gemini-1.5-pro'],
    security_audit:   ['anthropic/claude-3-opus-20240229',     'openai/o1',               'anthropic/claude-3-5-sonnet-20241022'],
    documentation:    ['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o',           'groq/llama-3.1-70b-versatile'],
    general:          ['openai/gpt-4o',                        'anthropic/claude-3-5-sonnet-20241022', 'google/gemini-2.0-flash'],
  },
};

// Validate critical configuration
function validate(cfg) {
  const warnings = [];
  const enabledProviders = Object.entries(cfg.providers)
    .filter(([, p]) => p.enabled)
    .map(([k]) => k);

  if (enabledProviders.length === 0) {
    warnings.push('No providers are enabled. Set at least one API key.');
  }

  if (cfg.budget.dailyCap <= 0) {
    warnings.push('BUDGET_DAILY_CAP must be > 0');
  }

  return warnings;
}

config.validate = validate;
config.validationWarnings = validate(config);

module.exports = config;
