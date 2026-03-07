// ══════════════════════════════════════════════════════════════════
// HeadyBuddy Widget — Context-Aware AI Assistant for Heady Ecosystem
// Drop this script on any Heady site for an instant floating assistant.
// ══════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    // ── Context Engine ──────────────────────────────────────────
    const SERVICES = {
        headysystems: {
            name: 'HeadySystems', tagline: 'The Architecture of Intelligence',
            color: '#3b82f6', url: 'https://headysystems.com', icon: '🏗️',
            greeting: "You're on HeadySystems — the foundational backbone of the Heady ecosystem. I can help with system orchestration, HCFP policies, security, and infrastructure.",
            tips: ['View all 6 services and their status', 'Check HCFP auto-success policies', "Explore the Metatron's Cube architecture", 'Review system orchestration details'],
            chips: ['System Status', 'HCFP Policies', 'Service Mesh', 'Architecture'],
            knowledge: {
                'system status': 'All 6 Heady services are currently online: HeadySystems, HeadyMe, HeadyConnection, HeadyIO, HeadyBuddy, and HeadyMCP. HCFP is running in full-auto mode with zero violations.',
                'hcfp': 'HCFP (Heady Core Functionality Platform) manages auto-success policies, production domain enforcement, and the HeadyBattle interceptor. It currently runs in PRODUCTION_DOMAINS_ONLY mode with zero_headysystems.com policy enforced.',
                'service mesh': "HeadySystems orchestrates a cross-domain service mesh connecting all 6 Heady services. It uses Nginx reverse proxy, Cloudflare Workers, and WARP tunnel encryption for zero-trust architecture.",
                'architecture': "HeadySystems is built on the Metatron's Cube Sacred Geometry pattern — 13 interconnected nodes representing balanced, fault-tolerant system design. Each node maps to a service endpoint.",
                'security': 'Security features include: WARP tunnel encryption, zero-trust architecture, HeadyBattle interceptor engine, real-time health monitoring, and production-only domain policies.'
            }
        },
        headyme: {
            name: 'HeadyMe', tagline: 'Your Personal AI Companion',
            color: '#d97706', url: 'https://headyme.com', icon: '🧠',
            greeting: "Welcome to HeadyMe — your personal AI companion. I can help you personalize your experience, manage preferences, and explore your identity within the Heady ecosystem.",
            tips: ['Personalize your AI preferences', 'Review your interaction history', 'Customize notification settings', 'Explore identity & privacy controls'],
            chips: ['My Profile', 'Preferences', 'Privacy', 'History'],
            knowledge: {
                'profile': 'HeadyMe stores your personal AI profile — your preferences, interaction patterns, and customized settings. Your profile syncs across all Heady services for a personalized experience.',
                'preferences': 'You can customize notification frequency, AI response style, theme preferences, and which Heady services you interact with most. All settings sync via HeadyIO.',
                'privacy': 'HeadyMe implements privacy-first design. Your data stays within the Heady ecosystem, encrypted at rest and in transit. You control what personal information is shared across services.',
                'history': 'Your interaction history is stored securely and used to improve AI responses. You can view, export, or clear your history at any time.',
                'flower of life': "HeadyMe is built on the Flower of Life Sacred Geometry pattern — representing the interconnected nature of personal growth and universal intelligence."
            }
        },
        headyconnection: {
            name: 'HeadyConnection', tagline: 'The Social Intelligence Layer',
            color: '#8b5cf6', url: 'https://headyconnection.org', icon: '🔗',
            greeting: "You're at HeadyConnection — the social intelligence layer. I can help with collaboration tools, knowledge graphs, and community connections.",
            tips: ['Discover collaboration tools', 'Browse the knowledge graph', 'Explore Sri Yantra network topology', 'Connect with ecosystem services'],
            chips: ['Collaborate', 'Knowledge Graph', 'Network', 'Connect'],
            knowledge: {
                'collaboration': 'HeadyConnection provides real-time collaboration tools for teams working within the Heady ecosystem. Share insights, coordinate projects, and build knowledge together.',
                'knowledge graph': 'The knowledge graph maps relationships between concepts, services, and users across the entire Heady ecosystem. It grows organically as you interact with Heady services.',
                'network': "HeadyConnection uses Sri Yantra Sacred Geometry to model network topology — nested triangles representing the harmonic intersection of different intelligence layers.",
                'community': 'Connect with other users, share discoveries, and learn from the community. HeadyConnection bridges the gap between individual AI and collective intelligence.'
            }
        },
        headyio: {
            name: 'HeadyIO', tagline: 'The Intelligence Gateway',
            color: '#06b6d4', url: 'https://headyio.com', icon: '⚡',
            greeting: "You're on HeadyIO — the data orchestration gateway. I can help with data pipelines, API management, webhooks, and real-time integrations.",
            tips: ['Configure data pipelines', 'Monitor API gateway traffic', 'Set up webhook integrations', 'Review real-time data flows'],
            chips: ['Pipelines', 'API Gateway', 'Webhooks', 'Data Flow'],
            knowledge: {
                'pipelines': 'HeadyIO manages data pipelines that route information between all Heady services. Pipelines support real-time streaming, batch processing, and event-driven architectures.',
                'api gateway': 'The API Gateway handles all external and internal API traffic with <10ms latency. It supports REST protocols, rate limiting, authentication, and automatic schema validation.',
                'webhooks': 'Configure live webhook endpoints to receive real-time notifications from any Heady service. Webhooks support retry logic, payload signing, and custom filters.',
                'data flow': 'HeadyIO is built on the Torus Sacred Geometry pattern — representing the continuous, self-sustaining flow of information through interconnected systems.',
                'throughput': 'HeadyIO provides infinite throughput scaling with automatic load balancing across distributed nodes.'
            }
        },
        headybuddy: {
            name: 'HeadyBuddy', tagline: 'Your AI Assistant & Guide',
            color: '#10b981', url: 'https://headybuddy.org', icon: '🤖',
            greeting: "You're home! This is HeadyBuddy HQ. I'm your AI assistant across the entire Heady ecosystem. Ask me anything!",
            tips: ["Learn about Buddy's capabilities", 'Explore conversational AI features', 'See how Buddy integrates everywhere', 'Check smart nudge settings'],
            chips: ['My Features', 'AI Chat', 'Integrations', 'Nudges'],
            knowledge: {
                'features': "I'm HeadyBuddy — your always-on AI assistant. I provide: natural language interaction, multi-turn memory context, task-aware suggestions, proactive smart alerts, cross-domain navigation, and real-time system status across all 6 Heady services.",
                'ai chat': 'My conversational AI engine supports multi-turn conversations with memory context. I understand your questions in the context of whichever Heady service you\'re currently using.',
                'integrations': 'I\'m integrated into all 6 Heady ecosystem websites: HeadySystems, HeadyMe, HeadyConnection, HeadyIO, HeadyBuddy, and HeadyMCP. I\'m context-aware — I know which site you\'re on and tailor my responses accordingly.',
                'nudges': 'Smart nudges are proactive suggestions I offer based on your activity. For example, if you\'re on HeadyIO and haven\'t set up webhooks, I\'ll suggest it. You can customize nudge frequency in your HeadyMe profile.',
                'seed of life': 'HeadyBuddy is built on the Seed of Life Sacred Geometry pattern — representing the genesis point of intelligence and growth.'
            }
        },
        headymcp: {
            name: 'HeadyMCP', tagline: 'Model Context Protocol Hub',
            color: '#f43f5e', url: 'https://headymcp.com', icon: '🔌',
            greeting: "You're on HeadyMCP — the AI context layer. I can help with MCP tools, context management, schemas, and protocol configuration.",
            tips: ['Browse available MCP tools', 'Configure context management', 'Review Vesica Piscis architecture', 'Explore schema definitions'],
            chips: ['MCP Tools', 'Context Mgmt', 'Schemas', 'Architecture'],
            knowledge: {
                'mcp tools': 'HeadyMCP provides 20+ MCP tools for connecting AI models with data sources: heady_chat, heady_analyze, heady_deploy, heady_search, heady_embed, heady_refactor, heady_health, and more. All tools use typed schemas for reliable integration.',
                'context management': 'The Context Management layer maintains conversation state, user preferences, and service awareness across all AI interactions. It ensures every tool call has the right context.',
                'schemas': 'HeadyMCP uses typed JSON schemas for all tool inputs and outputs. This ensures reliable, validated communication between AI models and Heady services.',
                'architecture': 'HeadyMCP is built on the Vesica Piscis Sacred Geometry pattern — representing the intersection of two worlds: AI models and real-world data sources.',
                'vesica piscis': 'The Vesica Piscis is the lens-shaped region formed by two overlapping circles. In HeadyMCP, it represents the perfect intersection between AI intelligence and structured data.'
            }
        }
    };

    // Detect which service we're on
    function detectService() {
        const bodyCtx = document.body.getAttribute('data-buddy-context');
        if (bodyCtx) {
            try {
                const parsed = JSON.parse(bodyCtx);
                if (parsed.service && SERVICES[parsed.service]) return parsed.service;
            } catch (e) { /* fallback */ }
        }
        const host = window.location.hostname.toLowerCase();
        const title = document.title.toLowerCase();
        for (const key in SERVICES) {
            if (host.includes(key.replace('heady', '')) || title.includes(SERVICES[key].name.toLowerCase())) return key;
        }
        const href = window.location.href.toLowerCase();
        for (const key in SERVICES) {
            if (href.includes('/' + key + '/')) return key;
        }
        return 'headybuddy';
    }

    const currentService = detectService();
    const ctx = SERVICES[currentService];

    // ── Persistent Memory System ────────────────────────────────
    const HeadyMemory = (() => {
        const STORAGE_KEY = 'heady_buddy_memory';
        const MAX_HISTORY = 50;
        const MAX_TOPICS = 30;

        function load() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) return JSON.parse(raw);
            } catch (e) { }
            return createFresh();
        }

        function createFresh() {
            return {
                user: null, // { name, email, avatar, joinedAt }
                conversations: [], // [{ q, a, service, ts }]
                topics: [], // extracted topics the user cares about
                preferences: { theme: 'dark', notifications: true },
                visitedServices: {},
                sessionCount: 0,
                firstSeen: new Date().toISOString(),
                lastSeen: new Date().toISOString()
            };
        }

        let mem = load();

        function save() {
            mem.lastSeen = new Date().toISOString();
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(mem)); } catch (e) { }
        }

        function trackVisit() {
            mem.sessionCount++;
            const svc = currentService;
            mem.visitedServices[svc] = (mem.visitedServices[svc] || 0) + 1;
            save();
        }

        function login(name, email) {
            mem.user = { name, email, avatar: name.charAt(0).toUpperCase(), joinedAt: new Date().toISOString() };
            save();
            // Try syncing from Manager API for cross-device support
            syncFromCloud(email);
        }

        function logout() {
            mem.user = null;
            save();
        }

        function isLoggedIn() { return !!mem.user; }
        function getUser() { return mem.user; }

        function addConversation(question, answer) {
            mem.conversations.push({
                q: question, a: answer.substring(0, 300),
                service: currentService,
                ts: new Date().toISOString()
            });
            if (mem.conversations.length > MAX_HISTORY) mem.conversations = mem.conversations.slice(-MAX_HISTORY);
            extractTopics(question);
            save();
            syncToCloud();
        }

        function extractTopics(text) {
            const keywords = ['hcfp', 'headybattle', 'sacred geometry', 'service mesh', 'architecture',
                'deployment', 'cloudflare', 'drupal', 'ai', 'ollama', 'deep-analysis', 'headylens',
                'security', 'monitoring', 'api', 'mcp', 'connection', 'wellness', 'analytics', 'budget',
                'therapy', 'journal', 'data', 'automation', 'integration', 'brain', 'soul'];
            const lower = text.toLowerCase();
            keywords.forEach(kw => {
                if (lower.includes(kw) && !mem.topics.includes(kw)) {
                    mem.topics.push(kw);
                    if (mem.topics.length > MAX_TOPICS) mem.topics.shift();
                }
            });
        }

        function getRecentContext(n = 8) {
            return mem.conversations.slice(-n);
        }

        function buildContextPrompt() {
            let context = '';
            if (mem.user) {
                context += `The user's name is ${mem.user.name}. `;
            }
            if (mem.sessionCount > 1) {
                context += `They have visited ${mem.sessionCount} times. `;
            }
            const svcs = Object.entries(mem.visitedServices)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => SERVICES[k]?.name || k);
            if (svcs.length > 1) {
                context += `Their most visited services: ${svcs.slice(0, 3).join(', ')}. `;
            }
            if (mem.topics.length > 0) {
                context += `Topics they care about: ${mem.topics.slice(-10).join(', ')}. `;
            }
            const recent = getRecentContext(5);
            if (recent.length > 0) {
                context += `Recent conversation topics: ${recent.map(c => c.q.substring(0, 60)).join('; ')}. `;
            }
            return context;
        }

        // Cross-device sync via Manager API
        async function syncToCloud() {
            if (!mem.user?.email) return;
            try {
                await fetch('https://manager.headysystems.com/api/memory', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: mem.user.email, memory: { topics: mem.topics, preferences: mem.preferences, visitedServices: mem.visitedServices, sessionCount: mem.sessionCount } })
                });
            } catch (e) { /* offline is fine */ }
        }

        async function syncFromCloud(email) {
            try {
                const resp = await fetch(`https://manager.headysystems.com/api/memory?email=${encodeURIComponent(email)}`);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.topics) mem.topics = [...new Set([...mem.topics, ...data.topics])];
                    if (data.visitedServices) {
                        Object.entries(data.visitedServices).forEach(([k, v]) => {
                            mem.visitedServices[k] = Math.max(mem.visitedServices[k] || 0, v);
                        });
                    }
                    save();
                }
            } catch (e) { /* offline is fine */ }
        }

        function getMemoryStats() {
            return {
                conversations: mem.conversations.length,
                topics: mem.topics.length,
                services: Object.keys(mem.visitedServices).length,
                sessions: mem.sessionCount,
                since: mem.firstSeen
            };
        }

        trackVisit();
        return { login, logout, isLoggedIn, getUser, addConversation, getRecentContext, buildContextPrompt, getMemoryStats, save };
    })();

    // ── AI Response Engine ──────────────────────────────────────
    // Cascading: Local Knowledge → Heady Brain API → Fallback
    const HEADY_BRAIN_API = 'https://manager.headysystems.com';
    const HEADY_SYSTEM_PROMPT = `You are HeadyBuddy, the AI assistant for the Heady Ecosystem — a unified platform of 6 interconnected services built on Sacred Geometry principles.

SERVICES:
1. HeadySystems (headysystems.com) — Infrastructure backbone. Sacred Geometry: Metatron's Cube. Manages Docker containers, Cloudflare tunnels, DNS, domain routing, service mesh, and deployment orchestration.
2. HeadyMe (headyme.com) — Personal growth & wellness. Sacred Geometry: Flower of Life. Journaling, therapy tools, wellness tracking, self-improvement, and personal development.
3. HeadyConnection (headyconnection.com) — Community & networking. Sacred Geometry: Sri Yantra. Connects users, groups, events, and shared experiences.
4. HeadyIO (headyio.com) — Data intelligence & APIs. Sacred Geometry: Torus. Analytics, dashboards, data pipelines, API gateway, and real-time monitoring.
5. HeadyBuddy (headybuddy.org) — AI assistant (you). Sacred Geometry: Seed of Life. Context-aware help, persistent memory, cross-service guidance.
6. HeadyMCP (headymcp.com) — Integrations & protocols. Sacred Geometry: Vesica Piscis. Model Context Protocol server, tool orchestration, external service connectors.

CORE SYSTEMS:
- HCFP (Heady Core Functionality Platform): The central governance and policy engine. Runs in full-auto mode. Enforces production_domains_only policy — all localhost/non-custom-domain references are violations. Tracks violations per domain.
- HeadyBattle: The critical thinking and adversarial intelligence engine. Intercepts and challenges all system decisions with Socratic questions. Operates in "enforced" mode. Creates stronger, more resilient outputs through intellectual challenge.
- HeadySoul: The ethical oversight layer. Reviews escalated decisions. Has 24h approval window for major changes. Ensures alignment with Heady values.
- Heady Brain: AI processing backend (Heady proprietary routing). Powers HeadyBuddy responses.
- Communication Chain: Channel→Promoter (120ms) → Brain (80ms) → HeadySoul (450ms) → Approval (24h max).
- HeadyLens: Real-time monitoring dashboard. CPU, memory, response time charts. WebSocket-based live updates.

ARCHITECTURE:
- Docker-based microservices on local infrastructure
- Cloudflare Workers for edge routing and DNS
- Manager API at manager.headysystems.com (orchestration hub)
- Drupal 11 for admin CMS and content management
- All services share cosmic glassmorphism design aesthetic
- PWA-enabled for mobile installation

PERSONALITY: Warm, intelligent, technically precise. Use Sacred Geometry metaphors when natural. Be concise but comprehensive. If you know the user's name from memory, address them personally.`;
    function getEnhancedPrompt() {
        const memCtx = HeadyMemory.buildContextPrompt();
        if (memCtx) return HEADY_SYSTEM_PROMPT + '\n\nUser context: ' + memCtx;
        return HEADY_SYSTEM_PROMPT;
    }

    const BRAIN_ENDPOINTS = [
        'https://manager.headysystems.com/api/brain/chat',
    ];
    function getBrainEndpoints() {
        const endpoints = [...BRAIN_ENDPOINTS];
        return endpoints;
    }

    // ── HeadyConductor: Distributed Dynamic Resource Allocation ──
    // Routes 100% through Heady Brain API — no direct Ollama exposure
    const HEADY_NODES = {
        primary: { name: 'Heady-Brain', url: HEADY_BRAIN_API, model: 'heady-brain', type: 'api' },
        code: { name: 'Heady-Brain-Code', url: HEADY_BRAIN_API, model: 'heady-brain', type: 'api', focus: 'code' },
        vision: { name: 'Heady-Brain-Vision', url: HEADY_BRAIN_API, model: 'heady-brain', type: 'api', focus: 'vision' }
    };

    const HEADY_AUX = {
        hcfp: 'https://manager.headysystems.com/api/hcfp',
        embedding: 'https://manager.headysystems.com/api/brain/embed',
        manager: 'https://manager.headysystems.com',
        pythonWorker: 'https://manager.headysystems.com/api/process'
    };

    let roundRobinIndex = 0;

    async function queryNode(node, message, sysPrompt) {
        const ctrl = new AbortController();
        const tmout = setTimeout(() => ctrl.abort(), 15000);
        try {
            const recentConvo = HeadyMemory.getRecentContext(3).map(c => ({ role: 'user', content: c.q }));
            // Route through Heady Brain API
            const resp = await fetch(node.url + '/api/brain/chat', {
                method: 'POST', signal: ctrl.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Heady-Source': 'headybuddy-widget',
                    'X-Heady-Version': '1.0.0'
                },
                body: JSON.stringify({
                    message: message,
                    model: node.model || 'heady-brain',
                    system: sysPrompt,
                    temperature: 0.7,
                    max_tokens: 1024,
                    context: recentConvo,
                    focus: node.focus || 'general'
                })
            });
            clearTimeout(tmout);
            if (resp.ok) {
                const data = await resp.json();
                const content = data.response || data.message?.content || data.text;
                if (content && content.length > 10) return { answer: content, source: node.name };
            }
        } catch (e) { clearTimeout(tmout); }
        return null;
    }

    async function executeIntelligentRoute(message, sysPrompt) {
        const lower = message.toLowerCase();

        // 1. Intent Detection for Specialized Routing
        const isCode = /\b(code|function|debug|error|programming|script|css|html|api|deploy)\b/.test(lower);
        const isVision = /\b(image|picture|photo|look at|see)\b/.test(lower);
        const isAnalysis = /\b(analyze|summarize|extract|data|metrics|report)\b/.test(lower);

        // All routes go through Heady Brain API — intelligent routing happens server-side
        let routeChain = [];
        if (isCode) {
            routeChain = [HEADY_NODES.code, HEADY_NODES.primary];
        } else if (isVision) {
            routeChain = [HEADY_NODES.vision, HEADY_NODES.primary];
        } else {
            routeChain = [HEADY_NODES.primary];
        }

        // 2. Parallel Auxiliary Processing (Async Intelligence)
        const auxPromises = [];
        if (isAnalysis) {
            auxPromises.push(
                fetch(HEADY_AUX.pythonWorker, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: message, type: 'analyze' }), signal: AbortSignal.timeout(8000)
                }).then(r => r.ok ? r.json() : null).then(d => d ? { answer: d.result || d.response, source: 'Heady-Worker' } : null).catch(() => null)
            );
        }

        // 3. Execute through Heady Brain (primary route)
        let finalResult = null;
        for (const node of routeChain) {
            finalResult = await queryNode(node, message, sysPrompt);
            if (finalResult) break;
        }

        // 4. Auxiliary Fallbacks
        if (!finalResult && auxPromises.length > 0) {
            const auxResults = await Promise.all(auxPromises);
            finalResult = auxResults.find(r => r !== null);
        }

        return finalResult || { answer: null, source: 'unknown' };
    }

    async function getAIResponse(message) {
        // HeadyConductor: 100% Heady Brain intelligence — routes through manager.headysystems.com
        const sysPrompt = getEnhancedPrompt();

        const result = await executeIntelligentRoute(message, sysPrompt);

        let answer = result.answer;
        let source = result.source;

        if (!answer) {
            answer = "⚠️ I'm experiencing connectivity issues with the Heady Intelligence Stack. All distributed nodes are currently unreachable or locked up. Please check Docker container health.";
            source = 'fallback';
        }

        // Fire-and-forget ecosystem integration
        HeadyMemory.addConversation(message, answer);

        // Governance oversight
        fetch(HEADY_AUX.hcfp + '/log', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'buddy_response', source, message: message.substring(0, 200), ts: Date.now() })
        }).catch(() => { });

        // Vector memory storage
        fetch(HEADY_AUX.embedding, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: message.substring(0, 500), model: 'nomic-embed-text', source: 'headybuddy-widget' })
        }).catch(() => { });

        return answer;
    }

    // ── Styles ──────────────────────────────────────────────────
    const WIDGET_CSS = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        #heady-buddy-widget * {
            margin: 0; padding: 0; box-sizing: border-box;
            font-family: 'Inter', system-ui, sans-serif;
        }

        /* FAB */
        #heady-buddy-fab {
            position: fixed; bottom: 24px; right: 24px;
            width: 60px; height: 60px; border-radius: 50%;
            background: linear-gradient(135deg, #065f46, #10b981);
            border: 2px solid rgba(52, 211, 153, 0.5);
            cursor: pointer; z-index: 99999;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 24px rgba(16, 185, 129, 0.35), 0 0 40px rgba(16, 185, 129, 0.12);
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
            animation: buddy-breathe 3s ease-in-out infinite;
        }
        #heady-buddy-fab:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 32px rgba(16,185,129,0.5), 0 0 60px rgba(16,185,129,0.2);
        }
        #heady-buddy-fab.open { transform: scale(0.9) rotate(45deg); animation: none; }
        #heady-buddy-fab svg { width: 28px; height: 28px; fill: none; stroke: #d1fae5; stroke-width: 1.8; filter: drop-shadow(0 0 4px rgba(52,211,153,0.6)); }
        #heady-buddy-fab::after {
            content: ''; position: absolute; top: 4px; right: 4px;
            width: 12px; height: 12px; border-radius: 50%;
            background: #34d399; border: 2px solid #065f46;
            animation: buddy-pulse 2s ease-in-out infinite;
        }
        @keyframes buddy-breathe {
            0%, 100% { box-shadow: 0 4px 24px rgba(16,185,129,0.35), 0 0 40px rgba(16,185,129,0.12); }
            50% { box-shadow: 0 4px 32px rgba(16,185,129,0.50), 0 0 60px rgba(16,185,129,0.20); }
        }
        @keyframes buddy-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.85); }
        }

        /* Panel */
        #heady-buddy-panel {
            position: fixed; bottom: 96px; right: 24px;
            width: 400px; height: 580px;
            background: rgba(8, 12, 20, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(52,211,153,0.18);
            border-radius: 1.25rem; z-index: 99998;
            display: flex; flex-direction: column; overflow: hidden;
            transform: scale(0.8) translateY(20px); opacity: 0; pointer-events: none;
            transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
            box-shadow: 0 12px 48px rgba(0,0,0,0.5), 0 0 40px rgba(16,185,129,0.08);
        }
        #heady-buddy-panel.open { transform: scale(1) translateY(0); opacity: 1; pointer-events: auto; }

        /* Header */
        .buddy-header {
            padding: 0.9rem 1.1rem;
            background: linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,95,70,0.15));
            border-bottom: 1px solid rgba(52,211,153,0.10);
            display: flex; align-items: center; gap: 0.7rem; flex-shrink: 0;
        }
        .buddy-avatar {
            width: 36px; height: 36px; border-radius: 50%;
            background: linear-gradient(135deg, #065f46, #10b981);
            display: flex; align-items: center; justify-content: center;
            font-size: 1.1rem; border: 2px solid rgba(52,211,153,0.3); flex-shrink: 0;
        }
        .buddy-header-text h3 { font-size: 0.88rem; font-weight: 600; color: #d1fae5; }
        .buddy-header-text span { font-size: 0.68rem; color: #34d399; font-weight: 500; }

        /* Chips row */
        .buddy-chips {
            padding: 0.6rem 1.1rem;
            display: flex; flex-wrap: wrap; gap: 0.35rem;
            border-bottom: 1px solid rgba(52,211,153,0.08); flex-shrink: 0;
        }
        .buddy-chip {
            font-size: 0.68rem; font-weight: 500; color: #a7d8c8;
            background: rgba(16,185,129,0.08); border: 1px solid rgba(52,211,153,0.15);
            border-radius: 999px; padding: 0.3rem 0.65rem;
            cursor: pointer; transition: all 0.2s ease; white-space: nowrap;
        }
        .buddy-chip:hover { background: rgba(16,185,129,0.18); border-color: rgba(52,211,153,0.35); color: #d1fae5; transform: translateY(-1px); }

        /* Messages area */
        .buddy-messages {
            flex: 1; overflow-y: auto; padding: 0.8rem 1.1rem;
            display: flex; flex-direction: column; gap: 0.6rem;
        }
        .buddy-messages::-webkit-scrollbar { width: 4px; }
        .buddy-messages::-webkit-scrollbar-track { background: transparent; }
        .buddy-messages::-webkit-scrollbar-thumb { background: rgba(52,211,153,0.2); border-radius: 4px; }

        .buddy-msg {
            max-width: 92%; padding: 0.65rem 0.9rem;
            border-radius: 0.85rem; font-size: 0.8rem; line-height: 1.55;
            animation: buddy-msg-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes buddy-msg-in {
            from { opacity: 0; transform: translateY(8px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .buddy-msg.bot {
            background: rgba(16,185,129,0.10); border: 1px solid rgba(52,211,153,0.12);
            color: #c8e6dc; align-self: flex-start;
            border-bottom-left-radius: 0.25rem;
        }
        .buddy-msg.user {
            background: rgba(52,211,153,0.15); border: 1px solid rgba(52,211,153,0.20);
            color: #d1fae5; align-self: flex-end;
            border-bottom-right-radius: 0.25rem;
        }
        .buddy-msg.bot strong { color: #34d399; }
        .buddy-msg.bot .msg-text { white-space: pre-wrap; }

        /* Typing indicator */
        .buddy-typing {
            display: flex; align-items: center; gap: 4px;
            padding: 0.65rem 0.9rem; align-self: flex-start;
            background: rgba(16,185,129,0.08); border: 1px solid rgba(52,211,153,0.08);
            border-radius: 0.85rem; border-bottom-left-radius: 0.25rem;
        }
        .buddy-typing span {
            width: 6px; height: 6px; border-radius: 50%;
            background: #34d399; animation: buddy-dot 1.4s infinite;
        }
        .buddy-typing span:nth-child(2) { animation-delay: 0.2s; }
        .buddy-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes buddy-dot {
            0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
            30% { opacity: 1; transform: scale(1.2); }
        }

        /* Ecosystem nav */
        .buddy-eco {
            padding: 0.55rem 1.1rem;
            border-top: 1px solid rgba(52,211,153,0.10);
            background: rgba(16,185,129,0.03); flex-shrink: 0;
        }
        .buddy-eco-label { font-size: 0.58rem; font-weight: 600; color: rgba(52,211,153,0.5); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.35rem; }
        .buddy-eco-links { display: flex; flex-wrap: wrap; gap: 0.3rem; }
        .buddy-eco-link {
            font-size: 0.65rem; font-weight: 500; color: #8aa;
            background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
            border-radius: 0.5rem; padding: 0.25rem 0.45rem;
            text-decoration: none; transition: all 0.2s ease;
            display: flex; align-items: center; gap: 0.25rem;
        }
        .buddy-eco-link:hover { background: rgba(255,255,255,0.08); color: #d1fae5; border-color: rgba(52,211,153,0.2); }
        .buddy-eco-link.active { background: rgba(16,185,129,0.12); color: #34d399; border-color: rgba(52,211,153,0.25); }

        /* Memory / Login */
        .buddy-login-bar, .buddy-user-bar { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 1.1rem; border-bottom: 1px solid rgba(52,211,153,0.08); }
        .buddy-login-btn { background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(16,185,129,0.2)); border: 1px solid rgba(139,92,246,0.3); color: #c4b5fd; border-radius: 2rem; padding: 0.3rem 0.8rem; font-size: 0.72rem; cursor: pointer; font-family: inherit; transition: all 0.2s; width: 100%; }
        .buddy-login-btn:hover { background: linear-gradient(135deg, rgba(139,92,246,0.3), rgba(16,185,129,0.3)); }
        .buddy-user-avatar { width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6, #10b981); display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; color: white; flex-shrink: 0; }
        .buddy-user-name { font-size: 0.78rem; font-weight: 600; color: #d1fae5; flex: 1; }
        .buddy-mem-badge { font-size: 0.65rem; background: rgba(139,92,246,0.15); color: #a78bfa; padding: 0.15rem 0.45rem; border-radius: 1rem; border: 1px solid rgba(139,92,246,0.25); white-space: nowrap; }
        .buddy-logout-btn { background: none; border: none; color: var(--muted, #64748b); cursor: pointer; font-size: 0.85rem; padding: 0.2rem; }
        .buddy-login-panel { padding: 0.6rem 1.1rem; display: flex; flex-direction: column; gap: 0.4rem; border-bottom: 1px solid rgba(52,211,153,0.08); }
        .buddy-login-input { background: rgba(15,23,42,0.6); border: 1px solid rgba(71,85,105,0.35); border-radius: 0.4rem; padding: 0.4rem 0.6rem; color: #e2e8f0; font-size: 0.8rem; font-family: inherit; outline: none; }
        .buddy-login-input:focus { border-color: #8b5cf6; }
        .buddy-login-submit { background: linear-gradient(135deg, #8b5cf6, #10b981); border: none; color: white; border-radius: 0.4rem; padding: 0.4rem; font-size: 0.78rem; cursor: pointer; font-family: inherit; font-weight: 600; transition: opacity 0.2s; }
        .buddy-login-submit:hover { opacity: 0.9; }

        /* Input */
        .buddy-input-row {
            padding: 0.65rem 1.1rem;
            border-top: 1px solid rgba(52,211,153,0.10);
            display: flex; gap: 0.4rem; flex-shrink: 0;
        }
        .buddy-input {
            flex: 1; background: rgba(255,255,255,0.05);
            border: 1px solid rgba(52,211,153,0.12);
            border-radius: 0.65rem; padding: 0.5rem 0.75rem;
            font-size: 0.78rem; color: #d1fae5; outline: none;
            transition: border-color 0.2s ease;
        }
        .buddy-input::placeholder { color: rgba(52,211,153,0.35); }
        .buddy-input:focus { border-color: rgba(52,211,153,0.35); }
        .buddy-send {
            width: 34px; height: 34px; border-radius: 0.55rem;
            background: linear-gradient(135deg, #065f46, #10b981);
            border: none; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: transform 0.2s ease, box-shadow 0.2s ease; flex-shrink: 0;
        }
        .buddy-send:hover { transform: scale(1.08); box-shadow: 0 2px 12px rgba(16,185,129,0.3); }
        .buddy-send:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .buddy-send svg { width: 15px; height: 15px; fill: none; stroke: #d1fae5; stroke-width: 2; }

        /* Mobile */
        @media (max-width: 480px) {
            #heady-buddy-panel { width: calc(100vw - 24px); right: 12px; bottom: 88px; height: 70vh; }
            #heady-buddy-fab { bottom: 16px; right: 16px; width: 52px; height: 52px; }
        }
    `;

    // ── Build HTML ──────────────────────────────────────────────
    function buildWidget() {
        const widget = document.createElement('div');
        widget.id = 'heady-buddy-widget';

        const style = document.createElement('style');
        style.textContent = WIDGET_CSS;
        widget.appendChild(style);

        // FAB
        const fab = document.createElement('div');
        fab.id = 'heady-buddy-fab';
        fab.title = 'HeadyBuddy Assistant';
        fab.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><circle cx="6.8" cy="9" r="3"/><circle cx="17.2" cy="9" r="3"/><circle cx="6.8" cy="15" r="3"/><circle cx="17.2" cy="15" r="3"/></svg>`;
        widget.appendChild(fab);

        // Ecosystem links
        let ecoLinks = '';
        for (const key in SERVICES) {
            const s = SERVICES[key];
            const isActive = key === currentService ? ' active' : '';
            ecoLinks += `<a class="buddy-eco-link${isActive}" href="${s.url}" title="${s.tagline}">${s.icon} ${s.name.replace('Heady', '')}</a>`;
        }

        // Panel
        const panel = document.createElement('div');
        panel.id = 'heady-buddy-panel';
        const user = HeadyMemory.getUser();
        const memStats = HeadyMemory.getMemoryStats();
        const loginHtml = user
            ? `<div class="buddy-user-bar"><span class="buddy-user-avatar">${user.avatar}</span><span class="buddy-user-name">${user.name}</span><span class="buddy-mem-badge" title="${memStats.conversations} memories, ${memStats.topics} topics">🧠 ${memStats.conversations}</span><button class="buddy-logout-btn" id="buddy-logout">↩</button></div>`
            : `<div class="buddy-login-bar"><button class="buddy-login-btn" id="buddy-login-toggle">🔑 Quick Login</button></div>`;
        const greeting = user
            ? `Welcome back, **${user.name}**! I remember our last conversations. How can I help on ${ctx.name}?`
            : ctx.greeting;
        panel.innerHTML = `
            <div class="buddy-header">
                <div class="buddy-avatar">🤖</div>
                <div class="buddy-header-text">
                    <h3>HeadyBuddy</h3>
                    <span>● Online — ${user ? '🧠 Memory Active' : 'Context-Aware'}</span>
                </div>
            </div>
            ${loginHtml}
            <div class="buddy-login-panel" id="buddy-login-panel" style="display:none;">
                <input class="buddy-login-input" id="buddy-login-name" type="text" placeholder="Your name" />
                <input class="buddy-login-input" id="buddy-login-email" type="email" placeholder="Email" />
                <button class="buddy-login-submit" id="buddy-login-submit">🚀 Start Remembering</button>
            </div>
            <div class="buddy-chips">
                ${ctx.chips.map(c => `<div class="buddy-chip">${c}</div>`).join('')}
            </div>
            <div class="buddy-messages" id="buddy-messages"></div>
            <div class="buddy-eco">
                <div class="buddy-eco-label">Heady Ecosystem</div>
                <div class="buddy-eco-links">${ecoLinks}</div>
            </div>
            <div class="buddy-input-row">
                <input class="buddy-input" type="text" placeholder="${user ? `Ask me anything, ${user.name}...` : 'Ask Buddy anything...'}" />
                <button class="buddy-send"><svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg></button>
            </div>
        `;

        widget.appendChild(panel);
        return widget;
    }

    // ── Message Helpers ─────────────────────────────────────────
    function addMessage(container, text, type) {
        const msg = document.createElement('div');
        msg.className = `buddy-msg ${type}`;
        // Simple markdown-like bold processing
        const processed = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        msg.innerHTML = `<div class="msg-text">${processed}</div>`;
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
        return msg;
    }

    function showTyping(container) {
        const typing = document.createElement('div');
        typing.className = 'buddy-typing';
        typing.id = 'buddy-typing-indicator';
        typing.innerHTML = '<span></span><span></span><span></span>';
        container.appendChild(typing);
        container.scrollTop = container.scrollHeight;
        return typing;
    }

    function removeTyping() {
        const el = document.getElementById('buddy-typing-indicator');
        if (el) el.remove();
    }

    // ── Init ────────────────────────────────────────────────────
    function init() {
        const widget = buildWidget();
        document.body.appendChild(widget);

        const fab = document.getElementById('heady-buddy-fab');
        const panel = document.getElementById('heady-buddy-panel');
        const messagesContainer = document.getElementById('buddy-messages');
        const input = panel.querySelector('.buddy-input');
        const sendBtn = panel.querySelector('.buddy-send');
        let isOpen = false;
        let isSending = false;

        // Personalized greeting
        const user = HeadyMemory.getUser();
        const greeting = user
            ? `Welcome back, **${user.name}**! 🧠 I remember our conversations. How can I help on ${ctx.name}?`
            : ctx.greeting;
        addMessage(messagesContainer, greeting, 'bot');

        // Login toggle
        const loginToggle = document.getElementById('buddy-login-toggle');
        const loginPanel = document.getElementById('buddy-login-panel');
        const loginSubmit = document.getElementById('buddy-login-submit');
        const logoutBtn = document.getElementById('buddy-logout');

        if (loginToggle && loginPanel) {
            loginToggle.addEventListener('click', () => {
                loginPanel.style.display = loginPanel.style.display === 'none' ? 'flex' : 'none';
            });
        }
        if (loginSubmit) {
            loginSubmit.addEventListener('click', () => {
                const name = document.getElementById('buddy-login-name')?.value?.trim();
                const email = document.getElementById('buddy-login-email')?.value?.trim();
                if (name) {
                    HeadyMemory.login(name, email || '');
                    // Rebuild widget to show logged-in state
                    widget.remove();
                    init();
                }
            });
        }
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                HeadyMemory.logout();
                widget.remove();
                init();
            });
        }

        // Toggle panel
        fab.addEventListener('click', () => {
            isOpen = !isOpen;
            fab.classList.toggle('open', isOpen);
            panel.classList.toggle('open', isOpen);
            if (isOpen) setTimeout(() => input.focus(), 350);
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (isOpen && !widget.contains(e.target)) {
                isOpen = false;
                fab.classList.remove('open');
                panel.classList.remove('open');
            }
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) {
                isOpen = false;
                fab.classList.remove('open');
                panel.classList.remove('open');
            }
        });

        // Handle send
        async function handleSend(messageText) {
            const text = (messageText || input.value).trim();
            if (!text || isSending) return;

            isSending = true;
            sendBtn.disabled = true;
            input.value = '';

            // Show user message
            addMessage(messagesContainer, text, 'user');

            // Show typing indicator
            showTyping(messagesContainer);

            // Get AI response (with realistic delay)
            const minDelay = new Promise(r => setTimeout(r, 600 + Math.random() * 800));
            const [response] = await Promise.all([getAIResponse(text), minDelay]);

            // Remove typing, show response
            removeTyping();
            addMessage(messagesContainer, response, 'bot');

            isSending = false;
            sendBtn.disabled = false;
            input.focus();
        }

        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSend(); });
        sendBtn.addEventListener('click', () => handleSend());

        // Chip click → send as message
        panel.querySelectorAll('.buddy-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                handleSend(`Tell me about ${chip.textContent}`);
            });
        });

        // Tip click → send as message
        panel.querySelectorAll('.buddy-tip').forEach(tip => {
            tip.addEventListener('click', () => {
                const text = tip.querySelector('.tip-text');
                if (text) handleSend(text.textContent);
            });
        });
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
