#!/usr/bin/env node
/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Strategic Report Embedder & Task Projector ═══
 *
 * Embeds the strategic report into 3D vector memory,
 * runs the input-task-extractor against it, builds
 * injectable templates, and projects the results outward.
 *
 * Usage:  node scripts/embed-strategic-report.js [path-to-report]
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ── Load vector memory ──────────────────────────────────────────
const vm = require('../src/vector-memory');
const embedder = require('../src/services/continuous-embedder');
const { inputTaskExtractor, extractEnterpriseTasksFromArchitecture } = require('../src/bees/input-task-extractor');

const ROOT = path.resolve(__dirname, '..');

// ── Resolve report path ─────────────────────────────────────────
const reportArg = process.argv[2];
const defaultReportPaths = [
    path.join(ROOT, 'docs', 'strategic', 'valuation-report-2026-03-04.md'),
    path.join(ROOT, 'docs', 'strategic', 'operational-masterclass.md'),
    path.join(ROOT, 'docs', 'research', 'strategic-deep-dive-2026-03-03.md'),
];

async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  🐝 HEADY STRATEGIC REPORT EMBEDDER & PROJECTOR');
    console.log('═══════════════════════════════════════════════════════\n');

    // ── 1. Init vector memory ───────────────────────────────────
    console.log('1️⃣  Initializing 3D vector memory...');
    vm.init();
    const vmStats = vm.getStats();
    console.log(`   ✅ Vector memory online — ${vmStats.totalVectors || 0} existing vectors, ${vmStats.shardCount || 0} shards`);

    // ── 2. Start continuous embedder ────────────────────────────
    console.log('\n2️⃣  Starting continuous embedder (RAM-first)...');
    embedder.start(vm);
    const embedStats = embedder.getStats();
    console.log(`   ✅ Continuous embedder active — queue: ${embedStats.queueLength || 0}`);

    // ── 3. Locate & read file(s) to embed ───────────────────────
    const sources = [];
    if (reportArg && fs.existsSync(reportArg)) {
        sources.push(reportArg);
    }
    for (const p of defaultReportPaths) {
        if (fs.existsSync(p) && !sources.includes(p)) {
            sources.push(p);
        }
    }

    // Also accept piped stdin content
    let stdinContent = '';
    if (!process.stdin.isTTY) {
        stdinContent = fs.readFileSync(0, 'utf8');
    }

    if (sources.length === 0 && !stdinContent) {
        console.log('   ⚠️  No report files found — embedding inline strategic content...');
        stdinContent = generateInlineStrategicContent();
    }

    // ── 4. Chunk & embed each source ────────────────────────────
    console.log('\n3️⃣  Embedding strategic content into 3D vector space...');

    let totalChunks = 0;
    let totalTasks = 0;
    const allTasks = [];

    for (const src of sources) {
        const content = fs.readFileSync(src, 'utf8');
        const basename = path.basename(src);
        console.log(`\n   📄 ${basename} (${content.length.toLocaleString()} chars)`);

        const chunks = chunkContent(content, 1800);
        console.log(`      → ${chunks.length} chunks`);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const meta = {
                source: basename,
                type: 'strategic-report',
                chunkIndex: i,
                totalChunks: chunks.length,
                domain: 'enterprise-architecture',
            };

            // Ingest via continuous embedder (RAM-first path)
            const result = await embedder.ingest(chunk, meta);
            if (result.ok) totalChunks++;
        }

        // Run task extractor on this source
        const extracted = extractEnterpriseTasksFromArchitecture(content);
        allTasks.push(...extracted.tasks);
        totalTasks += extracted.tasks.length;
        console.log(`      → ${extracted.tasks.length} enterprise tasks extracted`);
    }

    if (stdinContent) {
        console.log(`\n   📋 Stdin content (${stdinContent.length.toLocaleString()} chars)`);
        const chunks = chunkContent(stdinContent, 1800);
        for (let i = 0; i < chunks.length; i++) {
            await embedder.ingest(chunks[i], {
                source: 'stdin',
                type: 'strategic-report',
                chunkIndex: i,
                totalChunks: chunks.length,
                domain: 'enterprise-architecture',
            });
            totalChunks++;
        }
        const extracted = extractEnterpriseTasksFromArchitecture(stdinContent);
        allTasks.push(...extracted.tasks);
        totalTasks += extracted.tasks.length;
        console.log(`      → ${extracted.tasks.length} enterprise tasks extracted`);
    }

    // Also run the full bee extractor
    if (sources.length > 0 || stdinContent) {
        const fullText = sources.map(s => fs.readFileSync(s, 'utf8')).join('\n') + '\n' + stdinContent;
        try {
            const beeResult = await inputTaskExtractor.workers[0].fn({ input: fullText });
            if (beeResult.tasks) {
                const newTasks = beeResult.tasks.filter(t =>
                    !allTasks.some(at => at.text.toLowerCase().slice(0, 40) === t.text.toLowerCase().slice(0, 40))
                );
                allTasks.push(...newTasks);
                console.log(`\n   🐝 Bee extractor found ${beeResult.tasks.length} additional tasks (${newTasks.length} unique)`);
            }
        } catch (err) {
            console.log(`   ⚠️  Bee extractor error: ${err.message}`);
        }
    }

    // ── 5. Flush the embed queue ────────────────────────────────
    console.log('\n4️⃣  Flushing embed queue to vector memory...');
    // Force a batch process
    const preFlush = embedder.getStats();
    console.log(`   Queue before flush: ${preFlush.queueLength || 0}`);
    // Give the embedder time to process
    await new Promise(r => setTimeout(r, 2000));
    const postFlush = embedder.getStats();
    console.log(`   Queue after flush: ${postFlush.queueLength || 0}`);
    console.log(`   Total chunks embedded: ${totalChunks}`);

    // ── 6. Build projections ────────────────────────────────────
    console.log('\n5️⃣  Building outbound projections...');
    const outbound = vm.buildOutboundRepresentation({
        channel: 'strategic',
        topK: 20,
    });
    console.log(`   ✅ Outbound projection built:`);
    console.log(`      Architecture: ${outbound.architecture}`);
    console.log(`      Total vectors: ${outbound.total_vectors}`);
    console.log(`      Active zones: ${outbound.active_zones}`);
    console.log(`      Sample size: ${outbound.sample?.length || 0}`);

    // ── 7. Build injectable templates ───────────────────────────
    console.log('\n6️⃣  Building injectable HeadyBee/HeadySwarm templates...');
    const templates = await embedder.buildInjectableTemplates({
        topK: 15,
        channel: 'strategic',
    });
    console.log(`   ✅ Templates generated: ${templates.templateCount || 0}`);
    console.log(`   Profile: ${templates.profile || 'default'}`);

    // ── 8. Build live context snapshot ───────────────────────────
    console.log('\n7️⃣  Building live context snapshot...');
    const snapshot = embedder.buildLiveContextSnapshot();
    console.log(`   ✅ Context snapshot:`);
    console.log(`      RAM hash: ${snapshot.ramStateHash || 'n/a'}`);
    console.log(`      Ingested total: ${snapshot.stats?.ingestedTotal || 0}`);
    console.log(`      Queue length: ${snapshot.stats?.queueLength || 0}`);

    // ── 9. Classify & summarize tasks ───────────────────────────
    console.log('\n8️⃣  Task Extraction Summary:');
    console.log(`   Total tasks: ${allTasks.length}`);

    const byTrack = {};
    const byImpact = {};
    const byCategory = {};
    for (const t of allTasks) {
        byTrack[t.enterpriseTrack || 'platform-foundation'] = (byTrack[t.enterpriseTrack || 'platform-foundation'] || 0) + 1;
        byImpact[t.impact || 'medium'] = (byImpact[t.impact || 'medium'] || 0) + 1;
        byCategory[t.category || 'ops'] = (byCategory[t.category || 'ops'] || 0) + 1;
    }

    console.log('   By Track:');
    Object.entries(byTrack).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`      ${k}: ${v}`));
    console.log('   By Impact:');
    Object.entries(byImpact).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`      ${k}: ${v}`));
    console.log('   By Category:');
    Object.entries(byCategory).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`      ${k}: ${v}`));

    // ── 10. Project task extraction results to file ─────────────
    const extractionReport = {
        generatedAt: new Date().toISOString(),
        sources: sources.map(s => path.basename(s)),
        totalChunksEmbedded: totalChunks,
        vectorStats: {
            totalVectors: outbound.total_vectors,
            activeZones: outbound.active_zones,
            architecture: outbound.architecture,
        },
        taskSummary: {
            total: allTasks.length,
            byTrack,
            byImpact,
            byCategory,
        },
        tasks: allTasks.slice(0, 100).map((t, i) => ({
            rank: i + 1,
            text: t.text,
            priority: t.priority,
            category: t.category,
            track: t.enterpriseTrack,
            impact: t.impact,
            source: t.source,
        })),
        templates: {
            count: templates.templateCount || 0,
            profile: templates.profile,
        },
        contextSnapshot: {
            ramHash: snapshot.ramStateHash,
            ingestedTotal: snapshot.stats?.ingestedTotal || 0,
        },
    };

    // Project to docs
    const outDir = path.join(ROOT, 'docs', 'strategic');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const jsonPath = path.join(outDir, 'enterprise-task-extraction.json');
    fs.writeFileSync(jsonPath, JSON.stringify(extractionReport, null, 2));
    console.log(`\n9️⃣  Projected to: ${path.relative(ROOT, jsonPath)}`);

    // Also project a markdown summary
    const mdLines = [
        '# Enterprise Task Extraction Report',
        `> Generated: ${extractionReport.generatedAt}`,
        `> Sources: ${extractionReport.sources.join(', ') || 'inline'}`,
        `> Chunks Embedded: ${totalChunks} | Vectors: ${outbound.total_vectors} | Zones: ${outbound.active_zones}`,
        '',
        '## Summary',
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Total Tasks | ${allTasks.length} |`,
        ...Object.entries(byTrack).map(([k, v]) => `| Track: ${k} | ${v} |`),
        ...Object.entries(byImpact).map(([k, v]) => `| Impact: ${k} | ${v} |`),
        '',
        '## Top Tasks',
        '',
    ];
    for (const t of allTasks.slice(0, 50)) {
        mdLines.push(`- **[${t.impact || '?'}]** [${t.category || '?'}] ${t.text.slice(0, 200)}`);
    }
    const mdPath = path.join(outDir, 'ENTERPRISE_TASK_EXTRACTION.md');
    fs.writeFileSync(mdPath, mdLines.join('\n'));
    console.log(`   Projected to: ${path.relative(ROOT, mdPath)}`);

    // ── 11. Embed the extraction results back into memory ───────
    console.log('\n🔟  Embedding extraction results back into vector memory (meta-embedding)...');
    await embedder.ingest(JSON.stringify(extractionReport.taskSummary), {
        type: 'task-extraction-summary',
        source: 'embed-strategic-report',
        domain: 'meta',
    });
    console.log('   ✅ Meta-embedding complete');

    // ── Done ────────────────────────────────────────────────────
    embedder.stop();
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`  ✅ EMBEDDING & PROJECTION COMPLETE`);
    console.log(`     ${totalChunks} chunks → vector memory`);
    console.log(`     ${allTasks.length} tasks extracted`);
    console.log(`     ${templates.templateCount || 0} injectable templates built`);
    console.log(`     ${outbound.active_zones} active 3D zones`);
    console.log('═══════════════════════════════════════════════════════');

    process.exit(0);
}

// ── Helpers ─────────────────────────────────────────────────────

function chunkContent(text, maxLen = 1800) {
    const paragraphs = text.split(/\n\n+/);
    const chunks = [];
    let current = '';

    for (const para of paragraphs) {
        if ((current + '\n\n' + para).length > maxLen && current.length > 0) {
            chunks.push(current.trim());
            current = para;
        } else {
            current += (current ? '\n\n' : '') + para;
        }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
}

function generateInlineStrategicContent() {
    // Fallback: embed core architectural concepts
    return `
HeadyMe Operational Masterclass: Multi-Agent Orchestration & Buddy Integration

The HeadyMe system relies on a Sacred Geometry topology — a hierarchical, non-linear routing framework
where intelligence is distributed across specialized nodes. Buddy acts as the primary User-Interface Agent,
serving as the gateway between the user's dynamic UI and the deeper orchestration layers.

Core Components:
- Orchestrator (heady-manager.js refactored): Central hub mapping user intent onto the geometric agent grid
- Buddy Agent: Persistent, casual yet technically rigorous assistant for UI events and context management
- 3D Vector Workspace: Persistent high-dimensional storage layer with vectorized user data for RAG
- Verification Agents: Adversarial nodes confirming outputs before state changes are committed

The system must implement:
1. Token-based access using MCP to pass JWT-signed user identifiers across agent boundaries
2. WebSocket optimization with Redis Pub/Sub for real-time UI updates
3. Pre-Processor Agent for input sanitization and intent categorization
4. Three-step verification: Execution Audit, Integrity Check, Final Confirmation

Dynamic Build Liquid Architecture:
- Template injection from 3D vector space into reality
- HeadyBees: Atomic single-purpose functions deployed dynamically
- HeadySwarms: Complex multi-agent orchestration groups
- Cross-device widget syncing to user's persistent storage and 3D vector workspaces
- Autonomous pruning of stale projections and unused files

HeadyOS Six-Layer Architecture:
- L1 Edge: Cloudflare Workers, KV Cache, Vectorize
- L2 Gateway: Liquid Gateway with provider racing and budget guards
- L3 Orchestration: Service conductor, task decomposition, workflow routing
- L4 Intelligence: Multi-provider AI, quality scoring, adversarial battle validation
- L5 Service Mesh: Health monitoring, mTLS security, auto-scaling
- L6 Persistence: 3D Vector Memory, Knowledge Vault, Embedding Store

IP Strategy:
- Liquid Gateway Provider Racing Protocol (utility patent)
- HCFP Battle Validation Protocol (method patent)
- Swarm-to-Creative Context Handoff (design/utility hybrid patent)
`;
}

main().catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
});
