const { CrossDeviceSyncHub } = require('../src/cross-device-sync');

describe('cross-device sync enterprise hardening', () => {
    test('enforces auth token when enabled', () => {
        const hub = new CrossDeviceSyncHub({
            requireAuthToken: true,
            sharedToken: 'secret-token',
        });

        expect(hub._isAuthorized({ headers: { 'x-sync-token': 'secret-token' } })).toBe(true);
        expect(hub._isAuthorized({ headers: { 'x-sync-token': 'wrong-token' } })).toBe(false);
        expect(hub._isAuthorized({ headers: {} })).toBe(false);
    });

    test('rejects oversized messages', () => {
        const hub = new CrossDeviceSyncHub({ maxMessageBytes: 8 });
        const rejected = hub._isMessageRejected('device-12345678', Buffer.from('0123456789', 'utf8'));

        expect(rejected).toBe(true);
        expect(hub.getStatus().rejectedMessages).toBe(1);
    });

    test('rate limits high-volume messages per minute', () => {
        const hub = new CrossDeviceSyncHub({ maxMessagesPerMinute: 2 });

        expect(hub._isMessageRejected('device-12345678', Buffer.from('a'))).toBe(false);
        expect(hub._isMessageRejected('device-12345678', Buffer.from('a'))).toBe(false);
        expect(hub._isMessageRejected('device-12345678', Buffer.from('a'))).toBe(true);
        expect(hub.getStatus().rejectedMessages).toBe(1);
    });

    test('registerRoutes includes sync health endpoint', () => {
        const hub = new CrossDeviceSyncHub();
        const registeredPaths = [];
        const app = {
            get(path) {
                registeredPaths.push(path);
            },
            post(path) {
                registeredPaths.push(path);
            },
        };

        hub.registerRoutes(app);

        expect(registeredPaths).toContain('/api/sync/health');
    });
});
