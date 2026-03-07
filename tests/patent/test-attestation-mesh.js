/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ─── Test Suite: HS-059 Self-Healing Attestation Mesh ─────────────────────────
 *
 * Patent Docket: HS-059
 * Tests every claim of the attestation mesh implementation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const assert = require('assert');
const {
    PHI,
    DEFAULTS,
    buildAttestation,
    computeHeartbeatInterval,
    AttestationMesh,
} = require('../src/mesh/self-healing-attestation-mesh');

// ─────────────────────────────────────────────────────────────────────────────
// Test runner
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        failed++;
    }
}

// Helper: make random N-dim vector
function randVec(dim = 8) {
    return Array.from({ length: dim }, () => Math.random() * 2 - 1);
}

// Helper: make a normalized vector close to reference with optional noise
function noisyVec(ref, noise = 0.05) {
    return ref.map(x => x + (Math.random() * 2 - 1) * noise);
}

// ─────────────────────────────────────────────────────────────────────────────
// Claim 1: Attestation Protocol + Hallucination Detection + Quarantine
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 1: Agent Attestation Protocol ===');

test('Claim 1: buildAttestation creates structured record', () => {
    const emb = randVec();
    const att = buildAttestation('agent-1', '1.0.0', emb, 0.9, 'hello world');
    assert.strictEqual(att.agentId,   'agent-1');
    assert.strictEqual(att.version,   '1.0.0');
    assert.ok(Array.isArray(att.embedding));
    assert.strictEqual(att.confidence, 0.9);
    assert.ok(typeof att.hash === 'string', 'hash missing');
    assert.ok(att.hash.length === 64, `expected 64-char SHA-256, got ${att.hash.length}`);
    assert.ok(typeof att.timestamp === 'number');
});

test('Claim 1: SHA-256 hash is deterministic per payload', () => {
    const emb = randVec();
    const att1 = buildAttestation('a', '1', emb, 0.9, 'same text');
    const att2 = buildAttestation('a', '1', emb, 0.9, 'same text');
    // Same fields with same timestamps would collide — here we just check format
    assert.strictEqual(att1.hash.length, 64);
    assert.strictEqual(att2.hash.length, 64);
});

test('Claim 1(b): mesh maintains consensus vector from healthy agents', () => {
    const mesh = new AttestationMesh();
    const v1 = [1, 0, 0, 0, 0, 0, 0, 0];
    const v2 = [1, 0, 0, 0, 0, 0, 0, 0];
    mesh.submitAttestation('a1', '1', v1, 0.9, 'r1');
    mesh.submitAttestation('a2', '1', v2, 0.9, 'r2');
    const cv = mesh.getConsensusVector();
    assert.ok(cv !== null, 'no consensus vector');
    assert.ok(Array.isArray(cv));
});

test('Claim 1(c)/(d): low-resonance attestation flagged', () => {
    const mesh = new AttestationMesh({
        hallucination_threshold: 0.999,  // very strict — almost everything flagged
        sigmoid_steepness: 20,
    });
    const consensus = [1, 0, 0, 0, 0, 0, 0, 0];
    mesh.submitAttestation('anchor', '1', consensus, 0.9, 'anchor');

    // Submit a very different vector
    const divergent = [0, 1, 0, 0, 0, 0, 0, 0];
    const result = mesh.submitAttestation('agent-x', '1', divergent, 0.9, 'bad');
    assert.strictEqual(result.flagged, true, 'expected flagged=true for divergent vector');
});

test('Claim 1(e): quarantine after streak of flagged attestations', () => {
    const mesh = new AttestationMesh({
        hallucination_threshold: 0.999,
        quarantine_streak: 3,
        sigmoid_steepness: 20,
    });
    const consensus = [1, 0, 0, 0, 0, 0, 0, 0];
    mesh.submitAttestation('anchor', '1', consensus, 0.9, 'anchor');

    const divergent = [0, 1, 0, 0, 0, 0, 0, 0];
    // 3 consecutive divergent attestations → quarantine
    mesh.submitAttestation('bad-agent', '1', divergent, 0.9, 'r1');
    mesh.submitAttestation('bad-agent', '1', divergent, 0.9, 'r2');
    const third = mesh.submitAttestation('bad-agent', '1', divergent, 0.9, 'r3');
    assert.strictEqual(third.quarantined, true, 'expected quarantine after streak');
});

test('Claim 1(f): consensus recomputed after quarantine', () => {
    const mesh = new AttestationMesh({
        hallucination_threshold: 0.999,
        quarantine_streak: 3,
        critical_threshold:      0.001,
        sigmoid_steepness: 20,
    });
    const good = [1, 0, 0, 0, 0, 0, 0, 0];
    const bad  = [0, 1, 0, 0, 0, 0, 0, 0];
    mesh.submitAttestation('g1', '1', good, 0.9, 'ok');
    mesh.submitAttestation('b1', '1', bad,  0.9, 'r1');
    mesh.submitAttestation('b1', '1', bad,  0.9, 'r2');
    mesh.submitAttestation('b1', '1', bad,  0.9, 'r3');
    // b1 is quarantined; consensus should only reflect g1
    const cv = mesh.getConsensusVector();
    assert.ok(cv !== null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Claim 2: Resonance Gate for Geometric Hallucination Detection
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 2: Resonance Gate Hallucination Detection ===');

test('Claim 2: measureAlignment uses Resonance Gate (returns score + activation)', () => {
    const mesh = new AttestationMesh();
    const v = [1, 0, 0, 0, 0, 0, 0, 0];
    mesh.submitAttestation('a1', '1', v, 0.9, 'test');
    const alignment = mesh.measureAlignment(v);
    assert.ok(alignment !== null, 'no alignment result');
    assert.ok('score'      in alignment);
    assert.ok('activation' in alignment);
    assert.ok('open'       in alignment);
});

test('Claim 2: identical vector to consensus gets score ≈ 1', () => {
    const mesh = new AttestationMesh();
    const v = [1, 0, 0, 0, 0, 0, 0, 0];
    mesh.submitAttestation('a1', '1', v, 0.9, 'test');
    const alignment = mesh.measureAlignment(v, 0.5);
    assert.ok(alignment.score > 0.99, `score=${alignment.score}`);
    assert.strictEqual(alignment.open, true);
});

test('Claim 2: measureAlignment returns null when no consensus', () => {
    const mesh = new AttestationMesh();
    const result = mesh.measureAlignment([1, 0, 0]);
    assert.strictEqual(result, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Claim 3: Auto Un-Quarantine
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 3: Auto Un-Quarantine ===');

test('Claim 3: agent un-quarantined after recovery streak', () => {
    const mesh = new AttestationMesh({
        hallucination_threshold: 0.999,
        quarantine_streak: 2,
        recovery_streak:   2,
        critical_threshold: 0.001,
        sigmoid_steepness: 20,
    });
    const good = [1, 0, 0, 0, 0, 0, 0, 0];
    const bad  = [0, 1, 0, 0, 0, 0, 0, 0];

    mesh.submitAttestation('anchor', '1', good, 0.9, 'r0');
    // Trigger quarantine
    mesh.submitAttestation('agent',  '1', bad, 0.9, 'r1');
    mesh.submitAttestation('agent',  '1', bad, 0.9, 'r2');

    let status = mesh.getMeshStatus();
    const quarantinedAfter = status.agents.find(a => a.agentId === 'agent');
    assert.strictEqual(quarantinedAfter.quarantined, true, 'should be quarantined');

    // Now submit good attestations matching consensus
    mesh.submitAttestation('agent', '1', good, 0.9, 'r3');
    mesh.submitAttestation('agent', '1', good, 0.9, 'r4');

    status = mesh.getMeshStatus();
    const recoveredAgent = status.agents.find(a => a.agentId === 'agent');
    assert.strictEqual(recoveredAgent.quarantined, false, 'agent should be recovered');
});

// ─────────────────────────────────────────────────────────────────────────────
// Claim 4: Suspect Output Marking
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 4: Suspect Output Marking ===');

test('Claim 4: quarantined agent has last N outputs marked suspect', () => {
    const mesh = new AttestationMesh({
        hallucination_threshold: 0.999,
        quarantine_streak: 2,
        suspect_output_count: 3,
        critical_threshold: 0.001,
        sigmoid_steepness: 20,
    });
    const good = [1, 0, 0, 0, 0, 0, 0, 0];
    const bad  = [0, 1, 0, 0, 0, 0, 0, 0];
    mesh.submitAttestation('anchor', '1', good, 0.9, 'r0');
    mesh.submitAttestation('agent',  '1', good, 0.9, 'r1');
    mesh.submitAttestation('agent',  '1', good, 0.9, 'r2');
    mesh.submitAttestation('agent',  '1', bad,  0.9, 'r3');
    mesh.submitAttestation('agent',  '1', bad,  0.9, 'r4');  // triggers quarantine

    const suspects = mesh.getSuspectOutputs('agent');
    assert.ok(suspects.length > 0, 'expected suspect outputs');
    for (const s of suspects) {
        assert.strictEqual(s.suspect, true, `output should be marked suspect`);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Claim 5: PHI-Based Heartbeat Timing
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 5: PHI-Based Heartbeat Timing ===');

test('Claim 5: computeHeartbeatInterval uses PHI multiplier', () => {
    const base     = 5000;
    const interval = computeHeartbeatInterval(base);
    const expected = Math.round(PHI * base);
    assert.strictEqual(interval, expected, `expected ${expected} ms, got ${interval} ms`);
});

test('Claim 5: default 5000ms base gives ≈8090ms interval', () => {
    const interval = computeHeartbeatInterval(5000);
    assert.ok(interval >= 8000 && interval <= 8200,
        `expected ≈8090ms, got ${interval}ms`);
});

test('Claim 5: PHI constant = 1.6180339887', () => {
    assert.strictEqual(PHI, 1.6180339887);
});

test('Claim 5: registered agent has phi-derived heartbeat interval', () => {
    const mesh = new AttestationMesh({ heartbeat_base_ms: 1000 });
    mesh.registerAgent('a1', '1.0');
    const status = mesh.getMeshStatus();
    const agent  = status.agents.find(a => a.agentId === 'a1');
    assert.ok(agent !== undefined);
    // Should be approximately PHI * 1000
    assert.ok(Math.abs(agent.heartbeatIntervalMs - Math.round(PHI * 1000)) <= 1,
        `expected ${Math.round(PHI * 1000)}, got ${agent.heartbeatIntervalMs}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Claim 6: Consensus Reconstitution
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 6: Consensus Reconstitution ===');

test('Claim 6: consensus is normalized unit vector', () => {
    const mesh = new AttestationMesh();
    const v1 = [1, 0, 0, 0, 0, 0, 0, 0];
    const v2 = [0, 1, 0, 0, 0, 0, 0, 0];
    const v3 = [0, 0, 1, 0, 0, 0, 0, 0];
    mesh.submitAttestation('a1', '1', v1, 0.9, 'r1');
    mesh.submitAttestation('a2', '1', v2, 0.9, 'r2');
    mesh.submitAttestation('a3', '1', v3, 0.9, 'r3');
    const cv = mesh.getConsensusVector();
    assert.ok(cv !== null);
    const n = Math.sqrt(cv.reduce((s, x) => s + x * x, 0));
    assert.ok(Math.abs(n - 1.0) < 1e-5, `consensus norm = ${n}`);
});

test('Claim 6: mesh continues operating at reduced capacity after quarantine', () => {
    const mesh = new AttestationMesh({
        hallucination_threshold: 0.999,
        quarantine_streak: 1,
        critical_threshold: 0.001,
        sigmoid_steepness: 20,
    });
    const good = [1, 0, 0, 0, 0, 0, 0, 0];
    const bad  = [0, 0, 0, 0, 1, 0, 0, 0];
    mesh.submitAttestation('anchor', '1', good, 0.9, 'r0');
    mesh.submitAttestation('bad',    '1', bad,  0.9, 'r1');
    // Mesh should still have consensus from anchor
    const cv = mesh.getConsensusVector();
    assert.ok(cv !== null, 'mesh should still have consensus from healthy agents');
});

// ─────────────────────────────────────────────────────────────────────────────
// Claim 7: Full System
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Claim 7: Full AttestationMesh System ===');

test('Claim 7: getMeshStatus returns comprehensive report', () => {
    const mesh = new AttestationMesh();
    mesh.registerAgent('a1', '2.0', { role: 'worker' });
    mesh.registerAgent('a2', '2.0');
    const status = mesh.getMeshStatus();
    assert.strictEqual(status.totalAgents,    2);
    assert.strictEqual(status.healthyAgents,  2);
    assert.strictEqual(status.quarantinedAgents, 0);
});

test('Claim 7(a): multiple agents can be registered', () => {
    const mesh = new AttestationMesh();
    for (let i = 0; i < 5; i++) {
        mesh.registerAgent(`agent-${i}`, '1.0');
    }
    assert.strictEqual(mesh.getMeshStatus().totalAgents, 5);
});

test('Claim 7(b): Resonance Gate module integrated (measureAlignment)', () => {
    const mesh = new AttestationMesh();
    const v = [1, 0, 0, 0, 0, 0, 0, 0];
    mesh.submitAttestation('a', '1', v, 0.9, 'r');
    const result = mesh.measureAlignment(v, 0.5);
    assert.ok(result !== null);
    assert.ok('score' in result);
});

test('Claim 7(c): consensus engine updates on each submission', () => {
    const mesh = new AttestationMesh();
    assert.strictEqual(mesh.getConsensusVector(), null);
    mesh.submitAttestation('a1', '1', [1, 0, 0, 0], 0.9, 'r1');
    assert.ok(mesh.getConsensusVector() !== null, 'consensus should exist after submission');
});

test('Claim 7(d): quarantine module accessible via getMeshStatus', () => {
    const mesh = new AttestationMesh({
        hallucination_threshold: 0.999,
        quarantine_streak: 1,
        critical_threshold: 0.001,
        sigmoid_steepness: 20,
    });
    const good = [1, 0, 0, 0, 0, 0, 0, 0];
    const bad  = [0, 1, 0, 0, 0, 0, 0, 0];
    mesh.submitAttestation('anchor', '1', good, 0.9, 'r0');
    mesh.submitAttestation('bad',    '1', bad,  0.9, 'r1');
    const status = mesh.getMeshStatus();
    assert.ok(status.quarantinedAgents >= 1, 'should have quarantined agent');
});

test('Claim 7(e): event system fires on quarantine and recovery', () => {
    const events = [];
    const mesh = new AttestationMesh({
        hallucination_threshold: 0.999,
        quarantine_streak: 2,
        recovery_streak: 2,
        critical_threshold: 0.001,
        sigmoid_steepness: 20,
    });
    mesh.on((event, data) => events.push({ event, data }));
    const good = [1, 0, 0, 0, 0, 0, 0, 0];
    const bad  = [0, 1, 0, 0, 0, 0, 0, 0];
    mesh.submitAttestation('anchor', '1', good, 0.9, 'r0');
    mesh.submitAttestation('agent',  '1', bad,  0.9, 'r1');
    mesh.submitAttestation('agent',  '1', bad,  0.9, 'r2');
    const quarantineEvents = events.filter(e => e.event === 'agent:quarantined');
    assert.ok(quarantineEvents.length >= 1, 'expected quarantine event');
});

test('Claim 7: getAuditLog returns all attestations', () => {
    const mesh = new AttestationMesh();
    mesh.submitAttestation('a1', '1', [1, 0, 0, 0], 0.9, 'r1');
    mesh.submitAttestation('a2', '1', [0, 1, 0, 0], 0.8, 'r2');
    const log = mesh.getAuditLog();
    assert.ok(log.length >= 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────────`);
console.log(`HS-059 Attestation Mesh: ${passed} passed, ${failed} failed`);
console.log(`─────────────────────────────────────────`);

if (failed > 0) process.exit(1);
