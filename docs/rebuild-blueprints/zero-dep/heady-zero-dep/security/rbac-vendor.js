/**
 * @file rbac-vendor.js
 * @description Role-Based Access Control with permission inheritance, resource-level
 *              access control, policy evaluation, and audit logging.
 *
 * Features:
 * - Users, roles, permissions (3-tier hierarchy)
 * - Permission inheritance (role hierarchy)
 * - Resource-level access control (object-level policies)
 * - Policy evaluation engine (allow/deny rules, conditions)
 * - Audit logging with tamper-evident HMAC chain
 *
 * Zero external dependencies (crypto, events).
 *
 * @module HeadySecurity/RBAC
 */

import { EventEmitter }         from 'events';
import { randomUUID, createHmac } from 'crypto';

// ─── Permission Model ─────────────────────────────────────────────────────────

/**
 * Permission string format: "resource:action" or "resource:*" or "*:*"
 * Examples: "vector-db:read", "pipeline:execute", "*:admin"
 */

export class Permission {
  constructor(resource, action) {
    this.resource = resource;  // string or '*'
    this.action   = action;    // string or '*'
  }

  matches(resource, action) {
    const rMatch = this.resource === '*' || this.resource === resource;
    const aMatch = this.action   === '*' || this.action   === action;
    return rMatch && aMatch;
  }

  toString() { return `${this.resource}:${this.action}`; }

  static parse(str) {
    const [resource, action] = str.split(':');
    return new Permission(resource ?? '*', action ?? '*');
  }
}

// ─── Role ─────────────────────────────────────────────────────────────────────

export class Role {
  /**
   * @param {string}   id
   * @param {string[]} permissions   Array of "resource:action" strings
   * @param {string[]} inherits      Role IDs this role inherits from
   * @param {object}   [meta]
   */
  constructor(id, permissions = [], inherits = [], meta = {}) {
    this.id          = id;
    this.permissions = permissions.map(p => typeof p === 'string' ? Permission.parse(p) : p);
    this.inherits    = inherits;   // role IDs
    this.meta        = meta;
    this.createdAt   = Date.now();
  }

  hasPermission(resource, action) {
    return this.permissions.some(p => p.matches(resource, action));
  }
}

// ─── User ─────────────────────────────────────────────────────────────────────

export class User {
  /**
   * @param {string}   id
   * @param {string[]} roles         Role IDs
   * @param {object}   [attributes]  Context attributes (for ABAC conditions)
   */
  constructor(id, roles = [], attributes = {}) {
    this.id         = id;
    this.roles      = roles;        // role IDs
    this.attributes = attributes;
    this.createdAt  = Date.now();
    this.active     = true;
  }
}

// ─── Policy ───────────────────────────────────────────────────────────────────

/**
 * Fine-grained policy overrides (allow/deny at resource instance level).
 */
export class Policy {
  /**
   * @param {object} def
   * @param {string} def.id
   * @param {string} def.effect      'allow' | 'deny'
   * @param {string[]} def.subjects  User IDs or role IDs (prefix 'role:')
   * @param {string} def.resource    Resource type
   * @param {string} def.action      Action
   * @param {string} [def.resourceId] Specific resource instance ID (null = any)
   * @param {Function} [def.condition] (user, context) => bool
   * @param {number}  [def.priority]   Higher priority wins (default 0)
   */
  constructor(def) {
    this.id         = def.id ?? randomUUID();
    this.effect     = def.effect ?? 'allow';
    this.subjects   = def.subjects ?? [];
    this.resource   = def.resource;
    this.action     = def.action;
    this.resourceId = def.resourceId ?? null;
    this.condition  = def.condition  ?? null;
    this.priority   = def.priority   ?? 0;
  }

  appliesToSubject(user, userRoles) {
    return this.subjects.some(s => {
      if (s === user.id) return true;
      if (s.startsWith('role:') && userRoles.includes(s.slice(5))) return true;
      if (s === '*') return true;
      return false;
    });
  }
}

// ─── Audit Log Chain ──────────────────────────────────────────────────────────

class AuditChain {
  constructor(secret) {
    this._secret = secret;
    this._log    = [];
    this._prevHash = '0'.repeat(64);
  }

  append(entry) {
    const record = {
      seq:      this._log.length,
      ts:       Date.now(),
      prev:     this._prevHash,
      ...entry,
    };
    const payload   = JSON.stringify(record);
    const hmac      = createHmac('sha256', this._secret).update(payload).digest('hex');
    record.hmac     = hmac;
    this._prevHash  = hmac;
    this._log.push(record);
    return record;
  }

  verify() {
    let prev = '0'.repeat(64);
    for (const record of this._log) {
      const { hmac, ...rest } = record;
      const expected = createHmac('sha256', this._secret)
        .update(JSON.stringify({ ...rest, prev }))
        .digest('hex');
      if (expected !== hmac) return false;
      prev = hmac;
    }
    return true;
  }

  last(n = 50) {
    return this._log.slice(-n);
  }

  get length() { return this._log.length; }
}

// ─── RBAC Engine ─────────────────────────────────────────────────────────────

export class RBACEngine extends EventEmitter {
  /**
   * @param {object} opts
   * @param {string} [opts.auditSecret]  HMAC secret for audit chain
   */
  constructor(opts = {}) {
    super();
    this._users    = new Map();   // id → User
    this._roles    = new Map();   // id → Role
    this._policies = new Map();   // id → Policy
    this._audit    = new AuditChain(opts.auditSecret ?? randomUUID());
    this._setupDefaults();
  }

  _setupDefaults() {
    // Built-in roles
    this.defineRole('superadmin', ['*:*'], []);
    this.defineRole('admin',      ['*:read', '*:write', '*:delete'], []);
    this.defineRole('operator',   ['*:read', '*:write', 'pipeline:execute'], []);
    this.defineRole('observer',   ['*:read'], []);
    this.defineRole('node-brain', [
      'vector-db:*', 'embedding:*', 'llm:*', 'memory:*',
    ], ['observer']);
    this.defineRole('node-conductor', [
      'pipeline:*', 'swarm:*', 'conductor:*', 'bees:*',
    ], ['observer']);
    this.defineRole('node-sentinel', [
      'security:*', 'resilience:*', 'telemetry:*', 'governance:*',
    ], ['observer']);
  }

  // ── User Management ───────────────────────────────────────────────────────

  defineUser(id, roles = [], attributes = {}) {
    const user = new User(id, roles, attributes);
    this._users.set(id, user);
    this._audit.append({ type: 'USER_CREATED', userId: id, roles });
    return user;
  }

  getUser(id) { return this._users.get(id) ?? null; }

  assignRole(userId, roleId) {
    const user = this._users.get(userId);
    if (!user) throw new Error(`RBAC: unknown user ${userId}`);
    if (!this._roles.has(roleId)) throw new Error(`RBAC: unknown role ${roleId}`);
    if (!user.roles.includes(roleId)) user.roles.push(roleId);
    this._audit.append({ type: 'ROLE_ASSIGNED', userId, roleId });
  }

  revokeRole(userId, roleId) {
    const user = this._users.get(userId);
    if (!user) return;
    user.roles = user.roles.filter(r => r !== roleId);
    this._audit.append({ type: 'ROLE_REVOKED', userId, roleId });
  }

  // ── Role Management ───────────────────────────────────────────────────────

  defineRole(id, permissions = [], inherits = [], meta = {}) {
    const role = new Role(id, permissions, inherits, meta);
    this._roles.set(id, role);
    return role;
  }

  getRole(id) { return this._roles.get(id) ?? null; }

  /**
   * Resolve all permissions for a role, following inheritance chain.
   * @returns {Permission[]}
   */
  resolveRolePermissions(roleId, _visited = new Set()) {
    if (_visited.has(roleId)) return [];
    _visited.add(roleId);

    const role = this._roles.get(roleId);
    if (!role) return [];

    const perms = [...role.permissions];
    for (const parentId of role.inherits) {
      perms.push(...this.resolveRolePermissions(parentId, _visited));
    }
    return perms;
  }

  // ── Policy Management ─────────────────────────────────────────────────────

  definePolicy(def) {
    const policy = new Policy(def);
    this._policies.set(policy.id, policy);
    this._audit.append({ type: 'POLICY_CREATED', policyId: policy.id, effect: policy.effect });
    return policy;
  }

  removePolicy(id) {
    this._policies.delete(id);
    this._audit.append({ type: 'POLICY_REMOVED', policyId: id });
  }

  // ── Authorization ─────────────────────────────────────────────────────────

  /**
   * Check if a user can perform an action on a resource.
   *
   * @param {string} userId
   * @param {string} resource      Resource type (e.g., 'vector-db')
   * @param {string} action        Action (e.g., 'read')
   * @param {object} [context]     Additional context for condition evaluation
   * @param {string} [resourceId]  Specific resource instance ID
   *
   * @returns {{ allowed: boolean, reason: string, matched: string }}
   */
  can(userId, resource, action, context = {}, resourceId = null) {
    const user = this._users.get(userId);
    if (!user) {
      this._logAccess(userId, resource, action, false, 'unknown-user');
      return { allowed: false, reason: 'unknown-user', matched: null };
    }
    if (!user.active) {
      this._logAccess(userId, resource, action, false, 'user-inactive');
      return { allowed: false, reason: 'user-inactive', matched: null };
    }

    const userRoles = user.roles;

    // ── Phase 1: Policy evaluation (highest priority, explicit allow/deny) ──
    const applicablePolicies = [...this._policies.values()]
      .filter(p =>
        p.appliesToSubject(user, userRoles) &&
        (p.resource === resource || p.resource === '*') &&
        (p.action   === action   || p.action   === '*') &&
        (p.resourceId === null || p.resourceId === resourceId)
      )
      .sort((a, b) => b.priority - a.priority);

    for (const policy of applicablePolicies) {
      const condOk = !policy.condition || policy.condition(user, context);
      if (!condOk) continue;

      const allowed = policy.effect === 'allow';
      this._logAccess(userId, resource, action, allowed, `policy:${policy.id}`);
      return { allowed, reason: `policy:${policy.effect}`, matched: policy.id };
    }

    // ── Phase 2: Role-based permission check ──────────────────────────────
    for (const roleId of userRoles) {
      const perms = this.resolveRolePermissions(roleId);
      if (perms.some(p => p.matches(resource, action))) {
        this._logAccess(userId, resource, action, true, `role:${roleId}`);
        return { allowed: true, reason: 'role-permission', matched: roleId };
      }
    }

    // Default deny
    this._logAccess(userId, resource, action, false, 'no-match');
    return { allowed: false, reason: 'no-matching-permission', matched: null };
  }

  /**
   * Enforce access — throws if denied.
   */
  enforce(userId, resource, action, context = {}, resourceId = null) {
    const result = this.can(userId, resource, action, context, resourceId);
    if (!result.allowed) {
      const err = new Error(`Access denied: ${userId} cannot ${action} on ${resource}`);
      err.code  = 'ACCESS_DENIED';
      err.rbac  = result;
      throw err;
    }
    return result;
  }

  _logAccess(userId, resource, action, allowed, reason) {
    const record = this._audit.append({
      type:     allowed ? 'ACCESS_GRANTED' : 'ACCESS_DENIED',
      userId, resource, action, reason,
    });
    this.emit(allowed ? 'access:granted' : 'access:denied', record);
  }

  // ── Audit ─────────────────────────────────────────────────────────────────

  auditLog(n = 100) { return this._audit.last(n); }

  verifyAuditChain() { return this._audit.verify(); }

  // ── Stats ─────────────────────────────────────────────────────────────────

  stats() {
    return {
      users:    this._users.size,
      roles:    this._roles.size,
      policies: this._policies.size,
      auditLog: this._audit.length,
    };
  }
}

export default RBACEngine;
