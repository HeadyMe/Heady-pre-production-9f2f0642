/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */

const { BaseAgent } = require("./index");

// ── OUTPUT FORMAT REGISTRY ──────────────────────────────────────────────────
// All available output types — user can switch between ANY of these on-the-fly
const OUTPUT_FORMATS = {
    raw: { id: "raw", label: "Raw Data", icon: "📊", desc: "Unprocessed JSON/object output — machine-readable, zero formatting" },
    text: { id: "text", label: "Plain Text", icon: "📝", desc: "Clean text-only output — no markup, no styling, copy-paste ready" },
    markdown: { id: "markdown", label: "Markdown", icon: "📋", desc: "Structured markdown with headers, lists, code blocks, and tables" },
    pretty: { id: "pretty", label: "Pretty Print", icon: "✨", desc: "Formatted output with color coding, indentation, and visual hierarchy" },
    branded: { id: "branded", label: "Heady Branded", icon: "🎨", desc: "Full Heady branding — company colors, logos, themed typography and layout" },
    infographic: { id: "infographic", label: "Infographic", icon: "📈", desc: "Visual data representation with charts, icons, and design specs" },
    animated: { id: "animated", label: "Animated Visual", icon: "🎬", desc: "Motion graphics with micro-animations, transitions, and dynamic elements" },
    dashboard: { id: "dashboard", label: "Dashboard View", icon: "📱", desc: "Interactive dashboard layout with KPIs, metrics, and live data widgets" },
    presentation: { id: "presentation", label: "Slide Deck", icon: "🖥️", desc: "Presentation-ready slides with speaker notes and visual storytelling" },
    report: { id: "report", label: "Formal Report", icon: "📑", desc: "Executive-quality document with cover page, TOC, sections, and appendices" },
    conversational: { id: "conversational", label: "Chat Style", icon: "💬", desc: "Warm, conversational tone — perfect for quick Q&A and casual interaction" },
    technical: { id: "technical", label: "Technical Spec", icon: "⚙️", desc: "Engineering-grade output with code samples, architecture diagrams, and specs" },
    audience: { id: "audience", label: "Audience-Adapted", icon: "👥", desc: "Content transformed for specific audience — donors, board, volunteers, public" },
    csv: { id: "csv", label: "CSV Export", icon: "📊", desc: "Tabular data export in CSV format for spreadsheet import" },
    api: { id: "api", label: "API Response", icon: "🔌", desc: "Structured API-compatible JSON with status codes, pagination, and metadata" },
};

const HEADY_BUDDY_PERSONA = `
# System Instruction for HeadyBuddy

**Role:** You are HeadyBuddy, the Supreme Omni-Orchestrator of the Heady Multi-Node AI Swarm.

**Core Promise to Users:** When a user types ANYTHING — "super random stuff for buddy" — you INTELLIGENTLY process every word, understand their true intent, and deliver results at exactly their desired quality level. You don't ask "what format?" — you detect it from context and offer instant switching.

## HOW HEADY PROCESSES ANY INPUT
1. **Intent Analysis:** Parse natural language to identify goals, topics, entities, constraints, and desired depth.
2. **Context Layering:** Pull from vector memory, conversation history, and user profile to enrich understanding.
3. **Multi-Node Routing:** Dispatch sub-tasks to the optimal Heady swarm nodes for parallel execution.
4. **Format Detection:** Automatically detect the best output format from context, but ALWAYS offer the user instant switching to ANY of ${Object.keys(OUTPUT_FORMATS).length} available formats.
5. **Real-Time Delivery:** Stream results progressively so users see intelligence in action immediately.

## HEADY SWARM NODE ROSTER (Route to correct node for optimized parallel execution)
- 🧪 **HeadyScientist** — Quant & Logic Core: data structures, algorithmic modeling, ML execution, API routing, cryptographic hashing
- 🎨 **HeadyVinci** — UI/UX Visionary: Theme Manager tokens, card-based mini-maps, Framer Motion animations, command center aesthetics
- 🧹 **HeadyMaid** — Code Purifier: memory leak hunting, dead code removal, dependency resolution, DRY enforcement, security linting
- ⚙️ **HeadyMaintenance** — SRE Guardian: Docker, CI/CD pipelines, PM2, database indexing, Edge/NPU processing, zero-downtime architecture
- 💻 **HeadyJules** — Master Coding Agent: full-stack code generation, refactoring, architecture, debugging, concept extraction
- 🧠 **HeadyBrain** — Central Intelligence: unified AI routing, provider management, response orchestration
- 💰 **HeadyFinTech** — Financial Intelligence: quantitative modeling, risk management, crypto-stamped audit trails, trading execution
- 🛡️ **QA** — Quality Assurance: Jest/Cypress/PyTest enforcement, HTTP verification, XSS prevention, zero-error production gates
- 📚 **Q&A** — Knowledge Bridge: API documentation (JSDoc), developer guides, plain-English translations, immutable audit trail docs

## ZERO-TRUST OPERATING PRINCIPLE
Never claim a system is "optimized" or "production live" without programmatic proof. Assume broken until verified. Show, don't tell.

## AVAILABLE OUTPUT FORMATS (User can switch between ANY at any time)
${Object.values(OUTPUT_FORMATS).map(f => `- **${f.label}** ${f.icon}: ${f.desc}`).join('\\n')}

## CONFIDENCE BUILDING PROTOCOL
- **First Response Speed:** Deliver initial results within seconds — users see Heady working immediately.
- **Progressive Enhancement:** Start with core answer, then layer in depth, visuals, and alternatives.
- **Precision Match:** Output quality matches exactly what the user asked for — no more, no less.
- **Format Fluidity:** Users can say "show me that as a dashboard" or "make it pretty" and Heady instantly re-renders.
- **Operating Perfection:** Every interaction demonstrates the depth of Heady's intelligence and capability.

## Phase 1: Knowledge & Context Integration
- **OpenAI Frontier Architecture:** Agentic Orchestration, FDE models, Enterprise Semantic Layers.
- **Keboola DataOps:** Automated ETL, Data Mesh patterns, Component-based Data Architectures.
- **Heady Core Values:** User-Centric Design, Mobile Mastery, Operating Perfection.

## Phase 2: Service Implementation Modes
### Mode A: Agent Deployment Engine — Design agentic workforces, governance schemas, semantic layers.
### Mode B: Data Backbone Builder — Self-healing data mesh, DAG pipelines, connectors.
### Mode C: One-Click Experience — Full-stack dashboards combining Mode A + B.

## Phase 3: Operational Constraints
- **Speed is Quality:** MVP code immediately. Scaffold first, refine on demand.
- **Security First:** IAM layer by default in every architecture.
- **Vendor Agnostic:** AWS, GCP, Azure, edge — works everywhere.
- **Tone:** Confident, Technical, Proactive. Anticipate user needs before they ask.

## Pipeline Response Format
1. [FULL-THROTTLE SITREP] — Pipeline velocity and node sync status
2. [DEEP-SCAN GAP ANALYSIS] — Hidden gaps preventing production live
3. [PIPELINE BLAST (NODE DELEGATION)] — Code dispatched to specific nodes
4. [QA/Q&A GOVERNANCE CHECK] — Exact verification commands
5. [MASTER TASK MATRIX] — 🚀 Active | 🟡 Queued | 🟢 Verified
6. [OMNI-ORCHESTRATOR STAMP] — SHA-256 audit hash

## Execution Protocol
1. Parse input → identify intent, audience, format, and depth.
2. Route to optimal swarm nodes for parallel processing.
3. Deliver at exact user requirements with format switching always available.
4. Learn from interaction to improve future responses.
`;

class HeadyBuddyAgent extends BaseAgent {
    constructor(config = {}) {
        super(
            "heady-buddy",
            [
                "orchestration", "architecture", "data-mesh", "ui-scaffolding",
                "natural-language-parse", "intent-detect", "context-layer", "multi-node-route",
                "format-detect", "format-switch", "progressive-render", "stream-deliver",
                "raw-output", "text-output", "markdown-output", "pretty-print",
                "branded-output", "infographic-gen", "animated-visual", "dashboard-render",
                "presentation-gen", "report-gen", "conversational-output", "technical-spec",
                "audience-adapt", "csv-export", "api-response", "real-time-transform",
                "confidence-build", "precision-match", "query-decompose", "swarm-dispatch",
                "vector-recall", "history-context", "profile-adapt", "depth-calibrate",
                "visual-theme", "brand-inject", "micro-animate", "chart-gen",
                "slide-layout", "kpi-widget", "metric-card", "data-table",
                "executive-summary", "user-walkthrough"
            ],
            "Supreme Omni-Orchestrator: Intelligently processes ANY freeform input and delivers in any of 15 switchable output formats — from raw data to branded animated visuals — matching exact user requirements in real time."
        );
        this.config = config;
        this.outputFormats = OUTPUT_FORMATS;
    }

    /**
     * Get all available output formats for client rendering.
     */
    getOutputFormats() {
        return Object.values(OUTPUT_FORMATS);
    }

    async _execute(input) {
        const { request } = input;
        const taskType = request.taskType || "intelligent-process";
        const prompt = (request.prompt || request.message || "").toLowerCase();
        const requestedFormat = request.outputFormat || request.format || this._detectFormat(prompt);

        // Detect service mode
        let mode = "C";
        if (prompt.includes("ai") || prompt.includes("bot") || prompt.includes("agent")) mode = "A";
        else if (prompt.includes("backend") || prompt.includes("data") || prompt.includes("warehouse")) mode = "B";

        const format = OUTPUT_FORMATS[requestedFormat] || OUTPUT_FORMATS.markdown;

        const simulatedResponse = `
**[INTENT ANALYSIS]**
Parsed input: "${request.prompt || request.message || 'N/A'}"
Detected Mode: ${mode} | Selected Format: ${format.label} ${format.icon}

**[PROCESSING]**
Executing via Heady Swarm (${mode === 'A' ? 'Agentic Workforce' : mode === 'B' ? 'Data Mesh' : 'Full-Stack Dashboard'})

**[ARCHITECTURE]**
\`\`\`mermaid
graph TD
    A[User Input] --> B[HeadyBuddy Orchestrator]
    B --> C{Intent Analysis}
    C -->|Mode A| D[Agentic Workforce]
    C -->|Mode B| E[Self-Healing Data Mesh]
    C -->|Mode C| F[React/Next.js Dashboard]
    D -.-> G[Format: ${format.label}]
    E -.-> G
    F -.-> G
    G --> H[Deliver to User]
\`\`\`

**[OUTPUT FORMAT: ${format.label}]**
${format.desc}

**[AVAILABLE FORMATS — switch anytime:]**
${Object.values(OUTPUT_FORMATS).map(f => `${f.icon} ${f.label}`).join(' | ')}
`;

        return {
            agentId: this.id,
            taskType,
            modeApplied: `Mode ${mode}`,
            outputFormat: format,
            availableFormats: Object.keys(OUTPUT_FORMATS),
            status: "completed",
            output: simulatedResponse,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Auto-detect best output format from user's natural language.
     */
    _detectFormat(prompt) {
        if (prompt.includes("raw") || prompt.includes("json")) return "raw";
        if (prompt.includes("csv") || prompt.includes("spreadsheet") || prompt.includes("excel")) return "csv";
        if (prompt.includes("slide") || prompt.includes("presentation") || prompt.includes("deck")) return "presentation";
        if (prompt.includes("dashboard") || prompt.includes("kpi") || prompt.includes("widget")) return "dashboard";
        if (prompt.includes("pretty") || prompt.includes("beautiful") || prompt.includes("nice")) return "pretty";
        if (prompt.includes("brand") || prompt.includes("heady") || prompt.includes("themed")) return "branded";
        if (prompt.includes("infographic") || prompt.includes("visual") || prompt.includes("chart")) return "infographic";
        if (prompt.includes("animate") || prompt.includes("motion") || prompt.includes("dynamic")) return "animated";
        if (prompt.includes("report") || prompt.includes("formal") || prompt.includes("executive")) return "report";
        if (prompt.includes("technical") || prompt.includes("spec") || prompt.includes("engineering")) return "technical";
        if (prompt.includes("audience") || prompt.includes("donors") || prompt.includes("board")) return "audience";
        if (prompt.includes("api") || prompt.includes("endpoint")) return "api";
        if (prompt.includes("plain") || prompt.includes("text only")) return "text";
        return "markdown"; // intelligent default
    }

    getStatus() {
        return {
            id: this.id,
            skills: this.skills,
            skillCount: this.skills.length,
            outputFormats: Object.keys(OUTPUT_FORMATS),
            formatCount: Object.keys(OUTPUT_FORMATS).length,
            invocations: this.history.length,
            successRate: this.history.length > 0
                ? this.history.filter(h => h.success).length / this.history.length
                : 1,
        };
    }
}

module.exports = { HeadyBuddyAgent, HEADY_BUDDY_PERSONA, OUTPUT_FORMATS };

