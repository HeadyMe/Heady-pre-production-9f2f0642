/**
 * ─── Patent Concept Registry ──────────────────────────────────
 * 
 * The definitive IP registry for Heady Systems' 50-patent portfolio.
 * Lives in vector memory — queryable by any system component.
 * 
 * Usage:
 *   const patents = require('./patent-concept-registry');
 *   const match = patents.findByDomain('security');
 *   const coverage = patents.getCoverage();
 *   const concept = patents.getByPPA(11);
 * 
 * This module is the KNOWLEDGE layer. It doesn't scan files —
 * it provides structured access to patent concepts already
 * embedded in 3D vector memory.
 * ────────────────────────────────────────────────────────────────
 */

const PHI = 1.6180339887;

// ── All 50 Patent Concepts ──────────────────────────────────────
const PATENT_CONCEPTS = [
    // ── Hardware & Physical Trust ──
    { ppa: 1, name: 'PTACA — Physical Trust-Anchored Continuous Auth', appNum: '63/953,813', domain: 'security', filed: true, status: 'archived', codeRef: 'hc_auth.js' },
    { ppa: 2, name: 'RAAS — Remote Attestation as a Service', appNum: '63/953,840', domain: 'security', filed: true, status: 'missing' },
    { ppa: 3, name: 'SBAA — Safety-Biased Autonomous Auth', appNum: '63/953,846', domain: 'security', filed: true, status: 'missing' },

    // ── Core Platform ──
    { ppa: 4, name: 'SCP — Structured Context Packets', appNum: '63/953,851', domain: 'intelligence', filed: true, status: 'partial', codeRef: 'services/' },
    { ppa: 5, name: 'SBHG — Safety-Biased Human Governance', appNum: '63/953,860', domain: 'governance', filed: true, status: 'missing' },
    { ppa: 6, name: 'VAIW — Versioned AI Workspaces', appNum: '63/953,870', domain: 'intelligence', filed: true, status: 'partial' },
    { ppa: 7, name: 'DataVault — Jurisdictional Data Routing', appNum: '63/953,876', domain: 'security', filed: true, status: 'missing' },
    { ppa: 8, name: 'HeadyNexus — Nexus Variant', appNum: '63/953,882', domain: 'infrastructure', filed: true, status: 'missing' },
    { ppa: 9, name: 'Liquid Runtime Architecture', appNum: '63/965,289', domain: 'liquid-architecture', filed: true, status: 'active', codeRef: 'hc_liquid.js' },
    { ppa: 10, name: 'Trust Zone Mediation', appNum: '63/965,294', domain: 'security', filed: true, status: 'partial' },

    // ── Security & Governance ──
    { ppa: 11, name: 'AI Tool Safety Gateway (Admin Citadel)', appNum: '63/965,304', domain: 'security', filed: true, status: 'archived', codeRef: 'admin-citadel.js' },
    { ppa: 12, name: 'PromptOps Governance', appNum: '63/965,314', domain: 'governance', filed: true, status: 'archived', codeRef: 'heady-autonomy.js' },
    { ppa: 13, name: 'Deterministic Repo Builder', appNum: '63/965,320', domain: 'infrastructure', filed: true, status: 'partial' },
    { ppa: 14, name: 'RAA Execution Fabric', appNum: '63/965,331', domain: 'security', filed: true, status: 'archived', codeRef: 'antigravity-heady-runtime.js' },
    { ppa: 15, name: 'PQC Evidence Chain', appNum: '63/965,335', domain: 'security', filed: true, status: 'archived', codeRef: 'quantum-bridge.js' },
    { ppa: 16, name: 'Tunnel-Only Origin', appNum: '63/965,337', domain: 'infrastructure', filed: true, status: 'archived', codeRef: 'hc_cloudflare.js' },
    { ppa: 17, name: 'Policy Supply Chain', appNum: '63/965,340', domain: 'governance', filed: true, status: 'partial' },

    // ── Creative & Music ──
    { ppa: 18, name: 'HeadySymphony — MIDI Composition', appNum: '63/965,345', domain: 'creative', filed: true, status: 'archived', codeRef: 'cloud-midi-sequencer.js' },

    // ── Specialized ──
    { ppa: 19, name: 'HeadyBio — Ephemeral Pipeline', appNum: '63/965,348', domain: 'data-privacy', filed: true, status: 'missing' },
    { ppa: 20, name: 'HeadyEd — Curriculum Gen', appNum: '63/965,350', domain: 'education', filed: true, status: 'missing' },
    { ppa: 21, name: 'HeadyGuard — Safety Limiter', appNum: '63/965,351', domain: 'security', filed: true, status: 'missing' },
    { ppa: 22, name: 'HeadyArmistice — Kinetic Interlock', appNum: '63/965,354', domain: 'security', filed: true, status: 'archived', codeRef: 'security/' },
    { ppa: 23, name: 'HeadyUI — Dynamic UI Injection', appNum: '63/965,356', domain: 'ux', filed: true, status: 'archived', codeRef: 'digital-presence-orchestrator.js' },
    { ppa: 24, name: 'HeadyLearn — Prompt Heuristic Extraction', appNum: '63/965,359', domain: 'intelligence', filed: true, status: 'archived', codeRef: 'error-sentinel-service.js' },
    { ppa: 25, name: 'HeadyStyle — Taste Vectors', appNum: '63/965,368', domain: 'ux', filed: true, status: 'missing' },
    { ppa: 26, name: 'HeadyStore — Reverse Marketplace', appNum: '63/965,372', domain: 'commerce', filed: true, status: 'archived', codeRef: 'dynamic-connector-service.js' },
    { ppa: 27, name: 'HeadyFest — Real-Time Crowd Telemetry', appNum: '63/965,373', domain: 'events', filed: true, status: 'archived', codeRef: 'monte-carlo-service.js' },

    // ── Agent Governance ──
    { ppa: 28, name: 'HeadyGoose — Autonomous Engineering Agent', appNum: '63/965,377', domain: 'agent-governance', filed: true, status: 'archived', codeRef: 'arena-mode-service.js' },
    { ppa: 29, name: 'HeadyReflect — Cognitive Validation', appNum: '63/965,316', domain: 'metacognition', filed: true, status: 'archived', codeRef: 'heady-principles.js' },
    { ppa: 30, name: 'HeadyConductor — Spectral Phase Alignment', appNum: '63/965,440', domain: 'orchestration', filed: true, status: 'archived', codeRef: 'heady-conductor.js' },

    // ── Advanced Systems ──
    { ppa: 31, name: 'HeadyQA / HeadySpace — Microgravity Stabilization', appNum: '63/965,442', domain: 'space', filed: true, status: 'archived', codeRef: 'octree-manager.js' },
    { ppa: 32, name: 'HeadyTempo — Temporal Opportunity Prediction', appNum: '63/965,451', domain: 'orchestration', filed: true, status: 'archived', codeRef: 'spatial-embedder.js' },
    { ppa: 33, name: 'HeadyMint — Spectral Interference Tuning', appNum: '63/965,450', domain: 'optimization', filed: true, status: 'archived', codeRef: 'heady-bees.js' },
    { ppa: 34, name: 'HeadyPhi — Golden Ratio Orchestration', appNum: '63/965,285', domain: 'sacred-geometry', filed: true, status: 'active', codeRef: 'liquid-colab-services.js' },

    // ── 2026 Filings (HS-2026-006 through HS-2026-010) ──
    { ppa: 'HS-2026-006', name: 'AI Session Replay Engine (DVR)', appNum: '63/995,318', domain: 'ai-forensics', filed: true, status: 'archived', codeRef: 'ai-dvr.js' },
    { ppa: 'HS-2026-007', name: 'Autonomous API Connector Synthesis', appNum: '63/995,320', domain: 'infrastructure', filed: true, status: 'archived', codeRef: 'dynamic-connector-service.js' },
    { ppa: 'HS-2026-008', name: 'Tournament-Based AI Strategy Selection', appNum: '63/995,322', domain: 'intelligence', filed: true, status: 'archived', codeRef: 'arena-mode-service.js' },
    { ppa: 'HS-2026-009', name: 'Liquid Runtime Architecture (Full)', appNum: '63/995,325', domain: 'liquid-architecture', filed: true, status: 'archived', codeRef: 'liquid-unified-runtime.js' },
    { ppa: 'HS-2026-010', name: 'Cross-Device Sync with Phi Heartbeat', appNum: '63/995,330', domain: 'distributed-systems', filed: true, status: 'archived', codeRef: 'cross-device-sync.js' },

    // ── Remaining Filed (35–43) ──
    { ppa: 35, name: 'Balanced Ternary Logic Engine', appNum: '63/965,455', domain: 'core', filed: true, status: 'partial', codeRef: 'ternary-logic.js' },
    { ppa: 36, name: 'Network MIDI 2.0 Protocol', appNum: '63/965,458', domain: 'creative', filed: true, status: 'partial', codeRef: 'network-midi.js' },
    { ppa: 37, name: 'Swarm Intelligence Orchestration', appNum: '63/965,460', domain: 'swarm', filed: true, status: 'active', codeRef: 'bees/registry.js' },
    { ppa: 38, name: '3D Spatial Vector Memory', appNum: '63/965,462', domain: 'memory', filed: true, status: 'active', codeRef: 'vector-memory.js' },

    // ── Next-Gen (unfiled) ──
    { ppa: 43, name: 'HeadyEx — Sovereign Exchange', domain: 'finance', filed: false, status: 'missing' },
    { ppa: 44, name: 'HeadyBet — Prediction Markets', domain: 'finance', filed: false, status: 'missing' },
    { ppa: 45, name: 'HeadyFinance — Autonomous Ledger', domain: 'finance', filed: false, status: 'missing' },
    { ppa: 46, name: 'HeadyBare — Minimalist OS', domain: 'core', filed: false, status: 'missing' },
    { ppa: 47, name: 'HeadyQuantum — Error Correction', domain: 'quantum', filed: false, status: 'missing' },
    { ppa: 48, name: 'HeadyTube — Content Platform', domain: 'media', filed: false, status: 'missing' },
    { ppa: 49, name: 'HeadyHome — Spatial Computing', domain: 'iot', filed: false, status: 'missing' },
    { ppa: 50, name: 'HeadyArchive — Forever Vault', domain: 'storage', filed: false, status: 'missing' },
];

// ── Query Functions ─────────────────────────────────────────────

function getAll() {
    return PATENT_CONCEPTS;
}

function getByPPA(ppa) {
    return PATENT_CONCEPTS.find(p => String(p.ppa) === String(ppa));
}

function findByDomain(domain) {
    return PATENT_CONCEPTS.filter(p => p.domain === domain);
}

function findByStatus(status) {
    return PATENT_CONCEPTS.filter(p => p.status === status);
}

function findByName(keyword) {
    const lower = keyword.toLowerCase();
    return PATENT_CONCEPTS.filter(p => p.name.toLowerCase().includes(lower));
}

function getFiled() {
    return PATENT_CONCEPTS.filter(p => p.filed);
}

function getUnfiled() {
    return PATENT_CONCEPTS.filter(p => !p.filed);
}

// ── Coverage Report ─────────────────────────────────────────────

function getCoverage() {
    const total = PATENT_CONCEPTS.length;
    const filed = PATENT_CONCEPTS.filter(p => p.filed).length;
    const active = PATENT_CONCEPTS.filter(p => p.status === 'active').length;
    const archived = PATENT_CONCEPTS.filter(p => p.status === 'archived').length;
    const partial = PATENT_CONCEPTS.filter(p => p.status === 'partial').length;
    const missing = PATENT_CONCEPTS.filter(p => p.status === 'missing').length;

    const domains = new Map();
    for (const p of PATENT_CONCEPTS) {
        if (!domains.has(p.domain)) domains.set(p.domain, { total: 0, active: 0, archived: 0 });
        const d = domains.get(p.domain);
        d.total++;
        if (p.status === 'active') d.active++;
        if (p.status === 'archived') d.archived++;
    }

    return {
        total,
        filed,
        unfiled: total - filed,
        active,
        archived,
        partial,
        missing,
        coveragePercent: +((active / total) * 100).toFixed(1),
        embeddedPercent: +(((active + archived) / total) * 100).toFixed(1),
        domains: Object.fromEntries(domains),
    };
}

// ── Vector Memory Integration ───────────────────────────────────

/**
 * Verify all patents are embedded in vector memory.
 * Returns { embedded, missing } counts.
 */
async function verifyVectorPresence(vectorMemory) {
    if (!vectorMemory || !vectorMemory.queryMemory) {
        return { embedded: 0, missing: PATENT_CONCEPTS.length, error: 'no vector memory' };
    }

    let embedded = 0;
    let missing = 0;
    const missingPatents = [];

    for (const patent of PATENT_CONCEPTS.filter(p => p.filed)) {
        try {
            const results = await vectorMemory.queryMemory({
                query: patent.name,
                topK: 1,
            });
            if (results && results.length > 0 && results[0].score > 0.001) {
                embedded++;
            } else {
                missing++;
                missingPatents.push(patent.name);
            }
        } catch {
            missing++;
            missingPatents.push(patent.name);
        }
    }

    return { embedded, missing, missingPatents };
}

// ── Express Routes ──────────────────────────────────────────────

function registerRoutes(app) {
    app.get('/api/patents', (req, res) => {
        res.json({ ok: true, patents: getAll() });
    });

    app.get('/api/patents/coverage', (req, res) => {
        res.json({ ok: true, ...getCoverage() });
    });

    app.get('/api/patents/domain/:domain', (req, res) => {
        res.json({ ok: true, patents: findByDomain(req.params.domain) });
    });

    app.get('/api/patents/:ppa', (req, res) => {
        const patent = getByPPA(req.params.ppa);
        if (!patent) return res.status(404).json({ error: 'patent not found' });
        res.json({ ok: true, patent });
    });
}

module.exports = {
    PATENT_CONCEPTS,
    getAll,
    getByPPA,
    findByDomain,
    findByStatus,
    findByName,
    getFiled,
    getUnfiled,
    getCoverage,
    verifyVectorPresence,
    registerRoutes,
};
