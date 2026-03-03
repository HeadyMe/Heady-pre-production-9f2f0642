/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  PROPRIETARY AND CONFIDENTIAL — HEADYSYSTEMS INC.                  ║
 * ║  Copyright © 2024-2026 HeadySystems Inc. All Rights Reserved.      ║
 * ║                                                                     ║
 * ║  This file contains trade secrets of HeadySystems Inc.              ║
 * ║  Unauthorized copying, distribution, or use is strictly prohibited  ║
 * ║  and may result in civil and criminal penalties.                    ║
 * ║                                                                     ║
 * ║  Protected under the Defend Trade Secrets Act (18 U.S.C. § 1836)  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * @module heady/security/ip-classification
 * @description Intellectual Property classification and enforcement system
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── IP Classification Levels ─────────────────────────────────────────
const IP_LEVELS = {
    PUBLIC: {
        level: 0,
        label: 'PUBLIC',
        description: 'Open source, freely distributable',
        license: 'MIT OR Apache-2.0',
        canPublish: true,
        canOpenSource: true,
    },
    INTERNAL: {
        level: 1,
        label: 'INTERNAL',
        description: 'Internal use only — not for distribution',
        license: 'PROPRIETARY',
        canPublish: false,
        canOpenSource: false,
    },
    CONFIDENTIAL: {
        level: 2,
        label: 'CONFIDENTIAL',
        description: 'Trade secret — access restricted to authorized personnel',
        license: 'PROPRIETARY — DTSA Protected',
        canPublish: false,
        canOpenSource: false,
    },
    RESTRICTED: {
        level: 3,
        label: 'RESTRICTED',
        description: 'Critical IP — founder access only',
        license: 'PROPRIETARY — DTSA + Patent Pending',
        canPublish: false,
        canOpenSource: false,
    },
};

// ─── File Classification Registry ─────────────────────────────────────
const FILE_CLASSIFICATIONS = {
    // RESTRICTED — Core Inventions (Patent-pending)
    'src/heady-conductor.js': IP_LEVELS.RESTRICTED,
    'src/security/pqc.js': IP_LEVELS.RESTRICTED,
    'src/security/handshake.js': IP_LEVELS.RESTRICTED,
    'src/security/secret-rotation.js': IP_LEVELS.CONFIDENTIAL,
    'src/security/env-validator.js': IP_LEVELS.INTERNAL,

    // CONFIDENTIAL — Core Business Logic
    'src/security/ip-classification.js': IP_LEVELS.CONFIDENTIAL,

    // PUBLIC — SDK and tools
    'heady-hive-sdk/': IP_LEVELS.PUBLIC,
    'bin/': IP_LEVELS.PUBLIC,
    'dist/': IP_LEVELS.PUBLIC,
};

// ─── Pattern-based classification for directories ─────────────────────
const DIR_CLASSIFICATIONS = [
    { pattern: /^src\/gateway\//, level: IP_LEVELS.RESTRICTED },
    { pattern: /^src\/hcfp\//, level: IP_LEVELS.RESTRICTED },
    { pattern: /^src\/conductor\//, level: IP_LEVELS.RESTRICTED },
    { pattern: /^src\/battle\//, level: IP_LEVELS.CONFIDENTIAL },
    { pattern: /^src\/swarm\//, level: IP_LEVELS.CONFIDENTIAL },
    { pattern: /^src\/security\//, level: IP_LEVELS.CONFIDENTIAL },
    { pattern: /^src\//, level: IP_LEVELS.INTERNAL },
    { pattern: /^scripts\//, level: IP_LEVELS.INTERNAL },
    { pattern: /^docs\/internal\//, level: IP_LEVELS.CONFIDENTIAL },
    { pattern: /^infrastructure\//, level: IP_LEVELS.CONFIDENTIAL },
    { pattern: /^dist\//, level: IP_LEVELS.PUBLIC },
    { pattern: /^bin\//, level: IP_LEVELS.PUBLIC },
    { pattern: /^heady-hive-sdk\//, level: IP_LEVELS.PUBLIC },
    { pattern: /^public\//, level: IP_LEVELS.PUBLIC },
];

// ─── PROPRIETARY Header Template ──────────────────────────────────────
const PROPRIETARY_HEADER_JS = `/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  PROPRIETARY AND CONFIDENTIAL — HEADYSYSTEMS INC.                  ║
 * ║  Copyright © 2024-2026 HeadySystems Inc. All Rights Reserved.      ║
 * ║                                                                     ║
 * ║  This file contains trade secrets of HeadySystems Inc.              ║
 * ║  Unauthorized copying, distribution, or use is strictly prohibited  ║
 * ║  and may result in civil and criminal penalties.                    ║
 * ║                                                                     ║
 * ║  Protected under the Defend Trade Secrets Act (18 U.S.C. § 1836)  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */
`;

// ─── Classification Engine ────────────────────────────────────────────
class IPClassificationEngine {
    constructor(projectRoot) {
        this.projectRoot = projectRoot || process.cwd();
        this.scanResults = [];
    }

    /**
     * Classify a file by its path
     * @param {string} filePath - Relative path from project root
     * @returns {Object} Classification result
     */
    classifyFile(filePath) {
        const relative = path.relative(this.projectRoot, filePath).replace(/\\/g, '/');

        // Check exact matches first
        for (const [pattern, level] of Object.entries(FILE_CLASSIFICATIONS)) {
            if (relative === pattern || relative.startsWith(pattern)) {
                return { file: relative, ...level };
            }
        }

        // Check directory patterns
        for (const { pattern, level } of DIR_CLASSIFICATIONS) {
            if (pattern.test(relative)) {
                return { file: relative, ...level };
            }
        }

        // Default: INTERNAL
        return { file: relative, ...IP_LEVELS.INTERNAL };
    }

    /**
     * Scan project and classify all files
     * @returns {Object} Scan results grouped by classification level
     */
    scanProject() {
        const results = {
            RESTRICTED: [],
            CONFIDENTIAL: [],
            INTERNAL: [],
            PUBLIC: [],
            summary: {},
        };

        const walk = (dir) => {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.name === 'node_modules' || entry.name === '.git') continue;
                    const full = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        walk(full);
                    } else if (entry.isFile() && entry.name.endsWith('.js')) {
                        const classification = this.classifyFile(full);
                        results[classification.label].push(classification);
                    }
                }
            } catch { /* skip unreadable dirs */ }
        };

        walk(this.projectRoot);

        results.summary = {
            RESTRICTED: results.RESTRICTED.length,
            CONFIDENTIAL: results.CONFIDENTIAL.length,
            INTERNAL: results.INTERNAL.length,
            PUBLIC: results.PUBLIC.length,
            total: results.RESTRICTED.length + results.CONFIDENTIAL.length +
                results.INTERNAL.length + results.PUBLIC.length,
            scannedAt: new Date().toISOString(),
        };

        this.scanResults = results;
        return results;
    }

    /**
     * Add PROPRIETARY headers to classified files
     * @param {string} minLevel - Minimum level to add headers to ('INTERNAL', 'CONFIDENTIAL', 'RESTRICTED')
     * @returns {Object} { modified, skipped, errors }
     */
    addProprietaryHeaders(minLevel = 'CONFIDENTIAL') {
        const minLevelNum = IP_LEVELS[minLevel]?.level || 2;
        const report = { modified: [], skipped: [], errors: [] };

        if (!this.scanResults.summary) {
            this.scanProject();
        }

        const filesToProcess = [
            ...this.scanResults.RESTRICTED,
            ...this.scanResults.CONFIDENTIAL,
            ...(minLevelNum <= 1 ? this.scanResults.INTERNAL : []),
        ];

        for (const fileInfo of filesToProcess) {
            const fullPath = path.join(this.projectRoot, fileInfo.file);
            try {
                const content = fs.readFileSync(fullPath, 'utf8');

                // Skip if already has PROPRIETARY header
                if (content.includes('PROPRIETARY AND CONFIDENTIAL')) {
                    report.skipped.push(fileInfo.file);
                    continue;
                }

                // Add header
                const newContent = PROPRIETARY_HEADER_JS + '\n' + content;
                fs.writeFileSync(fullPath, newContent, 'utf8');
                report.modified.push(fileInfo.file);
            } catch (err) {
                report.errors.push({ file: fileInfo.file, error: err.message });
            }
        }

        return report;
    }

    /**
     * Verify no classified files leak into dist/npm
     * @returns {Object} { safe, violations }
     */
    auditPublishSafety() {
        const violations = [];

        // Check if .npmignore exists
        const npmignorePath = path.join(this.projectRoot, '.npmignore');
        if (!fs.existsSync(npmignorePath)) {
            violations.push({ severity: 'CRITICAL', issue: 'No .npmignore file — source code may be published!' });
        }

        // Check package.json "files" field
        const pkgPath = path.join(this.projectRoot, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            if (!pkg.files && !fs.existsSync(npmignorePath)) {
                violations.push({
                    severity: 'CRITICAL',
                    issue: 'No "files" in package.json and no .npmignore — entire repo may be published!',
                });
            }
        }

        return {
            safe: violations.length === 0,
            violations,
            checkedAt: new Date().toISOString(),
        };
    }
}

module.exports = {
    IPClassificationEngine,
    IP_LEVELS,
    FILE_CLASSIFICATIONS,
    DIR_CLASSIFICATIONS,
    PROPRIETARY_HEADER_JS,
};
