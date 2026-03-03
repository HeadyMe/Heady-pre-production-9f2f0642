/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */

/**
 * Predictive Suggestion Engine for HeadyBuddy
 *
 * Context-aware suggestion chips based on:
 *  - Time of day
 *  - Recent activity / chat history
 *  - User skill level (inferred from interactions)
 *  - Current system state (services up/down)
 *
 * Progressive disclosure: show 5 smart suggestions,
 * expandable via "Show more" to full catalog.
 */

const SUGGESTION_CATALOG = {
    // ─── Time-of-day aware ──────────────────────────────────────────
    morning: [
        { label: "☀️ Morning briefing", prompt: "Give me a morning briefing on Heady system status" },
        { label: "📋 Today's priorities", prompt: "What should I focus on today based on recent pipeline runs?" },
    ],
    evening: [
        { label: "📊 Daily wrap-up", prompt: "Summarize today's pipeline activity and key metrics" },
        { label: "🔒 End-of-day security check", prompt: "Run a quick security audit on today's changes" },
    ],

    // ─── System-state aware ─────────────────────────────────────────
    systemDown: [
        { label: "🔴 Diagnose outage", prompt: "Which services are down and what's the root cause?" },
        { label: "🔄 Restart services", prompt: "Restart all unhealthy services" },
    ],
    allHealthy: [
        { label: "🚀 Deploy latest", prompt: "Deploy the latest changes to production" },
        { label: "📈 Performance report", prompt: "Show me the performance metrics for the last 24 hours" },
    ],

    // ─── Capability discovery ───────────────────────────────────────
    didYouKnow: [
        { label: "🧠 Memory search", prompt: "Search my Heady memory for recent conversations about security" },
        { label: "📋 Clipboard sync", prompt: "Enable cross-device clipboard sync" },
        { label: "🎨 Output formats", prompt: "Show me all 15 output formats HeadyBuddy supports" },
        { label: "🔬 Deep research", prompt: "Do deep research on the latest AI agent frameworks" },
        { label: "⚔️ Arena mode", prompt: "Run a HeadyBattle arena competition on my latest code" },
    ],

    // ─── Always available ───────────────────────────────────────────
    universal: [
        { label: "❓ Help", prompt: "What can HeadyBuddy do?" },
        { label: "⚡ Quick status", prompt: "Give me a quick system status" },
        { label: "🔍 Search docs", prompt: "Search the Heady documentation" },
    ],
};

/**
 * Get context-aware suggestions.
 * @param {Object} context
 * @param {number} [context.hour] - Current hour (0-23)
 * @param {boolean} [context.systemHealthy] - Are all services up?
 * @param {string[]} [context.recentTopics] - Topics from recent chat
 * @param {number} [context.sessionCount] - User's total session count
 * @param {number} [limit=5] - Max suggestions to return
 * @returns {Array<{label: string, prompt: string, category: string}>}
 */
function getSuggestions(context = {}, limit = 5) {
    const hour = context.hour ?? new Date().getHours();
    const suggestions = [];

    // Time-of-day suggestions
    if (hour >= 5 && hour < 12) {
        suggestions.push(...SUGGESTION_CATALOG.morning.map(s => ({ ...s, category: "time" })));
    } else if (hour >= 17 || hour < 5) {
        suggestions.push(...SUGGESTION_CATALOG.evening.map(s => ({ ...s, category: "time" })));
    }

    // System state suggestions
    if (context.systemHealthy === false) {
        suggestions.push(...SUGGESTION_CATALOG.systemDown.map(s => ({ ...s, category: "system" })));
    } else {
        suggestions.push(...SUGGESTION_CATALOG.allHealthy.map(s => ({ ...s, category: "system" })));
    }

    // "Did you know?" for newer users or to surface hidden features
    if (!context.sessionCount || context.sessionCount < 10) {
        const randomTip = SUGGESTION_CATALOG.didYouKnow[Math.floor(Math.random() * SUGGESTION_CATALOG.didYouKnow.length)];
        suggestions.push({ ...randomTip, category: "discover" });
    }

    // Universal always included
    suggestions.push(...SUGGESTION_CATALOG.universal.map(s => ({ ...s, category: "universal" })));

    // Deduplicate by prompt and limit
    const seen = new Set();
    return suggestions.filter(s => {
        if (seen.has(s.prompt)) return false;
        seen.add(s.prompt);
        return true;
    }).slice(0, limit);
}

/**
 * Get a "Did you know?" tip for post-task moments.
 * @returns {{label: string, prompt: string}}
 */
function getDidYouKnowTip() {
    const tips = SUGGESTION_CATALOG.didYouKnow;
    return tips[Math.floor(Math.random() * tips.length)];
}

module.exports = {
    SUGGESTION_CATALOG,
    getSuggestions,
    getDidYouKnowTip,
};
