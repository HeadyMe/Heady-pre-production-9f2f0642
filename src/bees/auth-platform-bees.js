/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Auth Flow Bee ═══
 *
 * Delivers the auth page experience through HeadyBees dispatched
 * from 3D vector space. Auth events (signup, login, tier change)
 * are ingested as vectors for semantic querying and pattern detection.
 *
 * ═══ Platform Onboarding Analyzer Bee ═══
 *
 * Analyzes which platforms make Heady easiest to onboard for
 * developers, using vector similarity to match platform capabilities
 * against Heady's requirements.
 */

const { createBee } = require('./bee-factory');
const vectorMemory = require('../vector-memory');

// ═══════════════════════════════════════════════════════════════
// HeadyBee: auth-flow
// Delivers auth experience through 3D vector space
// ═══════════════════════════════════════════════════════════════
const authFlowBee = createBee('auth-flow', {
    description: 'Auth page delivery and event tracking via 3D vector space',
    category: 'ops',
    priority: 1.0,
    workers: [{
        name: 'serve',
        fn: async (ctx = {}) => {
            // Serve auth page — the actual server lives in auth-page-server.js
            // This bee orchestrates it from vector space
            const authServer = require('../core/auth-page-server');
            console.log('🐝 auth-flow: serving auth page from vector space');

            // Ingest the auth flow configuration into vector memory
            await vectorMemory.ingestMemory({
                content: `Auth flow configuration: 5 tiers (Spark Free, Glow $9, Blaze $29, Nova $79, Sovereign $199), PBKDF2 hashing, HY- prefixed API keys, session tokens. Port 3847.`,
                metadata: {
                    type: 'auth-config',
                    domain: 'auth-flow',
                    beeId: 'auth-flow',
                    timestamp: Date.now(),
                },
            });

            return { status: 'serving', port: 3847, tiers: 5 };
        }
    }, {
        name: 'track-event',
        fn: async (ctx = {}) => {
            // Track auth events as vectors in 3D space
            const event = ctx.event || 'unknown'; // signup, login, tier-upgrade
            const email = ctx.email || 'anonymous';
            const tier = ctx.tier || 'spark';

            console.log(`🐝 auth-flow: tracking ${event} for ${email} (${tier})`);

            await vectorMemory.ingestMemory({
                content: `Auth event: ${event} by ${email} at tier ${tier}. Timestamp: ${new Date().toISOString()}`,
                metadata: {
                    type: 'auth-event',
                    event,
                    email,
                    tier,
                    domain: 'auth-flow',
                    timestamp: Date.now(),
                },
            });

            return { tracked: true, event, email, tier };
        }
    }, {
        name: 'query-patterns',
        fn: async (ctx = {}) => {
            // Query auth event patterns from vector space
            const query = ctx.query || 'auth signup login patterns';
            console.log(`🐝 auth-flow: querying auth patterns: "${query}"`);

            const results = await vectorMemory.queryMemory(query, ctx.topK || 10, {
                type: 'auth-event',
            });

            return { query, matches: results?.length || 0, results };
        }
    }],
    persist: true,
});

// ═══════════════════════════════════════════════════════════════
// HeadyBee: platform-onboarding-analyzer
// Analyzes best platforms for easy Heady onboarding
// ═══════════════════════════════════════════════════════════════
const platformOnboardingAnalyzer = createBee('platform-onboarding-analyzer', {
    description: 'Analyze platforms for easy Heady developer onboarding, dispatched from 3D vector space',
    category: 'research',
    priority: 0.9,
    workers: [{
        name: 'analyze',
        fn: async (ctx = {}) => {
            console.log('🐝 platform-onboarding-analyzer: analyzing onboarding platforms');

            // Platform analysis — which platforms make Heady easiest to adopt
            const platforms = [
                {
                    name: 'npm Registry',
                    onboardingSteps: 1,
                    command: 'npm install heady-sdk',
                    reach: 'Massive — every JS developer',
                    friction: 'Very Low — familiar workflow',
                    strengths: [
                        'One-command install',
                        'Auto-discovery via search',
                        'Version management built-in',
                        'README renders as docs',
                    ],
                    weaknesses: ['No hosted runtime', 'User must run locally'],
                    score: 9.2,
                    verdict: 'PRIMARY — publish heady-sdk and heady-cli to npm immediately',
                },
                {
                    name: 'VS Code / Cursor Marketplace',
                    onboardingSteps: 1,
                    command: 'Install extension → auto-configures MCP',
                    reach: 'Huge — every Cursor/VS Code user',
                    friction: 'Very Low — one click install',
                    strengths: [
                        'One-click install from marketplace',
                        'MCP auto-configuration',
                        'In-editor experience',
                        'Heady tools appear natively',
                    ],
                    weaknesses: ['Extension review process', 'Platform lock-in'],
                    score: 9.5,
                    verdict: 'HIGHEST PRIORITY — IDE extension is the killer distribution channel',
                },
                {
                    name: 'Hugging Face Spaces',
                    onboardingSteps: 0,
                    command: 'Visit space → instant demo',
                    reach: 'AI/ML community',
                    friction: 'Zero — browser-only',
                    strengths: [
                        'Zero install — browser only',
                        'Already have 3 spaces live',
                        'GPU runtime available',
                        'Community discovery',
                    ],
                    weaknesses: ['Limited to demo mode', 'No persistent state'],
                    score: 8.5,
                    verdict: 'GREAT for demos and AI community reach, already deployed',
                },
                {
                    name: 'Docker Hub',
                    onboardingSteps: 2,
                    command: 'docker pull headyme/heady && docker run',
                    reach: 'DevOps and server-side developers',
                    friction: 'Low — if Docker is installed',
                    strengths: [
                        'Self-contained runtime',
                        'Works anywhere Docker runs',
                        'Consistent environment',
                        'Easy for teams',
                    ],
                    weaknesses: ['Requires Docker', 'Heavier than npm'],
                    score: 8.0,
                    verdict: 'SOLID for enterprise and team deployments',
                },
                {
                    name: 'GitHub Marketplace / Actions',
                    onboardingSteps: 2,
                    command: 'Add to workflow YAML → runs on every push',
                    reach: 'Every GitHub user',
                    friction: 'Low — YAML one-liner',
                    strengths: [
                        'CI/CD integration',
                        'Automated on every push',
                        'GitHub native',
                        'Team-wide adoption',
                    ],
                    weaknesses: ['CI-only context', 'Not interactive'],
                    score: 7.5,
                    verdict: 'GOOD for automated workflows, not for interactive use',
                },
                {
                    name: 'MCP Registry (smithery.ai / glama.ai)',
                    onboardingSteps: 1,
                    command: 'Add server URL → all 43 tools available',
                    reach: 'MCP-aware AI assistants',
                    friction: 'Very Low — just add URL',
                    strengths: [
                        'Direct MCP integration',
                        'All 43 tools instantly available',
                        'Works with Claude, Cursor, Windsurf',
                        'No SDK needed — protocol-native',
                    ],
                    weaknesses: ['MCP ecosystem still early', 'Discovery limited'],
                    score: 9.0,
                    verdict: 'CRITICAL — register on smithery.ai and glama.ai for MCP discoverability',
                },
                {
                    name: 'Google Cloud Marketplace',
                    onboardingSteps: 3,
                    command: 'Deploy to Cloud Run → one-click',
                    reach: 'Enterprise GCP customers',
                    friction: 'Medium — requires GCP account',
                    strengths: [
                        'Enterprise credibility',
                        'One-click deploy to Cloud Run',
                        'Billing integration',
                        'Already running on GCP',
                    ],
                    weaknesses: ['Lengthy review process', 'GCP lock-in'],
                    score: 7.0,
                    verdict: 'FUTURE — pursue after product-market fit established',
                },
            ];

            // Sort by score
            platforms.sort((a, b) => b.score - a.score);

            // Ingest analysis into vector space for future recall
            for (const p of platforms) {
                await vectorMemory.ingestMemory({
                    content: `Onboarding platform analysis: ${p.name} (score: ${p.score}/10). Install: "${p.command}". Verdict: ${p.verdict}. Strengths: ${p.strengths.join(', ')}. Weaknesses: ${p.weaknesses.join(', ')}.`,
                    metadata: {
                        type: 'platform-analysis',
                        platform: p.name,
                        score: p.score,
                        domain: 'platform-onboarding',
                        timestamp: Date.now(),
                    },
                });
            }

            console.log(`🐝 platform-onboarding-analyzer: analyzed ${platforms.length} platforms, ingested into vector space`);

            // Priority action plan
            const actionPlan = [
                { priority: 1, action: 'Publish VS Code/Cursor extension to marketplace', platform: 'VS Code / Cursor Marketplace', score: 9.5 },
                { priority: 2, action: 'Publish heady-sdk and heady-cli to npm', platform: 'npm Registry', score: 9.2 },
                { priority: 3, action: 'Register on smithery.ai and glama.ai MCP registries', platform: 'MCP Registry', score: 9.0 },
                { priority: 4, action: 'Enhance existing Hugging Face Spaces with interactive demos', platform: 'Hugging Face Spaces', score: 8.5 },
                { priority: 5, action: 'Push heady Docker image to Docker Hub', platform: 'Docker Hub', score: 8.0 },
            ];

            return { platforms, actionPlan, totalAnalyzed: platforms.length };
        }
    }, {
        name: 'recommend',
        fn: async (ctx = {}) => {
            // Query vector space for platform analysis
            const query = ctx.query || 'easiest platform to onboard developers to Heady';
            console.log(`🐝 platform-onboarding-analyzer: querying: "${query}"`);

            const results = await vectorMemory.queryMemory(query, 5, {
                type: 'platform-analysis',
            });

            return { query, recommendations: results };
        }
    }],
    persist: true,
});

module.exports = {
    authFlowBee,
    platformOnboardingAnalyzer,
};

console.log('  🐝 Loaded auth-flow + platform-onboarding-analyzer bees (3D vector space dispatch)');
