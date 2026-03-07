// MCP Service Registry — All 42 Heady Skills as MCP-Compatible Services
// Generated: March 7, 2026
// Each skill maps to an MCP tool endpoint with typed parameters

const PHI = 1.618033988749895;

/**
 * Heady MCP Service Registry
 * Maps all 42 skills to MCP service definitions with:
 * - tool name (MCP-compatible snake_case)
 * - description
 * - parameter schema
 * - priority tier (phi-scaled)
 * - category
 */
const MCP_SERVICES = {
    // ═══════════════════════════════════════════════════════════
    // TIER 1 — CRITICAL INFRASTRUCTURE (φ^0 priority)
    // ═══════════════════════════════════════════════════════════

    heady_deep_scan: {
        tool: 'heady_deep_scan',
        description: 'Project-wide context mapping via HeadyDeepScan — maps entire workspace into 3D vector memory',
        category: 'intelligence',
        priority: Math.pow(PHI, 0),
        parameters: {
            directory: { type: 'string', required: true, description: 'Root directory to scan' },
            depth: { type: 'number', default: 10, description: 'Max scan depth' },
        },
    },

    heady_auto_flow: {
        tool: 'heady_auto_flow',
        description: 'Full auto-success pipeline — chains Battle, Coder, Analyze, Risks, Patterns',
        category: 'orchestration',
        priority: Math.pow(PHI, 0),
        parameters: {
            task: { type: 'string', required: true, description: 'Task description' },
            code: { type: 'string', description: 'Initial code to process' },
            context: { type: 'string', description: 'Additional context' },
        },
    },

    heady_agent_orchestration: {
        tool: 'heady_agent_orchestration',
        description: 'Latent OS agent decomposition — planner-executor-validator structure with swarm coordination',
        category: 'orchestration',
        priority: Math.pow(PHI, 0),
        parameters: {
            objective: { type: 'string', required: true, description: 'High-level objective to decompose' },
            max_agents: { type: 'number', default: 17, description: 'Maximum parallel agents' },
            strategy: { type: 'string', enum: ['parallel', 'sequential', 'hybrid'], default: 'hybrid' },
        },
    },

    heady_csl_engine: {
        tool: 'heady_csl_engine',
        description: 'Continuous Semantic Logic engine — fuzzy gates, resonance, superposition, entanglement',
        category: 'intelligence',
        priority: Math.pow(PHI, 0),
        parameters: {
            input: { type: 'string', required: true, description: 'Input to evaluate through CSL gates' },
            gates: { type: 'array', description: 'Specific gates to apply', items: { type: 'string' } },
            threshold: { type: 'number', description: 'Phi-scaled activation threshold' },
        },
    },

    heady_memory_ops: {
        tool: 'heady_memory_ops',
        description: 'Persistent 3D vector memory — search, store, embed, learn via HeadyMemory',
        category: 'memory',
        priority: Math.pow(PHI, 0),
        parameters: {
            action: { type: 'string', required: true, enum: ['search', 'store', 'embed', 'recall', 'forget'] },
            query: { type: 'string', description: 'Search query or content to store' },
            namespace: { type: 'string', default: 'default', description: 'Memory namespace' },
        },
    },

    // ═══════════════════════════════════════════════════════════
    // TIER 2 — CORE CAPABILITIES (φ^0.25 priority)
    // ═══════════════════════════════════════════════════════════

    heady_battle_arena: {
        tool: 'heady_battle_arena',
        description: 'Competitive AI evaluation — pit AI nodes against each other for best solution',
        category: 'intelligence',
        priority: Math.pow(PHI, 0.25),
        parameters: {
            challenge: { type: 'string', required: true, description: 'Challenge description' },
            contestants: { type: 'array', description: 'AI nodes to compete', items: { type: 'string' } },
            rounds: { type: 'number', default: 3 },
        },
    },

    heady_code_generation: {
        tool: 'heady_code_generation',
        description: 'Multi-model code generation, refactoring, and inline suggestions',
        category: 'development',
        priority: Math.pow(PHI, 0.25),
        parameters: {
            task: { type: 'string', required: true, description: 'Code generation task' },
            language: { type: 'string', default: 'javascript' },
            model: { type: 'string', description: 'Preferred model' },
        },
    },

    heady_security_audit: {
        tool: 'heady_security_audit',
        description: 'Comprehensive security auditing — vulnerability scanning, risk assessment, mitigation',
        category: 'security',
        priority: Math.pow(PHI, 0.25),
        parameters: {
            target: { type: 'string', required: true, description: 'File or directory to audit' },
            depth: { type: 'string', enum: ['quick', 'standard', 'deep'], default: 'standard' },
        },
    },

    heady_research: {
        tool: 'heady_research',
        description: 'Deep web research with citations via Perplexity Sonar Pro',
        category: 'intelligence',
        priority: Math.pow(PHI, 0.25),
        parameters: {
            query: { type: 'string', required: true, description: 'Research query' },
            depth: { type: 'string', enum: ['quick', 'deep', 'exhaustive'], default: 'deep' },
        },
    },

    heady_perplexity: {
        tool: 'heady_perplexity',
        description: 'Full Perplexity Enterprise Max — sonar search, deep research, reasoning, embeddings',
        category: 'intelligence',
        priority: Math.pow(PHI, 0.25),
        parameters: {
            query: { type: 'string', required: true },
            model: { type: 'string', enum: ['sonar', 'sonar-pro', 'sonar-deep-research', 'sonar-reasoning-pro'] },
        },
    },

    heady_gateway_routing: {
        tool: 'heady_gateway_routing',
        description: 'Multi-provider AI routing — choose models based on workload, optimize caching',
        category: 'infrastructure',
        priority: Math.pow(PHI, 0.25),
        parameters: {
            request: { type: 'object', required: true, description: 'AI request to route' },
            strategy: { type: 'string', enum: ['fastest', 'cheapest', 'best', 'round-robin'] },
        },
    },

    heady_liquid_gateway: {
        tool: 'heady_liquid_gateway',
        description: 'Dynamic liquid architecture for AI routing — provider racing, MCP transport, BYOK',
        category: 'infrastructure',
        priority: Math.pow(PHI, 0.25),
        parameters: {
            action: { type: 'string', required: true, enum: ['route', 'race', 'stream', 'health'] },
            payload: { type: 'object', description: 'Request payload' },
        },
    },

    heady_reliability_orchestrator: {
        tool: 'heady_reliability_orchestrator',
        description: 'Self-healing, health checks, drift detection, quarantine and respawn',
        category: 'infrastructure',
        priority: Math.pow(PHI, 0.25),
        parameters: {
            action: { type: 'string', required: true, enum: ['health', 'quarantine', 'respawn', 'drift-check'] },
            target: { type: 'string', description: 'Service or component to check' },
        },
    },

    // ═══════════════════════════════════════════════════════════
    // TIER 3 — EXTENDED CAPABILITIES (φ^0.5 priority)
    // ═══════════════════════════════════════════════════════════

    heady_agent_factory: {
        tool: 'heady_agent_factory',
        description: 'Decompose objectives into specialized sub-agents with clear responsibilities',
        category: 'orchestration',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            objective: { type: 'string', required: true },
            constraints: { type: 'object', description: 'Resource and time constraints' },
        },
    },

    heady_task_decomposition: {
        tool: 'heady_task_decomposition',
        description: 'Break complex tasks into executable sub-tasks with dependency graphs',
        category: 'orchestration',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            task: { type: 'string', required: true },
            max_depth: { type: 'number', default: 5 },
        },
    },

    heady_semantic_backpressure: {
        tool: 'heady_semantic_backpressure',
        description: 'Semantic flow control — prevent agent overload through backpressure signals',
        category: 'orchestration',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            queue_depth: { type: 'number', description: 'Current queue depth' },
            action: { type: 'string', enum: ['check', 'throttle', 'release'] },
        },
    },

    heady_context_window_manager: {
        tool: 'heady_context_window_manager',
        description: 'Intelligent context window management — compress, prioritize, evict context',
        category: 'memory',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            action: { type: 'string', required: true, enum: ['compress', 'summarize', 'evict', 'status'] },
            tokens: { type: 'number', description: 'Target token budget' },
        },
    },

    heady_embedding_router: {
        tool: 'heady_embedding_router',
        description: 'Route embedding requests to optimal model based on input type and requirements',
        category: 'intelligence',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            text: { type: 'string', required: true },
            model: { type: 'string', description: 'Specific embedding model' },
            dimensions: { type: 'number', default: 1536 },
        },
    },

    heady_graph_rag_memory: {
        tool: 'heady_graph_rag_memory',
        description: 'Graph-based RAG with knowledge graph traversal and entity linking',
        category: 'memory',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            query: { type: 'string', required: true },
            depth: { type: 'number', default: 3, description: 'Graph traversal depth' },
        },
    },

    heady_hybrid_vector_search: {
        tool: 'heady_hybrid_vector_search',
        description: 'Hybrid search combining dense vectors, sparse BM25, and graph traversal',
        category: 'memory',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            query: { type: 'string', required: true },
            k: { type: 'number', default: 10, description: 'Number of results' },
            alpha: { type: 'number', default: 0.618, description: 'Dense/sparse blend (phi-scaled)' },
        },
    },

    heady_vsa_hyperdimensional: {
        tool: 'heady_vsa_hyperdimensional',
        description: 'Vector-symbolic architecture — bind, bundle, permute, similarity for state logic',
        category: 'intelligence',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            operation: { type: 'string', required: true, enum: ['bind', 'bundle', 'permute', 'similarity', 'encode'] },
            vectors: { type: 'array', items: { type: 'string' } },
        },
    },

    heady_phi_math_foundation: {
        tool: 'heady_phi_math_foundation',
        description: 'Phi mathematics foundation — golden ratio scaling, Fibonacci sequences, sacred geometry',
        category: 'intelligence',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            operation: { type: 'string', required: true, enum: ['scale', 'fibonacci', 'golden-spiral', 'threshold'] },
            value: { type: 'number', required: true },
            exponent: { type: 'number', default: 1 },
        },
    },

    heady_deployment: {
        tool: 'heady_deployment',
        description: 'Deploy, monitor, scale, and maintain services via HeadyDeploy and HeadyOps',
        category: 'infrastructure',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            action: { type: 'string', required: true, enum: ['deploy', 'rollback', 'scale', 'health', 'logs'] },
            service: { type: 'string', required: true },
            environment: { type: 'string', default: 'production' },
        },
    },

    heady_edge_ai: {
        tool: 'heady_edge_ai',
        description: 'Ultra-low latency AI inference on Cloudflare edge — embeddings, chat, classification',
        category: 'infrastructure',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            task: { type: 'string', required: true, enum: ['embed', 'chat', 'classify', 'vectorize'] },
            input: { type: 'string', required: true },
            region: { type: 'string', description: 'Edge region preference' },
        },
    },

    heady_self_healing_lifecycle: {
        tool: 'heady_self_healing_lifecycle',
        description: 'Detect failures, quarantine, attest, respawn, and prevent repeated breakdowns',
        category: 'infrastructure',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            action: { type: 'string', required: true, enum: ['detect', 'quarantine', 'attest', 'respawn', 'status'] },
            component: { type: 'string', description: 'Target component' },
        },
    },

    heady_multi_model: {
        tool: 'heady_multi_model',
        description: 'Cross-provider AI routing — Claude, GPT-4o, Gemini, Groq through unified interface',
        category: 'intelligence',
        priority: Math.pow(PHI, 0.5),
        parameters: {
            prompt: { type: 'string', required: true },
            model: { type: 'string', description: 'Specific model or "best"' },
            provider: { type: 'string', enum: ['anthropic', 'openai', 'google', 'groq', 'auto'] },
        },
    },

    // ═══════════════════════════════════════════════════════════
    // TIER 4 — SPECIALIZED SERVICES (φ^1 priority)
    // ═══════════════════════════════════════════════════════════

    heady_auth_provider_federation: {
        tool: 'heady_auth_provider_federation',
        description: 'OAuth provider federation — auto-wired routes, frontend buttons, profile extraction',
        category: 'identity',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['register', 'list', 'validate', 'generate'] },
            provider: { type: 'string', description: 'OAuth provider name' },
        },
    },

    heady_sovereign_identity_byok: {
        tool: 'heady_sovereign_identity_byok',
        description: 'User-controlled identity and bring-your-own-key model access',
        category: 'identity',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['register-key', 'validate', 'rotate', 'revoke'] },
            key_type: { type: 'string', description: 'Type of key (api, oauth, signing)' },
        },
    },

    heady_companion_memory: {
        tool: 'heady_companion_memory',
        description: 'Persistent assistant with long-term memory, preference learning, anticipatory suggestions',
        category: 'memory',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['learn', 'recall', 'suggest', 'preferences'] },
            context: { type: 'string', description: 'Current interaction context' },
        },
    },

    heady_memory_knowledge_os: {
        tool: 'heady_memory_knowledge_os',
        description: 'Latent OS memory + knowledge layer — persistent memory, repo-to-docs, briefing packs',
        category: 'memory',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['ingest', 'brief', 'export', 'status'] },
            source: { type: 'string', description: 'Source path or URL' },
        },
    },

    heady_knowledge_ingestion: {
        tool: 'heady_knowledge_ingestion',
        description: 'Turn repos, notes, and materials into structured knowledge packs',
        category: 'memory',
        priority: Math.pow(PHI, 1),
        parameters: {
            source: { type: 'string', required: true, description: 'Source path or URL' },
            format: { type: 'string', enum: ['briefing', 'docs', 'knowledge-pack'], default: 'knowledge-pack' },
        },
    },

    heady_cross_device_sync: {
        tool: 'heady_cross_device_sync',
        description: 'Cross-device state sync, session handoff, shared context, presence tracking',
        category: 'infrastructure',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['sync', 'handoff', 'presence', 'broadcast'] },
            device_id: { type: 'string', description: 'Target device' },
        },
    },

    heady_mcp_gateway_zero_trust: {
        tool: 'heady_mcp_gateway_zero_trust',
        description: 'MCP gateway with zero-trust security model and connection pooling',
        category: 'security',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['validate', 'authorize', 'audit', 'block'] },
            request: { type: 'object', description: 'MCP request to validate' },
        },
    },

    heady_mcp_streaming_interface: {
        tool: 'heady_mcp_streaming_interface',
        description: 'MCP-compatible streaming interface — JSON-RPC, SSE transport, tool contracts',
        category: 'infrastructure',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['stream', 'invoke', 'subscribe', 'health'] },
            method: { type: 'string', description: 'MCP method name' },
        },
    },

    heady_durable_agent_state: {
        tool: 'heady_durable_agent_state',
        description: 'Durable agent state management — persist, restore, checkpoint agent state',
        category: 'orchestration',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['save', 'restore', 'checkpoint', 'list'] },
            agent_id: { type: 'string', description: 'Agent identifier' },
        },
    },

    heady_monetization_platform: {
        tool: 'heady_monetization_platform',
        description: 'Usage metering, feature gating, Stripe integration, revenue tracking',
        category: 'business',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['meter', 'gate', 'billing', 'usage-report'] },
            customer_id: { type: 'string', description: 'Customer identifier' },
        },
    },

    heady_ide_control_plane: {
        tool: 'heady_ide_control_plane',
        description: 'IDE as control plane for latent OS — routing tools, models, memory through IDE',
        category: 'development',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['route', 'configure', 'status', 'connect'] },
            target: { type: 'string', description: 'Target service or tool' },
        },
    },

    heady_ide_governed_codeflow: {
        tool: 'heady_ide_governed_codeflow',
        description: 'Governed code changes — validation, auto-correction, approval gates, rollback',
        category: 'development',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['propose', 'validate', 'approve', 'rollback'] },
            diff: { type: 'string', description: 'Code diff to validate' },
        },
    },

    heady_domain_architecture: {
        tool: 'heady_domain_architecture',
        description: 'Domain routing, Cloudflare integration, OAuth callback normalization',
        category: 'infrastructure',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['map', 'route', 'validate', 'audit'] },
            domain: { type: 'string', description: 'Domain to configure' },
        },
    },

    heady_drupal_headless: {
        tool: 'heady_drupal_headless',
        description: 'Headless Drupal operations — JSON:API, custom modules, endpoint verification',
        category: 'development',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['query', 'create', 'update', 'verify'] },
            endpoint: { type: 'string', description: 'API endpoint' },
        },
    },

    heady_installable_package: {
        tool: 'heady_installable_package',
        description: 'Package, verify, and publish installable Heady surfaces',
        category: 'business',
        priority: Math.pow(PHI, 1),
        parameters: {
            action: { type: 'string', required: true, enum: ['package', 'verify', 'publish', 'list'] },
            target: { type: 'string', description: 'Package to build' },
        },
    },
};

// ═══════════════════════════════════════════════════════════
// SERVICE DISCOVERY & ROUTING
// ═══════════════════════════════════════════════════════════

/**
 * Get all services sorted by phi-priority (highest first)
 */
function getAllServices() {
    return Object.values(MCP_SERVICES).sort((a, b) => a.priority - b.priority);
}

/**
 * Get services by category
 */
function getServicesByCategory(category) {
    return Object.values(MCP_SERVICES)
        .filter(s => s.category === category)
        .sort((a, b) => a.priority - b.priority);
}

/**
 * Get service by tool name
 */
function getService(toolName) {
    return MCP_SERVICES[toolName] || null;
}

/**
 * Get all unique categories
 */
function getCategories() {
    return [...new Set(Object.values(MCP_SERVICES).map(s => s.category))].sort();
}

/**
 * Generate MCP manifest for all services
 */
function generateMCPManifest() {
    return {
        name: 'heady-mcp-server',
        version: '4.0.0',
        description: 'Heady™ Latent OS — 42 MCP Services for AI Orchestration',
        transport: ['stdio', 'sse'],
        tools: Object.entries(MCP_SERVICES).map(([key, svc]) => ({
            name: svc.tool,
            description: svc.description,
            inputSchema: {
                type: 'object',
                properties: svc.parameters,
                required: Object.entries(svc.parameters)
                    .filter(([, v]) => v.required)
                    .map(([k]) => k),
            },
        })),
        categories: getCategories(),
        total_services: Object.keys(MCP_SERVICES).length,
    };
}

module.exports = {
    MCP_SERVICES,
    getAllServices,
    getServicesByCategory,
    getService,
    getCategories,
    generateMCPManifest,
};
