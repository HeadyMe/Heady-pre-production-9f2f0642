/**
 * ═══ HeadySwarm — Bio-Inspired Colony Orchestrator ═══
 *
 * Manages a colony of HeadyBee workers that continuously forage
 * for AI results through the HeadyGateway. Models real bee behavior:
 *
 *   - Flower Field: prioritized task queue (the work to be done)
 *   - Waggle Dance: successful bees recruit others to high-yield categories
 *   - Honeycomb: persistent result store for proven AI outputs
 *   - Energy Cycles: bees rest between foraging rounds
 *   - Division of Labor: roles assigned based on colony needs
 *
 * Usage:
 *   const swarm = new HeadySwarm(gateway, { beeCount: 5 });
 *   swarm.start();
 *   // ... later
 *   swarm.status();
 */

const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");
const HeadyBee = require("./bee");

const HONEYCOMB_PATH = path.join(__dirname, "..", "..", "data", "honeycomb.json");
const DEFAULT_BEE_COUNT = 5;
const DEFAULT_ROUND_INTERVAL_MS = 60000; // 1 minute between foraging rounds
const MAX_HONEYCOMB_ENTRIES = 500;

// ─── Flower Field: Real Tasks That Use the AI Gateway ─────────────────────

const FLOWER_FIELD = [
    // ── Health & Monitoring (the hive's immune system) ──
    {
        id: "health-001", name: "System Health Analysis",
        category: "health", priority: 9, role: "nurse",
        prompt: "Analyze a Node.js system running 18 PM2 processes serving multiple websites through Cloudflare tunnels. What are the top 3 health risks and how to mitigate them? Be specific and actionable.",
    },
    {
        id: "health-002", name: "Memory Pressure Forecast",
        category: "health", priority: 8, role: "nurse",
        prompt: "A mini-computer runs 18 Node.js processes. Combined RSS is typically 2-3GB on 4GB RAM. What memory optimization strategies would prevent OOM kills without reducing service count?",
    },
    {
        id: "health-003", name: "Process Crash Loop Detection",
        category: "health", priority: 10, role: "guard",
        prompt: "A PM2 managed process has restarted 157 times in 17 minutes. What are the top 5 root causes of crash loops in Node.js, and what diagnostic steps should be taken?",
    },

    // ── Security (guard bees) ──
    {
        id: "sec-001", name: "Secret Exposure Scan Strategy",
        category: "security", priority: 9, role: "guard",
        prompt: "Design a 5-step automated secret scanning strategy for a multi-site Node.js ecosystem with 20+ API keys, Cloudflare tokens, and Firebase credentials. Focus on preventing accidental git commits of secrets.",
    },
    {
        id: "sec-002", name: "CORS & Headers Audit",
        category: "security", priority: 7, role: "guard",
        prompt: "What security headers should a Node.js Express API serving 7 domains implement? Cover CORS, CSP, HSTS, X-Frame-Options. Give exact middleware configuration.",
    },
    {
        id: "sec-003", name: "API Authentication Review",
        category: "security", priority: 8, role: "guard",
        prompt: "Review API key authentication for a system where a Bearer token is passed via X-Heady-SDK header. What are the security weaknesses and how to implement mTLS or JWT rotation?",
    },

    // ── SEO & Content (forager bees) ──
    {
        id: "seo-001", name: "Cross-Domain Link Strategy",
        category: "seo", priority: 6, role: "forager",
        prompt: "Design an SEO cross-linking strategy for a 7-domain ecosystem: headyme.com, headysystems.com, headybuddy.org, headyconnection.org, headymcp.com, headyio.com, 1ime1.com. How should they interlink for maximum domain authority without looking spammy?",
    },
    {
        id: "seo-002", name: "Meta Description Generator",
        category: "seo", priority: 5, role: "forager",
        prompt: "Generate SEO-optimized meta descriptions (max 155 chars each) for these pages: 1) HeadyMe AI companion dashboard, 2) HeadySystems infrastructure admin, 3) HeadyBuddy personal AI assistant, 4) HeadyConnection community hub, 5) HeadyMCP model context protocol tools.",
    },
    {
        id: "seo-003", name: "Structured Data Strategy",
        category: "seo", priority: 5, role: "forager",
        prompt: "What JSON-LD structured data should an AI platform ecosystem implement? Cover Organization, WebApplication, SoftwareApplication schemas for maximum search visibility.",
    },

    // ── Code Quality (scout bees) ──
    {
        id: "code-001", name: "Architecture Pattern Review",
        category: "code", priority: 7, role: "scout",
        prompt: "Review this architecture pattern: a central HeadyManager Express server routes to 20+ service handlers, uses a liquid gateway to race AI providers (Claude, Gemini, OpenAI), and serves 7 domains via Cloudflare tunnel. What are the architectural risks and improvements?",
    },
    {
        id: "code-002", name: "Error Handling Best Practices",
        category: "code", priority: 6, role: "scout",
        prompt: "A Node.js system uses `catch { }` (empty catch blocks) extensively to prevent crashes. While this ensures 100% uptime, it silently swallows errors. Design a better error handling strategy that maintains resilience while preserving observability.",
    },
    {
        id: "code-003", name: "Event-Driven Architecture Audit",
        category: "code", priority: 6, role: "scout",
        prompt: "Audit this pattern: Node.js EventEmitter used as a system-wide event bus with 30+ event types. What are the risks (memory leaks, ordering, error propagation) and what's the optimal event architecture for a system this size?",
    },

    // ── Performance (forager bees looking for the sweetest nectar) ──
    {
        id: "perf-001", name: "API Latency Optimization",
        category: "performance", priority: 8, role: "forager",
        prompt: "An AI API gateway races 5 providers in parallel and returns the fastest response. Average latency is 777ms. What techniques can reduce this to under 500ms? Consider connection pooling, warm-up requests, edge caching, and pre-computation.",
    },
    {
        id: "perf-002", name: "Interactive Site Optimization",
        category: "performance", priority: 8, role: "forager",
        prompt: "Multiple PM2 processes each run full-stack interactive web apps (Node.js/Express) serving dynamic routes and websockets. What's the optimal architecture to serve 7+ interactive domains behind Cloudflare without breaking real-time features or SSR performance?",
    },

    // ── Creative & Content (forager bees) ──
    {
        id: "create-001", name: "Landing Page Copy",
        category: "creative", priority: 4, role: "forager",
        prompt: "Write a compelling hero section for HeadyMe.com — an AI-powered personal intelligence platform. The aesthetic is cyberpunk wireframe (dark black, neon pink). Include headline, subheadline, and CTA button text. Tone: bold, futuristic, personal.",
    },
    {
        id: "create-002", name: "Documentation Outline",
        category: "creative", priority: 4, role: "forager",
        prompt: "Create a developer documentation outline for the heady-hive-sdk — a Node.js SDK that provides liquid AI gateway routing, task decomposition, and multi-provider racing. Cover: quickstart, API reference, configuration, and advanced usage.",
    },

    // ── Infrastructure (nurse bees maintaining the hive) ──
    {
        id: "infra-001", name: "PM2 Configuration Optimization",
        category: "infrastructure", priority: 7, role: "nurse",
        prompt: "Optimize a PM2 ecosystem config for 18 Node.js processes on a 4GB RAM machine with 4 CPU cores. Current setup: all fork mode, no clustering, no memory limits. Design optimal config with limits, restarts, and watch settings.",
    },
    {
        id: "infra-002", name: "Cloudflare Tunnel Architecture",
        category: "infrastructure", priority: 7, role: "nurse",
        prompt: "Design the ideal Cloudflare tunnel configuration for routing 7 domains to a single mini-computer running PM2 processes on different ports. Cover: ingress rules, origin certificates, access policies, and failover.",
    },

    // ── Learning & Discovery (scout bees) ──
    {
        id: "learn-001", name: "AI Provider Cost Analysis",
        category: "learning", priority: 5, role: "scout",
        prompt: "Compare the cost-per-token of Claude Sonnet, Gemini Pro, GPT-4o, and Grok for a system that processes ~1000 requests/day averaging 500 input tokens and 800 output tokens. Which provider mix minimizes cost while maintaining quality?",
    },
    {
        id: "learn-002", name: "Edge AI Routing Patterns",
        category: "learning", priority: 5, role: "scout",
        prompt: "What are the best patterns for routing AI inference requests between edge (Cloudflare Workers), cloud (GCP Vertex AI), and local (self-hosted) providers? Design a decision tree based on latency requirements, cost, and model capability.",
    },

    // ── Bio-Inspired & Human-System Patterns (Tier 8 evolution) ──
    {
        id: "bio-001", name: "Ant Colony Optimization for API Routing",
        category: "discovery", priority: 6, role: "scout",
        prompt: "Design an Ant Colony Optimization (ACO) algorithm for API routing. Each AI provider (Claude, Gemini, OpenAI, Grok) is a path. Pheromone = success rate × speed. Evaporation rate = 0.1/hour. How should requests deposit and follow pheromone trails to self-optimize routing without centralized control?",
    },
    {
        id: "bio-002", name: "I-Beam Load Distribution",
        category: "discovery", priority: 5, role: "scout",
        prompt: "Apply structural engineering I-beam principles to server load distribution. An I-beam concentrates material at stress points (flanges) and minimizes it at low-stress areas (web). How should a system with 18 processes allocate CPU and memory using this principle? Which processes are flanges vs web?",
    },
    {
        id: "bio-003", name: "Mycelial Network Service Discovery",
        category: "discovery", priority: 6, role: "scout",
        prompt: "Design a service discovery pattern inspired by mycelial (fungal) networks. In forests, mycorrhizal networks connect trees and share nutrients. How should 18 Node.js processes discover each other, share health data, and redistribute load through indirect underground-style communication?",
    },
    {
        id: "bio-004", name: "Immune System Circuit Breaker",
        category: "health", priority: 8, role: "guard",
        prompt: "Design a circuit breaker pattern modeled on the biological immune system. Innate immunity = rate limiting. Adaptive immunity = learning from past failures. Memory cells = persistent error patterns. How should a Node.js API gateway implement detect → isolate → remember → respond?",
    },
    {
        id: "bio-005", name: "Flocking Algorithm for Load Balancing",
        category: "performance", priority: 6, role: "forager",
        prompt: "Apply Craig Reynolds' Boids flocking rules to load balancing: 1) Separation — avoid overloading any single provider, 2) Alignment — match request patterns to provider strengths, 3) Cohesion — keep requests flowing to proven clusters. Design the algorithm for 5 AI providers.",
    },
    {
        id: "bio-006", name: "Fibonacci Scaling Thresholds",
        category: "infrastructure", priority: 5, role: "nurse",
        prompt: "Apply Fibonacci sequence to auto-scaling thresholds. Instead of linear scaling (50%, 60%, 70%), use Fibonacci ratios (61.8%, 78.6%, 88.6%) for scale-up triggers and inverse (38.2%, 23.6%, 11.4%) for scale-down. Why might golden ratio intervals produce more stable scaling behavior?",
    },
    {
        id: "bio-007", name: "Stigmergy Coordination Pattern",
        category: "discovery", priority: 5, role: "scout",
        prompt: "Design a stigmergy-based coordination system for distributed AI tasks. Like termites building mounds by modifying their environment rather than communicating directly, how should workers leave traces in shared state (Redis, files, env) that guide subsequent workers without direct messaging?",
    },
    {
        id: "bio-008", name: "Circadian Rhythm Scheduling",
        category: "infrastructure", priority: 7, role: "nurse",
        prompt: "Design a circadian rhythm scheduling system for a 24/7 AI platform. Heavy computation (foraging, training, scanning) during owner-active hours (8AM-12AM). Maintenance, backups, and log rotation during sleep hours (12AM-8AM). How should the system detect and adapt to the human's actual activity patterns?",
    },
    {
        id: "human-001", name: "Kanban WIP Limits for Task Categories",
        category: "performance", priority: 6, role: "forager",
        prompt: "Apply Toyota Production System Kanban WIP (work-in-progress) limits to AI task categories. If health tasks have WIP=3, security WIP=2, creative WIP=5, how should the system enforce limits, handle overflow, and signal bottlenecks? Design the queue and pull system.",
    },
    {
        id: "human-002", name: "Six Sigma Error Budget",
        category: "health", priority: 7, role: "guard",
        prompt: "Apply Six Sigma methodology to an AI system's error budget. Current: 45 forages, ~67 avg quality. Target: 3.4 defects per million. Calculate the sigma level, identify the vital few error sources (Pareto), and design control charts for quality monitoring.",
    },
];

// ─── HeadySwarm ─────────────────────────────────────────────────────────────

class HeadySwarm extends EventEmitter {
    /**
     * @param {Object} gateway - HeadyGateway instance
     * @param {Object} [opts]
     * @param {number} [opts.beeCount=5] - Number of bees in the colony
     * @param {number} [opts.roundInterval=60000] - ms between foraging rounds
     * @param {boolean} [opts.autoSeed=true] - Auto-seed flower field
     */
    constructor(gateway, opts = {}) {
        super();
        this.gateway = gateway;
        this.beeCount = opts.beeCount || DEFAULT_BEE_COUNT;
        this.roundInterval = opts.roundInterval || DEFAULT_ROUND_INTERVAL_MS;
        this.running = false;
        this.timer = null;
        this.round = 0;
        this.startedAt = null;

        // The colony
        this.bees = [];

        // Flower field — task queue with dynamic priority
        this.flowerField = [];
        this.categoryBoosts = {}; // waggle dance boosts

        // Honeycomb — proven results
        this.honeycomb = this._loadHoneycomb();

        // Stats
        this.stats = {
            totalForages: 0,
            totalNectar: 0,
            totalErrors: 0,
            roundsCompleted: 0,
            waggleDances: 0,
            bestCategory: null,
        };

        // Spawn bees
        this._spawnColony();

        // Seed flower field
        if (opts.autoSeed !== false) {
            this._seedFlowerField();
        }
    }

    // ─── Colony Management ──────────────────────────────────────────────

    _spawnColony() {
        // Role distribution inspired by real hive ratios
        const roleDistribution = [
            "forager", "forager", "forager", // 60% foragers
            "scout",                          // 20% scouts
            "nurse",                          // 10% nurses
            "guard",                          // 10% guards
        ];

        for (let i = 0; i < this.beeCount; i++) {
            const role = roleDistribution[i % roleDistribution.length];
            const bee = new HeadyBee({
                gateway: this.gateway,
                role,
                id: `bee-${role}-${i + 1}`,
            });

            // Listen to waggle dances
            bee.on("waggle", (data) => this._onWaggleDance(data));
            bee.on("nectar", (nectar) => this._onNectarReturned(nectar));
            bee.on("error-absorbed", (data) => {
                this.stats.totalErrors++;
                this.emit("error-absorbed", data);
            });

            this.bees.push(bee);
        }
    }

    _seedFlowerField() {
        // Clone the static field and add dynamic state
        this.flowerField = FLOWER_FIELD.map(f => ({
            ...f,
            effectivePriority: f.priority,
            lastForaged: null,
            forageCount: 0,
            cooldownUntil: 0,
        }));
    }

    // ─── Lifecycle ──────────────────────────────────────────────────────

    start() {
        if (this.running) return;
        this.running = true;
        this.startedAt = new Date().toISOString();

        console.log(`\n🐝 ═══ HeadySwarm STARTED ═══`);
        console.log(`   ${this.bees.length} bees spawned | ${this.flowerField.length} flowers in field`);
        console.log(`   Roles: ${this.bees.map(b => b.role).join(", ")}`);
        console.log(`   Round interval: ${this.roundInterval / 1000}s`);
        console.log(`   Honeycomb: ${this.honeycomb.length} stored results`);
        console.log(`🐝 ════════════════════════\n`);

        // First round immediately
        this._runRound();

        // Continuous rounds with circadian rhythm
        this.timer = setInterval(() => this._runRound(), this._circadianInterval());

        // Adapt interval every 10 minutes based on time of day
        this._circadianTimer = setInterval(() => {
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = setInterval(() => this._runRound(), this._circadianInterval());
            }
        }, 600000);

        this.emit("started", { bees: this.bees.length, flowers: this.flowerField.length });
    }

    stop() {
        if (!this.running) return;
        this.running = false;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (this._circadianTimer) { clearInterval(this._circadianTimer); this._circadianTimer = null; }
        this._saveHoneycomb();
        console.log(`🐝 HeadySwarm STOPPED after ${this.round} rounds, ${this.stats.totalForages} forages`);
        this.emit("stopped", this.status());
    }

    // ─── Foraging Round ─────────────────────────────────────────────────

    async _runRound() {
        this.round++;
        const roundStart = Date.now();
        const roundId = `round-${this.round}`;

        // Rest all idle bees first
        for (const bee of this.bees) bee.rest();

        // Select flowers for this round
        const availableBees = this.bees.filter(b => b.canForage());
        const flowers = this._selectFlowers(availableBees.length);

        if (availableBees.length === 0 || flowers.length === 0) {
            return; // no work possible this round
        }

        console.log(`\n🌸 Round #${this.round} — ${availableBees.length} bees foraging ${flowers.length} flowers`);

        // Dispatch bees to flowers IN PARALLEL (the swarm's power)
        const foragePromises = availableBees.slice(0, flowers.length).map((bee, i) => {
            const flower = flowers[i];
            flower.forageCount++;
            flower.lastForaged = Date.now();
            // Add cooldown so same flower isn't picked again too soon
            flower.cooldownUntil = Date.now() + (this.roundInterval * 3);

            return bee.forage(flower).then(nectar => {
                if (nectar.ok) {
                    const preview = (nectar.response || "").substring(0, 80).replace(/\n/g, " ");
                    console.log(`   🍯 ${bee.id} → ${flower.name} [${nectar.quality}q] ${nectar.latencyMs}ms "${preview}..."`);
                } else {
                    console.log(`   💀 ${bee.id} → ${flower.name}: ${nectar.error || "failed"}`);
                }
                return nectar;
            });
        });

        const results = await Promise.allSettled(foragePromises);
        const roundDurationMs = Date.now() - roundStart;

        // Tally
        let roundOk = 0, roundErr = 0;
        for (const r of results) {
            const nectar = r.value || {};
            this.stats.totalForages++;
            if (nectar.ok) {
                roundOk++;
                this.stats.totalNectar += (nectar.response || "").length;
            } else {
                roundErr++;
            }
        }

        this.stats.roundsCompleted++;

        console.log(`   ── Round #${this.round}: ✅ ${roundOk} ❌ ${roundErr} ⏱ ${roundDurationMs}ms | Honeycomb: ${this.honeycomb.length} entries`);

        // Save honeycomb after every round (file is small, persistence is critical)
        this._saveHoneycomb();

        this.emit("round-complete", {
            round: this.round, ok: roundOk, err: roundErr,
            durationMs: roundDurationMs, honeycombSize: this.honeycomb.length,
        });
    }

    /**
     * Select the best flowers for this round.
     * Factors: priority, cooldown, waggle boost, freshness.
     */
    _selectFlowers(count) {
        const now = Date.now();

        return this.flowerField
            .filter(f => f.cooldownUntil < now) // not on cooldown
            .map(f => {
                // Apply waggle dance boost to category
                const boost = this.categoryBoosts[f.category] || 0;
                f.effectivePriority = f.priority + boost;
                return f;
            })
            .sort((a, b) => b.effectivePriority - a.effectivePriority)
            .slice(0, count);
    }

    // ─── Waggle Dance Protocol ──────────────────────────────────────────

    _onWaggleDance(data) {
        this.stats.waggleDances++;

        // High quality nectar → boost that category's priority
        if (data.quality >= 70) {
            const current = this.categoryBoosts[data.taskCategory] || 0;
            this.categoryBoosts[data.taskCategory] = Math.min(current + 2, 10); // cap at +10
        }

        // Decay all boosts slightly each dance (information ages)
        for (const cat of Object.keys(this.categoryBoosts)) {
            if (cat !== data.taskCategory) {
                this.categoryBoosts[cat] = Math.max(0, (this.categoryBoosts[cat] || 0) - 0.5);
            }
        }

        // Track best category
        const sorted = Object.entries(this.categoryBoosts).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) this.stats.bestCategory = sorted[0][0];

        this.emit("waggle-dance", data);
    }

    _onNectarReturned(nectar) {
        if (!nectar.ok) return;

        // Store in honeycomb
        this.honeycomb.push({
            taskId: nectar.taskId,
            taskName: nectar.taskName,
            category: nectar.category,
            response: (nectar.response || "").substring(0, 3000), // cap storage
            engine: nectar.engine,
            model: nectar.model,
            quality: nectar.quality,
            latencyMs: nectar.latencyMs,
            beeId: nectar.beeId,
            role: nectar.role,
            ts: nectar.ts,
        });

        // Trim honeycomb
        if (this.honeycomb.length > MAX_HONEYCOMB_ENTRIES) {
            this.honeycomb = this.honeycomb.slice(-MAX_HONEYCOMB_ENTRIES);
        }
    }

    // ─── Flower Field Management ────────────────────────────────────────

    /** Add a custom task to the flower field. */
    addFlower(flower) {
        this.flowerField.push({
            id: flower.id || `custom-${Date.now()}`,
            name: flower.name || "Custom Task",
            category: flower.category || "custom",
            priority: flower.priority || 5,
            role: flower.role || "forager",
            prompt: flower.prompt,
            system: flower.system,
            effectivePriority: flower.priority || 5,
            lastForaged: null,
            forageCount: 0,
            cooldownUntil: 0,
        });
    }

    // ─── Honeycomb Persistence ───────────────────────────────────────────

    _loadHoneycomb() {
        try {
            if (fs.existsSync(HONEYCOMB_PATH)) {
                const data = JSON.parse(fs.readFileSync(HONEYCOMB_PATH, "utf8"));
                return Array.isArray(data) ? data : [];
            }
        } catch { /* fresh start */ }
        return [];
    }

    _saveHoneycomb() {
        try {
            const dir = path.dirname(HONEYCOMB_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(HONEYCOMB_PATH, JSON.stringify(this.honeycomb, null, 2));
        } catch (err) {
            console.error(`🐝 Honeycomb save error: ${err.message}`);
        }
    }

    // ─── Public API ─────────────────────────────────────────────────────

    status() {
        return {
            running: this.running,
            startedAt: this.startedAt,
            round: this.round,
            bees: this.bees.map(b => b.status()),
            flowerField: {
                total: this.flowerField.length,
                categories: [...new Set(this.flowerField.map(f => f.category))],
                categoryBoosts: { ...this.categoryBoosts },
            },
            honeycomb: {
                total: this.honeycomb.length,
                recentCategories: this.honeycomb.slice(-10).map(h => h.category),
            },
            stats: { ...this.stats },
        };
    }

    /** Get recent honeycomb entries. */
    getHoneycomb(limit = 20) {
        return this.honeycomb.slice(-limit);
    }

    // ─── Circadian Rhythm — Bio-Inspired Scheduling ─────────────────────

    /** Returns adaptive round interval based on time of day.
     *  Active hours (8AM-midnight): faster rounds (base interval)
     *  Sleep hours (midnight-8AM): slower rounds (4x interval) for maintenance
     */
    _circadianInterval() {
        const hour = new Date().getHours();
        if (hour >= 0 && hour < 8) {
            // Night mode — slow foraging, let the system breathe
            return this.roundInterval * 4;
        } else if (hour >= 8 && hour < 12) {
            // Morning — ramp up
            return this.roundInterval;
        } else if (hour >= 12 && hour < 18) {
            // Peak hours — full throttle
            return Math.max(this.roundInterval * 0.75, 30000);
        } else {
            // Evening — steady state
            return this.roundInterval;
        }
    }
}

module.exports = HeadySwarm;
module.exports.FLOWER_FIELD = FLOWER_FIELD;
