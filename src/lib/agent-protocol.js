/**
 * T10: Cross-Language Agent Protocol (A2A / AG-UI adapter)
 * @module src/lib/agent-protocol
 */
'use strict';

class AgentProtocolAdapter {
    constructor(opts = {}) {
        this.protocolVersion = '1.0';
        this.agentId = opts.agentId || process.env.HEADY_SERVICE_NAME || 'heady-agent';
        this.capabilities = opts.capabilities || ['chat', 'tool_use', 'memory', 'orchestration'];
    }

    // A2A discovery endpoint
    getAgentCard() {
        return {
            name: this.agentId,
            description: 'Heady Sovereign AI Agent',
            url: process.env.AGENT_URL || `http://localhost:${process.env.PORT || 3000}`,
            version: this.protocolVersion,
            capabilities: {
                streaming: true,
                pushNotifications: false,
                stateTransitionHistory: true,
            },
            defaultInputModes: ['text'],
            defaultOutputModes: ['text'],
            skills: this.capabilities.map(c => ({ id: c, name: c, description: `Heady ${c} capability` })),
        };
    }

    // Convert between A2A task format and Heady internal format
    fromA2A(task) {
        return {
            id: task.id,
            messages: (task.history || []).map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.parts?.map(p => p.text || p.data || '').join('') || '',
            })),
            metadata: task.metadata || {},
        };
    }

    toA2A(result) {
        return {
            id: result.id || `task_${Date.now()}`,
            status: { state: result.error ? 'failed' : 'completed' },
            artifacts: result.output ? [{
                parts: [{ type: 'text', text: String(result.output) }],
            }] : [],
            history: result.messages || [],
        };
    }

    // AG-UI event stream adapter
    toAGUIEvents(result) {
        const events = [];
        if (result.thinking) events.push({ type: 'REASONING', content: result.thinking });
        if (result.toolCalls) {
            for (const tc of result.toolCalls) {
                events.push({ type: 'TOOL_CALL', name: tc.name, args: tc.args });
                events.push({ type: 'TOOL_RESULT', name: tc.name, result: tc.result });
            }
        }
        if (result.output) events.push({ type: 'TEXT', content: String(result.output) });
        events.push({ type: 'DONE' });
        return events;
    }

    // Express routes
    routes(router) {
        router.get('/.well-known/agent.json', (req, res) => res.json(this.getAgentCard()));
        router.post('/a2a/tasks', async (req, res) => {
            const internal = this.fromA2A(req.body);
            // Route to Heady conductor for processing
            res.json(this.toA2A({ id: internal.id, output: 'Agent processing initiated' }));
        });
        return router;
    }
}

module.exports = AgentProtocolAdapter;
