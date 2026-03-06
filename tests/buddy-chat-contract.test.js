const {
    sanitizeText,
    buildUserWorkspaceId,
    buildChatRequest,
    parseBuddyResponse,
    assertConfirmedCompletion,
} = require('../src/services/buddy-chat-contract');

describe('buddy chat contract', () => {
    test('builds stable user-scoped 3d workspace id', () => {
        const id = buildUserWorkspaceId({ userId: 'user-1', deviceId: 'dev-1', site: 'headybuddy' });
        expect(id).toBe('vw:headybuddy:user-1:dev-1');
    });

    test('buildChatRequest includes auth and workspace headers', () => {
        const request = buildChatRequest({
            message: 'Hello',
            userId: 'u1',
            token: 'tok',
            deviceId: 'd1',
            site: 'heady',
        });

        expect(request.headers.Authorization).toBe('Bearer tok');
        expect(request.headers['X-Heady-Workspace']).toContain('vw:heady:u1:d1');
        expect(request.body.context.vector3d).toBe(true);
    });

    test('parseBuddyResponse recognizes confirmed completion', () => {
        const parsed = parseBuddyResponse({ response: 'Done', status: 'completed' });
        expect(parsed.confirmed).toBe(true);
        expect(assertConfirmedCompletion(parsed)).toBe(true);
    });

    test('parseBuddyResponse returns in_progress when not confirmed', () => {
        const parsed = parseBuddyResponse({ response: 'Working', status: 'in_progress' });
        expect(parsed.confirmed).toBe(false);
        expect(assertConfirmedCompletion(parsed)).toBe(false);
    });

    test('sanitizeText strips html control chars', () => {
        expect(sanitizeText('<b>ok</b>')).toBe('bok/b');
    });
});
