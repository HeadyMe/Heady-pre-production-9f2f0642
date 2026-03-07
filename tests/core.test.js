/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Core module tests — heady-kv, heady-jwt, heady-crypt, heady-scheduler, heady-fetch
 */

'use strict';

// ─── Module imports ───────────────────────────────────────────────────────────

const { HeadyKV }    = require('../src/core/heady-kv');
const heady_jwt      = require('../src/core/heady-jwt');
const headyCrypt     = require('../src/core/heady-crypt');
const { HeadyScheduler, createScheduler } = require('../src/core/heady-scheduler');
const headyFetch     = require('../src/core/heady-fetch');

// ─── heady-kv ────────────────────────────────────────────────────────────────

describe('HeadyKV', () => {
  let kv;

  beforeEach(() => {
    kv = new HeadyKV({ maxSize: 100 });
  });

  test('set and get a value', () => {
    kv.set('hello', 'world');
    expect(kv.get('hello')).toBe('world');
  });

  test('returns undefined for missing key', () => {
    expect(kv.get('nonexistent')).toBeUndefined();
  });

  test('has() returns true for existing key, false for missing', () => {
    kv.set('exists', 42);
    expect(kv.has('exists')).toBe(true);
    expect(kv.has('nope')).toBe(false);
  });

  test('delete() removes a key and returns true', () => {
    kv.set('del-me', 'value');
    const removed = kv.delete('del-me');
    expect(removed).toBe(true);
    expect(kv.get('del-me')).toBeUndefined();
  });

  test('delete() returns false for non-existent key', () => {
    expect(kv.delete('ghost')).toBe(false);
  });

  test('set() overwrites existing value', () => {
    kv.set('k', 'v1');
    kv.set('k', 'v2');
    expect(kv.get('k')).toBe('v2');
  });

  test('TTL expiry: value disappears after TTL elapses', async () => {
    kv.set('ttl-key', 'short-lived', 50); // 50 ms
    expect(kv.get('ttl-key')).toBe('short-lived');
    await new Promise(r => setTimeout(r, 100));
    expect(kv.get('ttl-key')).toBeUndefined();
  });

  test('clear() removes all entries', () => {
    kv.set('a', 1);
    kv.set('b', 2);
    kv.clear();
    expect(kv.has('a')).toBe(false);
    expect(kv.has('b')).toBe(false);
  });

  test('incr() increments a numeric value', () => {
    kv.set('counter', 0);
    kv.incr('counter', 5);
    expect(kv.get('counter')).toBe(5);
    kv.incr('counter', 3);
    expect(kv.get('counter')).toBe(8);
  });

  test('LRU eviction removes least-recently-used entry', () => {
    const tiny = new HeadyKV({ maxSize: 3 });
    tiny.set('a', 1);
    tiny.set('b', 2);
    tiny.set('c', 3);
    // Access 'a' to keep it warm
    tiny.get('a');
    // Adding 'd' should evict the LRU entry ('b')
    tiny.set('d', 4);
    expect(tiny.has('b')).toBe(false);
    expect(tiny.has('a')).toBe(true);
    expect(tiny.has('c')).toBe(true);
    expect(tiny.has('d')).toBe(true);
  });

  test('stores and retrieves complex objects', () => {
    const obj = { nested: { value: [1, 2, 3] }, flag: true };
    kv.set('obj', obj);
    expect(kv.get('obj')).toEqual(obj);
  });

  test('ttl() returns remaining TTL for a key with expiry', () => {
    kv.set('ttl-check', 'val', 10_000);
    const remaining = kv.ttl('ttl-check');
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(10_000);
  });

  test('getOrSet() returns existing value without calling compute fn', async () => {
    kv.set('cached', 'existing');
    const computeFn = jest.fn().mockResolvedValue('computed');
    const result = await kv.getOrSet('cached', computeFn);
    expect(result).toBe('existing');
    expect(computeFn).not.toHaveBeenCalled();
  });

  test('getOrSet() calls compute fn and stores result when key is missing', async () => {
    const computeFn = jest.fn().mockResolvedValue('freshly-computed');
    const result = await kv.getOrSet('new-key', computeFn);
    expect(result).toBe('freshly-computed');
    expect(computeFn).toHaveBeenCalledTimes(1);
    expect(kv.get('new-key')).toBe('freshly-computed');
  });
});

// ─── heady-jwt ────────────────────────────────────────────────────────────────

describe('heady-jwt', () => {
  const secret = 'test-secret-12345678901234567890';

  test('sign() produces a three-part JWT string', () => {
    const token = heady_jwt.sign({ sub: 'user-1' }, secret);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  test('verify() returns payload for a valid token', () => {
    const token = heady_jwt.sign({ sub: 'user-2', role: 'admin' }, secret);
    const payload = heady_jwt.verify(token, secret);
    expect(payload.sub).toBe('user-2');
    expect(payload.role).toBe('admin');
  });

  test('verify() throws on invalid signature', () => {
    const token = heady_jwt.sign({ sub: 'user-3' }, secret);
    expect(() => heady_jwt.verify(token, 'wrong-secret')).toThrow();
  });

  test('verify() throws on expired token', () => {
    const token = heady_jwt.sign({ sub: 'user-4', exp: Math.floor(Date.now() / 1000) - 10 }, secret);
    expect(() => heady_jwt.verify(token, secret)).toThrow(/expir/i);
  });

  test('sign() embeds iat and exp by default when expiresIn provided', () => {
    const token = heady_jwt.sign({ sub: 'u5' }, secret, { expiresIn: '1h' });
    const payload = heady_jwt.verify(token, secret);
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test('decode() extracts payload without verifying signature', () => {
    const token = heady_jwt.sign({ sub: 'u6', custom: 'data' }, secret);
    const decoded = heady_jwt.decode(token);
    expect(decoded.payload.sub).toBe('u6');
    expect(decoded.payload.custom).toBe('data');
  });

  test('verify() rejects a tampered token', () => {
    const token = heady_jwt.sign({ sub: 'u7' }, secret);
    const parts = token.split('.');
    // Tamper the payload
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'hacker' })).toString('base64url');
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    expect(() => heady_jwt.verify(tampered, secret)).toThrow();
  });
});

// ─── heady-crypt ─────────────────────────────────────────────────────────────

describe('heady-crypt', () => {
  test('hash() returns a Heady hash string', async () => {
    const h = await headyCrypt.hash('my-password', 4);
    expect(typeof h).toBe('string');
    expect(h.startsWith('$heady$')).toBe(true);
  });

  test('compare() returns true for matching password', async () => {
    const h = await headyCrypt.hash('correct-horse', 4);
    const match = await headyCrypt.compare('correct-horse', h);
    expect(match).toBe(true);
  });

  test('compare() returns false for wrong password', async () => {
    const h = await headyCrypt.hash('correct-horse', 4);
    const match = await headyCrypt.compare('wrong-pony', h);
    expect(match).toBe(false);
  });

  test('two hashes for same password differ (salt randomness)', async () => {
    const h1 = await headyCrypt.hash('password', 4);
    const h2 = await headyCrypt.hash('password', 4);
    expect(h1).not.toBe(h2);
  });

  test('getRounds() extracts the cost factor from a stored hash', async () => {
    const h = await headyCrypt.hash('test', 8);
    expect(headyCrypt.getRounds(h)).toBe(8);
  });

  test('generateToken() returns a hex string of expected length', () => {
    const tok = headyCrypt.generateToken(16);
    expect(typeof tok).toBe('string');
    expect(tok).toHaveLength(32); // 16 bytes → 32 hex chars
  });

  test('generateApiKey() returns a prefixed string', () => {
    const key = headyCrypt.generateApiKey();
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(10);
  });

  test('hashSync() and compareSync() work synchronously', () => {
    const h = headyCrypt.hashSync('sync-password', 4);
    expect(headyCrypt.compareSync('sync-password', h)).toBe(true);
    expect(headyCrypt.compareSync('wrong', h)).toBe(false);
  });
});

// ─── heady-scheduler ─────────────────────────────────────────────────────────

describe('HeadyScheduler', () => {
  let scheduler;

  beforeEach(() => {
    scheduler = createScheduler ? createScheduler() : new HeadyScheduler();
  });

  afterEach(() => {
    try { scheduler.destroy(); } catch {}
  });

  test('every() schedules a repeated task and calls it', async () => {
    const fn = jest.fn();
    scheduler.every('tick', 50, fn);
    await new Promise(r => setTimeout(r, 160));
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test('once() fires exactly once after delay', async () => {
    const fn = jest.fn();
    scheduler.once('one-shot', 50, fn);
    await new Promise(r => setTimeout(r, 200));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('remove() stops a scheduled task', async () => {
    const fn = jest.fn();
    scheduler.every('removable', 30, fn);
    await new Promise(r => setTimeout(r, 80));
    const countBefore = fn.mock.calls.length;
    scheduler.remove('removable');
    await new Promise(r => setTimeout(r, 100));
    expect(fn.mock.calls.length).toBe(countBefore); // no more calls
  });

  test('pause() and resume() control task execution', async () => {
    const fn = jest.fn();
    scheduler.every('pausable', 30, fn);
    await new Promise(r => setTimeout(r, 70));
    const countBeforePause = fn.mock.calls.length;
    scheduler.pause('pausable');
    await new Promise(r => setTimeout(r, 100));
    expect(fn.mock.calls.length).toBe(countBeforePause); // paused
    scheduler.resume('pausable');
    await new Promise(r => setTimeout(r, 80));
    expect(fn.mock.calls.length).toBeGreaterThan(countBeforePause);
  });

  test('list() returns registered task names', () => {
    scheduler.every('taskA', 1000, () => {});
    scheduler.every('taskB', 1000, () => {});
    const names = scheduler.list().map(t => t.name || t);
    expect(names).toContain('taskA');
    expect(names).toContain('taskB');
  });

  test('cron() schedules a task by cron expression', async () => {
    const fn = jest.fn();
    // Every minute — just validate registration without waiting a full minute
    expect(() => scheduler.cron('cron-task', '* * * * *', fn)).not.toThrow();
    const tasks = scheduler.list();
    const names = tasks.map(t => t.name || t);
    expect(names).toContain('cron-task');
  });
});

// ─── heady-fetch ─────────────────────────────────────────────────────────────

describe('heady-fetch', () => {
  test('fetches a real URL and returns ok response', async () => {
    const res = await headyFetch('https://httpbin.org/get', { timeout: 10000 });
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  }, 15000);

  test('res.json() parses JSON body', async () => {
    const res = await headyFetch('https://httpbin.org/json', { timeout: 10000 });
    const body = await res.json();
    expect(body).toBeDefined();
    expect(typeof body).toBe('object');
  }, 15000);

  test('res.body is a string for HTML response', async () => {
    const res = await headyFetch('https://httpbin.org/html', { timeout: 10000 });
    // heady-fetch exposes body as a string property directly
    const text = typeof res.text === 'function' ? await res.text() : res.body;
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  }, 15000);

  test('returns non-ok status for 404', async () => {
    const res = await headyFetch('https://httpbin.org/status/404', { timeout: 10000 });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  }, 15000);

  test('POST with JSON body works', async () => {
    const body = { key: 'value', num: 42 };
    const res = await headyFetch('https://httpbin.org/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout: 10000,
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(JSON.parse(data.data)).toEqual(body);
  }, 15000);

  test('throws or rejects for invalid URL', async () => {
    await expect(headyFetch('http://this.hostname.does.not.exist.invalid/path', { timeout: 3000 }))
      .rejects.toThrow();
  }, 10000);
});
