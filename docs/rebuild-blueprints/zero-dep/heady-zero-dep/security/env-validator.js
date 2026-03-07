/**
 * @file env-validator.js
 * @description Schema-based environment variable validation and loading.
 *
 * Features:
 * - Schema-based validation (required/optional/default)
 * - Type coercion (string → number, boolean, array, json)
 * - Secret masking in logs and error output
 * - Fail-fast on missing required variables
 * - Namespace grouping (e.g., all HEADY_* vars)
 * - Validation report with masked values
 *
 * Zero external dependencies.
 *
 * @module HeadySecurity/EnvValidator
 */

// ─── Type Coercers ────────────────────────────────────────────────────────────
const COERCERS = {
  string:  v => String(v),
  number:  v => {
    const n = Number(v);
    if (isNaN(n)) throw new Error(`not a valid number: "${v}"`);
    return n;
  },
  integer: v => {
    const n = parseInt(v, 10);
    if (isNaN(n)) throw new Error(`not a valid integer: "${v}"`);
    return n;
  },
  boolean: v => {
    const lower = String(v).toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(lower))  return true;
    if (['false', '0', 'no', 'off'].includes(lower)) return false;
    throw new Error(`not a valid boolean: "${v}"`);
  },
  json: v => {
    try { return JSON.parse(v); }
    catch { throw new Error(`not valid JSON: "${v}"`); }
  },
  array: v => v.split(',').map(s => s.trim()).filter(Boolean),
  url: v => {
    try { new URL(v); return v; }
    catch { throw new Error(`not a valid URL: "${v}"`); }
  },
  port: v => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n < 1 || n > 65535) throw new Error(`not a valid port: "${v}"`);
    return n;
  },
};

// ─── Secret Masker ────────────────────────────────────────────────────────────

/**
 * Mask a value for logging: reveal first 4 chars + "***"
 */
function maskSecret(value) {
  const str = String(value ?? '');
  if (str.length <= 4) return '***';
  return str.slice(0, 4) + '***';
}

// ─── EnvValidator ────────────────────────────────────────────────────────────

/**
 * Schema entry definition:
 * @typedef {object} EnvSchema
 * @property {string}  [type]       Type coercion: string|number|integer|boolean|json|array|url|port
 * @property {boolean} [required]   Must be present
 * @property {any}     [default]    Default value if not set
 * @property {boolean} [secret]     Mask in logs
 * @property {string}  [description]
 * @property {Function} [validate]  Custom validator: (value) => bool | string (error msg)
 * @property {any[]}   [enum]       Allowed values
 * @property {number}  [min]        Min numeric value
 * @property {number}  [max]        Max numeric value
 */

export class EnvValidator {
  /**
   * @param {Record<string, EnvSchema>} schema
   * @param {object} [opts]
   * @param {boolean} [opts.strict]      Throw on first error (default: collect all)
   * @param {object}  [opts.source]      Custom env source (default: process.env)
   */
  constructor(schema = {}, opts = {}) {
    this._schema = schema;
    this._opts   = {
      strict: opts.strict ?? false,
      source: opts.source ?? process.env,
    };
    this._result = null;
  }

  /**
   * Validate and load all env vars per schema.
   *
   * @returns {{ env: object, errors: string[], warnings: string[], report: object }}
   */
  validate() {
    const env      = {};
    const errors   = [];
    const warnings = [];
    const report   = {};

    for (const [key, schema] of Object.entries(this._schema)) {
      const raw      = this._opts.source[key];
      const hasValue = raw !== undefined && raw !== '';

      let value;
      let masked;

      if (!hasValue) {
        if (schema.required) {
          errors.push(`Missing required env var: ${key}`);
          report[key] = { status: 'missing', required: true };
          if (this._opts.strict) break;
          continue;
        }
        if (schema.default !== undefined) {
          value  = schema.default;
          masked = schema.secret ? maskSecret(value) : String(value);
          report[key] = { status: 'default', value: masked };
        } else {
          report[key] = { status: 'optional-absent' };
          continue;
        }
      } else {
        // Coerce type
        const type    = schema.type ?? 'string';
        const coercer = COERCERS[type];
        if (!coercer) {
          warnings.push(`Unknown type "${type}" for ${key}, treating as string`);
          value = raw;
        } else {
          try {
            value = coercer(raw);
          } catch (err) {
            errors.push(`Invalid value for ${key}: ${err.message}`);
            report[key] = { status: 'invalid', error: err.message };
            if (this._opts.strict) break;
            continue;
          }
        }

        // Enum check
        if (schema.enum && !schema.enum.includes(value)) {
          errors.push(`${key} must be one of [${schema.enum.join(', ')}], got: ${schema.secret ? maskSecret(value) : value}`);
          report[key] = { status: 'enum-mismatch' };
          if (this._opts.strict) break;
          continue;
        }

        // Range check
        if (schema.min !== undefined && value < schema.min) {
          errors.push(`${key} must be >= ${schema.min}`);
        }
        if (schema.max !== undefined && value > schema.max) {
          errors.push(`${key} must be <= ${schema.max}`);
        }

        // Custom validator
        if (schema.validate) {
          const vResult = schema.validate(value);
          if (vResult !== true && vResult !== undefined && vResult !== null) {
            const msg = typeof vResult === 'string' ? vResult : `failed custom validation`;
            errors.push(`${key}: ${msg}`);
            report[key] = { status: 'validation-failed', error: msg };
            if (this._opts.strict) break;
            continue;
          }
        }

        masked = schema.secret ? maskSecret(value) : String(value);
        report[key] = { status: 'ok', value: masked, type: schema.type ?? 'string' };
      }

      env[key] = value;
    }

    this._result = { env, errors, warnings, report };
    return this._result;
  }

  /**
   * Validate and throw if any errors.
   * @returns {object} env — clean validated env object
   */
  validateOrThrow() {
    const { env, errors, warnings, report } = this.validate();
    if (errors.length > 0) {
      const err     = new Error(`Environment validation failed:\n${errors.map(e => `  • ${e}`).join('\n')}`);
      err.code      = 'ENV_INVALID';
      err.errors    = errors;
      err.warnings  = warnings;
      err.report    = report;
      throw err;
    }
    return env;
  }

  /**
   * Return a masked version of the env for safe logging.
   */
  safeDump() {
    if (!this._result) this.validate();
    return this._result.report;
  }
}

// ─── Pre-built Heady Schema ───────────────────────────────────────────────────

export const HEADY_SCHEMA = {
  // Node identity
  HEADY_NODE_ID: {
    type: 'string',
    enum: ['brain', 'conductor', 'sentinel'],
    description: 'This Colab node identity',
    default: 'brain',
  },
  HEADY_CLUSTER_SECRET: {
    type: 'string',
    required: false,
    secret: true,
    description: 'Shared cluster secret for inter-node auth',
  },

  // LLM Providers
  OPENAI_API_KEY: {
    type: 'string', required: false, secret: true,
    description: 'OpenAI API key',
  },
  ANTHROPIC_API_KEY: {
    type: 'string', required: false, secret: true,
    description: 'Anthropic Claude API key',
  },
  GOOGLE_API_KEY: {
    type: 'string', required: false, secret: true,
    description: 'Google Gemini API key',
  },

  // Network
  HEADY_HTTP_PORT: {
    type: 'port', default: 3000,
    description: 'HTTP server port',
  },
  HEADY_WS_PORT: {
    type: 'port', default: 3001,
    description: 'WebSocket mesh port',
  },

  // Storage
  HEADY_DATA_DIR: {
    type: 'string', default: '/tmp/heady-data',
    description: 'Data persistence directory',
  },

  // Governance
  HEADY_GOVERNANCE_MODE: {
    type: 'string',
    enum: ['auto', 'manual', 'strict'],
    default: 'auto',
    description: 'Approval gate mode',
  },

  // Feature flags
  HEADY_DEBUG: {
    type: 'boolean', default: false,
    description: 'Enable debug logging',
  },
  HEADY_METRICS_ENABLED: {
    type: 'boolean', default: true,
    description: 'Enable telemetry metrics',
  },
};

/**
 * Quick-validate the Heady env (call at startup).
 */
export function validateHeadyEnv(extra = {}) {
  const validator = new EnvValidator({ ...HEADY_SCHEMA, ...extra });
  return validator.validateOrThrow();
}

export default EnvValidator;
