#!/usr/bin/env node
/*
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Project Sites CLI ══════════════════════════════════════════════
 *
 * Runs the full site projection pipeline:
 *   site-registry.json → site-projection-renderer → services/heady-web/sites/
 *
 * Usage:
 *   node scripts/project-sites.js            # Project all sites
 *   node scripts/project-sites.js --verbose  # With detailed output
 *
 * Source of truth: src/sites/site-registry.json (latent space)
 * Output: services/heady-web/sites/{slug}/index.html (dev projections)
 */

'use strict';

const path = require('path');
const renderer = require(path.join(__dirname, '../src/projection/site-projection-renderer'));

const verbose = process.argv.includes('--verbose');

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  HeadySystems Site Projection Engine                        ║');
console.log('║  Source: site-registry.json (latent space)                  ║');
console.log('║  Target: services/heady-web/sites/ (dev projections)       ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

try {
    const { projected, errors } = renderer.projectToDevFolder();

    console.log(`✅ Projected ${projected.length} sites:\n`);
    projected.forEach((p, i) => console.log(`   ${i + 1}. ${p}`));

    if (errors.length > 0) {
        console.log(`\n⚠️  ${errors.length} errors:\n`);
        errors.forEach(e => console.log(`   ✗ ${e}`));
    }

    if (verbose) {
        const allSites = renderer.renderAllSites();
        console.log('\n── Detailed Report ──\n');
        for (const [domain, data] of Object.entries(allSites)) {
            if (data.html) {
                const lines = data.html.split('\n').length;
                console.log(`  ${domain}`);
                console.log(`    slug: ${data.slug}`);
                console.log(`    bytes: ${data.bytes}`);
                console.log(`    lines: ${lines}`);
                console.log(`    sacredGeometry: ${data.sacredGeometry}`);
                console.log(`    accent: ${data.accent}`);
                console.log('');
            }
        }
    }

    console.log(`\n🎯 All sites are now synced as dev projections.`);
    console.log(`   Source of truth: src/sites/site-registry.json`);
    console.log(`   Edit the registry, not the HTML files.\n`);

    process.exit(errors.length > 0 ? 1 : 0);
} catch (e) {
    console.error(`\n❌ Projection failed: ${e.message}\n`);
    if (verbose) console.error(e.stack);
    process.exit(1);
}
