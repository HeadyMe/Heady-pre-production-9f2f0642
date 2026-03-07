const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger').child({ component: 'test-generator' });

class TestGenerator {
    constructor() {
        this.outputDir = path.join(process.cwd(), 'tests', 'auto-generated');
        this.templates = this.loadTemplates();
    }

    loadTemplates() {
        return {
            describe: (name) => `describe('${name}', () => {`,
            it: (description, body) => `  it('${description}', ${body});`,
            expect: (actual, matcher, expected) => `expect(${actual}).${matcher}(${expected});`
        };
    }

    async scanAndGenerate(srcDir = 'src') {
        const files = this.findJsFiles(srcDir);
        const report = { total: 0, generated: 0, skipped: 0 };

        for (const file of files) {
            const testPath = this.getTestPath(file);

            if (fs.existsSync(testPath)) {
                report.skipped++;
                logger.info('Test already exists, skipping', { file });
                continue;
            }

            const testCode = await this.generateTest(file);
            this.writeTest(testPath, testCode);
            report.generated++;
            report.total++;
        }

        return report;
    }

    findJsFiles(dir, files = []) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.includes('node_modules')) {
                this.findJsFiles(fullPath, files);
            } else if (entry.isFile() && entry.name.endsWith('.js')) {
                files.push(fullPath);
            }
        }
        return files;
    }

    async generateTest(file Path) {
        const source = fs.readFileSync(filePath, 'utf-8');
        const moduleName = path.basename(filePath, '.js');
        const exports = this.extractExports(source);

        let testCode = `/**\n * Auto-generated tests for ${moduleName}\n */\n\n`;
        testCode += `const ${moduleName} = require('${this.getRelativePath(filePath)}');\n\n`;
        testCode += `describe('${moduleName}', () => {\n`;

        // Generate tests for each export
        for (const exp of exports) {
            if (exp.type === 'function') {
                testCode += this.generateFunctionTests(exp.name);
            } else if (exp.type === 'class') {
                testCode += this.generateClassTests(exp.name);
            }
        }

        testCode += `});\n`;
        return testCode;
    }

    extractExports(source) {
        const exports = [];

        // Simple regex-based extraction (could use AST for precision)
        const moduleExports = source.match(/module\.exports\s*=\s*(\w+)/);
        if (moduleExports) {
            exports.push({ type: 'default', name: moduleExports[1] });
        }

        const namedExports = source.matchAll(/module\.exports\.(\w+)\s*=/g);
        for (const match of namedExports) {
            exports.push({ type: 'named', name: match[1] });
        }

        return exports;
    }

    generateFunctionTests(name) {
        return `
  describe('${name}', () => {
    it('should execute without errors', () => {
      expect(typeof ${name}).toBe('function');
    });

    it('should handle null input', () => {
      expect(() => ${name}(null)).not.toThrow();
    });

    it('should handle undefined input', () => {
      expect(() => ${name}(undefined)).not.toThrow();
    });
  });
`;
    }

    generateClassTests(name) {
        return `
  describe('${name}', () => {
    it('should be constructable', () => {
      const instance = new ${name}();
      expect(instance).toBeInstanceOf(${name});
    });

    it('should have expected methods', () => {
      const instance = new ${name}();
      expect(typeof instance).toBe('object');
    });
  });
`;
    }

    getTestPath(srcPath) {
        const rel = path.relative('src', srcPath);
        return path.join(this.outputDir, rel.replace('.js', '.test.js'));
    }

    getRelativePath(filePath) {
        return path.relative(this.outputDir, filePath).replace(/\\/g, '/');
    }

    writeTest(testPath, code) {
        const dir = path.dirname(testPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(testPath, code);
        logger.info('Generated test', { path: testPath });
    }
}

module.exports = TestGenerator;
