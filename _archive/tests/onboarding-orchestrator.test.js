/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Tests for OnboardingOrchestrator — 5-stage onboarding flow
 */

const {
    OnboardingOrchestrator,
    deriveUsername,
    STAGES,
    SECURE_EMAIL_CLIENTS,
    EMAIL_FORWARDING_MODES,
} = require('../src/services/onboarding-orchestrator');

describe('OnboardingOrchestrator', () => {
    let orchestrator;

    beforeEach(() => {
        orchestrator = new OnboardingOrchestrator();
    });

    // ─── Stage Definitions ──────────────────────────────────────────
    test('has exactly 5 stages in correct order', () => {
        expect(STAGES).toHaveLength(5);
        expect(STAGES.map((s) => s.id)).toEqual([
            'auth', 'permissions', 'email', 'email-config', 'buddy-setup',
        ]);
    });

    test('email-config is optional, others are required', () => {
        const optional = STAGES.filter((s) => !s.required);
        expect(optional).toHaveLength(1);
        expect(optional[0].id).toBe('email-config');
    });

    // ─── Username Derivation ────────────────────────────────────────
    test('deriveUsername from displayName', () => {
        expect(deriveUsername({ displayName: 'John Doe', email: 'john@gmail.com', provider: 'google' }))
            .toBe('john.doe');
    });

    test('deriveUsername from email prefix when no displayName', () => {
        expect(deriveUsername({ email: 'jdoe42@gmail.com', provider: 'google' }))
            .toBe('jdoe42');
    });

    test('deriveUsername falls back to provider+random', () => {
        const username = deriveUsername({ provider: 'github' });
        expect(username).toMatch(/^github\.[a-f0-9]{6}$/);
    });

    test('deriveUsername sanitizes special characters', () => {
        expect(deriveUsername({ displayName: 'André María', email: null, provider: 'test' }))
            .toBe('andr.mara');
    });

    // ─── Initial State ──────────────────────────────────────────────
    test('getOnboardingState returns initial state for new user', () => {
        const state = orchestrator.getOnboardingState('new-user');
        expect(state.userId).toBe('new-user');
        expect(state.currentStage).toBe('auth');
        expect(state.completed).toBe(false);
        expect(Object.keys(state.stages)).toHaveLength(5);
    });

    // ─── Full Flow ──────────────────────────────────────────────────
    test('full 5-stage flow progresses correctly', () => {
        const userId = 'flow-test-user';

        // Stage 1: Auth
        const r1 = orchestrator.advanceStage(userId, {
            stage: 'auth', provider: 'github', email: 'dev@github.com', displayName: 'Dev User',
        });
        expect(r1.ok).toBe(true);
        expect(r1.currentStage).toBe('permissions');
        expect(r1.completed).toBe(false);

        // Stage 2: Permissions
        const r2 = orchestrator.advanceStage(userId, { stage: 'permissions' });
        expect(r2.ok).toBe(true);
        expect(r2.currentStage).toBe('email');

        // Stage 3: Email
        const r3 = orchestrator.advanceStage(userId, { stage: 'email', username: 'devuser' });
        expect(r3.ok).toBe(true);
        expect(r3.currentStage).toBe('email-config');
        expect(r3.email).toBe('devuser@headyme.com');
        expect(r3.username).toBe('devuser');

        // Stage 4: Email Config
        const r4 = orchestrator.advanceStage(userId, {
            stage: 'email-config', mode: 'forward-to-auth',
        });
        expect(r4.ok).toBe(true);
        expect(r4.currentStage).toBe('buddy-setup');

        // Stage 5: Buddy Setup
        const r5 = orchestrator.advanceStage(userId, {
            stage: 'buddy-setup',
            contexts: ['dev-platform', 'creative-studio'],
            preferences: { theme: 'midnight-blue' },
        });
        expect(r5.ok).toBe(true);
        expect(r5.currentStage).toBe('complete');
        expect(r5.completed).toBe(true);

        // Verify final state
        const state = orchestrator.getOnboardingState(userId);
        expect(state.completed).toBe(true);
        expect(state.stages.auth.done).toBe(true);
        expect(state.stages.permissions.done).toBe(true);
        expect(state.stages.email.done).toBe(true);
        expect(state.stages['email-config'].done).toBe(true);
        expect(state.stages['buddy-setup'].done).toBe(true);
    });

    // ─── Prerequisite Enforcement ───────────────────────────────────
    test('blocks skipping required stages', () => {
        const userId = 'skip-test';
        const result = orchestrator.advanceStage(userId, { stage: 'email' });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/auth.*must be completed/);
    });

    test('rejects unknown stage', () => {
        const result = orchestrator.advanceStage('test', { stage: 'nonexistent' });
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/Unknown stage/);
    });

    // ─── Email Provisioning ─────────────────────────────────────────
    test('email stage auto-derives username from auth profile', () => {
        const userId = 'email-auto-test';
        orchestrator.advanceStage(userId, {
            stage: 'auth', provider: 'google', email: 'user@gmail.com', displayName: 'Test User',
        });
        orchestrator.advanceStage(userId, { stage: 'permissions' });
        const result = orchestrator.advanceStage(userId, { stage: 'email' });

        expect(result.ok).toBe(true);
        expect(result.email).toBe('test.user@headyme.com');
        expect(result.username).toBe('test.user');
    });

    test('email stage uses explicit username when provided', () => {
        const userId = 'email-explicit-test';
        orchestrator.advanceStage(userId, { stage: 'auth', provider: 'github' });
        orchestrator.advanceStage(userId, { stage: 'permissions' });
        const result = orchestrator.advanceStage(userId, { stage: 'email', username: 'custom.name' });

        expect(result.email).toBe('custom.name@headyme.com');
    });

    // ─── Email Config Modes ─────────────────────────────────────────
    test('email-config with secure-client returns IMAP/SMTP config', () => {
        const userId = 'client-test';
        orchestrator.advanceStage(userId, { stage: 'auth', provider: 'test', email: 'a@b.com' });
        orchestrator.advanceStage(userId, { stage: 'permissions' });
        orchestrator.advanceStage(userId, { stage: 'email', username: 'clientuser' });
        const result = orchestrator.advanceStage(userId, { stage: 'email-config', mode: 'secure-client' });

        expect(result.ok).toBe(true);
        const data = orchestrator.getOnboardingState(userId).stages['email-config'].data;
        expect(data.mode).toBe('secure-client');
        expect(data.clientConfig.imapConfig.server).toBe('imap.gmail.com');
        expect(data.clientConfig.emailAddress).toBe('clientuser@headyme.com');
    });

    test('email-config forward-to-auth picks auth provider email', () => {
        const userId = 'fwd-auth-test';
        orchestrator.advanceStage(userId, { stage: 'auth', email: 'me@provider.com', provider: 'test' });
        orchestrator.advanceStage(userId, { stage: 'permissions' });
        orchestrator.advanceStage(userId, { stage: 'email', username: 'fwduser' });
        const result = orchestrator.advanceStage(userId, { stage: 'email-config', mode: 'forward-to-auth' });

        expect(result.ok).toBe(true);
        const data = orchestrator.getOnboardingState(userId).stages['email-config'].data;
        expect(data.forwardingTarget).toBe('me@provider.com');
    });

    test('email-config forward-custom stores target email', () => {
        const userId = 'fwd-custom-test';
        orchestrator.advanceStage(userId, { stage: 'auth', provider: 'test' });
        orchestrator.advanceStage(userId, { stage: 'permissions' });
        orchestrator.advanceStage(userId, { stage: 'email', username: 'customfwd' });
        const result = orchestrator.advanceStage(userId, { stage: 'email-config', mode: 'forward-custom', forwardTo: 'my@email.com' });

        expect(result.ok).toBe(true);
        const data = orchestrator.getOnboardingState(userId).stages['email-config'].data;
        expect(data.forwardingTarget).toBe('my@email.com');
    });

    // ─── Buddy Setup ────────────────────────────────────────────────
    test('buddy-setup generates welcome message and context definitions', () => {
        const userId = 'buddy-test';
        orchestrator.advanceStage(userId, { stage: 'auth', displayName: 'Dewayne', provider: 'github' });
        orchestrator.advanceStage(userId, { stage: 'permissions' });
        orchestrator.advanceStage(userId, { stage: 'email', username: 'dewayne' });
        orchestrator.advanceStage(userId, { stage: 'email-config', mode: 'skip' });
        const result = orchestrator.advanceStage(userId, {
            stage: 'buddy-setup',
            contexts: ['dev-platform'],
            preferences: { theme: 'sacred-geometry-dark' },
        });

        expect(result.ok).toBe(true);
        expect(result.completed).toBe(true);

        const data = orchestrator.getOnboardingState(userId).stages['buddy-setup'].data;
        expect(data.selectedContexts).toEqual(['dev-platform']);
        expect(data.buddyWelcomeMessage.greeting).toMatch(/Dewayne/);
        expect(data.contextDefinitions.length).toBeGreaterThan(0);
    });

    // ─── Suggestions ────────────────────────────────────────────────
    test('getSuggestionsForUser suggests contexts based on auth provider', () => {
        const userId = 'suggest-test';
        orchestrator.advanceStage(userId, { stage: 'auth', provider: 'github' });

        const suggestions = orchestrator.getSuggestionsForUser(userId);
        expect(suggestions.ok).toBe(true);
        expect(suggestions.suggestedContexts).toContain('dev-platform');
        expect(suggestions.provider).toBe('github');
    });

    // ─── Constants ──────────────────────────────────────────────────
    test('SECURE_EMAIL_CLIENTS has at least 4 clients', () => {
        expect(SECURE_EMAIL_CLIENTS.length).toBeGreaterThanOrEqual(4);
        const ids = SECURE_EMAIL_CLIENTS.map((c) => c.id);
        expect(ids).toContain('thunderbird');
        expect(ids).toContain('k9-mail');
        expect(ids).toContain('gmail-web');
    });

    test('EMAIL_FORWARDING_MODES has 4 modes', () => {
        expect(EMAIL_FORWARDING_MODES).toHaveLength(4);
        const ids = EMAIL_FORWARDING_MODES.map((m) => m.id);
        expect(ids).toEqual(['secure-client', 'forward-custom', 'forward-to-auth', 'skip']);
    });

    // ─── Health ─────────────────────────────────────────────────────
    test('getHealth reports service status', () => {
        const health = orchestrator.getHealth();
        expect(health.ok).toBe(true);
        expect(health.service).toBe('onboarding-orchestrator');
        expect(health.domain).toBe('headyme.com');
        expect(health.stages).toBe(5);
    });
});
