/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const assert = require('assert');
const {
  PHI,
  EMOTION_DIMENSIONS,
  TRAIT_DIMENSIONS,
  EmotionVector,
  EmotionDetector,
  BiometricSync,
  PersonaProfile,
  ResponseModulator,
  PersonaEngine,
} = require('../src/persona/empathic-persona-engine');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}: ${err.message}`); failed++; }
}

console.log('\n=== Empathic Persona Engine Tests ===\n');

test('PHI constant correct', () => { assert.strictEqual(PHI, 1.6180339887); });

test('EMOTION_DIMENSIONS defined', () => {
  assert.ok(EMOTION_DIMENSIONS.includes('valence'));
  assert.ok(EMOTION_DIMENSIONS.includes('arousal'));
  assert.ok(EMOTION_DIMENSIONS.includes('dominance'));
});

test('TRAIT_DIMENSIONS defined', () => {
  assert.ok(TRAIT_DIMENSIONS.includes('warmth'));
  assert.ok(TRAIT_DIMENSIONS.includes('formality'));
  assert.ok(TRAIT_DIMENSIONS.includes('humor'));
  assert.ok(TRAIT_DIMENSIONS.includes('assertiveness'));
  assert.ok(TRAIT_DIMENSIONS.includes('empathy'));
});

// EmotionVector
test('EmotionVector clamps values to [-1, 1]', () => {
  const ev = new EmotionVector(5, -5, 3);
  assert.strictEqual(ev.valence, 1);
  assert.strictEqual(ev.arousal, -1);
  assert.strictEqual(ev.dominance, 1);
});

test('EmotionVector blend returns new EmotionVector', () => {
  const a = new EmotionVector(1, 0, 0);
  const b = new EmotionVector(0, 1, 0);
  const c = a.blend(b, 0.5);
  assert.ok(Math.abs(c.valence - 0.5) < 0.01);
  assert.ok(Math.abs(c.arousal - 0.5) < 0.01);
});

test('EmotionVector distanceTo', () => {
  const a = new EmotionVector(1, 0, 0);
  const b = new EmotionVector(0, 0, 0);
  assert.ok(Math.abs(a.distanceTo(b) - 1) < 0.001);
});

test('EmotionVector classify neutral', () => {
  const ev = new EmotionVector(0, 0, 0);
  assert.strictEqual(ev.classify(), 'neutral');
});

test('EmotionVector classify excited', () => {
  const ev = new EmotionVector(0.8, 0.8, 0);
  assert.strictEqual(ev.classify(), 'excited');
});

test('EmotionVector classify angry', () => {
  const ev = new EmotionVector(-0.8, 0.8, 0);
  assert.strictEqual(ev.classify(), 'angry');
});

test('EmotionVector classify content', () => {
  const ev = new EmotionVector(0.8, 0.1, 0);
  assert.strictEqual(ev.classify(), 'content');
});

test('EmotionVector classify sad', () => {
  const ev = new EmotionVector(-0.8, -0.1, 0);
  assert.strictEqual(ev.classify(), 'sad');
});

test('EmotionVector toJSON includes label', () => {
  const ev   = new EmotionVector(0, 0, 0);
  const json = ev.toJSON();
  assert.ok(json.label);
  assert.ok(typeof json.valence === 'number');
  assert.ok(typeof json.arousal === 'number');
  assert.ok(typeof json.dominance === 'number');
});

// EmotionDetector
test('EmotionDetector detectFromText positive text', () => {
  const d      = new EmotionDetector({ smoothing: 1.0 });
  const emotion = d.detectFromText('This is amazing! I love this fantastic product!');
  assert.ok(emotion.valence > 0);
});

test('EmotionDetector detectFromText negative text', () => {
  const d      = new EmotionDetector({ smoothing: 1.0 });
  const emotion = d.detectFromText('This is terrible! I hate this broken thing!');
  assert.ok(emotion.valence < 0);
});

test('EmotionDetector detectFromText high arousal', () => {
  const d      = new EmotionDetector({ smoothing: 1.0 });
  const emotion = d.detectFromText('URGENT! IMMEDIATELY! CRITICAL ISSUE NOW!');
  assert.ok(emotion.arousal > 0);
});

test('EmotionDetector ALL CAPS raises arousal', () => {
  const d  = new EmotionDetector({ smoothing: 1.0 });
  const e1 = new EmotionDetector({ smoothing: 1.0 }).detectFromText('hello world');
  const e2 = new EmotionDetector({ smoothing: 1.0 }).detectFromText('HELLO WORLD');
  assert.ok(e2.arousal > e1.arousal);
});

test('EmotionDetector returns EmotionVector', () => {
  const d = new EmotionDetector();
  const e = d.detectFromText('Normal text here');
  assert.ok(e instanceof EmotionVector);
});

test('EmotionDetector getCurrentEmotion', () => {
  const d = new EmotionDetector();
  assert.ok(d.getCurrentEmotion() instanceof EmotionVector);
});

test('EmotionDetector getHistory accumulates entries', () => {
  const d = new EmotionDetector();
  d.detectFromText('Hello');
  d.detectFromText('World');
  assert.ok(d.getHistory().length >= 2);
});

test('EmotionDetector reset clears history', () => {
  const d = new EmotionDetector();
  d.detectFromText('text1');
  d.reset();
  assert.strictEqual(d.getHistory().length, 0);
});

test('EmotionDetector detectFromVoiceMeta high pitch → higher arousal', () => {
  const d  = new EmotionDetector({ smoothing: 1.0 });
  d.detectFromVoiceMeta({ pitchHz: 300, tempoWpm: 200, energyDb: -10 });
  const e = d.getCurrentEmotion();
  assert.ok(e.arousal > 0);
});

// BiometricSync
test('BiometricSync update heart_rate returns state', () => {
  const bs    = new BiometricSync();
  const state = bs.update('heart_rate', 150); // intense zone
  assert.ok(state.arousal > 0);
  assert.ok(state.hrZone);
});

test('BiometricSync HR zones correct', () => {
  const bs = new BiometricSync();
  const resting  = bs.update('heart_rate', 55);
  assert.strictEqual(resting.hrZone, 'rest');
  const moderate = bs.update('heart_rate', 120);
  assert.strictEqual(moderate.hrZone, 'moderate');
  const intense  = bs.update('heart_rate', 160);
  assert.strictEqual(intense.hrZone, 'intense');
});

test('BiometricSync update typing_speed sets engagement', () => {
  const bs    = new BiometricSync();
  const state = bs.update('typing_speed', 80); // wpm
  assert.ok(state.engagement > 0 && state.engagement <= 1);
});

test('BiometricSync onChange fires callback', () => {
  const bs  = new BiometricSync();
  let fired = false;
  bs.onChange(() => { fired = true; });
  bs.update('heart_rate', 100);
  assert.ok(fired);
});

test('BiometricSync getSignals returns current signals', () => {
  const bs = new BiometricSync();
  bs.update('heart_rate', 90);
  const signals = bs.getSignals();
  assert.ok(signals.heart_rate);
  assert.strictEqual(signals.heart_rate.value, 90);
});

test('BiometricSync getState returns derived state', () => {
  const bs    = new BiometricSync();
  bs.update('heart_rate', 80);
  const state = bs.getState();
  assert.ok(typeof state.arousal === 'number');
  assert.ok(typeof state.stress === 'number');
});

// PersonaProfile
test('PersonaProfile initializes with default traits', () => {
  const p = new PersonaProfile({ name: 'Test' });
  assert.ok(p.warmth >= 0 && p.warmth <= 1);
  assert.ok(p.formality >= 0 && p.formality <= 1);
  assert.ok(p.humor >= 0 && p.humor <= 1);
  assert.ok(p.assertiveness >= 0 && p.assertiveness <= 1);
  assert.ok(p.empathy >= 0 && p.empathy <= 1);
});

test('PersonaProfile toVector returns array of 5 values', () => {
  const p = new PersonaProfile();
  const v = p.toVector();
  assert.strictEqual(v.length, 5);
  assert.ok(v.every(x => x >= 0 && x <= 1));
});

test('PersonaProfile adaptToEmotion changes traits', () => {
  const p     = new PersonaProfile({ warmth: 0.5, formality: 0.5 });
  const emotion = { valence: 0.8, arousal: 0.8, dominance: 0 };
  p.adaptToEmotion(emotion);
  // With high positive valence, warmth should increase
  assert.ok(p.warmth !== 0.5 || p.formality !== 0.5); // at least one should change
});

test('PersonaProfile similarityTo self = 1', () => {
  const p    = new PersonaProfile({ warmth: 0.7, formality: 0.3 });
  const sim  = p.similarityTo(p);
  assert.ok(Math.abs(sim - 1) < 0.001);
});

test('PersonaProfile reset restores base traits', () => {
  const p = new PersonaProfile({ warmth: 0.6, formality: 0.4 });
  p.adaptToEmotion({ valence: 1, arousal: 1 });
  p.reset();
  assert.ok(Math.abs(p.warmth - 0.6) < 0.001);
  assert.ok(Math.abs(p.formality - 0.4) < 0.001);
});

test('PersonaProfile toJSON includes all fields', () => {
  const p    = new PersonaProfile({ name: 'TestPersona' });
  const json = p.toJSON();
  assert.strictEqual(json.name, 'TestPersona');
  assert.ok(typeof json.warmth === 'number');
  assert.ok(typeof json.empathy === 'number');
});

// ResponseModulator
test('ResponseModulator modulate returns valid params', () => {
  const m      = new ResponseModulator({ defaultTemperature: 0.7 });
  const emotion = new EmotionVector(0.5, 0.2, 0);
  const params  = m.modulate(emotion, null);
  assert.ok(params.temperature > 0 && params.temperature <= 1.5);
  assert.ok(params.top_p > 0 && params.top_p <= 1);
  assert.ok(params.max_tokens > 0);
});

test('ResponseModulator high arousal + negative valence reduces max_tokens', () => {
  const m      = new ResponseModulator({ defaultMaxTokens: 1024 });
  const emotion = new EmotionVector(-0.5, 0.8, 0);
  const params  = m.modulate(emotion, null);
  assert.ok(params.max_tokens <= 512);
});

test('ResponseModulator with persona generates systemPrompt', () => {
  const m       = new ResponseModulator();
  const emotion = new EmotionVector(0, 0, 0);
  const persona = new PersonaProfile({ formality: 0.9, warmth: 0.9, empathy: 0.9 });
  const params  = m.modulate(emotion, persona);
  assert.ok(typeof params.systemPrompt === 'string');
  assert.ok(params.systemPrompt.length > 0);
});

test('ResponseModulator angry emotion adds patience guidance', () => {
  const m       = new ResponseModulator();
  const emotion = new EmotionVector(-0.8, 0.8, 0.3); // angry
  const persona = new PersonaProfile();
  const params  = m.modulate(emotion, persona);
  assert.ok(params.systemPrompt.includes('frustrated') || params.systemPrompt.includes('patience'));
});

// PersonaEngine
test('PersonaEngine initializes with default profile', () => {
  const engine = new PersonaEngine({ defaultProfile: { name: 'Heady' } });
  const profile = engine.getActiveProfile();
  assert.ok(profile);
  assert.strictEqual(profile.name, 'Heady');
});

test('PersonaEngine registerProfile and activateProfile', () => {
  const engine  = new PersonaEngine();
  const profile = new PersonaProfile({ name: 'Custom' });
  engine.registerProfile(profile);
  engine.activateProfile(profile.id);
  assert.strictEqual(engine.getActiveProfile().id, profile.id);
});

test('PersonaEngine activateProfile throws for unknown id', () => {
  const engine = new PersonaEngine();
  let threw = false;
  try { engine.activateProfile('unknown-id'); } catch (e) { threw = true; }
  assert.ok(threw);
});

test('PersonaEngine process returns LLM params', () => {
  const engine = new PersonaEngine();
  const params = engine.process('Hello, I need help urgently!');
  assert.ok(params.temperature > 0);
  assert.ok(params.max_tokens > 0);
});

test('PersonaEngine process with voice meta', () => {
  const engine = new PersonaEngine();
  const params = engine.process('test', { pitchHz: 250, tempoWpm: 180, energyDb: -5 });
  assert.ok(params.temperature > 0);
});

test('PersonaEngine updateBiometric feeds biometric state', () => {
  const engine = new PersonaEngine();
  const state  = engine.updateBiometric('heart_rate', 160);
  assert.ok(state.arousal > 0);
});

test('PersonaEngine getEmotionHistory accumulates', () => {
  const engine = new PersonaEngine();
  engine.process('Hello!');
  engine.process('Goodbye!');
  const history = engine.getEmotionHistory();
  assert.ok(history.length >= 2);
});

test('PersonaEngine getProcessHistory accumulates', () => {
  const engine = new PersonaEngine();
  engine.process('one');
  engine.process('two');
  engine.process('three');
  assert.ok(engine.getProcessHistory().length >= 3);
});

test('PersonaEngine listProfiles returns array', () => {
  const engine    = new PersonaEngine();
  const profiles  = engine.listProfiles();
  assert.ok(Array.isArray(profiles));
  assert.ok(profiles.length >= 1);
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
