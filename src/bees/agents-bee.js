/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Agents Bee — Covers all src/agents/ modules:
 * buddy-error-protocol (479), claude-code-agent, heady-buddy-agent,
 * heady-fintech-agent, nonprofit-agent, pipeline-handlers
 */
const domain = 'agents';
const description = 'All agent types: buddy-error, claude-code, buddy, fintech, nonprofit, pipeline-handlers';
const priority = 0.85;

function getWork(ctx = {}) {
    const mods = [
        'buddy-error-protocol', 'claude-code-agent', 'heady-buddy-agent',
        'heady-fintech-agent', 'nonprofit-agent', 'pipeline-handlers',
    ];
    return mods.map(name => async () => {
        try { require(`../agents/${name}`); return { bee: domain, action: name, loaded: true }; }
        catch { return { bee: domain, action: name, loaded: false }; }
    });
}

module.exports = { domain, description, priority, getWork };
