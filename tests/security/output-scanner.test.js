/**
 * Output Scanner Test Suite
 * ==========================
 * Tests all 12 redaction pattern types.
 */

'use strict';

const { OutputScanner, luhnCheck } = require('../../src/security/output-scanner');

describe('OutputScanner', () => {
  let scanner;

  beforeEach(() => {
    scanner = new OutputScanner();
  });

  describe('AWS Credentials', () => {
    test('redacts AWS access key', () => {
      const result = scanner.scan('Here is key: AKIAIOSFODNN7EXAMPLE');
      expect(result.redacted).toBe(true);
      expect(result.output).toContain('[REDACTED:AWS_KEY]');
      expect(result.output).not.toContain('AKIAIOSFODNN7EXAMPLE');
    });

    test('redacts AWS secret key', () => {
      const result = scanner.scan('aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
      expect(result.redacted).toBe(true);
      expect(result.output).toContain('[REDACTED:AWS_SECRET]');
    });
  });

  describe('JWT Tokens', () => {
    test('redacts JWT token', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const result = scanner.scan(`Token: ${jwt}`);
      expect(result.redacted).toBe(true);
      expect(result.output).toContain('[REDACTED:JWT]');
    });
  });

  describe('Bearer Tokens', () => {
    test('redacts Bearer token', () => {
      const result = scanner.scan('Authorization: Bearer sk-abc123def456ghi789jkl012mno345pqr678stu');
      expect(result.redacted).toBe(true);
      expect(result.output).toContain('[REDACTED:TOKEN]');
    });
  });

  describe('Private Keys', () => {
    test('redacts RSA private key', () => {
      const key = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0Z...\n-----END RSA PRIVATE KEY-----';
      const result = scanner.scan(`Config: ${key}`);
      expect(result.redacted).toBe(true);
      expect(result.output).toContain('[REDACTED:PRIVATE_KEY]');
    });
  });

  describe('Credit Cards', () => {
    test('redacts valid Visa number', () => {
      const result = scanner.scan('Payment: 4532015112830366');
      expect(result.redacted).toBe(true);
      expect(result.output).toContain('[REDACTED:CARD]');
    });

    test('skips invalid card number (fails Luhn)', () => {
      const result = scanner.scan('Number: 4532015112830367'); // invalid Luhn
      expect(result.output).not.toContain('[REDACTED:CARD]');
    });
  });

  describe('GitHub Tokens', () => {
    test('redacts GitHub PAT', () => {
      const result = scanner.scan('GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn');
      expect(result.redacted).toBe(true);
      expect(result.output).toContain('[REDACTED:GITHUB_TOKEN]');
    });
  });

  describe('Database URLs', () => {
    test('redacts PostgreSQL connection string', () => {
      const result = scanner.scan('DATABASE_URL=postgresql://admin:secret@db.example.com:5432/heady');
      expect(result.redacted).toBe(true);
      expect(result.output).toContain('[REDACTED:DB_URL]');
    });

    test('redacts MongoDB connection string', () => {
      const result = scanner.scan('MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/db');
      expect(result.redacted).toBe(true);
      expect(result.output).toContain('[REDACTED:DB_URL]');
    });
  });

  describe('Internal IPs', () => {
    test('redacts 10.x.x.x addresses', () => {
      const result = scanner.scan('Server: 10.0.0.1:3000');
      expect(result.redacted).toBe(true);
      expect(result.output).toContain('[REDACTED:INTERNAL_IP]');
    });

    test('redacts 192.168.x.x addresses', () => {
      const result = scanner.scan('Gateway: 192.168.1.1');
      expect(result.redacted).toBe(true);
      expect(result.output).toContain('[REDACTED:INTERNAL_IP]');
    });
  });

  describe('Generic Secrets', () => {
    test('redacts api_key assignments', () => {
      const result = scanner.scan('api_key=sk_live_abcdef1234567890abcdef');
      expect(result.redacted).toBe(true);
      expect(result.output).toContain('[REDACTED:SECRET]');
    });
  });

  describe('Object Output', () => {
    test('handles and redacts object output', () => {
      const obj = {
        status: 'ok',
        config: {
          db: 'postgresql://admin:secret@db.example.com:5432/heady',
          key: 'AKIAIOSFODNN7EXAMPLE',
        },
      };
      const result = scanner.scan(obj);
      expect(result.redacted).toBe(true);
      expect(typeof result.output).toBe('object');
    });
  });

  describe('Clean Output', () => {
    test('passes through clean output unchanged', () => {
      const clean = { status: 'ok', message: 'Hello world', count: 42 };
      const result = scanner.scan(clean);
      expect(result.redacted).toBe(false);
      expect(result.output).toEqual(clean);
    });
  });

  describe('Luhn Check', () => {
    test('validates known good Visa', () => {
      expect(luhnCheck('4532015112830366')).toBe(true);
    });

    test('rejects invalid number', () => {
      expect(luhnCheck('1234567890123456')).toBe(false);
    });
  });

  describe('Statistics', () => {
    test('tracks scan statistics', () => {
      scanner.scan('AKIAIOSFODNN7EXAMPLE');
      scanner.scan('clean output');
      const stats = scanner.getStats();
      expect(stats.scanned).toBe(2);
      expect(stats.redacted).toBe(1);
    });
  });
});
