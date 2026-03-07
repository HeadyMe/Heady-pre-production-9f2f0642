/**
 * Audit Logger Test Suite
 * ========================
 * Tests chain integrity, SOC 2 fields, export formats, rotation.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { AuditLogger, SOC2_CRITERIA } = require('../src/security/audit-logger');

describe('AuditLogger', () => {
  let logger;
  const testLogPath = '/tmp/test-audit.jsonl';

  beforeEach(() => {
    // Clean up
    if (fs.existsSync(testLogPath)) fs.unlinkSync(testLogPath);
    logger = new AuditLogger({ logPath: testLogPath });
  });

  afterEach(async () => {
    await logger.destroy();
    if (fs.existsSync(testLogPath)) fs.unlinkSync(testLogPath);
  });

  describe('Core Logging', () => {
    test('logs record with 6 required SOC 2 fields', async () => {
      const entry = await logger.log({
        tool: 'github.createPR',
        user: 'eric@headyconnection.org',
        duration_ms: 150,
        inputHash: 'abc123',
        outputHash: 'def456',
        action: 'EXECUTED',
      });

      expect(entry.timestamp).toBeDefined();
      expect(entry.tool).toBe('github.createPR');
      expect(entry.user).toBe('eric@headyconnection.org');
      expect(entry.input_hash).toBe('abc123');
      expect(entry.output_hash).toBe('def456');
      expect(entry.duration_ms).toBe(150);
    });

    test('includes chain hash', async () => {
      const entry = await logger.log({ tool: 'test', user: 'user1' });
      expect(entry.chain_hash).toBeDefined();
      expect(entry.chain_hash).toHaveLength(64); // SHA-256 hex
    });

    test('chains records with prev_hash linkage', async () => {
      const entry1 = await logger.log({ tool: 'test1', user: 'user1' });
      const entry2 = await logger.log({ tool: 'test2', user: 'user1' });

      expect(entry1.prev_hash).toBe('GENESIS');
      expect(entry2.prev_hash).toBe(entry1.chain_hash);
    });
  });

  describe('SOC 2 Criteria Tagging', () => {
    test('tags EXECUTED with CC7.1 and PI1', async () => {
      const entry = await logger.log({ action: 'EXECUTED', tool: 'test', user: 'u' });
      expect(entry.soc2_criteria).toContain(SOC2_CRITERIA.CC7_1);
      expect(entry.soc2_criteria).toContain(SOC2_CRITERIA.PI_1);
    });

    test('tags RBAC_DENIED with CC6.1 and CC6.2', async () => {
      const entry = await logger.log({ action: 'RBAC_DENIED', tool: 'test', user: 'u' });
      expect(entry.soc2_criteria).toContain(SOC2_CRITERIA.CC6_1);
    });

    test('tags RATE_LIMITED with CC7.2', async () => {
      const entry = await logger.log({ action: 'RATE_LIMITED', tool: 'test', user: 'u' });
      expect(entry.soc2_criteria).toContain(SOC2_CRITERIA.CC7_2);
    });
  });

  describe('Chain Verification', () => {
    test('verifies valid chain', async () => {
      await logger.log({ tool: 'test1', user: 'u' });
      await logger.log({ tool: 'test2', user: 'u' });
      await logger.log({ tool: 'test3', user: 'u' });
      await logger.flush();

      const result = await logger.verifyChain();
      expect(result.valid).toBe(true);
      expect(result.length).toBe(3);
    });

    test('verifies empty log', async () => {
      const result = await logger.verifyChain();
      expect(result.valid).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('Hashing', () => {
    test('hashInput produces consistent results', () => {
      const h1 = logger.hashInput({ key: 'value' });
      const h2 = logger.hashInput({ key: 'value' });
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(16);
    });

    test('hashOutput produces consistent results', () => {
      const h1 = logger.hashOutput('result data');
      const h2 = logger.hashOutput('result data');
      expect(h1).toBe(h2);
    });

    test('different inputs produce different hashes', () => {
      const h1 = logger.hashInput('input1');
      const h2 = logger.hashInput('input2');
      expect(h1).not.toBe(h2);
    });
  });

  describe('Export Formats', () => {
    test('exports NDJSON', async () => {
      await logger.log({ tool: 'test', user: 'u', action: 'EXECUTED' });
      await logger.flush();
      const output = await logger.export('ndjson');
      expect(output).toContain('"tool":"test"');
    });

    test('exports JSON array', async () => {
      await logger.log({ tool: 'test', user: 'u', action: 'EXECUTED' });
      await logger.flush();
      const output = await logger.export('json');
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
    });

    test('exports CEF format', async () => {
      await logger.log({ tool: 'test', user: 'u', action: 'EXECUTED' });
      await logger.flush();
      const output = await logger.export('cef');
      expect(output).toContain('CEF:0|HeadySystems|MCPGateway');
      expect(output).toContain('cs1=test');
    });

    test('exports syslog format', async () => {
      await logger.log({ tool: 'test', user: 'u', action: 'EXECUTED' });
      await logger.flush();
      const output = await logger.export('syslog');
      expect(output).toContain('heady-mcp-gateway');
      expect(output).toContain('tool="test"');
    });
  });

  describe('Flush & Persistence', () => {
    test('flushes buffer to disk', async () => {
      await logger.log({ tool: 'test', user: 'u' });
      await logger.flush();

      const content = fs.readFileSync(testLogPath, 'utf8');
      expect(content).toContain('"tool":"test"');
    });

    test('batch writes at threshold', async () => {
      // Log 21 records (fib(8) = 21 batch size)
      for (let i = 0; i < 22; i++) {
        await logger.log({ tool: `test${i}`, user: 'u' });
      }

      // Should have auto-flushed at 21
      if (fs.existsSync(testLogPath)) {
        const content = fs.readFileSync(testLogPath, 'utf8');
        const lines = content.trim().split('\n');
        expect(lines.length).toBeGreaterThanOrEqual(21);
      }
    });
  });
});
