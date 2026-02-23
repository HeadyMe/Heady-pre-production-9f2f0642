/**
 * Heady PWA Manifest Generator
 * Creates per-vertical manifest.json files for "Add to Home Screen" installation
 * Run: node scripts/generate-pwa-manifests.js
 */

const fs = require('fs');
const path = require('path');

const VERTICALS = [
    { id: 'headyme', name: 'HeadyMe', short: 'HeadyMe', desc: 'Your AI-powered personal hub — intelligence, personal, always learning.', color: '#8b5cf6', icon: '🏠' },
    { id: 'headysystems', name: 'HeadySystems', short: 'Systems', desc: 'System architecture intelligence — monitoring, optimization, infrastructure.', color: '#06b6d4', icon: '⚙️' },
    { id: 'headyconnection', name: 'HeadyConnection', short: 'Connection', desc: 'Technology for human connection — social, community, collaboration.', color: '#ec4899', icon: '🤝' },
    { id: 'headymcp', name: 'HeadyMCP', short: 'MCP', desc: 'Model Context Protocol hub — 30+ tools, universal AI integration.', color: '#f59e0b', icon: '🔧' },
    { id: 'headyio', name: 'HeadyIO', short: 'IO SDK', desc: 'Developer platform & Hive SDK — build with 40+ AI services.', color: '#6366f1', icon: '⬡' },
    { id: 'headybuddy', name: 'HeadyBuddy', short: 'Buddy', desc: 'Your ultimate AI companion — chat, learn, create across all devices.', color: '#7c3aed', icon: '🤖' },
    { id: 'headybot', name: 'HeadyBot', short: 'Bot', desc: 'AI automation engine — bots, workflows, scheduled intelligence.', color: '#10b981', icon: '🤖' },
    { id: 'headycreator', name: 'HeadyCreator', short: 'Creator', desc: 'AI creative studio — 12 models, design, remix, generate.', color: '#ec4899', icon: '🎨' },
    { id: 'headymusic', name: 'HeadyMusic', short: 'Music', desc: 'AI music creation — compose, mix, master, publish.', color: '#f43f5e', icon: '🎵' },
    { id: 'headytube', name: 'HeadyTube', short: 'Tube', desc: 'AI video platform — create, edit, stream, share.', color: '#ef4444', icon: '📹' },
    { id: 'headycloud', name: 'HeadyCloud', short: 'Cloud', desc: 'Cloud infrastructure — storage, compute, deploy.', color: '#3b82f6', icon: '☁️' },
    { id: 'headylearn', name: 'HeadyLearn', short: 'Learn', desc: 'AI learning platform — courses, tutoring, knowledge.', color: '#14b8a6', icon: '📚' },
    { id: 'headystore', name: 'HeadyStore', short: 'Store', desc: 'AI marketplace — apps, plugins, models, assets.', color: '#a855f7', icon: '🏪' },
    { id: 'headystudio', name: 'HeadyStudio', short: 'Studio', desc: 'Production studio — audio, video, animation.', color: '#f97316', icon: '🎬' },
    { id: 'headyagent', name: 'HeadyAgent', short: 'Agent', desc: 'Autonomous AI agents — task execution, reasoning, planning.', color: '#22c55e', icon: '🤖' },
    { id: 'headydata', name: 'HeadyData', short: 'Data', desc: 'Data intelligence — analytics, visualization, insights.', color: '#0ea5e9', icon: '📊' },
    { id: 'headyapi', name: 'HeadyAPI', short: 'API', desc: 'Public API portal — docs, keys, playground, SDK.', color: '#8b5cf6', icon: '🔌' },
];

const outDir = path.join(__dirname, '..', 'public', 'manifests');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let count = 0;
for (const v of VERTICALS) {
    const manifest = {
        name: v.name,
        short_name: v.short,
        description: v.desc,
        start_url: `/v/${v.id}?source=pwa`,
        display: 'standalone',
        orientation: 'any',
        background_color: '#0a0a1a',
        theme_color: v.color,
        categories: ['productivity', 'utilities', 'personalization'],
        icons: [
            { src: '/heady-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: '/heady-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        screenshots: [],
        prefer_related_applications: false,
        related_applications: [],
        scope: '/',
        lang: 'en',
        dir: 'ltr',
    };
    fs.writeFileSync(path.join(outDir, `${v.id}.json`), JSON.stringify(manifest, null, 2));
    count++;
}

console.log(`✅ Generated ${count} PWA manifests in public/manifests/`);
