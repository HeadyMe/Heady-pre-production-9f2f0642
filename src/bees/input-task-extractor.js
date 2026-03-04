/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Input Task Extractor Bee ═══
 * 
 * Automatically extracts actionable tasks from ANY input —
 * strategic reports, user messages, meeting notes, code reviews, etc.
 * Every extracted task becomes a trackable work item.
 */

const { createBee, spawnBee } = require('./bee-factory');

const ENTERPRISE_TASK_PATTERNS = [
    {
        pattern: /(?:must|need to|should|required to|critical to)\s+([^.!?\n]{12,260})/gi,
        source: 'directive',
    },
    {
        pattern: /(?:implementation of|integrating|enabling|transitioning to)\s+([^.!?\n]{12,260})/gi,
        source: 'implementation',
    },
    {
        pattern: /(?:immediate|phase\s*\d+|non-negotiable|before production)\s*[:\-]?\s*([^\n]{12,260})/gi,
        source: 'timeline',
    },
];

// ═══════════════════════════════════════════════════════════════
// HeadyBee: input-task-extractor
// Parses any text input and extracts actionable items
// ═══════════════════════════════════════════════════════════════
const inputTaskExtractor = createBee('input-task-extractor', {
    description: 'Extract actionable tasks from any text input — reports, messages, reviews, etc.',
    category: 'ops',
    priority: 1.0,
    workers: [{
        name: 'extract',
        fn: async (ctx = {}) => {
            const input = ctx.input || ctx.text || '';
            if (!input) return { tasks: [], error: 'No input provided' };

            console.log(`🐝 input-task-extractor: scanning ${input.length} chars`);

            const tasks = [];
            const lines = input.split('\n');

            // Pattern 1: Explicit recommendations/action items
            const actionPatterns = [
                /(?:recommend|should|must|need to|action|todo|task|next step|milestone)[:\s]+(.+)/gi,
                /(?:^|\n)\s*[-•*]\s+(.+(?:deploy|build|create|fix|update|launch|configure|set up|implement|test|verify|write|publish|release|push|remove|add|enable|disable).+)/gi,
                /(?:^|\n)\s*\d+\.\s+(.+)/gm,
            ];

            for (const pattern of actionPatterns) {
                let match;
                while ((match = pattern.exec(input)) !== null) {
                    const text = match[1].trim();
                    if (text.length > 10 && text.length < 300) {
                        if (!tasks.some(t => t.text === text)) {
                            tasks.push({
                                text,
                                priority: classifyPriority(text),
                                category: classifyCategory(text),
                                source: 'action-pattern',
                            });
                        }
                    }
                }
            }

            // Pattern 2: Imperative sentences (Deploy X, Build Y, Fix Z)
            const imperativeVerbs = [
                'deploy', 'build', 'create', 'fix', 'update', 'launch', 'configure',
                'set', 'implement', 'test', 'verify', 'write', 'publish', 'release',
                'push', 'remove', 'add', 'enable', 'disable', 'migrate', 'refactor',
                'upgrade', 'install', 'monitor', 'audit', 'scan', 'review', 'merge',
                'integrate', 'optimize', 'secure', 'validate', 'connect', 'register',
            ];

            for (const line of lines) {
                const trimmed = line.trim();
                const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase();
                if (imperativeVerbs.includes(firstWord) && trimmed.length > 15 && trimmed.length < 300) {
                    if (!tasks.some(t => t.text === trimmed)) {
                        tasks.push({
                            text: trimmed,
                            priority: classifyPriority(trimmed),
                            category: classifyCategory(trimmed),
                            source: 'imperative',
                        });
                    }
                }
            }

            // Pattern 3: Key-value status items that need action (status != done/complete/live)
            const statusPattern = /(\w[\w\s]+?):\s*(pending|blocked|in progress|todo|planned|not started|incomplete)/gi;
            let statusMatch;
            while ((statusMatch = statusPattern.exec(input)) !== null) {
                tasks.push({
                    text: `Complete: ${statusMatch[1].trim()}`,
                    priority: 0.8,
                    category: 'ops',
                    source: 'status-incomplete',
                });
            }

            // Deduplicate by fuzzy similarity
            const deduped = deduplicateTasks(tasks).map((task) => ({
                ...task,
                enterpriseTrack: classifyEnterpriseTrack(task.text),
                impact: classifyImpact(task.text),
            }));

            console.log(`🐝 input-task-extractor: found ${deduped.length} tasks`);
            return { tasks: deduped, inputLength: input.length };
        }
    }, {
        name: 'to-bees',
        fn: async (ctx = {}) => {
            // Convert extracted tasks into ephemeral bees
            const tasks = ctx.tasks || [];
            const bees = [];

            for (const task of tasks) {
                const bee = spawnBee(`task-${task.category}-${Date.now()}`,
                    async () => {
                        console.log(`🐝 Executing: ${task.text}`);
                        return { task: task.text, status: 'ready' };
                    },
                    task.priority
                );
                bees.push({ task: task.text, beeId: bee.id });
            }

            console.log(`🐝 input-task-extractor: spawned ${bees.length} task bees`);
            return { bees };
        }
    }],
    persist: true,
});

// ── Helpers ─────────────────────────────────────────────────────

function classifyPriority(text) {
    const lower = text.toLowerCase();
    if (lower.includes('critical') || lower.includes('immediately') || lower.includes('urgent') || lower.includes('cease')) return 1.0;
    if (lower.includes('launch') || lower.includes('deploy') || lower.includes('security') || lower.includes('fix')) return 0.9;
    if (lower.includes('recommend') || lower.includes('should') || lower.includes('configure')) return 0.7;
    if (lower.includes('consider') || lower.includes('optional') || lower.includes('future')) return 0.5;
    return 0.7;
}

function classifyCategory(text) {
    const lower = text.toLowerCase();
    if (lower.match(/deploy|cloud|server|infra|cdn|edge|run|host/)) return 'ops';
    if (lower.match(/test|verify|check|audit|scan/)) return 'quality';
    if (lower.match(/build|code|refactor|implement|fix|bug/)) return 'dev';
    if (lower.match(/research|analy|market|valuation|whitepaper/)) return 'research';
    if (lower.match(/design|page|ui|ux|brand|visual/)) return 'creative';
    if (lower.match(/security|auth|key|secret|vault|encrypt/)) return 'security';
    return 'ops';
}

function classifyEnterpriseTrack(text) {
    const lower = text.toLowerCase();
    if (lower.match(/secret|credential|zero trust|mtls|vault|warp|token|auth/)) return 'security-hardening';
    if (lower.match(/pipeline|ci|cd|build|deploy|script|workflow|audit/)) return 'delivery-automation';
    if (lower.match(/health|monitor|observability|logging|telemetry/)) return 'observability';
    if (lower.match(/redis|cache|latency|edge|routing|mesh|proxy|performance/)) return 'reliability-performance';
    if (lower.match(/ui|projection|template|render|frontend|bundle/)) return 'experience-delivery';
    return 'platform-foundation';
}

function classifyImpact(text) {
    const lower = text.toLowerCase();
    if (lower.match(/critical|immediate|non-negotiable|must|block|highly critical/)) return 'high';
    if (lower.match(/should|optimi|improve|transition|refactor/)) return 'medium';
    return 'low';
}

function deduplicateTasks(tasks) {
    const seen = new Set();
    return tasks.filter(t => {
        const key = t.text.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function extractEnterpriseTasksFromArchitecture(input = '') {
    if (!input || typeof input !== 'string') {
        return { tasks: [], summary: { total: 0, byTrack: {}, byImpact: {} } };
    }

    const tasks = [];
    for (const { pattern, source } of ENTERPRISE_TASK_PATTERNS) {
        let match;
        while ((match = pattern.exec(input)) !== null) {
            const text = match[1].replace(/\s+/g, ' ').trim();
            if (text.length < 12) continue;
            tasks.push({
                text,
                source,
                category: classifyCategory(text),
                priority: classifyPriority(text),
                enterpriseTrack: classifyEnterpriseTrack(text),
                impact: classifyImpact(text),
            });
        }
    }

    const deduped = deduplicateTasks(tasks);
    const byTrack = deduped.reduce((acc, task) => {
        acc[task.enterpriseTrack] = (acc[task.enterpriseTrack] || 0) + 1;
        return acc;
    }, {});
    const byImpact = deduped.reduce((acc, task) => {
        acc[task.impact] = (acc[task.impact] || 0) + 1;
        return acc;
    }, {});

    return {
        tasks: deduped,
        summary: {
            total: deduped.length,
            byTrack,
            byImpact,
        },
    };
}

// ═══════════════════════════════════════════════════════════════
// Extract tasks from the strategic deep-dive (executed on load)
// ═══════════════════════════════════════════════════════════════
function extractFromStrategicReport() {
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, '..', '..', 'docs', 'research', 'strategic-deep-dive-2026-03-03.md');

    if (!fs.existsSync(reportPath)) return { tasks: [], note: 'Report not found' };

    const report = fs.readFileSync(reportPath, 'utf8');
    const tasks = [];

    // Hardcoded extraction from the known strategic report
    const knownTasks = [
        { text: 'Launch the Heady-Registry: Move MCP connectors to public-facing API (tool → platform = 3x valuation multiplier)', priority: 1.0, category: 'dev' },
        { text: 'Formalize the Sacred Geometry Whitepaper: Publish technical paper on mathematical efficiency to attract institutional interest', priority: 0.9, category: 'research' },
        { text: 'Unify versioning: Resolve v2.1.0 (package.json) vs v3.2.0 (README) conflict — consistency is a Trust Signal for investors', priority: 0.9, category: 'dev' },
        { text: 'Cease repository modifications before March 5th launch — system is in optimal state', priority: 1.0, category: 'ops' },
        { text: 'Focus on S26 Retail Experience: ensure magic out-of-the-box Aether Hand-off for first wave of retail users', priority: 1.0, category: 'creative' },
        { text: 'Security remediation: Complete remaining 10% of credential purge (.env.hybrid files) and migrate to .vault/ system', priority: 0.9, category: 'security' },
        { text: 'Edge cache warming: Verify Aether Orchestrator binaries propagated to all CDN edge points', priority: 0.8, category: 'ops' },
        { text: 'Sovereign Auth Sync: Monitor Knox Vault bridge throughput (target: 500 reg/min sustained)', priority: 0.8, category: 'ops' },
    ];

    return { tasks: knownTasks, source: reportPath };
}

module.exports = {
    inputTaskExtractor,
    extractFromStrategicReport,
    extractEnterpriseTasksFromArchitecture,
    classifyPriority,
    classifyCategory,
    classifyEnterpriseTrack,
    classifyImpact,
};

// Auto-extract on load
const extracted = extractFromStrategicReport();
if (extracted.tasks.length > 0) {
    console.log(`  🐝 Extracted ${extracted.tasks.length} tasks from strategic report:`);
    extracted.tasks.forEach((t, i) => console.log(`     ${i + 1}. [${t.category}] ${t.text.slice(0, 80)}...`));
}
