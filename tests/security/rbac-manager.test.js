/**
 * RBAC Manager Test Suite
 * ========================
 * Tests role hierarchy, JWT decoding, vendor adapters, tool overrides.
 */

'use strict';

const { RBACManager, ROLES, CAPABILITIES } = require('../../src/security/rbac-manager');

// Helper to create a mock JWT
function createMockJWT(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  })).toString('base64url');
  const sig = 'mock-signature-for-testing-only';
  return `${header}.${body}.${sig}`;
}

describe('RBACManager', () => {
  let rbac;

  beforeEach(() => {
    rbac = new RBACManager({ jwtAdapter: 'heady' });
  });

  describe('Role Definitions', () => {
    test('admin has FULL_ACCESS', () => {
      expect(ROLES.admin.capabilities).toBe(CAPABILITIES.FULL_ACCESS);
    });

    test('viewer has READ_ONLY', () => {
      expect(ROLES.viewer.capabilities).toBe(CAPABILITIES.READ_ONLY);
    });

    test('admin inherits from operator', () => {
      expect(ROLES.admin.inherits).toContain('operator');
    });
  });

  describe('JWT Decoding', () => {
    test('decodes valid JWT payload', () => {
      const jwt = createMockJWT({ sub: 'user1', heady_roles: ['developer'] });
      const result = rbac.checkAccess(jwt, 'file.read');
      expect(result.allowed).toBe(true);
      expect(result.user.userId).toBe('user1');
    });

    test('rejects expired JWT', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
      const body = Buffer.from(JSON.stringify({
        sub: 'user1',
        heady_roles: ['admin'],
        exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
      })).toString('base64url');
      const jwt = `${header}.${body}.sig`;

      const result = rbac.checkAccess(jwt, 'file.read');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Invalid or expired JWT');
    });

    test('rejects null JWT', () => {
      const result = rbac.checkAccess(null, 'file.read');
      expect(result.allowed).toBe(false);
    });

    test('rejects malformed JWT', () => {
      const result = rbac.checkAccess('not.a.valid.jwt', 'file.read');
      expect(result.allowed).toBe(false);
    });
  });

  describe('Role Hierarchy', () => {
    test('admin resolves all inherited roles', () => {
      const jwt = createMockJWT({ sub: 'admin1', heady_roles: ['admin'] });
      const result = rbac.checkAccess(jwt, 'file.read');
      expect(result.roles).toContain('admin');
      expect(result.roles).toContain('operator');
      expect(result.roles).toContain('developer');
      expect(result.roles).toContain('viewer');
    });

    test('developer inherits viewer', () => {
      const jwt = createMockJWT({ sub: 'dev1', heady_roles: ['developer'] });
      const result = rbac.checkAccess(jwt, 'file.read');
      expect(result.roles).toContain('developer');
      expect(result.roles).toContain('viewer');
      expect(result.roles).not.toContain('admin');
    });

    test('viewer cannot access admin tools', () => {
      const jwt = createMockJWT({ sub: 'viewer1', heady_roles: ['viewer'] });
      const result = rbac.checkAccess(jwt, 'secrets.rotate');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('requires minimum role');
    });
  });

  describe('Capability Resolution', () => {
    test('admin gets FULL_ACCESS capabilities', () => {
      const jwt = createMockJWT({ sub: 'admin1', heady_roles: ['admin'] });
      const result = rbac.checkAccess(jwt, 'file.read');
      expect(result.capabilities & CAPABILITIES.FULL_ACCESS).toBe(CAPABILITIES.FULL_ACCESS);
    });

    test('viewer gets READ_ONLY capabilities', () => {
      const jwt = createMockJWT({ sub: 'v1', heady_roles: ['viewer'] });
      const result = rbac.checkAccess(jwt, 'file.read');
      expect(result.capabilities & CAPABILITIES.READ_ONLY).toBe(CAPABILITIES.READ_ONLY);
      expect(result.capabilities & CAPABILITIES.FILE_WRITE).toBe(0);
    });
  });

  describe('Tool Overrides', () => {
    test('secrets.rotate requires admin role', () => {
      const jwt = createMockJWT({ sub: 'dev1', heady_roles: ['developer'] });
      const result = rbac.checkAccess(jwt, 'secrets.rotate');
      expect(result.allowed).toBe(false);
    });

    test('secrets.rotate allowed for admin', () => {
      const jwt = createMockJWT({ sub: 'admin1', heady_roles: ['admin'] });
      const result = rbac.checkAccess(jwt, 'secrets.rotate');
      expect(result.allowed).toBe(true);
      expect(result.capabilities & CAPABILITIES.SECRET_ACCESS).toBe(CAPABILITIES.SECRET_ACCESS);
    });
  });

  describe('JWT Vendor Adapters', () => {
    test('Auth0 adapter extracts roles', () => {
      const auth0Rbac = new RBACManager({ jwtAdapter: 'auth0' });
      const jwt = createMockJWT({
        sub: 'auth0|123',
        'https://headyme.com/roles': ['developer'],
        email: 'test@test.com',
      });
      const result = auth0Rbac.checkAccess(jwt, 'file.read');
      expect(result.allowed).toBe(true);
      expect(result.user.userId).toBe('auth0|123');
    });

    test('default to viewer when no roles', () => {
      const jwt = createMockJWT({ sub: 'user1' });
      const result = rbac.checkAccess(jwt, 'file.read');
      expect(result.allowed).toBe(true);
      expect(result.roles).toContain('viewer');
    });
  });

  describe('listRoles', () => {
    test('returns all roles with details', () => {
      const roles = rbac.listRoles();
      expect(roles.length).toBeGreaterThan(0);
      const admin = roles.find(r => r.name === 'admin');
      expect(admin).toBeDefined();
      expect(admin.capabilityBits).toBe('11111111');
    });
  });
});
