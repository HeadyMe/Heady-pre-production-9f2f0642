/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/agents/nonprofit-agent.js                             ║
// ║  LAYER: backend/src/agents                                       ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * NonprofitConsultantAgent — Specialized agent for nonprofit consulting workflows.
 *
 * Handles 23 template-driven tasks across 7 HCFP categories:
 *   research (6), creative (3), governance (3), optimization (4),
 *   learning (2), monitoring (2), maintenance (2), security (1)
 *
 * Each task maps to a comprehensive prompt template stored in nonprofit-templates.json.
 * The agent resolves the template_ref, validates inputs, and produces structured
 * outputs wrapped in Cognitive Telemetry Payloads via BaseAgent.handle().
 *
 * Vertical: headyconnection.org
 */

const path = require("path");
const fs = require("fs");

// Load template catalog at module init
let TEMPLATE_CATALOG = { templates: [] };
try {
    const catalogPath = path.join(__dirname, "..", "nonprofit-templates.json");
    TEMPLATE_CATALOG = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
} catch (e) {
    console.warn("  ⚠ NonprofitConsultantAgent: Could not load template catalog:", e.message);
}

// ─── TEMPLATE INDEX ─────────────────────────────────────────────────────────
const TEMPLATE_INDEX = new Map();
for (const t of TEMPLATE_CATALOG.templates || []) {
    TEMPLATE_INDEX.set(t.id, t);
}

// ─── SKILLS DERIVED FROM TEMPLATES ──────────────────────────────────────────
const NONPROFIT_SKILLS = [
    "competitive-landscape", "policy-analysis", "program-development",
    "partnership-pitch", "website-copy", "grant-reporting",
    "partnership-identification", "funding-research", "technology-evaluation",
    "regulatory-compliance", "theory-of-change", "strategic-planning",
    "risk-assessment", "expansion-feasibility", "scenario-development",
    "needs-assessment", "impact-measurement", "program-evaluation",
    "content-qa", "partner-assessment", "training-material-qa",
    "marketing-review", "feedback-categorization",
    "participant-service-qa", "policy-knowledge", "policy-compliance-audit",
    "contract-review", "grant-completeness-check", "compliance-doc-review",
    "event-registration-followup", "membership-renewal-comms",
    "financial-reconciliation", "event-data-processing",
    "membership-data-mgmt", "data-transfer", "safety-protocols",
    "volunteer-agreements", "training-onboarding", "workshop-curriculum",
    "fundraising-case-statement", "impact-story-generator",
    "podcast-production", "social-media-graphics", "audit-response-report",
    "infographic-creation", "strategic-planning-doc"
];

/**
 * NonprofitConsultantAgent
 *
 * Extends the system's BaseAgent pattern. To stay decoupled from the
 * specific BaseAgent import path (which may vary across Heady builds),
 * we implement the same interface: { id, skills, describe(), handle(), getStatus() }
 * and delegate to BaseAgent when available.
 */
class NonprofitConsultantAgent {
    constructor(BaseAgentClass) {
        this.id = "nonprofit-consultant";
        this.skills = NONPROFIT_SKILLS;
        this._description = "Nonprofit consulting specialist — 46 template-driven workflows for headyconnection.org";
        this.history = [];
        this._BaseAgentClass = BaseAgentClass || null;

        // If a BaseAgent class is provided, create an internal delegate
        if (BaseAgentClass) {
            this._delegate = new BaseAgentClass(
                this.id,
                this.skills,
                this._description
            );
        }
    }

    describe() {
        return this._description;
    }

    /**
     * Handle a nonprofit template execution request.
     *
     * @param {object} input - { request: { templateId: "np-001", inputs: { ... } } }
     * @returns {object} Structured output with template results
     */
    async handle(input) {
        // Delegate to BaseAgent's handle() for Cognitive Telemetry wrapping
        if (this._delegate) {
            // Override the delegate's _execute to use our logic
            this._delegate._execute = (inp) => this._execute(inp);
            return this._delegate.handle(input);
        }

        // Standalone execution (no BaseAgent available)
        const start = Date.now();
        try {
            const result = await this._execute(input);
            const durationMs = Date.now() - start;
            this.history.push({ success: true, durationMs, ts: new Date().toISOString() });
            return result;
        } catch (err) {
            const durationMs = Date.now() - start;
            this.history.push({ success: false, error: err.message, durationMs, ts: new Date().toISOString() });
            throw err;
        }
    }

    /**
     * Core execution: resolve template, validate inputs, produce structured output.
     */
    async _execute(input) {
        const request = input?.request || input || {};
        const templateId = request.templateId || request.template_id || request.id;
        const userInputs = request.inputs || {};

        // Resolve template
        const template = TEMPLATE_INDEX.get(templateId);
        if (!template) {
            const available = Array.from(TEMPLATE_INDEX.keys()).join(", ");
            return {
                agentId: this.id,
                taskType: "nonprofit-consulting",
                status: "error",
                error: `Unknown template: ${templateId}. Available: ${available}`,
                timestamp: new Date().toISOString(),
            };
        }

        // Validate required inputs
        const missingInputs = (template.inputs || []).filter(
            (key) => !userInputs[key] && !userInputs[key.toLowerCase()]
        );

        // Build structured output
        return {
            agentId: this.id,
            taskType: "nonprofit-consulting",
            status: "completed",
            template: {
                id: template.id,
                name: template.name,
                category: template.category,
                complexity: template.complexity,
                role: template.role,
            },
            inputs_received: Object.keys(userInputs),
            inputs_missing: missingInputs,
            output_sections: template.output_sections,
            constraints: template.constraints_summary,
            vertical: "headyconnection.org",
            guidance: missingInputs.length > 0
                ? `Provide missing inputs to generate full analysis: ${missingInputs.join(", ")}`
                : `Template ready for execution. Output will contain ${template.output_sections.length} sections.`,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * List all available templates with metadata.
     */
    listTemplates() {
        return (TEMPLATE_CATALOG.templates || []).map((t) => ({
            id: t.id,
            name: t.name,
            category: t.category,
            complexity: t.complexity,
            role: t.role,
            inputs: t.inputs,
            output_section_count: (t.output_sections || []).length,
        }));
    }

    /**
     * Get a single template by ID.
     */
    getTemplate(id) {
        return TEMPLATE_INDEX.get(id) || null;
    }

    /**
     * Get agent status (matches BaseAgent interface).
     */
    getStatus() {
        return {
            id: this.id,
            skills: this.skills,
            template_count: TEMPLATE_INDEX.size,
            invocations: this.history.length,
            successRate: this.history.length > 0
                ? this.history.filter((h) => h.success).length / this.history.length
                : 1,
            vertical: "headyconnection.org",
        };
    }
}

module.exports = { NonprofitConsultantAgent, TEMPLATE_CATALOG, TEMPLATE_INDEX };
