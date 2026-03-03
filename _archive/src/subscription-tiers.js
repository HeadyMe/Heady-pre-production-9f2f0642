/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ─── Subscription Tier System ─────────────────────────────────────
 *
 *  Tier-based access control, rate limiting, and API key management.
 *  Tiers: free → pro → enterprise → internal
 *
 *  Features:
 *    - API key issuance + validation
 *    - Per-tier rate limits (req/min, req/day, models, features)
 *    - Usage tracking per key
 *    - Email invitation system
 *    - Enterprise inquiry pipeline
 * ──────────────────────────────────────────────────────────────────
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const logger = require("./utils/logger");

const DATA_DIR = path.join(__dirname, "..", "data");
const KEYS_FILE = path.join(DATA_DIR, "api-keys.json");
const INVITES_FILE = path.join(DATA_DIR, "invitations.json");
const INQUIRIES_FILE = path.join(DATA_DIR, "enterprise-inquiries.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ─── TIER DEFINITIONS ────────────────────────────────────────────────
const TIERS = {
    free: {
        name: "Free",
        price: 0,
        billing: "free",
        seats: 1,
        limits: {
            requestsPerMinute: 5,
            requestsPerDay: 200,
            maxTokensPerRequest: 2000,
            concurrentRequests: 1,
        },
        models: ["groq"],
        features: ["chat", "services-explorer"],
        support: "community",
        badge: "🆓",
    },
    "pro-individual": {
        name: "Pro+ Individual",
        price: 29,
        billing: "monthly",
        seats: 1,
        limits: {
            requestsPerMinute: 50,
            requestsPerDay: 5000,
            maxTokensPerRequest: 8000,
            concurrentRequests: 5,
        },
        models: ["groq", "huggingface", "gemini"],
        features: ["chat", "ide", "services-explorer", "gateway", "creative", "deep-intel"],
        support: "email",
        badge: "⚡",
    },
    "pro-business": {
        name: "Pro+ Business Team",
        price: 29,
        billing: "monthly-per-seat",
        seats: null,  // unlimited seats, billed per seat
        limits: {
            requestsPerMinute: 100,
            requestsPerDay: 10000,
            maxTokensPerRequest: 8000,
            concurrentRequests: 10,
        },
        models: ["groq", "huggingface", "gemini"],
        features: ["chat", "ide", "services-explorer", "gateway", "creative", "deep-intel",
            "team-management", "shared-workspaces", "audit-logs"],
        support: "priority-email",
        badge: "👥",
    },
    "max": {
        name: "Heady Max",
        price: 99,
        billing: "monthly",
        seats: 1,
        limits: {
            requestsPerMinute: 500,
            requestsPerDay: 50000,
            maxTokensPerRequest: 32000,
            concurrentRequests: 25,
        },
        models: ["groq", "huggingface", "gemini", "openai", "claude", "perplexity"],
        features: ["chat", "ide", "services-explorer", "gateway", "creative", "deep-intel",
            "battle", "quantum", "vector-memory", "custom-models", "auto-success"],
        support: "priority",
        badge: "🚀",
    },
    "family": {
        name: "Family",
        price: 99,
        billing: "monthly",
        seats: 6,
        limits: {
            requestsPerMinute: 500,
            requestsPerDay: 50000,
            maxTokensPerRequest: 32000,
            concurrentRequests: 25,
        },
        models: ["groq", "huggingface", "gemini", "openai", "claude", "perplexity"],
        features: ["chat", "ide", "services-explorer", "gateway", "creative", "deep-intel",
            "battle", "quantum", "vector-memory", "custom-models", "auto-success",
            "family-sharing", "parental-controls"],
        support: "priority",
        badge: "👨‍👩‍👧‍👦",
    },
    "enterprise-max": {
        name: "Enterprise Max",
        price: 99,
        billing: "monthly-per-seat",
        seats: null,
        limits: {
            requestsPerMinute: 1000,
            requestsPerDay: 100000,
            maxTokensPerRequest: 64000,
            concurrentRequests: 50,
        },
        models: ["groq", "huggingface", "gemini", "openai", "claude", "perplexity", "vertex"],
        features: ["chat", "ide", "services-explorer", "gateway", "creative", "deep-intel",
            "battle", "quantum", "vector-memory", "custom-models", "auto-success",
            "sso", "sla-99.9", "audit-logs", "dedicated-support", "custom-integrations"],
        support: "dedicated",
        badge: "🏢",
    },
    "enterprise-payg": {
        name: "Enterprise Pay-As-You-Go",
        price: null,
        billing: "usage-based",
        seats: null,
        limits: {
            requestsPerMinute: Infinity,
            requestsPerDay: Infinity,
            maxTokensPerRequest: 64000,
            concurrentRequests: 100,
        },
        models: ["groq", "huggingface", "gemini", "openai", "claude", "perplexity", "vertex"],
        features: ["chat", "ide", "services-explorer", "gateway", "creative", "deep-intel",
            "battle", "quantum", "vector-memory", "custom-models", "auto-success",
            "sso", "sla-99.99", "audit-logs", "dedicated-support", "custom-integrations",
            "on-prem-option", "volume-discounts"],
        support: "dedicated-tam",
        badge: "💳",
    },
    "nonprofit": {
        name: "Nonprofit & Govt Assistance",
        price: null,
        billing: "custom",
        seats: null,
        description: "Custom rates for nonprofits. Government assistance qualifies for free Pro+ or discounted Max.",
        limits: {
            requestsPerMinute: 500,
            requestsPerDay: 50000,
            maxTokensPerRequest: 32000,
            concurrentRequests: 25,
        },
        models: ["groq", "huggingface", "gemini", "openai", "claude"],
        features: ["chat", "ide", "services-explorer", "gateway", "creative", "deep-intel",
            "battle", "vector-memory", "nonprofit-dashboard"],
        support: "priority",
        badge: "🤝",
    },
    internal: {
        name: "Internal",
        price: 0,
        billing: "internal",
        seats: null,
        limits: {
            requestsPerMinute: Infinity,
            requestsPerDay: Infinity,
            maxTokensPerRequest: Infinity,
            concurrentRequests: Infinity,
        },
        models: ["groq", "huggingface", "gemini", "openai", "claude", "perplexity", "vertex", "colab"],
        features: ["*"],
        support: "self",
        badge: "🐝",
    },
};

// ─── API KEY MANAGEMENT ──────────────────────────────────────────────
let keys = {};
try { keys = JSON.parse(fs.readFileSync(KEYS_FILE, "utf-8")); } catch { }

function _saveKeys() {
    try { fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2)); } catch { }
}

function generateApiKey(tier, meta = {}) {
    const prefixes = {
        "free": "hdy_free_", "pro-individual": "hdy_pro_", "pro-business": "hdy_biz_",
        "max": "hdy_max_", "family": "hdy_fam_", "enterprise-max": "hdy_ent_",
        "enterprise-payg": "hdy_epg_", "nonprofit": "hdy_npo_", "internal": "hdy_int_",
    };
    const prefix = prefixes[tier] || "hdy_";
    const key = prefix + crypto.randomBytes(24).toString("hex");
    const record = {
        key,
        tier,
        owner: meta.email || meta.name || "unknown",
        email: meta.email || null,
        name: meta.name || null,
        org: meta.org || null,
        created: new Date().toISOString(),
        active: true,
        usage: { totalRequests: 0, todayRequests: 0, lastReset: new Date().toISOString().split("T")[0] },
    };
    keys[key] = record;
    _saveKeys();
    logger.logSystem(`  🔑 API Key issued: ${tier.toUpperCase()} → ${meta.email || "?"}`);
    return record;
}

function validateKey(apiKey) {
    const record = keys[apiKey];
    if (!record) return { valid: false, error: "Invalid API key" };
    if (!record.active) return { valid: false, error: "API key deactivated" };

    const tier = TIERS[record.tier];
    if (!tier) return { valid: false, error: "Unknown tier" };

    // Reset daily counter
    const today = new Date().toISOString().split("T")[0];
    if (record.usage.lastReset !== today) {
        record.usage.todayRequests = 0;
        record.usage.lastReset = today;
    }

    return { valid: true, tier: record.tier, tierConfig: tier, record };
}

function revokeKey(apiKey) {
    if (keys[apiKey]) {
        keys[apiKey].active = false;
        _saveKeys();
        return true;
    }
    return false;
}

function listKeys(filter = {}) {
    return Object.values(keys).filter(k => {
        if (filter.tier && k.tier !== filter.tier) return false;
        if (filter.active !== undefined && k.active !== filter.active) return false;
        if (filter.email && k.email !== filter.email) return false;
        return true;
    }).map(k => ({ ...k, key: k.key.substring(0, 12) + "..." })); // Mask keys in listings
}

// ─── RATE LIMITER (per-key, per-tier) ────────────────────────────────
const rateBuckets = new Map();  // key → { minute: { count, resetAt }, day: { count, resetAt } }

function checkRateLimit(apiKey) {
    const validation = validateKey(apiKey);
    if (!validation.valid) return { allowed: false, error: validation.error };

    const { tier, tierConfig, record } = validation;
    const limits = tierConfig.limits;
    const now = Date.now();

    // Initialize bucket
    if (!rateBuckets.has(apiKey)) {
        rateBuckets.set(apiKey, {
            minute: { count: 0, resetAt: now + 60000 },
            day: { count: 0, resetAt: now + 86400000 },
        });
    }
    const bucket = rateBuckets.get(apiKey);

    // Reset expired windows
    if (now >= bucket.minute.resetAt) { bucket.minute.count = 0; bucket.minute.resetAt = now + 60000; }
    if (now >= bucket.day.resetAt) { bucket.day.count = 0; bucket.day.resetAt = now + 86400000; }

    // Check limits
    if (bucket.minute.count >= limits.requestsPerMinute) {
        return {
            allowed: false, error: "Rate limit exceeded (per-minute)",
            tier, retryAfterMs: bucket.minute.resetAt - now,
            limit: limits.requestsPerMinute, used: bucket.minute.count,
        };
    }
    if (bucket.day.count >= limits.requestsPerDay) {
        return {
            allowed: false, error: "Rate limit exceeded (per-day)",
            tier, retryAfterMs: bucket.day.resetAt - now,
            limit: limits.requestsPerDay, used: bucket.day.count,
        };
    }

    // Increment
    bucket.minute.count++;
    bucket.day.count++;
    record.usage.totalRequests++;
    record.usage.todayRequests++;

    return {
        allowed: true, tier, badge: tierConfig.badge,
        remaining: {
            minute: limits.requestsPerMinute - bucket.minute.count,
            day: limits.requestsPerDay - bucket.day.count,
        },
        models: tierConfig.models,
        features: tierConfig.features,
    };
}

// ─── EXPRESS MIDDLEWARE ───────────────────────────────────────────────
function tierMiddleware(req, res, next) {
    // Skip health/public endpoints
    const publicPaths = ["/api/health", "/api/tiers", "/api/tiers/pricing", "/api/enterprise/inquire", "/api/invitations/accept"];
    if (publicPaths.some(p => req.path.startsWith(p))) return next();

    const apiKey = req.headers["x-api-key"] || req.query.apiKey;
    if (!apiKey) {
        // No key = free tier with IP-based limiting
        req.tier = "free";
        req.tierConfig = TIERS.free;
        return next();
    }

    const result = checkRateLimit(apiKey);
    if (!result.allowed) {
        return res.status(429).json({
            error: result.error,
            tier: result.tier,
            retryAfterMs: result.retryAfterMs,
            limit: result.limit, used: result.used,
            upgrade: "https://headysystems.com/pricing",
        });
    }

    req.tier = result.tier;
    req.tierConfig = TIERS[result.tier];
    req.tierBadge = result.badge;
    req.allowedModels = result.models;
    req.allowedFeatures = result.features;
    res.set("X-Tier", result.tier);
    res.set("X-Rate-Remaining-Minute", String(result.remaining.minute));
    res.set("X-Rate-Remaining-Day", String(result.remaining.day));
    next();
}

// ─── EMAIL INVITATIONS ───────────────────────────────────────────────
let invitations = [];
try { invitations = JSON.parse(fs.readFileSync(INVITES_FILE, "utf-8")); } catch { }

function _saveInvitations() {
    try { fs.writeFileSync(INVITES_FILE, JSON.stringify(invitations, null, 2)); } catch { }
}

function createInvitation(email, tier = "pro", meta = {}) {
    const token = crypto.randomBytes(32).toString("hex");
    const invite = {
        id: crypto.randomUUID(),
        email,
        tier,
        token,
        invitedBy: meta.invitedBy || "system",
        message: meta.message || null,
        status: "pending",  // pending → accepted → expired
        created: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),  // 7 days
        acceptUrl: `https://manager.headysystems.com/api/invitations/accept?token=${token}`,
    };
    invitations.push(invite);
    _saveInvitations();
    return invite;
}

function acceptInvitation(token) {
    const invite = invitations.find(i => i.token === token && i.status === "pending");
    if (!invite) return { success: false, error: "Invalid or expired invitation" };
    if (new Date(invite.expiresAt) < new Date()) {
        invite.status = "expired";
        _saveInvitations();
        return { success: false, error: "Invitation expired" };
    }

    invite.status = "accepted";
    invite.acceptedAt = new Date().toISOString();

    // Auto-generate API key for the invitee
    const apiKey = generateApiKey(invite.tier, { email: invite.email, name: invite.email.split("@")[0] });

    _saveInvitations();
    return { success: true, apiKey: apiKey.key, tier: invite.tier, email: invite.email };
}

function sendInvitationEmail(invite) {
    // Generates the email HTML — caller handles actual sending via their email provider
    return {
        to: invite.email,
        from: "noreply@headysystems.com",
        subject: `🐝 You're invited to Heady AI — ${TIERS[invite.tier]?.name || "Pro"} Access`,
        html: `
<!DOCTYPE html>
<html><head><style>
  body { font-family: 'Inter', Arial, sans-serif; background: #0a0a12; color: #e0e0f0; padding: 40px; }
  .container { max-width: 600px; margin: 0 auto; background: #12121e; border-radius: 16px; border: 1px solid #2a2a3e; padding: 40px; }
  h1 { background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .cta { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; border-radius: 10px; font-weight: 700; margin: 24px 0; }
  .tier-badge { padding: 6px 16px; background: rgba(102,126,234,0.15); border: 1px solid rgba(102,126,234,0.3); border-radius: 20px; font-size: 14px; color: #667eea; display: inline-block; }
  .features { list-style: none; padding: 0; }
  .features li { padding: 8px 0; border-bottom: 1px solid #2a2a3e; }
  .features li::before { content: "✅ "; }
  .footer { margin-top: 30px; font-size: 12px; color: #8888aa; }
</style></head><body>
<div class="container">
  <h1>🐝 Welcome to Heady AI</h1>
  <p>You've been invited to join the Heady AI platform with <span class="tier-badge">${TIERS[invite.tier]?.badge || "⚡"} ${TIERS[invite.tier]?.name || "Pro"} Access</span></p>
  ${invite.message ? `<p style="color:#8888aa;font-style:italic;">"${invite.message}"</p>` : ""}
  <p>Your ${TIERS[invite.tier]?.name} tier includes:</p>
  <ul class="features">
    <li>${(TIERS[invite.tier]?.limits.requestsPerMinute || 100)} requests/minute</li>
    <li>${(TIERS[invite.tier]?.limits.requestsPerDay || 10000).toLocaleString()} requests/day</li>
    <li>${(TIERS[invite.tier]?.models || []).join(", ")} AI providers</li>
    <li>${TIERS[invite.tier]?.support || "email"} support</li>
  </ul>
  <a href="${invite.acceptUrl}" class="cta">Accept Invitation →</a>
  <p class="footer">
    This invitation expires ${new Date(invite.expiresAt).toLocaleDateString()}.<br>
    HeadySystems Inc. · <a href="https://headysystems.com" style="color:#667eea;">headysystems.com</a><br>
    HeadyConnection Inc. · <a href="https://headyconnection.org" style="color:#667eea;">headyconnection.org</a>
  </p>
</div>
</body></html>`,
    };
}

// ─── ENTERPRISE INQUIRIES ────────────────────────────────────────────
let inquiries = [];
try { inquiries = JSON.parse(fs.readFileSync(INQUIRIES_FILE, "utf-8")); } catch { }

function _saveInquiries() {
    try { fs.writeFileSync(INQUIRIES_FILE, JSON.stringify(inquiries, null, 2)); } catch { }
}

function createInquiry(data) {
    const inquiry = {
        id: crypto.randomUUID(),
        name: data.name,
        email: data.email,
        company: data.company || null,
        role: data.role || null,
        teamSize: data.teamSize || null,
        useCase: data.useCase || null,
        message: data.message || null,
        status: "new",  // new → contacted → demo → negotiating → closed-won → closed-lost
        created: new Date().toISOString(),
    };
    inquiries.push(inquiry);
    _saveInquiries();
    logger.logSystem(`  🏢 Enterprise inquiry: ${data.company || data.email}`);
    return inquiry;
}

// ─── ROUTE REGISTRATION ─────────────────────────────────────────────
function registerTierRoutes(app) {
    // Public: tier info
    app.get("/api/tiers", (req, res) => {
        const publicTiers = {};
        for (const [id, tier] of Object.entries(TIERS)) {
            if (id === "internal") continue;  // Don't expose internal tier
            publicTiers[id] = {
                name: tier.name, price: tier.price, badge: tier.badge,
                limits: tier.limits, models: tier.models,
                features: tier.features, support: tier.support,
            };
        }
        res.json({ ok: true, tiers: publicTiers });
    });

    app.get("/api/tiers/pricing", (req, res) => {
        res.json({
            ok: true,
            pricing: {
                free: { price: "$0/mo", cta: "Get Started", url: "/api/keys/create?tier=free" },
                "pro-individual": { price: "$29/mo", cta: "Go Pro+", url: "/api/keys/create?tier=pro-individual" },
                "pro-business": { price: "$29/mo/seat", cta: "Team Pro+", url: "/api/keys/create?tier=pro-business" },
                max: { price: "$99/mo", cta: "Go Max", url: "/api/keys/create?tier=max" },
                family: { price: "$99/mo (6 seats)", cta: "Family Plan", url: "/api/keys/create?tier=family" },
                "enterprise-max": { price: "$99/mo/seat", cta: "Enterprise Max", url: "/api/enterprise/inquire" },
                "enterprise-payg": { price: "Pay-as-you-go", cta: "Contact Sales", url: "/api/enterprise/inquire" },
                nonprofit: { price: "Custom/Free", cta: "Apply", url: "/api/enterprise/inquire" },
            },
        });
    });

    // API key management
    app.post("/api/keys/create", (req, res) => {
        const { tier = "free", email, name, org } = req.body || {};
        const selfServiceTiers = ["free", "pro-individual", "max", "family"];
        if (!selfServiceTiers.includes(tier)) {
            return res.status(400).json({ error: "Use /api/enterprise/inquire for enterprise and nonprofit tiers" });
        }
        const key = generateApiKey(tier, { email, name, org });
        res.json({ ok: true, apiKey: key.key, tier, message: "Store this key securely — it won't be shown again" });
    });

    app.post("/api/keys/revoke", (req, res) => {
        const { apiKey } = req.body || {};
        if (revokeKey(apiKey)) {
            res.json({ ok: true, message: "Key revoked" });
        } else {
            res.status(404).json({ error: "Key not found" });
        }
    });

    app.get("/api/keys/list", (req, res) => {
        const { tier, active } = req.query;
        const result = listKeys({ tier, active: active === "true" ? true : active === "false" ? false : undefined });
        res.json({ ok: true, keys: result, total: result.length });
    });

    // Invitations
    app.post("/api/invitations/send", (req, res) => {
        const { emails, tier = "pro", message } = req.body || {};
        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({ error: "Provide an array of email addresses" });
        }
        const results = emails.map(email => {
            const invite = createInvitation(email.trim(), tier, { invitedBy: req.headers["x-api-key"] || "admin", message });
            const emailData = sendInvitationEmail(invite);
            return { email, inviteId: invite.id, acceptUrl: invite.acceptUrl, emailHtml: emailData.html, subject: emailData.subject };
        });
        res.json({ ok: true, sent: results.length, invitations: results });
    });

    app.get("/api/invitations/accept", (req, res) => {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: "Missing invitation token" });
        const result = acceptInvitation(token);
        if (result.success) {
            // Redirect to a success page or return the API key
            res.json({
                ok: true,
                message: `Welcome to Heady AI! Your ${result.tier} API key is ready.`,
                apiKey: result.apiKey,
                tier: result.tier,
                dashboard: "https://manager.headysystems.com/api/tiers",
            });
        } else {
            res.status(400).json({ error: result.error });
        }
    });

    app.get("/api/invitations/list", (req, res) => {
        const { status } = req.query;
        const filtered = status ? invitations.filter(i => i.status === status) : invitations;
        res.json({ ok: true, invitations: filtered.map(i => ({ ...i, token: "***" })), total: filtered.length });
    });

    // Enterprise inquiries
    app.post("/api/enterprise/inquire", (req, res) => {
        const { name, email, company, role, teamSize, useCase, message } = req.body || {};
        if (!email) return res.status(400).json({ error: "Email is required" });
        const inquiry = createInquiry({ name, email, company, role, teamSize, useCase, message });
        res.json({
            ok: true,
            message: "Thank you! Our team will contact you within 24 hours.",
            inquiryId: inquiry.id,
        });
    });

    app.get("/api/enterprise/inquiries", (req, res) => {
        const { status } = req.query;
        const filtered = status ? inquiries.filter(i => i.status === status) : inquiries;
        res.json({ ok: true, inquiries: filtered, total: filtered.length });
    });

    // Usage stats
    app.get("/api/usage", (req, res) => {
        const apiKey = req.headers["x-api-key"];
        if (!apiKey) return res.status(401).json({ error: "API key required" });
        const record = keys[apiKey];
        if (!record) return res.status(404).json({ error: "Key not found" });
        const tier = TIERS[record.tier];
        res.json({
            ok: true,
            tier: record.tier,
            badge: tier?.badge,
            usage: record.usage,
            limits: tier?.limits,
            models: tier?.models,
            features: tier?.features,
        });
    });

    logger.logSystem(`  💎 SubscriptionTiers: LOADED (${Object.keys(TIERS).length} tiers, rate limiting, invitations, enterprise inquiries)`);
}

module.exports = {
    TIERS, tierMiddleware, registerTierRoutes,
    generateApiKey, validateKey, revokeKey, checkRateLimit,
    createInvitation, acceptInvitation, sendInvitationEmail,
    createInquiry,
};
