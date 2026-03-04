const {
    LiquidAllocator,
    analyzeContext,
    calculateAffinity,
    COMPONENT_REGISTRY,
    STORAGE_TOPOLOGY,
    HF_SPACES_TOPOLOGY,
} = require('../src/hc_liquid');

describe('HeadyLiquid — Liquid Architecture Engine', () => {
    // ─── COMPONENT_REGISTRY ─────────────────────────────────────────
    test('COMPONENT_REGISTRY contains all 14 liquid components', () => {
        const expected = [
            'brain', 'soul', 'conductor', 'battle', 'vinci', 'patterns',
            'lens', 'notion', 'ops', 'maintenance', 'auto-success',
            'stream', 'buddy', 'cloud',
        ];
        for (const name of expected) {
            expect(COMPONENT_REGISTRY).toHaveProperty(name);
        }
        expect(Object.keys(COMPONENT_REGISTRY)).toHaveLength(14);
    });

    test('every component has required fields', () => {
        for (const [id, comp] of Object.entries(COMPONENT_REGISTRY)) {
            expect(comp).toHaveProperty('capabilities');
            expect(comp).toHaveProperty('contexts');
            expect(comp).toHaveProperty('weight');
            expect(comp).toHaveProperty('providers');
            expect(comp).toHaveProperty('providerPriority');
            expect(Array.isArray(comp.capabilities)).toBe(true);
            expect(Array.isArray(comp.contexts)).toBe(true);
            expect(typeof comp.weight).toBe('number');
        }
    });

    // ─── STORAGE_TOPOLOGY ───────────────────────────────────────────
    test('STORAGE_TOPOLOGY defines 10 data categories', () => {
        expect(Object.keys(STORAGE_TOPOLOGY)).toHaveLength(10);
        for (const [key, entry] of Object.entries(STORAGE_TOPOLOGY)) {
            expect(entry).toHaveProperty('description');
            expect(entry).toHaveProperty('primary');
            expect(entry).toHaveProperty('priority');
            expect(Array.isArray(entry.priority)).toBe(true);
        }
    });

    // ─── HF_SPACES_TOPOLOGY ────────────────────────────────────────
    test('HF_SPACES_TOPOLOGY defines 3 distributed nodes', () => {
        expect(Object.keys(HF_SPACES_TOPOLOGY)).toHaveLength(3);
        expect(HF_SPACES_TOPOLOGY).toHaveProperty('main');
        expect(HF_SPACES_TOPOLOGY).toHaveProperty('connection');
        expect(HF_SPACES_TOPOLOGY).toHaveProperty('systems');
        for (const [key, space] of Object.entries(HF_SPACES_TOPOLOGY)) {
            expect(space).toHaveProperty('slug');
            expect(space).toHaveProperty('providers');
            expect(space).toHaveProperty('components');
        }
    });

    // ─── analyzeContext ─────────────────────────────────────────────
    test('analyzeContext produces correct labels for chat request', () => {
        const ctx = analyzeContext({ type: 'chat', userFacing: true });
        expect(ctx.labels).toContain('user-facing');
        expect(ctx.labels).toContain('user-chat');
        expect(ctx.labels).toContain('every-request');
        expect(ctx.type).toBe('chat');
    });

    test('analyzeContext adds creative labels when creative=true', () => {
        const ctx = analyzeContext({ creative: true });
        expect(ctx.labels).toContain('creative-task');
        expect(ctx.labels).toContain('canvas-design');
    });

    test('analyzeContext adds depth labels when depth=true', () => {
        const ctx = analyzeContext({ depth: true });
        expect(ctx.labels).toContain('deep-scan');
        expect(ctx.labels).toContain('self-critique');
    });

    test('analyzeContext adds high-stakes label for critical urgency', () => {
        const ctx = analyzeContext({ urgency: 'critical' });
        expect(ctx.labels).toContain('high-stakes-decision');
    });

    test('analyzeContext adds background labels for background type', () => {
        const ctx = analyzeContext({ type: 'background' });
        expect(ctx.labels).toContain('background');
        expect(ctx.labels).toContain('continuous-improvement');
    });

    // ─── calculateAffinity ──────────────────────────────────────────
    test('calculateAffinity returns 0 for unknown component', () => {
        const ctx = analyzeContext({ type: 'chat' });
        expect(calculateAffinity('nonexistent', ctx)).toBe(0);
    });

    test('calculateAffinity scores brain highest for chat context', () => {
        const ctx = analyzeContext({ type: 'chat', speed: true });
        const brainAffinity = calculateAffinity('brain', ctx);
        const maintenanceAffinity = calculateAffinity('maintenance', ctx);
        expect(brainAffinity).toBeGreaterThan(maintenanceAffinity);
    });

    test('calculateAffinity gives always-present components a baseline', () => {
        const ctx = analyzeContext({});
        // patterns is alwaysPresent
        const patternsAffinity = calculateAffinity('patterns', ctx);
        expect(patternsAffinity).toBeGreaterThan(0);
    });

    // ─── LiquidAllocator ────────────────────────────────────────────
    test('LiquidAllocator initializes all 14 components', () => {
        const allocator = new LiquidAllocator();
        const state = allocator.getState();
        expect(Object.keys(state)).toHaveLength(14);
        for (const [id, alloc] of Object.entries(state)) {
            expect(alloc).toHaveProperty('presences');
            expect(alloc).toHaveProperty('activeInstances');
            expect(alloc).toHaveProperty('capabilities');
            expect(Array.isArray(alloc.presences)).toBe(true);
            expect(alloc.presences).toContain('local');
        }
    });

    test('allocate returns top components sorted by affinity', () => {
        const allocator = new LiquidAllocator();
        const flow = allocator.allocate({ type: 'chat', speed: true });

        expect(flow).toHaveProperty('id');
        expect(flow).toHaveProperty('context');
        expect(flow).toHaveProperty('allocated');
        expect(flow).toHaveProperty('ts');
        expect(flow.allocated.length).toBeGreaterThan(0);
        expect(flow.allocated.length).toBeLessThanOrEqual(6);

        // Should be sorted descending
        for (let i = 1; i < flow.allocated.length; i++) {
            expect(flow.allocated[i - 1].affinity).toBeGreaterThanOrEqual(flow.allocated[i].affinity);
        }
    });

    test('allocate increments totalFlows and records in flowLog', () => {
        const allocator = new LiquidAllocator();
        expect(allocator.totalFlows).toBe(0);
        allocator.allocate({ type: 'chat' });
        allocator.allocate({ type: 'orchestration' });
        expect(allocator.totalFlows).toBe(2);
        expect(allocator.getFlows()).toHaveLength(2);
    });

    test('allocate emits flow:allocated event', () => {
        const allocator = new LiquidAllocator();
        let emitted = null;
        allocator.on('flow:allocated', (flow) => { emitted = flow; });
        allocator.allocate({ type: 'chat' });
        expect(emitted).not.toBeNull();
        expect(emitted.id).toBe('flow-1');
    });

    test('getFlows respects limit parameter', () => {
        const allocator = new LiquidAllocator();
        for (let i = 0; i < 10; i++) {
            allocator.allocate({ type: 'chat' });
        }
        expect(allocator.getFlows(3)).toHaveLength(3);
        expect(allocator.getFlows()).toHaveLength(10);
    });

    test('cloud component gets cloudflare-edge presence', () => {
        const allocator = new LiquidAllocator();
        const state = allocator.getState();
        expect(state.cloud.presences).toContain('cloudflare-edge');
    });

    test('stream component gets sse-channel and websocket presences', () => {
        const allocator = new LiquidAllocator();
        const state = allocator.getState();
        expect(state.stream.presences).toContain('sse-channel');
        expect(state.stream.presences).toContain('websocket');
    });
});
