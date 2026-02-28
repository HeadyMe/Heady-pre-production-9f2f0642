// HEADY_BRAND:BEGIN
// HEADY SYSTEMS :: SACRED GEOMETRY
// FILE: backend/src/utils/config.js
// LAYER: backend
// HEADY_BRAND:END

const path = require("path");

const PORT = Number(process.env.PORT) || 3300;

const HF_TOKEN = process.env.HF_TOKEN;
const HEADY_API_KEY = process.env.HEADY_API_KEY;

const HEADY_TRUST_PROXY = process.env.HEADY_TRUST_PROXY === "true";
const HEADY_CORS_ORIGINS = (process.env.HEADY_CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const HEADY_RATE_LIMIT_WINDOW_MS = Number(process.env.HEADY_RATE_LIMIT_WINDOW_MS) || 60_000;
const HEADY_RATE_LIMIT_MAX = Number(process.env.HEADY_RATE_LIMIT_MAX) || 120;
const HF_MAX_CONCURRENCY = Number(process.env.HF_MAX_CONCURRENCY) || 4;

const HEADY_QA_BACKEND = process.env.HEADY_QA_BACKEND || "auto";
const HEADY_PYTHON_BIN = process.env.HEADY_PYTHON_BIN || "python";
const HEADY_PY_WORKER_TIMEOUT_MS = Number(process.env.HEADY_PY_WORKER_TIMEOUT_MS) || 90_000;
const HEADY_PY_MAX_CONCURRENCY = Number(process.env.HEADY_PY_MAX_CONCURRENCY) || 2;
const HEADY_QA_MAX_NEW_TOKENS = Number(process.env.HEADY_QA_MAX_NEW_TOKENS) || 256;
const HEADY_QA_MODEL = process.env.HEADY_QA_MODEL;
const HEADY_QA_MAX_QUESTION_CHARS = Number(process.env.HEADY_QA_MAX_QUESTION_CHARS) || 4000;
const HEADY_QA_MAX_CONTEXT_CHARS = Number(process.env.HEADY_QA_MAX_CONTEXT_CHARS) || 12000;

const DEFAULT_HF_TEXT_MODEL = process.env.HF_TEXT_MODEL || "gpt2";
const DEFAULT_HF_EMBED_MODEL = process.env.HF_EMBED_MODEL || "sentence-transformers/all-MiniLM-L6-v2";

const HEADY_ADMIN_ROOT = process.env.HEADY_ADMIN_ROOT || path.resolve(__dirname, "../../..");
const HEADY_ADMIN_ALLOWED_PATHS = (process.env.HEADY_ADMIN_ALLOWED_PATHS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const HEADY_ADMIN_MAX_BYTES = Number(process.env.HEADY_ADMIN_MAX_BYTES) || 512_000;
const HEADY_ADMIN_OP_LOG_LIMIT = Number(process.env.HEADY_ADMIN_OP_LOG_LIMIT) || 2000;
const HEADY_ADMIN_OP_LIMIT = Number(process.env.HEADY_ADMIN_OP_LIMIT) || 50;

// Path corrections for new structure
const HEADY_ADMIN_BUILD_SCRIPT =
    process.env.HEADY_ADMIN_BUILD_SCRIPT || path.join(__dirname, "..", "..", "python_worker", "consolidated_builder.py");
const HEADY_ADMIN_AUDIT_SCRIPT =
    process.env.HEADY_ADMIN_AUDIT_SCRIPT || path.join(__dirname, "..", "..", "python_worker", "admin_console.py");

const HEADY_ADMIN_ENABLE_GPU = process.env.HEADY_ADMIN_ENABLE_GPU === "true";
const REMOTE_GPU_HOST = process.env.REMOTE_GPU_HOST || "";
const REMOTE_GPU_PORT = process.env.REMOTE_GPU_PORT || "";
const GPU_MEMORY_LIMIT = process.env.GPU_MEMORY_LIMIT || "";
const ENABLE_GPUDIRECT = process.env.ENABLE_GPUDIRECT === "true";
const HEADY_VECTOR_STORE_PATH = process.env.HEADY_VECTOR_STORE_PATH || path.join(__dirname, "..", "..", "heady_vector_store.json");

module.exports = {
    PORT,
    HF_TOKEN,
    HEADY_API_KEY,
    HEADY_TRUST_PROXY,
    HEADY_CORS_ORIGINS,
    HEADY_RATE_LIMIT_WINDOW_MS,
    HEADY_RATE_LIMIT_MAX,
    HF_MAX_CONCURRENCY,
    HEADY_QA_BACKEND,
    HEADY_PYTHON_BIN,
    HEADY_PY_WORKER_TIMEOUT_MS,
    HEADY_PY_MAX_CONCURRENCY,
    HEADY_QA_MAX_NEW_TOKENS,
    HEADY_QA_MODEL,
    HEADY_QA_MAX_QUESTION_CHARS,
    HEADY_QA_MAX_CONTEXT_CHARS,
    DEFAULT_HF_TEXT_MODEL,
    DEFAULT_HF_EMBED_MODEL,
    HEADY_ADMIN_ROOT,
    HEADY_ADMIN_ALLOWED_PATHS,
    HEADY_ADMIN_MAX_BYTES,
    HEADY_ADMIN_OP_LOG_LIMIT,
    HEADY_ADMIN_OP_LIMIT,
    HEADY_ADMIN_BUILD_SCRIPT,
    HEADY_ADMIN_AUDIT_SCRIPT,
    HEADY_ADMIN_ENABLE_GPU,
    REMOTE_GPU_HOST,
    REMOTE_GPU_PORT,
    GPU_MEMORY_LIMIT,
    ENABLE_GPUDIRECT,
    HEADY_VECTOR_STORE_PATH,
};
