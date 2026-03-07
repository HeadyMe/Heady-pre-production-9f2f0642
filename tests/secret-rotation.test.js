/**
 * Secret Rotation Test Suite
 * ===========================
 * Tests rotation lifecycle, dual-key overlap, emergency rotation, scheduling.
 */

'use strict';

const {
  SecretRotationManager,
  InMemorySecretBackend,
  SECRET_TYPES,
  ROTATION_INTERVALS,
  OVERLAP_PERIODS,
} = require('../src/security/secret-rotation');

describe('SecretRotationManager', () => {
  let manager;

  beforeEach(() => {
    manager = new SecretRotationManager();
  });

  afterEach(() => {
    manager.stopAll();
  });

  describe('Registration', () => {
    test('registers a secret', () => {
      const entry = manager.register('mcp-api-key', {
        type: SECRET_TYPES.API_KEY,
      });
      expect(entry.id).toBe('mcp-api-key');
      expect(entry.type).toBe('api_key');
      expect(entry.status).toBe('active');
    });

    test('sets correct rotation interval for type', () => {
      const entry = manager.register('jwt-key', {
        type: SECRET_TYPES.JWT_SIGNING,
      });
      expect(entry.rotationInterval).toBe(ROTATION_INTERVALS[SECRET_TYPES.JWT_SIGNING]);
    });

    test('accepts custom rotation interval', () => {
      const entry = manager.register('custom-key', {
        type: SECRET_TYPES.API_KEY,
        rotationInterval: 60000,
      });
      expect(entry.rotationInterval).toBe(60000);
    });
  });

  describe('Rotation', () => {
    test('rotates a secret successfully', async () => {
      manager.register('test-key', { type: SECRET_TYPES.API_KEY });
      const result = await manager.rotate('test-key');

      expect(result.success).toBe(true);
      expect(result.secretId).toBe('test-key');
      expect(result.rotatedAt).toBeDefined();
    });

    test('generates prefixed API key', async () => {
      manager.register('api-key', { type: SECRET_TYPES.API_KEY });
      await manager.rotate('api-key');
      const value = await manager.getValue('api-key');
      expect(value).toMatch(/^hdy_/);
    });

    test('generates prefixed webhook secret', async () => {
      manager.register('webhook', { type: SECRET_TYPES.WEBHOOK_SECRET });
      await manager.rotate('webhook');
      const value = await manager.getValue('webhook');
      expect(value).toMatch(/^whsec_/);
    });

    test('maintains dual-key during overlap period', async () => {
      manager.register('overlap-key', { type: SECRET_TYPES.API_KEY });

      // First rotation
      await manager.rotate('overlap-key');
      const firstValue = await manager.getValue('overlap-key');

      // Second rotation
      await manager.rotate('overlap-key');
      const secondValue = await manager.getValue('overlap-key');

      // Both should be valid during overlap
      expect(await manager.validate('overlap-key', secondValue)).toBe(true);
      expect(await manager.validate('overlap-key', firstValue)).toBe(true);
      expect(firstValue).not.toBe(secondValue);
    });

    test('increments rotation count', async () => {
      manager.register('counter-key', { type: SECRET_TYPES.API_KEY });
      await manager.rotate('counter-key');
      await manager.rotate('counter-key');
      await manager.rotate('counter-key');

      const status = manager.getStatus();
      expect(status['counter-key'].rotationCount).toBe(3);
    });

    test('throws on unregistered secret', async () => {
      await expect(manager.rotate('nonexistent')).rejects.toThrow(/not registered/);
    });
  });

  describe('Emergency Rotation', () => {
    test('immediately deactivates previous key', async () => {
      manager.register('emergency-key', { type: SECRET_TYPES.API_KEY });
      await manager.rotate('emergency-key');
      const oldValue = await manager.getValue('emergency-key');

      await manager.emergencyRotate('emergency-key');

      // Old value should NOT be valid after emergency rotation
      expect(await manager.validate('emergency-key', oldValue)).toBe(false);
    });
  });

  describe('Rotate All', () => {
    test('rotates all registered secrets', async () => {
      manager.register('key1', { type: SECRET_TYPES.API_KEY });
      manager.register('key2', { type: SECRET_TYPES.WEBHOOK_SECRET });
      manager.register('key3', { type: SECRET_TYPES.JWT_SIGNING });

      const results = await manager.rotateAll();
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Status', () => {
    test('reports status for all secrets', async () => {
      manager.register('status-key', { type: SECRET_TYPES.API_KEY });
      await manager.rotate('status-key');

      const status = manager.getStatus();
      expect(status['status-key']).toBeDefined();
      expect(status['status-key'].status).toBe('active');
      expect(status['status-key'].lastRotated).toBeDefined();
      expect(status['status-key'].nextRotation).toBeDefined();
      expect(status['status-key'].alertLevel).toBeDefined();
    });
  });

  describe('Custom Generator', () => {
    test('uses custom generator function', async () => {
      manager.register('custom-gen', {
        type: SECRET_TYPES.API_KEY,
        generator: () => 'custom-secret-value-123',
      });
      await manager.rotate('custom-gen');
      const value = await manager.getValue('custom-gen');
      expect(value).toBe('custom-secret-value-123');
    });
  });

  describe('Audit Log', () => {
    test('records rotation events', async () => {
      manager.register('audit-key', { type: SECRET_TYPES.API_KEY });
      await manager.rotate('audit-key');

      expect(manager.auditLog.length).toBeGreaterThanOrEqual(2); // REGISTERED + ROTATED
      expect(manager.auditLog.some(l => l.action === 'REGISTERED')).toBe(true);
      expect(manager.auditLog.some(l => l.action === 'ROTATED')).toBe(true);
    });
  });

  describe('Rotation Intervals', () => {
    test('API key interval is 89 days', () => {
      expect(ROTATION_INTERVALS[SECRET_TYPES.API_KEY]).toBe(89 * 24 * 60 * 60 * 1000);
    });

    test('JWT signing interval is 55 days', () => {
      expect(ROTATION_INTERVALS[SECRET_TYPES.JWT_SIGNING]).toBe(55 * 24 * 60 * 60 * 1000);
    });

    test('all intervals use Fibonacci values', () => {
      const fibs = [5, 8, 13, 21, 34, 55, 89, 144, 233, 377];
      for (const interval of Object.values(ROTATION_INTERVALS)) {
        const days = interval / (24 * 60 * 60 * 1000);
        const hours = interval / (60 * 60 * 1000);
        // Should match a Fibonacci number (in days or hours)
        expect(fibs.includes(days) || fibs.includes(hours)).toBe(true);
      }
    });
  });
});
