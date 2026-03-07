/**
 * @file env-schema.js
 * @description Environment variable schema with validation, defaults, and secret masking.
 *
 * Defines all required and optional env vars.
 * Validates types, required-ness, and formats.
 * Masks secrets in logs (last 4 chars visible).
 *
 * Zero external dependencies — pure Node.js.
 *
 * @module HeadyConfig/EnvSchema
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export const EnvType = Object.freeze({
  STRING:  'string',
  NUMBER:  'number',
  BOOLEAN: 'boolean',
  URL:     'url',
  JSON:    'json',
  SECRET:  'secret',    // masked in logs
});

// ─── Secret patterns (any var name matching these is auto-masked) ─────────────
const SECRET_PATTERNS = [
  /key/i, /secret/i, /token/i, /password/i, /passwd/i,
  /credential/i, /auth/i, /private/i, /cert/i, /api_/i,
];

function isSecretVar(name) {
  return SECRET_PATTERNS.some(p => p.test(name));
}

function maskValue(value) {
  if (!value || value.length < 8) return '****';
  return '*'.repeat(value.length - 4) + value.slice(-4);
}

// ─── Schema Definition ────────────────────────────────────────────────────────
/**
 * Each entry: { type, required, default, description, validate }
 */
export const ENV_SCHEMA = Object.freeze({
  // Node identity
  HEADY_NODE_ROLE: {
    type:        EnvType.STRING,
    required:    false,
    default:     'BRAIN',
    description: 'Role of this node: BRAIN | CONDUCTOR | SENTINEL',
    validate:    v => ['BRAIN', 'CONDUCTOR', 'SENTINEL'].includes(v),
  },
  HEADY_NODE_ID: {
    type:        EnvType.STRING,
    required:    false,
    default:     'node-0',
    description: 'Unique node ID in the cluster',
  },
  NODE_ENV: {
    type:        EnvType.STRING,
    required:    false,
    default:     'development',
    description: 'Node environment (production | development | test)',
    validate:    v => ['production', 'development', 'test'].includes(v),
  },
  LOG_LEVEL: {
    type:        EnvType.STRING,
    required:    false,
    default:     'INFO',
    description: 'Log level: TRACE | DEBUG | INFO | WARN | ERROR | FATAL',
    validate:    v => ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'].includes(v),
  },

  // LLM Provider API Keys
  ANTHROPIC_API_KEY: {
    type:        EnvType.SECRET,
    required:    false,
    default:     '',
    description: 'Anthropic Claude API key',
  },
  OPENAI_API_KEY: {
    type:        EnvType.SECRET,
    required:    false,
    default:     '',
    description: 'OpenAI API key',
  },
  GOOGLE_API_KEY: {
    type:        EnvType.SECRET,
    required:    false,
    default:     '',
    description: 'Google Gemini API key',
  },
  GROQ_API_KEY: {
    type:        EnvType.SECRET,
    required:    false,
    default:     '',
    description: 'Groq API key',
  },
  PERPLEXITY_API_KEY: {
    type:        EnvType.SECRET,
    required:    false,
    default:     '',
    description: 'Perplexity Sonar API key',
  },
  OLLAMA_BASE_URL: {
    type:        EnvType.URL,
    required:    false,
    default:     'http://localhost:11434',
    description: 'Ollama server base URL',
  },

  // GitHub
  GITHUB_APP_ID: {
    type:        EnvType.STRING,
    required:    false,
    default:     '',
    description: 'GitHub App ID for deployment',
  },
  GITHUB_PRIVATE_KEY: {
    type:        EnvType.SECRET,
    required:    false,
    default:     '',
    description: 'GitHub App private key (PEM)',
  },
  GITHUB_INSTALLATION_ID: {
    type:        EnvType.STRING,
    required:    false,
    default:     '',
    description: 'GitHub App installation ID',
  },
  GITHUB_TOKEN: {
    type:        EnvType.SECRET,
    required:    false,
    default:     '',
    description: 'GitHub personal access token (fallback)',
  },

  // Cluster mesh
  NODE_0_URL: {
    type:        EnvType.URL,
    required:    false,
    default:     'http://localhost:3000',
    description: 'BRAIN node mesh URL',
  },
  NODE_1_URL: {
    type:        EnvType.URL,
    required:    false,
    default:     'http://localhost:3001',
    description: 'CONDUCTOR node mesh URL',
  },
  NODE_2_URL: {
    type:        EnvType.URL,
    required:    false,
    default:     'http://localhost:3002',
    description: 'SENTINEL node mesh URL',
  },
  MESH_AUTH_TOKEN: {
    type:        EnvType.SECRET,
    required:    false,
    default:     '',
    description: 'Shared secret for inter-node mesh authentication',
  },

  // Telemetry
  TELEMETRY_DIR: {
    type:        EnvType.STRING,
    required:    false,
    default:     '/tmp/heady-telemetry',
    description: 'Directory for NDJSON telemetry export',
  },
  TELEMETRY_SAMPLE_RATE: {
    type:        EnvType.NUMBER,
    required:    false,
    default:     '1.0',
    description: 'Global telemetry sample rate 0.0–1.0',
    validate:    v => v >= 0 && v <= 1,
  },

  // Budget
  DAILY_BUDGET_USD: {
    type:        EnvType.NUMBER,
    required:    false,
    default:     '33',
    description: 'Total daily LLM spend cap in USD',
    validate:    v => v > 0,
  },

  // Deployment
  DEPLOY_REPO: {
    type:        EnvType.STRING,
    required:    false,
    default:     '',
    description: 'GitHub repository for deployments (owner/repo)',
  },
  DEPLOY_BRANCH: {
    type:        EnvType.STRING,
    required:    false,
    default:     'main',
    description: 'Default deployment branch',
  },
  DEPLOY_STRATEGY: {
    type:        EnvType.STRING,
    required:    false,
    default:     'blue-green',
    description: 'Deployment strategy: blue-green | canary | direct',
    validate:    v => ['blue-green', 'canary', 'direct'].includes(v),
  },

  // Colab
  COLAB_JUPYTER_TOKEN: {
    type:        EnvType.SECRET,
    required:    false,
    default:     '',
    description: 'Colab Jupyter token (injected by Colab environment)',
  },
  NGROK_AUTH_TOKEN: {
    type:        EnvType.SECRET,
    required:    false,
    default:     '',
    description: 'ngrok auth token for inter-node tunneling',
  },
  GPU_MEMORY_FRACTION: {
    type:        EnvType.NUMBER,
    required:    false,
    default:     '0.9',
    description: 'GPU memory fraction to allocate (0–1)',
    validate:    v => v > 0 && v <= 1,
  },
});

// ─── Validator ────────────────────────────────────────────────────────────────
export class EnvValidator {
  /**
   * @param {object} schema  ENV_SCHEMA (or subset)
   * @param {object} source  process.env or override map
   */
  constructor(schema = ENV_SCHEMA, source = process.env) {
    this._schema = schema;
    this._source = source;
    this._errors  = [];
    this._warnings = [];
    this._resolved = {};
  }

  validate() {
    this._errors   = [];
    this._warnings = [];
    this._resolved = {};

    for (const [name, def] of Object.entries(this._schema)) {
      const raw = this._source[name];

      // Missing required
      if (def.required && (raw === undefined || raw === '')) {
        this._errors.push(`[ENV] Required variable ${name} is not set.`);
        continue;
      }

      // Use default if not set
      const value = (raw !== undefined && raw !== '') ? raw : def.default;

      if (value === undefined || value === '') {
        this._resolved[name] = value ?? '';
        continue;
      }

      // Type coercion + validation
      let coerced;
      try {
        coerced = this._coerce(name, value, def.type);
      } catch (e) {
        this._errors.push(`[ENV] ${name}: ${e.message}`);
        continue;
      }

      // Custom validator
      if (def.validate && !def.validate(coerced)) {
        this._warnings.push(`[ENV] ${name}="${value}" failed custom validator.`);
      }

      this._resolved[name] = coerced;
    }

    return {
      valid:    this._errors.length === 0,
      errors:   [...this._errors],
      warnings: [...this._warnings],
      env:      this.safe(),
    };
  }

  _coerce(name, value, type) {
    switch (type) {
      case EnvType.NUMBER: {
        const n = Number(value);
        if (Number.isNaN(n)) throw new Error(`expected number, got "${value}"`);
        return n;
      }
      case EnvType.BOOLEAN: {
        if (['true', '1', 'yes'].includes(String(value).toLowerCase())) return true;
        if (['false', '0', 'no'].includes(String(value).toLowerCase())) return false;
        throw new Error(`expected boolean, got "${value}"`);
      }
      case EnvType.URL: {
        try { new URL(value); } catch { throw new Error(`expected valid URL, got "${value}"`); }
        return value;
      }
      case EnvType.JSON: {
        try { return JSON.parse(value); } catch { throw new Error(`expected JSON, got "${value}"`); }
      }
      default:
        return String(value);
    }
  }

  /** Return env map with secrets masked */
  safe() {
    const out = {};
    for (const [name, value] of Object.entries(this._resolved)) {
      const def = this._schema[name];
      const secret = def?.type === EnvType.SECRET || isSecretVar(name);
      out[name] = secret && value ? maskValue(String(value)) : value;
    }
    return out;
  }

  /** Return resolved env (unmasked — internal use only) */
  resolved() {
    return { ...this._resolved };
  }

  get errors()   { return [...this._errors]; }
  get warnings() { return [...this._warnings]; }
  get isValid()  { return this._errors.length === 0; }
}

// ─── Singleton helper ─────────────────────────────────────────────────────────
let _validated = null;

/**
 * Validate process.env against schema.
 * Cached after first call.
 * @param {boolean} [force=false]  Re-validate
 */
export function validateEnv(force = false) {
  if (_validated && !force) return _validated;
  const validator = new EnvValidator();
  _validated = validator.validate();
  if (!_validated.valid) {
    // Log errors but don't throw — allow graceful degradation
    for (const e of _validated.errors) process.stderr.write(e + '\n');
  }
  return _validated;
}

/**
 * Get a single env var value (with default from schema).
 * @param {string} name
 * @returns {*}
 */
export function getEnv(name) {
  const schema = ENV_SCHEMA[name];
  const raw    = process.env[name];
  if (raw !== undefined && raw !== '') return raw;
  return schema?.default ?? undefined;
}

export default { ENV_SCHEMA, EnvValidator, EnvType, validateEnv, getEnv };
