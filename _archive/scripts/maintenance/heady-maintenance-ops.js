#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const POLICY_PATH = path.join(ROOT, 'configs', 'services', 'maintenance-policy.json');

function readPolicy(filePath = POLICY_PATH) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listTrackedFiles() {
    const output = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' });
    return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

function listUntrackedFiles() {
    const output = execSync('git ls-files --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' });
    return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

function buildRegexps(patterns = []) {
    return patterns.map((pattern) => new RegExp(pattern, 'i'));
}

function findRuntimeFileViolations(files, runtimePatterns) {
    return files.filter((file) => runtimePatterns.some((pattern) => pattern.test(file)));
}

function findForbiddenContentReferences(files, contentPatterns) {
    const suspect = [];
    for (const file of files) {
        if (!/\.(js|ts|jsx|tsx|json|yaml|yml|html|py|md|toml|env)$/.test(file)) continue;
        const fullPath = path.join(ROOT, file);
        let content = '';
        try {
            content = fs.readFileSync(fullPath, 'utf8');
        } catch {
            continue;
        }

        const matchedPatterns = contentPatterns.filter((pattern) => pattern.test(content)).map((pattern) => pattern.source);
        if (matchedPatterns.length > 0) {
            suspect.push({ file, matchedPatterns });
        }
    }
    return suspect;
}

function deletePrefix(prefix) {
    const fullPrefixPath = path.join(ROOT, prefix);
    if (!fs.existsSync(fullPrefixPath)) return [];

    const removed = [];
    for (const entry of fs.readdirSync(fullPrefixPath)) {
        const target = path.join(fullPrefixPath, entry);
        fs.rmSync(target, { recursive: true, force: true });
        removed.push(path.join(prefix, entry));
    }
    return removed;
}

function applyOptionalCleanup(policy, trackedFiles) {
    const removed = [];

    for (const relativePath of policy.optionalCleanupFiles || []) {
        const fullPath = path.join(ROOT, relativePath);
        if (fs.existsSync(fullPath)) {
            fs.rmSync(fullPath, { force: true });
            removed.push(relativePath);
        }
    }

    for (const prefix of policy.optionalCleanupPrefixes || []) {
        const prefixMatches = trackedFiles.filter((file) => file.startsWith(prefix));
        if (prefixMatches.length > 0) {
            removed.push(...deletePrefix(prefix));
        }
    }

    return removed;
}

function runMaintenance({ apply = false } = {}) {
    const policy = readPolicy();
    const runtimePatterns = buildRegexps(policy.forbiddenRuntimePatterns);
    const contentPatterns = buildRegexps(policy.forbiddenContentPatterns);

    const tracked = listTrackedFiles();
    const untracked = listUntrackedFiles();
    const runtimeTracked = findRuntimeFileViolations(tracked, runtimePatterns);
    const runtimeUntracked = findRuntimeFileViolations(untracked, runtimePatterns);
    const suspectDefinitions = findForbiddenContentReferences(tracked, contentPatterns);

    const report = {
        checkedAt: new Date().toISOString(),
        policyVersion: policy.version,
        runtimeTrackedCount: runtimeTracked.length,
        runtimeTracked,
        runtimeUntrackedCount: runtimeUntracked.length,
        runtimeUntracked,
        suspectDefinitionCount: suspectDefinitions.length,
        suspectDefinitions,
        removedOptionalFiles: [],
    };

    if (apply) {
        report.removedOptionalFiles = applyOptionalCleanup(policy, tracked);
    }

    return report;
}

function main() {
    const apply = process.argv.includes('--apply');
    const report = runMaintenance({ apply });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) {
    main();
}

module.exports = {
    readPolicy,
    runMaintenance,
    findRuntimeFileViolations,
    findForbiddenContentReferences,
};
