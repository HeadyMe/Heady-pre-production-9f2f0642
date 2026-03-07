/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const assert = require('assert');
const {
  PHI,
  PROVIDERS,
  PROVIDER_ENDPOINTS,
  AUTH_METHODS,
  BYOKKeyVault,
  IdentityAttestor,
  MultiProviderAuth,
  SovereignIdentityManager,
} = require('../src/identity/sovereign-identity-byok');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}: ${err.message}`); failed++; }
}

console.log('\n=== Sovereign Identity BYOK Tests ===\n');

test('PHI constant correct', () => { assert.strictEqual(PHI, 1.6180339887); });

// Providers
test('PROVIDERS contains all major providers', () => {
  assert.ok(PROVIDERS.ANTHROPIC);
  assert.ok(PROVIDERS.OPENAI);
  assert.ok(PROVIDERS.GOOGLE);
  assert.ok(PROVIDERS.GROQ);
});

test('PROVIDER_ENDPOINTS are valid URLs', () => {
  for (const [prov, url] of Object.entries(PROVIDER_ENDPOINTS)) {
    assert.ok(url.startsWith('https://'), `${prov} endpoint should be https`);
  }
});

// BYOKKeyVault
test('BYOKKeyVault initUser returns sessionTok', () => {
  const vault = new BYOKKeyVault();
  const { sessionTok, userId } = vault.initUser('user1', 'pass123');
  assert.ok(sessionTok);
  assert.strictEqual(userId, 'user1');
});

test('BYOKKeyVault storeKey and retrieveKey', () => {
  const vault = new BYOKKeyVault();
  const { sessionTok } = vault.initUser('u2', 'mypassword');
  vault.storeKey(sessionTok, 'anthropic', 'sk-ant-test-key-12345678901234567890');
  const retrieved = vault.retrieveKey(sessionTok, 'anthropic');
  assert.strictEqual(retrieved, 'sk-ant-test-key-12345678901234567890');
});

test('BYOKKeyVault encrypted key is not stored in plaintext', () => {
  const vault = new BYOKKeyVault();
  const { sessionTok } = vault.initUser('u3', 'secret');
  vault.storeKey(sessionTok, 'openai', 'sk-mykey12345');
  const userData = vault._store.get('u3');
  assert.ok(userData);
  assert.ok(userData.keys.openai);
  assert.ok(userData.keys.openai.envelope);
  // Envelope data should not be the raw key
  const rawEnvelope = JSON.stringify(userData.keys.openai.envelope);
  assert.ok(!rawEnvelope.includes('sk-mykey12345'));
});

test('BYOKKeyVault invalid session throws', () => {
  const vault = new BYOKKeyVault();
  let threw = false;
  try { vault.retrieveKey('bad-token', 'openai'); } catch (e) { threw = true; }
  assert.ok(threw);
});

test('BYOKKeyVault rotateKey increments rotation counter', () => {
  const vault = new BYOKKeyVault();
  const { sessionTok } = vault.initUser('u4', 'pass');
  vault.storeKey(sessionTok, 'openai', 'old-key-value-here');
  const result = vault.rotateKey(sessionTok, 'openai', 'new-key-value-here');
  assert.strictEqual(result.rotation, 1);
  const retrieved = vault.retrieveKey(sessionTok, 'openai');
  assert.strictEqual(retrieved, 'new-key-value-here');
});

test('BYOKKeyVault listProviders returns stored providers', () => {
  const vault = new BYOKKeyVault();
  const { sessionTok } = vault.initUser('u5', 'pass');
  vault.storeKey(sessionTok, 'anthropic', 'key1');
  vault.storeKey(sessionTok, 'openai', 'key2');
  const providers = vault.listProviders(sessionTok);
  assert.strictEqual(providers.length, 2);
  const names = providers.map(p => p.provider);
  assert.ok(names.includes('anthropic'));
  assert.ok(names.includes('openai'));
});

test('BYOKKeyVault deleteUser removes all data', () => {
  const vault = new BYOKKeyVault();
  const { sessionTok } = vault.initUser('u6', 'pass');
  vault.storeKey(sessionTok, 'openai', 'my-key');
  vault.deleteUser(sessionTok);
  assert.ok(!vault._store.has('u6'));
});

test('BYOKKeyVault getAccessLog returns entries', () => {
  const vault = new BYOKKeyVault();
  const { sessionTok } = vault.initUser('u7', 'pass');
  vault.storeKey(sessionTok, 'groq', 'groq-key');
  vault.retrieveKey(sessionTok, 'groq');
  const log = vault.getAccessLog('u7');
  assert.ok(log.length >= 3); // init_user, store_key, retrieve_key
  assert.ok(log.some(e => e.action === 'retrieve_key'));
});

test('BYOKKeyVault rotateKey throws if no existing key', () => {
  const vault = new BYOKKeyVault();
  const { sessionTok } = vault.initUser('u8', 'pass');
  let threw = false;
  try { vault.rotateKey(sessionTok, 'openai', 'new-key'); } catch (e) { threw = true; }
  assert.ok(threw);
});

// IdentityAttestor
test('IdentityAttestor issueChallenge returns challengeId and nonce', () => {
  const attestor = new IdentityAttestor();
  const { challengeId, nonce } = attestor.issueChallenge('user1', 'anthropic');
  assert.ok(challengeId);
  assert.ok(nonce);
  assert.strictEqual(nonce.length, 64); // 32 hex-encoded bytes
});

test('IdentityAttestor computeProof is deterministic', () => {
  const challenge = { nonce: 'abc', userId: 'user1', provider: 'anthropic' };
  const p1 = IdentityAttestor.computeProof('my-api-key', challenge);
  const p2 = IdentityAttestor.computeProof('my-api-key', challenge);
  assert.strictEqual(p1, p2);
});

test('IdentityAttestor computeProof differs by key', () => {
  const challenge = { nonce: 'abc', userId: 'user1', provider: 'anthropic' };
  const p1 = IdentityAttestor.computeProof('key-A', challenge);
  const p2 = IdentityAttestor.computeProof('key-B', challenge);
  assert.notStrictEqual(p1, p2);
});

test('IdentityAttestor verifyProof success', () => {
  const attestor  = new IdentityAttestor();
  const apiKey    = 'sk-test-key-abcdef12345';
  const { challengeId, nonce } = attestor.issueChallenge('user1', 'openai');
  const challenge = attestor._challenges.get(challengeId);
  const proof     = IdentityAttestor.computeProof(apiKey, challenge);
  const result    = attestor.verifyProof(challengeId, proof, apiKey);
  assert.ok(result.verified);
  assert.ok(result.proofId);
});

test('IdentityAttestor verifyProof fails with wrong key', () => {
  const attestor  = new IdentityAttestor();
  const { challengeId } = attestor.issueChallenge('user1', 'openai');
  const challenge = attestor._challenges.get(challengeId);
  const goodProof = IdentityAttestor.computeProof('correct-key', challenge);
  const result    = attestor.verifyProof(challengeId, goodProof, 'wrong-key');
  assert.ok(!result.verified);
});

test('IdentityAttestor verifyProof throws on unknown challenge', () => {
  const attestor = new IdentityAttestor();
  let threw = false;
  try { attestor.verifyProof('not-a-real-id', 'proof', 'key'); } catch (e) { threw = true; }
  assert.ok(threw);
});

test('IdentityAttestor isProofValid checks age', () => {
  const attestor = new IdentityAttestor();
  const apiKey   = 'test-key-xyz';
  const { challengeId } = attestor.issueChallenge('user1', 'anthropic');
  const challenge = attestor._challenges.get(challengeId);
  const proof     = IdentityAttestor.computeProof(apiKey, challenge);
  const { proofId } = attestor.verifyProof(challengeId, proof, apiKey);
  assert.ok(attestor.isProofValid(proofId, 60000)); // 60 seconds max age
  assert.ok(!attestor.isProofValid(proofId, 0));    // 0ms max age
});

// MultiProviderAuth
test('MultiProviderAuth authenticateApiKey returns token', () => {
  const auth    = new MultiProviderAuth();
  const session = auth.authenticateApiKey('user1', 'hash123');
  assert.ok(session.token);
  assert.strictEqual(session.userId, 'user1');
  assert.strictEqual(session.method, AUTH_METHODS.API_KEY);
});

test('MultiProviderAuth validateSession returns session', () => {
  const auth    = new MultiProviderAuth();
  const { token } = auth.authenticateApiKey('user1', 'hash');
  const session = auth.validateSession(token);
  assert.ok(session);
  assert.strictEqual(session.userId, 'user1');
});

test('MultiProviderAuth validateSession returns null for invalid token', () => {
  const auth = new MultiProviderAuth();
  const result = auth.validateSession('bad-token');
  assert.strictEqual(result, null);
});

test('MultiProviderAuth revokeSession', () => {
  const auth    = new MultiProviderAuth();
  const { token } = auth.authenticateApiKey('user1', 'hash');
  auth.revokeSession(token);
  assert.strictEqual(auth.validateSession(token), null);
});

test('MultiProviderAuth registerWebAuthn stores credential', () => {
  const auth   = new MultiProviderAuth();
  const result = auth.registerWebAuthn('user1', 'cred-id-123', 'public-key-pem');
  assert.ok(result.ok);
  assert.strictEqual(result.credentialId, 'cred-id-123');
});

test('MultiProviderAuth initiateOAuth returns authUrl', () => {
  const auth = new MultiProviderAuth({
    oauthClients: {
      github: {
        clientId: 'client-id',
        authUrl: 'https://github.com/login/oauth/authorize',
        redirectUri: 'https://app.example.com/callback',
      },
    },
  });
  const { authUrl, state } = auth.initiateOAuth('github');
  assert.ok(authUrl.includes('github.com'));
  assert.ok(authUrl.includes('client-id'));
  assert.ok(state);
});

// SovereignIdentityManager
test('SovereignIdentityManager registerUser creates vault session', () => {
  const mgr    = new SovereignIdentityManager();
  const result = mgr.registerUser('alice', 'alicepass');
  assert.ok(result.sessionTok);
  assert.strictEqual(result.userId, 'alice');
});

test('SovereignIdentityManager storeKey and retrieve via vault', () => {
  const mgr  = new SovereignIdentityManager();
  const { sessionTok } = mgr.registerUser('bob', 'bobpass');
  mgr.storeKey(sessionTok, 'groq', 'gsk_test_key_123');
  const key = mgr.getKeyVault().retrieveKey(sessionTok, 'groq');
  assert.strictEqual(key, 'gsk_test_key_123');
});

test('SovereignIdentityManager rotateKey', () => {
  const mgr  = new SovereignIdentityManager();
  const { sessionTok } = mgr.registerUser('carol', 'carolpass');
  mgr.storeKey(sessionTok, 'openai', 'old-key');
  const result = mgr.rotateKey(sessionTok, 'openai', 'new-key');
  assert.strictEqual(result.rotation, 1);
});

test('SovereignIdentityManager getUserProfile returns profile', () => {
  const mgr = new SovereignIdentityManager();
  mgr.registerUser('dave', 'davepass');
  const profile = mgr.getUserProfile('dave');
  assert.ok(profile);
  assert.ok(profile.createdAt);
  assert.ok(profile.defaultProvider);
});

test('SovereignIdentityManager setPreferredModel', () => {
  const mgr = new SovereignIdentityManager();
  mgr.registerUser('eve', 'evepass');
  mgr.setPreferredModel('eve', 'anthropic', 'claude-3-opus-20240229');
  const profile = mgr.getUserProfile('eve');
  assert.strictEqual(profile.preferredModels.anthropic, 'claude-3-opus-20240229');
});

test('SovereignIdentityManager ZK proof challenge-verify roundtrip', () => {
  const mgr    = new SovereignIdentityManager();
  const apiKey = 'sk-test-1234567890';
  const { challengeId, nonce } = mgr.challengeKeyOwnership('user1', 'anthropic');
  const challenge = mgr.getAttestor()._challenges.get(challengeId);
  const proof     = IdentityAttestor.computeProof(apiKey, challenge);
  const result    = mgr.verifyKeyOwnership(challengeId, proof, apiKey);
  assert.ok(result.verified);
});

test('SovereignIdentityManager getKeyVault returns BYOKKeyVault', () => {
  const mgr = new SovereignIdentityManager();
  assert.ok(mgr.getKeyVault() instanceof BYOKKeyVault);
});

test('SovereignIdentityManager getAttestor returns IdentityAttestor', () => {
  const mgr = new SovereignIdentityManager();
  assert.ok(mgr.getAttestor() instanceof IdentityAttestor);
});

test('SovereignIdentityManager getAuth returns MultiProviderAuth', () => {
  const mgr = new SovereignIdentityManager();
  assert.ok(mgr.getAuth() instanceof MultiProviderAuth);
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
