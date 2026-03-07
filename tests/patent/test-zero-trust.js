/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
'use strict';

const assert = require('assert');
const {
  PHI,
  SECRET_PATTERNS,
  PII_PATTERNS,
  UNSAFE_CODE_PATTERNS,
  shannonEntropy,
  SecretScanner,
  InputValidator,
  OutputSanitizer,
  CodeGovernor,
  AuditTrail,
  SanitizationPipeline,
} = require('../src/security/zero-trust-sanitizer');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}: ${err.message}`); failed++; }
}

console.log('\n=== Zero-Trust Sanitizer Tests ===\n');

test('PHI constant correct', () => { assert.strictEqual(PHI, 1.6180339887); });

// shannonEntropy
test('shannonEntropy of empty string = 0', () => {
  assert.strictEqual(shannonEntropy(''), 0);
  assert.strictEqual(shannonEntropy(null), 0);
});
test('shannonEntropy of single char = 0', () => {
  assert.strictEqual(shannonEntropy('aaaa'), 0);
});
test('shannonEntropy of varied string > 3', () => {
  const entropy = shannonEntropy('AKIA4J5TGX2BVPQE7K1D');
  assert.ok(entropy > 3);
});
test('shannonEntropy uniform dist has max entropy', () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const entropy = shannonEntropy(chars);
  assert.ok(entropy > 4);
});

// SecretScanner
test('SecretScanner detects AWS access key', () => {
  const scanner = new SecretScanner();
  const findings = scanner.scan('key=AKIAIOSFODNN7EXAMPLE here');
  assert.ok(findings.some(f => f.name === 'aws_access_key'));
});

test('SecretScanner detects JWT token', () => {
  const scanner = new SecretScanner();
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const findings = scanner.scan(jwt);
  assert.ok(findings.some(f => f.name === 'jwt_token'));
});

test('SecretScanner detects Bearer token', () => {
  const scanner = new SecretScanner();
  const findings = scanner.scan('Authorization: Bearer eyJsomeLongTokenHere123456789abcdefghijklmno');
  assert.ok(findings.some(f => f.name === 'bearer_token'));
});

test('SecretScanner detects private key PEM', () => {
  const scanner = new SecretScanner();
  const findings = scanner.scan('-----BEGIN RSA PRIVATE KEY----- MIIEowIBAAK...');
  assert.ok(findings.some(f => f.name === 'private_key_pem'));
});

test('SecretScanner detects password field', () => {
  const scanner = new SecretScanner();
  const findings = scanner.scan('"password": "mysecretpassword123"');
  assert.ok(findings.some(f => f.name === 'password_field'));
});

test('SecretScanner detects high-entropy strings', () => {
  const scanner = new SecretScanner({ entropyThreshold: 3.5 });
  const findings = scanner.scan('token=A3f8kP2mX9qR5vN1jL6wE4uI7oY0sT8bH2cW5zD');
  assert.ok(findings.some(f => f.type === 'entropy'));
});

test('SecretScanner redact replaces secrets', () => {
  const scanner = new SecretScanner();
  const redacted = scanner.redact('Authorization: Bearer eyJsomeReallyLongTokenHere1234567890abcdefghijklmno');
  assert.ok(redacted.includes('[REDACTED'));
  assert.ok(!redacted.includes('Bearer eyJ'));
});

test('SecretScanner getFindings accumulates', () => {
  const scanner = new SecretScanner();
  scanner.scan('AKIAIOSFODNN7EXAMPLE');
  scanner.scan('"password": "hunter2"');
  assert.ok(scanner.getFindings().length >= 1);
});

test('SecretScanner clearFindings resets', () => {
  const scanner = new SecretScanner();
  scanner.scan('AKIAIOSFODNN7EXAMPLE');
  scanner.clearFindings();
  assert.strictEqual(scanner.getFindings().length, 0);
});

test('SecretScanner no findings for clean text', () => {
  const scanner = new SecretScanner();
  const findings = scanner.scan('Hello world, this is a normal sentence.');
  assert.strictEqual(findings.filter(f => f.type === 'pattern').length, 0);
});

// InputValidator
test('InputValidator validate string type passes', () => {
  const v      = new InputValidator();
  const result = v.validate('hello', { type: 'string' });
  assert.ok(result.valid);
  assert.strictEqual(result.value, 'hello');
});

test('InputValidator validate wrong type fails', () => {
  const v      = new InputValidator();
  const result = v.validate(42, { type: 'string' });
  assert.ok(!result.valid);
  assert.ok(result.errors.length > 0);
});

test('InputValidator maxLength truncates string', () => {
  const v      = new InputValidator();
  const result = v.validate('hello world', { type: 'string', maxLength: 5 });
  assert.ok(!result.valid); // error reported
  assert.strictEqual(result.value.length, 5);
});

test('InputValidator number min/max', () => {
  const v = new InputValidator();
  const ok = v.validate(5, { type: 'number', min: 0, max: 10 });
  assert.ok(ok.valid);
  const fail = v.validate(15, { type: 'number', min: 0, max: 10 });
  assert.ok(!fail.valid);
});

test('InputValidator rejects NaN', () => {
  const v      = new InputValidator();
  const result = v.validate(NaN, { type: 'number' });
  assert.ok(!result.valid);
});

test('InputValidator object properties validation', () => {
  const v      = new InputValidator();
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string', required: true },
      age:  { type: 'number', min: 0, max: 150 },
    },
  };
  const ok = v.validate({ name: 'Alice', age: 30 }, schema);
  assert.ok(ok.valid);

  const fail = v.validate({ name: 'Alice', age: 200 }, schema);
  assert.ok(!fail.valid);
});

test('InputValidator required property missing', () => {
  const v      = new InputValidator();
  const schema = { type: 'object', properties: { name: { type: 'string', required: true } } };
  const result = v.validate({}, schema);
  assert.ok(!result.valid);
  assert.ok(result.errors.some(e => e.includes('name')));
});

test('InputValidator checkInjection detects SQL injection', () => {
  const v        = new InputValidator();
  const findings = v.checkInjection("'; DROP TABLE users; --");
  assert.ok(findings.some(f => f.type === 'sql_injection'));
});

test('InputValidator checkInjection detects NoSQL injection', () => {
  const v        = new InputValidator();
  const findings = v.checkInjection('{ "$where": "1===1" }');
  assert.ok(findings.some(f => f.type === 'nosql_injection'));
});

test('InputValidator checkInjection detects XSS', () => {
  const v        = new InputValidator();
  const findings = v.checkInjection('<script>alert(1)</script>');
  assert.ok(findings.some(f => f.type === 'xss'));
});

test('InputValidator removes null bytes from string', () => {
  const v      = new InputValidator();
  const result = v.validate('hello\0world', { type: 'string' });
  assert.ok(!result.value.includes('\0'));
});

test('InputValidator array maxItems', () => {
  const v      = new InputValidator();
  const result = v.validate([1, 2, 3, 4, 5], { type: 'array', maxItems: 3 });
  assert.ok(!result.valid);
  assert.strictEqual(result.value.length, 3);
});

test('InputValidator pattern validation', () => {
  const v      = new InputValidator();
  const ok     = v.validate('hello123', { type: 'string', pattern: '^[a-z0-9]+$' });
  assert.ok(ok.valid);
  const fail   = v.validate('Hello!', { type: 'string', pattern: '^[a-z0-9]+$' });
  assert.ok(!fail.valid);
});

// OutputSanitizer
test('OutputSanitizer strips email', () => {
  const san    = new OutputSanitizer();
  const result = san.sanitize('Contact user@example.com for details');
  assert.ok(result.text.includes('[EMAIL]'));
  assert.ok(!result.text.includes('user@example.com'));
});

test('OutputSanitizer strips US SSN', () => {
  const san    = new OutputSanitizer();
  const result = san.sanitize('SSN: 123-45-6789');
  assert.ok(result.text.includes('[SSN]'));
  assert.ok(!result.text.includes('123-45-6789'));
});

test('OutputSanitizer strips IP address', () => {
  const san    = new OutputSanitizer();
  const result = san.sanitize('Server at 192.168.1.100');
  assert.ok(result.text.includes('[IP]'));
});

test('OutputSanitizer redacts secrets', () => {
  const san    = new OutputSanitizer();
  const result = san.sanitize('Using key AKIAIOSFODNN7EXAMPLE to access AWS');
  assert.ok(result.text.includes('[REDACTED'));
});

test('OutputSanitizer returns clean=true for safe text', () => {
  const san    = new OutputSanitizer();
  const result = san.sanitize('The weather is nice today.');
  assert.ok(result.clean);
});

test('OutputSanitizer addCustomRedaction works', () => {
  const san = new OutputSanitizer();
  san.addCustomRedaction('my_pattern', 'CONFIDENTIAL', '[CONF]');
  const result = san.sanitize('This is CONFIDENTIAL information');
  assert.ok(result.text.includes('[CONF]'));
});

// CodeGovernor
test('CodeGovernor flags eval', () => {
  const gov    = new CodeGovernor();
  const result = gov.validate('const x = eval("1+1")');
  assert.ok(!result.safe || result.violations.some(v => v.name === 'eval'));
});

test('CodeGovernor flags new Function', () => {
  const gov    = new CodeGovernor();
  const result = gov.validate('const fn = new Function("return 1")');
  assert.ok(result.violations.some(v => v.name === 'new_function'));
});

test('CodeGovernor flags hardcoded secret', () => {
  const gov    = new CodeGovernor();
  const result = gov.validate('const password = "supersecret123"');
  assert.ok(result.violations.some(v => v.name === 'hardcoded_secret'));
});

test('CodeGovernor safe code passes', () => {
  const gov    = new CodeGovernor({ maxRiskScore: 100 });
  const result = gov.validate('function add(a, b) { return a + b; }');
  assert.ok(result.safe);
  assert.strictEqual(result.violations.length, 0);
});

test('CodeGovernor autoFix removes eval', () => {
  const gov   = new CodeGovernor();
  const fixed = gov.autoFix('const x = eval("code here")');
  assert.ok(!fixed.includes('eval('));
  assert.ok(fixed.includes('[BLOCKED:eval]'));
});

test('CodeGovernor autoFix removes new Function', () => {
  const gov   = new CodeGovernor();
  const fixed = gov.autoFix('const fn = new Function("return 1")');
  assert.ok(!fixed.match(/new\s+Function\s*\(/));
});

test('CodeGovernor riskScore calculated correctly', () => {
  const gov    = new CodeGovernor();
  const result = gov.validate('eval("x"); new Function("y")');
  assert.ok(result.riskScore >= 20); // eval=10 + new Function=10
});

// AuditTrail
test('AuditTrail append creates entry with hash', () => {
  const trail  = new AuditTrail();
  const entry  = trail.append('test_action', { key: 'value' });
  assert.strictEqual(entry.action, 'test_action');
  assert.ok(entry.hash);
  assert.ok(entry.ts);
  assert.strictEqual(entry.seq, 0);
});

test('AuditTrail hash chain is valid', () => {
  const trail = new AuditTrail();
  trail.append('action1', { a: 1 });
  trail.append('action2', { b: 2 });
  trail.append('action3', { c: 3 });
  const { valid } = trail.verify();
  assert.ok(valid);
});

test('AuditTrail verify detects tampering', () => {
  const trail = new AuditTrail();
  trail.append('action1', {});
  trail.append('action2', {});
  // Tamper: replace the frozen entry with a mutable copy that has changed action
  const original = trail._entries[0];
  trail._entries[0] = { ...original, action: 'tampered_action' };
  const { valid } = trail.verify();
  assert.ok(!valid);
});

test('AuditTrail getEntryCount', () => {
  const trail = new AuditTrail();
  trail.append('a', {});
  trail.append('b', {});
  assert.strictEqual(trail.getEntryCount(), 2);
});

test('AuditTrail query by action', () => {
  const trail = new AuditTrail();
  trail.append('login', { userId: 'u1' });
  trail.append('logout', { userId: 'u1' });
  trail.append('login', { userId: 'u2' });
  const logins = trail.query({ action: 'login' });
  assert.strictEqual(logins.length, 2);
});

test('AuditTrail entries are frozen', () => {
  const trail = new AuditTrail();
  const entry = trail.append('test', {});
  let threw = false;
  try {
    entry.action = 'modified'; // should throw in strict mode
  } catch (e) { threw = true; }
  // Either it threw or silently failed - in strict mode it throws
  assert.ok(threw || entry.action === 'test'); // at minimum, not modified
});

test('AuditTrail redacts secrets from log entries', () => {
  const trail = new AuditTrail();
  trail.append('store_key', { key: 'AKIAIOSFODNN7EXAMPLEABCDEF1234567890XYZ' });
  const entries = trail.query({ action: 'store_key' });
  assert.ok(!JSON.stringify(entries).includes('AKIAIOSFODNN7EXAMPLE'));
});

// SanitizationPipeline
test('SanitizationPipeline passes clean input', () => {
  const pipeline = new SanitizationPipeline();
  const result   = pipeline.run('The weather is nice today.');
  assert.ok(result.ok);
  assert.ok(!result.blocked);
  assert.ok(result.output);
});

test('SanitizationPipeline blocks SQL injection', () => {
  const pipeline = new SanitizationPipeline({ strict: true });
  const result   = pipeline.run("'; DROP TABLE users; --");
  assert.ok(!result.ok);
  assert.ok(result.blocked);
});

test('SanitizationPipeline blocks XSS', () => {
  const pipeline = new SanitizationPipeline({ strict: true });
  const result   = pipeline.run('<script>alert("xss")</script>');
  assert.ok(!result.ok || result.issues.some(i => i.issue === 'xss'));
});

test('SanitizationPipeline blocks AWS key', () => {
  const pipeline = new SanitizationPipeline({ strict: true });
  const result   = pipeline.run('My key is AKIAIOSFODNN7EXAMPLE please use it');
  assert.ok(!result.ok || result.issues.length > 0);
});

test('SanitizationPipeline validates schema', () => {
  const pipeline = new SanitizationPipeline();
  const result   = pipeline.run(42, { schema: { type: 'string' } });
  assert.ok(result.issues.some(i => i.stage === 'validate'));
});

test('SanitizationPipeline checks code governance', () => {
  const pipeline = new SanitizationPipeline({ strict: false }); // non-strict to get output
  const result   = pipeline.run('eval("dangerous code")', { isCode: true });
  assert.ok(result.issues.some(i => i.stage === 'code_govern'));
});

test('SanitizationPipeline getAuditTrail', () => {
  const pipeline = new SanitizationPipeline();
  pipeline.run('test input');
  const trail = pipeline.getAuditTrail();
  assert.ok(trail.getEntryCount() > 0);
});

test('SanitizationPipeline auditEntry returned in result', () => {
  const pipeline = new SanitizationPipeline();
  const result   = pipeline.run('hello');
  assert.ok(result.auditEntry);
  assert.ok(result.auditEntry.hash);
});

test('SanitizationPipeline strips PII from output', () => {
  const pipeline = new SanitizationPipeline({ strict: false });
  const result   = pipeline.run('Contact user@example.com or call 555-867-5309');
  assert.ok(result.output && !result.output.includes('user@example.com'));
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
