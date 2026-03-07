/**
 * Zero-Trust Sandbox Test Suite
 * ==============================
 * Tests capability checks, resource limits, violations, lockout.
 */

'use strict';

const {
  ZeroTrustSandbox,
  SandboxViolation,
  CAPABILITIES,
  TOOL_PROFILES,
  DEFAULT_RESOURCE_LIMITS,
} = require('../src/security/zero-trust-sandbox');

describe('ZeroTrustSandbox', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = new ZeroTrustSandbox({
      toolCategories: {
        'file.read': 'file-ops',
        'network.fetch': 'network',
        'db.query': 'database',
        'system.exec': 'code-exec',
        'secrets.get': 'secret-mgmt',
      },
    });
  });

  describe('Capability Bitmask', () => {
    test('CAPABILITIES has correct values', () => {
      expect(CAPABILITIES.NONE).toBe(0b00000000);
      expect(CAPABILITIES.FILE_READ).toBe(0b00000001);
      expect(CAPABILITIES.FILE_WRITE).toBe(0b00000010);
      expect(CAPABILITIES.FULL_ACCESS).toBe(0b11111111);
      expect(CAPABILITIES.READ_ONLY).toBe(0b00010101);
    });

    test('compound masks combine correctly', () => {
      expect(CAPABILITIES.FILE_ALL).toBe(CAPABILITIES.FILE_READ | CAPABILITIES.FILE_WRITE);
      expect(CAPABILITIES.NETWORK_ALL).toBe(CAPABILITIES.NETWORK_READ | CAPABILITIES.NETWORK_WRITE);
    });
  });

  describe('Capability Checks', () => {
    test('rejects insufficient capabilities', async () => {
      const mockConnection = { send: jest.fn() };
      await expect(sandbox.execute({
        tool: 'file.read',
        arguments: {},
        connection: mockConnection,
        user: 'user1',
        jwt: 'test',
        capabilities: CAPABILITIES.NETWORK_READ, // wrong capability
      })).rejects.toThrow(SandboxViolation);
    });

    test('allows matching capabilities', async () => {
      const mockConnection = {
        send: jest.fn().mockResolvedValue({ result: { data: 'ok' } }),
      };
      const result = await sandbox.execute({
        tool: 'file.read',
        arguments: {},
        connection: mockConnection,
        user: 'user1',
        jwt: 'test',
        capabilities: CAPABILITIES.FILE_ALL,
      });
      expect(result).toEqual({ data: 'ok' });
    });

    test('FULL_ACCESS grants all capabilities', async () => {
      const mockConnection = {
        send: jest.fn().mockResolvedValue({ result: { data: 'ok' } }),
      };
      const result = await sandbox.execute({
        tool: 'secrets.get',
        arguments: {},
        connection: mockConnection,
        user: 'admin1',
        jwt: 'test',
        capabilities: CAPABILITIES.FULL_ACCESS,
      });
      expect(result).toEqual({ data: 'ok' });
    });
  });

  describe('User Lockout', () => {
    test('locks out user after 5 violations', async () => {
      const mockConnection = { send: jest.fn() };

      // Generate 5 violations
      for (let i = 0; i < 5; i++) {
        try {
          await sandbox.execute({
            tool: 'secrets.get',
            arguments: {},
            connection: mockConnection,
            user: 'bad-user',
            jwt: 'test',
            capabilities: CAPABILITIES.NONE,
          });
        } catch (e) { /* expected */ }
      }

      // 6th attempt should be locked out
      await expect(sandbox.execute({
        tool: 'file.read',
        arguments: {},
        connection: mockConnection,
        user: 'bad-user',
        jwt: 'test',
        capabilities: CAPABILITIES.FILE_ALL,
      })).rejects.toThrow(/locked out/);
    });

    test('resetViolations clears lockout', () => {
      // Manually set violations
      sandbox._userViolations.set('bad-user', 10);
      expect(sandbox.getViolationCount('bad-user')).toBe(10);

      sandbox.resetViolations('bad-user');
      expect(sandbox.getViolationCount('bad-user')).toBe(0);
    });
  });

  describe('Output Size Limits', () => {
    test('rejects oversized output', async () => {
      const largeOutput = 'x'.repeat(DEFAULT_RESOURCE_LIMITS.maxOutputBytes + 1);
      const mockConnection = {
        send: jest.fn().mockResolvedValue({ result: largeOutput }),
      };

      await expect(sandbox.execute({
        tool: 'file.read',
        arguments: {},
        connection: mockConnection,
        user: 'user1',
        jwt: 'test',
        capabilities: CAPABILITIES.FILE_ALL,
      })).rejects.toThrow(SandboxViolation);
    });
  });

  describe('Tool Profiles', () => {
    test('default profile is read-only', () => {
      expect(TOOL_PROFILES['default'].caps).toBe(CAPABILITIES.READ_ONLY);
    });

    test('code-exec requires SYSTEM_EXEC', () => {
      expect(TOOL_PROFILES['code-exec'].caps).toBe(CAPABILITIES.SYSTEM_EXEC);
    });
  });

  describe('Execution Log', () => {
    test('logs successful executions', async () => {
      const mockConnection = {
        send: jest.fn().mockResolvedValue({ result: 'ok' }),
      };

      await sandbox.execute({
        tool: 'file.read',
        arguments: { path: '/test' },
        connection: mockConnection,
        user: 'user1',
        jwt: 'test',
        capabilities: CAPABILITIES.FILE_ALL,
      });

      const log = sandbox.getExecutionLog();
      expect(log).toHaveLength(1);
      expect(log[0].status).toBe('success');
      expect(log[0].tool).toBe('file.read');
    });
  });
});
