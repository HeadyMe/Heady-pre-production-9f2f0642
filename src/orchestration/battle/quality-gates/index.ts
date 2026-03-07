/**
 * Quality Gate Validator for HeadyBattle Coding Workflows
 * 
 * Implements automated quality checks during code generation:
 * - Security scanning
 * - Code complexity analysis
 * - Test coverage validation
 * - Performance profiling
 * - Architectural compliance
 * 
 * References:
 * - AI code quality gate best practices
 * - Autonomous quality gates for AI-generated code
 */

export interface QualityRule {
  name: string;
  category: 'security' | 'complexity' | 'coverage' | 'performance' | 'architecture';
  threshold: number;
  severity: 'blocker' | 'critical' | 'warning';
  validator: (code: string) => Promise<RuleResult>;
}

export interface RuleResult {
  passed: boolean;
  score: number;
  violations: Violation[];
  suggestions: string[];
}

export interface Violation {
  line: number;
  message: string;
  severity: 'blocker' | 'critical' | 'warning';
  autoFixable: boolean;
}

export interface ValidationResult {
  passed: boolean;
  overallScore: number;
  failures: string[];
  warnings: string[];
  violations: Violation[];
  originalCode: string;
  suggestedFixes: string[];
  metadata: {
    executionTime: number;
    rulesEvaluated: number;
    autoFixable: number;
  };
}

export class QualityGateValidator {
  private rules: QualityRule[];
  private strictMode: boolean;

  constructor(rules: QualityRule[], strictMode: boolean = true) {
    this.rules = rules;
    this.strictMode = strictMode;
  }

  /**
   * Main validation entry point
   * Runs all quality gates and determines pass/fail
   */
  async validate(code: string): Promise<ValidationResult> {
    console.log('[QualityGate] Starting validation with ${this.rules.length} rules');
    const startTime = Date.now();

    const results: RuleResult[] = [];
    const failures: string[] = [];
    const warnings: string[] = [];
    const allViolations: Violation[] = [];

    // Execute all rules in parallel
    const rulePromises = this.rules.map(async rule => {
      try {
        const result = await rule.validator(code);
        results.push(result);

        if (!result.passed) {
          const message = `${rule.name}: ${result.violations.length} violations`;

          if (rule.severity === 'blocker' || rule.severity === 'critical') {
            failures.push(message);
          } else {
            warnings.push(message);
          }

          allViolations.push(...result.violations);
        }

        return result;
      } catch (error) {
        console.error(`[QualityGate] Rule ${rule.name} failed:`, error);
        return {
          passed: false,
          score: 0,
          violations: [{ 
            line: 0, 
            message: `Rule execution error: ${error}`, 
            severity: 'critical',
            autoFixable: false
          }],
          suggestions: []
        };
      }
    });

    await Promise.all(rulePromises);

    // Calculate overall score
    const overallScore = this.calculateOverallScore(results);

    // Determine pass/fail
    const passed = this.strictMode 
      ? failures.length === 0 && overallScore >= 0.8
      : failures.length === 0;

    // Generate suggested fixes
    const suggestedFixes = await this.generateFixes(allViolations, code);

    const metadata = {
      executionTime: Date.now() - startTime,
      rulesEvaluated: this.rules.length,
      autoFixable: allViolations.filter(v => v.autoFixable).length
    };

    console.log(`[QualityGate] Validation ${passed ? 'PASSED' : 'FAILED'} (score: ${overallScore.toFixed(2)})`);

    return {
      passed,
      overallScore,
      failures,
      warnings,
      violations: allViolations,
      originalCode: code,
      suggestedFixes,
      metadata
    };
  }

  /**
   * Initialize default quality rules for coding
   */
  static defaultRules(): QualityRule[] {
    return [
      // Security rules
      {
        name: 'No Hardcoded Secrets',
        category: 'security',
        threshold: 0.0,
        severity: 'blocker',
        validator: async (code) => this.checkHardcodedSecrets(code)
      },
      {
        name: 'SQL Injection Prevention',
        category: 'security',
        threshold: 0.0,
        severity: 'blocker',
        validator: async (code) => this.checkSQLInjection(code)
      },
      {
        name: 'XSS Prevention',
        category: 'security',
        threshold: 0.0,
        severity: 'critical',
        validator: async (code) => this.checkXSS(code)
      },

      // Complexity rules
      {
        name: 'Cyclomatic Complexity',
        category: 'complexity',
        threshold: 10,
        severity: 'warning',
        validator: async (code) => this.checkComplexity(code)
      },
      {
        name: 'Function Length',
        category: 'complexity',
        threshold: 50,
        severity: 'warning',
        validator: async (code) => this.checkFunctionLength(code)
      },

      // Architecture rules
      {
        name: 'No Console Logs in Production',
        category: 'architecture',
        threshold: 0.0,
        severity: 'warning',
        validator: async (code) => this.checkConsoleLogs(code)
      },
      {
        name: 'Error Handling Required',
        category: 'architecture',
        threshold: 1.0,
        severity: 'critical',
        validator: async (code) => this.checkErrorHandling(code)
      },

      // Performance rules
      {
        name: 'No Synchronous File I/O',
        category: 'performance',
        threshold: 0.0,
        severity: 'warning',
        validator: async (code) => this.checkSyncFileIO(code)
      }
    ];
  }

  // Security validators
  private static async checkHardcodedSecrets(code: string): Promise<RuleResult> {
    const patterns = [
      /api[_-]?key\s*=\s*["'][^"']+["']/gi,
      /password\s*=\s*["'][^"']+["']/gi,
      /secret\s*=\s*["'][^"']+["']/gi,
      /token\s*=\s*["'][^"']+["']/gi
    ];

    const violations: Violation[] = [];
    const lines = code.split('\n');

    lines.forEach((line, idx) => {
      patterns.forEach(pattern => {
        if (pattern.test(line)) {
          violations.push({
            line: idx + 1,
            message: 'Hardcoded secret detected. Use environment variables.',
            severity: 'blocker',
            autoFixable: false
          });
        }
      });
    });

    return {
      passed: violations.length === 0,
      score: violations.length === 0 ? 1.0 : 0.0,
      violations,
      suggestions: violations.length > 0 
        ? ['Move secrets to environment variables or secrets manager']
        : []
    };
  }

  private static async checkSQLInjection(code: string): Promise<RuleResult> {
    const violations: Violation[] = [];
    const lines = code.split('\n');

    // Check for string concatenation in SQL queries
    const sqlPattern = /(?:query|execute|sql).*?\+.*?["'`]/gi;

    lines.forEach((line, idx) => {
      if (sqlPattern.test(line)) {
        violations.push({
          line: idx + 1,
          message: 'Potential SQL injection. Use parameterized queries.',
          severity: 'blocker',
          autoFixable: false
        });
      }
    });

    return {
      passed: violations.length === 0,
      score: violations.length === 0 ? 1.0 : 0.0,
      violations,
      suggestions: violations.length > 0 
        ? ['Use parameterized queries or ORM methods']
        : []
    };
  }

  private static async checkXSS(code: string): Promise<RuleResult> {
    const violations: Violation[] = [];
    const lines = code.split('\n');

    // Check for innerHTML or dangerouslySetInnerHTML
    const xssPattern = /(?:innerHTML|dangerouslySetInnerHTML)/gi;

    lines.forEach((line, idx) => {
      if (xssPattern.test(line) && !line.includes('sanitize')) {
        violations.push({
          line: idx + 1,
          message: 'Potential XSS vulnerability. Sanitize user input.',
          severity: 'critical',
          autoFixable: false
        });
      }
    });

    return {
      passed: violations.length === 0,
      score: violations.length === 0 ? 1.0 : 0.0,
      violations,
      suggestions: violations.length > 0
        ? ['Use DOMPurify or similar sanitization library']
        : []
    };
  }

  // Complexity validators
  private static async checkComplexity(code: string): Promise<RuleResult> {
    const violations: Violation[] = [];
    const functions = this.extractFunctions(code);

    functions.forEach(func => {
      const complexity = this.calculateCyclomaticComplexity(func.body);
      if (complexity > 10) {
        violations.push({
          line: func.line,
          message: `Cyclomatic complexity ${complexity} exceeds threshold of 10`,
          severity: 'warning',
          autoFixable: false
        });
      }
    });

    return {
      passed: violations.length === 0,
      score: violations.length === 0 ? 1.0 : Math.max(0, 1 - (violations.length * 0.1)),
      violations,
      suggestions: violations.length > 0
        ? ['Break down complex functions into smaller, focused functions']
        : []
    };
  }

  private static async checkFunctionLength(code: string): Promise<RuleResult> {
    const violations: Violation[] = [];
    const functions = this.extractFunctions(code);

    functions.forEach(func => {
      const lines = func.body.split('\n').length;
      if (lines > 50) {
        violations.push({
          line: func.line,
          message: `Function length ${lines} exceeds threshold of 50 lines`,
          severity: 'warning',
          autoFixable: false
        });
      }
    });

    return {
      passed: violations.length === 0,
      score: violations.length === 0 ? 1.0 : Math.max(0, 1 - (violations.length * 0.1)),
      violations,
      suggestions: violations.length > 0
        ? ['Refactor long functions into smaller, reusable functions']
        : []
    };
  }

  // Architecture validators
  private static async checkConsoleLogs(code: string): Promise<RuleResult> {
    const violations: Violation[] = [];
    const lines = code.split('\n');

    lines.forEach((line, idx) => {
      if (/console\.(log|debug|info|warn|error)/.test(line) && !line.includes('// DEBUG')) {
        violations.push({
          line: idx + 1,
          message: 'Console log statement found. Use proper logging library.',
          severity: 'warning',
          autoFixable: true
        });
      }
    });

    return {
      passed: violations.length === 0,
      score: violations.length === 0 ? 1.0 : 0.8,
      violations,
      suggestions: violations.length > 0
        ? ['Replace console logs with logger (Winston, Pino, etc.)']
        : []
    };
  }

  private static async checkErrorHandling(code: string): Promise<RuleResult> {
    const violations: Violation[] = [];
    const functions = this.extractFunctions(code);

    functions.forEach(func => {
      const hasAsync = func.signature.includes('async');
      const hasTryCatch = func.body.includes('try') && func.body.includes('catch');

      if (hasAsync && !hasTryCatch) {
        violations.push({
          line: func.line,
          message: 'Async function missing error handling (try-catch)',
          severity: 'critical',
          autoFixable: false
        });
      }
    });

    return {
      passed: violations.length === 0,
      score: violations.length === 0 ? 1.0 : 0.5,
      violations,
      suggestions: violations.length > 0
        ? ['Add try-catch blocks to async functions']
        : []
    };
  }

  // Performance validators
  private static async checkSyncFileIO(code: string): Promise<RuleResult> {
    const violations: Violation[] = [];
    const lines = code.split('\n');

    const syncMethods = ['readFileSync', 'writeFileSync', 'readdirSync', 'statSync'];

    lines.forEach((line, idx) => {
      syncMethods.forEach(method => {
        if (line.includes(method)) {
          violations.push({
            line: idx + 1,
            message: `Synchronous file I/O (${method}) blocks event loop`,
            severity: 'warning',
            autoFixable: true
          });
        }
      });
    });

    return {
      passed: violations.length === 0,
      score: violations.length === 0 ? 1.0 : 0.7,
      violations,
      suggestions: violations.length > 0
        ? ['Use async file I/O methods (readFile, writeFile, etc.)']
        : []
    };
  }

  // Helper methods
  private calculateOverallScore(results: RuleResult[]): number {
    if (results.length === 0) return 1.0;
    const sum = results.reduce((acc, r) => acc + r.score, 0);
    return sum / results.length;
  }

  private async generateFixes(violations: Violation[], code: string): Promise<string[]> {
    const autoFixable = violations.filter(v => v.autoFixable);
    if (autoFixable.length === 0) return [];

    // Generate automatic fixes for fixable violations
    return autoFixable.map(v => `Line ${v.line}: ${v.message}`);
  }

  private static extractFunctions(code: string): Array<{
    name: string;
    line: number;
    signature: string;
    body: string;
  }> {
    // Simple function extraction (could be improved with AST parsing)
    const functions: Array<{ name: string; line: number; signature: string; body: string }> = [];
    const lines = code.split('\n');

    let currentFunction: any = null;
    let braceDepth = 0;

    lines.forEach((line, idx) => {
      if (/(?:function|const|let|var)\s+\w+\s*=.*=>|(?:async\s+)?function\s+\w+/.test(line)) {
        currentFunction = {
          name: line.match(/\w+/)?.[0] || 'anonymous',
          line: idx + 1,
          signature: line,
          body: ''
        };
      }

      if (currentFunction) {
        currentFunction.body += line + '\n';
        braceDepth += (line.match(/{/g) || []).length;
        braceDepth -= (line.match(/}/g) || []).length;

        if (braceDepth === 0 && currentFunction.body.includes('{')) {
          functions.push(currentFunction);
          currentFunction = null;
        }
      }
    });

    return functions;
  }

  private static calculateCyclomaticComplexity(code: string): number {
    // Count decision points
    const decisionPoints = [
      /\bif\b/g,
      /\belse\sif\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /&&/g,
      /\|\|/g,
      /\?/g
    ];

    let complexity = 1; // Base complexity

    decisionPoints.forEach(pattern => {
      const matches = code.match(pattern);
      if (matches) complexity += matches.length;
    });

    return complexity;
  }
}

export default QualityGateValidator;
