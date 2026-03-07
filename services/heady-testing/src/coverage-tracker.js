const fs = require('fs');
const path = require('path');
const CSL = require('../core/semantic-logic');

class CoverageTracker {
    constructor() {
        this.srcDir = 'src';
        this.testDir = 'tests';
    }

    async scan() {
        const srcFiles = this.findFiles(this.srcDir, '.js');
        const testFiles = this.findFiles(this.testDir, '.test.js');

        const coverage = {
            total: srcFiles.length,
            full: 0,
            partial: 0,
            none: 0,
            auto: 0,
            files: []
        };

        for (const srcFile of srcFiles) {
            const testFile = this.getTestPath(srcFile);
            const hasTest = testFiles.includes(testFile);
            const isAuto = testFile.includes('auto-generated');

            let status = 'NONE';
            if (hasTest) {
                status = isAuto ? 'AUTO' : 'PARTIAL';
            }

            coverage.files.push({
                file: srcFile,
                testFile: hasTest ? testFile : null,
                status
            });

            coverage[status.toLowerCase()]++;
        }

        return coverage;
    }

    findFiles(dir, ext, files = []) {
        if (!fs.existsSync(dir)) return files;

        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.includes('node_modules')) {
                this.findFiles(fullPath, ext, files);
            } else if (entry.isFile() && entry.name.endsWith(ext)) {
                files.push(fullPath);
            }
        }
        return files;
    }

    getTestPath(srcPath) {
        const rel = path.relative(this.srcDir, srcPath);
        return path.join(this.testDir, rel.replace('.js', '.test.js'));
    }

    generateReport(coverage) {
        const html = `<!DOCTYPE html>
<html>
<head><title>Test Coverage Report</title></head>
<body>
<h1>Heady Test Coverage</h1>
<p>Total: ${coverage.total} | Full: ${coverage.full} | Partial: ${coverage.partial} | None: ${coverage.none} | Auto: ${coverage.auto}</p>
<table border="1">
<tr><th>File</th><th>Test</th><th>Status</th></tr>
${coverage.files.map(f => `<tr><td>${f.file}</td><td>${f.testFile || 'N/A'}</td><td>${f.status}</td></tr>`).join('\n')}
</table>
</body>
</html>`;

        fs.writeFileSync('reports/test-coverage.html', html);
        fs.writeFileSync('reports/test-coverage.json', JSON.stringify(coverage, null, 2));
    }
}

module.exports = CoverageTracker;
