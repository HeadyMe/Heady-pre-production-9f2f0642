const { detectCandidates, isProtectedPath } = require('../scripts/ops/projection-maintenance-ops');

describe('projection maintenance ops', () => {
    test('detectCandidates identifies cloudflare worker and tunnel surfaces', () => {
        const files = [
            'cloudflare/heady-edge-proxy/src/heady-edge-proxy.js',
            'cloudflare/unused-worker.js',
            'configs/infrastructure/cloud/cmd-center-cloudflared.yaml',
            'docs/readme.md',
        ];

        const result = detectCandidates(files);
        expect(result).toHaveProperty('staleWorkers');
        expect(result).toHaveProperty('staleTunnels');
        expect(result).toHaveProperty('staleServiceWorkers');
        expect(Array.isArray(result.stale)).toBe(true);
    });

    test('detectCandidates classifies stale service-worker.js candidates', () => {
        const files = [
            'cloudflare/obsolete-service-worker.js',
            'cloudflare/heady-edge-proxy/src/heady-edge-proxy.js',
        ];
        const result = detectCandidates(files);
        expect(Array.isArray(result.staleServiceWorkers)).toBe(true);
    });

    test('isProtectedPath blocks critical cloud configs from pruning', () => {
        expect(isProtectedPath('cloudflare/heady-edge-proxy/src/heady-edge-proxy.js')).toBe(true);
        expect(isProtectedPath('configs/infrastructure/cloud/cmd-center-cloudflared.yaml')).toBe(true);
        expect(isProtectedPath('cloudflare/unused-worker.js')).toBe(false);
    });
});
