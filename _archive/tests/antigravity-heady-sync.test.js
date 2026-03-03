const fs = require('fs');
const path = require('path');
const { runOnce } = require('../scripts/autonomous/antigravity-heady-sync');

describe('antigravity heady sync', () => {
    test('generates antigravity runtime state snapshot', () => {
        runOnce();
        const snapshotPath = path.join(__dirname, '..', 'configs', 'services', 'antigravity-heady-runtime-state.json');
        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

        expect(snapshot.enforcedGateway).toBe('heady');
        expect(snapshot.workspaceMode).toBe('3d-vector');
        expect(snapshot.samplePlan.enforced).toBe(true);
        expect(snapshot.topTemplates.length).toBeGreaterThan(0);
    });
});
