#!/usr/bin/env node
/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 *
 * Google Takeout Email → Heady Vector Space Processor
 *
 * Reads the mbox file, extracts email metadata + body content,
 * and stores embeddings in the 3D GPU vector space for deep-research.
 *
 * Usage:
 *   node process-google-takeout.js [path-to-mbox]
 *
 * Default path: data/google-takeout/all-mail.mbox
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');
const crypto = require('crypto');

const MBOX_PATH = process.argv[2] || path.join(__dirname, '..', 'data', 'google-takeout', 'all-mail.mbox');
const BATCH_SIZE = 100;
const MCP_URL = process.env.HEADY_MCP_URL || 'http://localhost:8420';

// ── Simple mbox stream parser ────────────────────────────────────
async function* parseMbox(filePath) {
    const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 64 * 1024 });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    let currentMessage = null;
    let lineCount = 0;
    let inHeaders = true;

    for await (const line of rl) {
        lineCount++;
        if (line.startsWith('From ') && (lineCount === 1 || !inHeaders)) {
            if (currentMessage) {
                yield currentMessage;
            }
            currentMessage = { headers: {}, body: '', rawHeaders: '' };
            inHeaders = true;
            continue;
        }

        if (!currentMessage) continue;

        if (inHeaders) {
            if (line.trim() === '') {
                inHeaders = false;
                continue;
            }
            // Parse header
            const match = line.match(/^([\w-]+):\s*(.*)/);
            if (match) {
                const key = match[1].toLowerCase();
                currentMessage.headers[key] = match[2];
            }
        } else {
            // Limit body to first 500 chars for embedding
            if (currentMessage.body.length < 500) {
                currentMessage.body += line + '\n';
            }
        }
    }

    if (currentMessage) yield currentMessage;
}

// ── Simple text → embedding (hash-based, no GPU needed for indexing) ─
function textToEmbedding(text, dimensions = 384) {
    const hash = crypto.createHash('sha512').update(text).digest();
    const embedding = new Float32Array(dimensions);
    for (let i = 0; i < dimensions; i++) {
        embedding[i] = (hash[i % hash.length] / 255.0) * 2 - 1;
    }
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    for (let i = 0; i < dimensions; i++) embedding[i] /= norm;
    return Array.from(embedding);
}

// ── Store email in vector space via MCP bridge ───────────────────
async function storeEmail(email, index) {
    const subject = email.headers.subject || '(no subject)';
    const from = email.headers.from || 'unknown';
    const date = email.headers.date || '';
    const searchText = `${subject} ${from} ${email.body.substring(0, 200)}`;

    const embedding = textToEmbedding(searchText);

    try {
        const res = await fetch(`${MCP_URL}/vector/store`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embedding,
                metadata: {
                    type: 'email',
                    subject: subject.substring(0, 200),
                    from: from.substring(0, 100),
                    date,
                    index,
                    bodyPreview: email.body.substring(0, 100),
                },
            }),
        });
        return await res.json();
    } catch (err) {
        return { error: err.message };
    }
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
    console.log(`\n  📧 Heady Google Takeout → Vector Space Processor`);
    console.log(`  ════════════════════════════════════════════════`);
    console.log(`  📁 Mbox: ${MBOX_PATH}`);
    console.log(`  📡 MCP:  ${MCP_URL}`);

    if (!fs.existsSync(MBOX_PATH)) {
        console.error(`  ❌ Mbox file not found: ${MBOX_PATH}`);
        process.exit(1);
    }

    const fileSize = fs.statSync(MBOX_PATH).size;
    console.log(`  📊 Size: ${(fileSize / 1024 / 1024).toFixed(1)}MB`);
    console.log(`  ════════════════════════════════════════════════\n`);

    let processed = 0;
    let stored = 0;
    let errors = 0;
    const startTime = Date.now();

    for await (const email of parseMbox(MBOX_PATH)) {
        processed++;
        const result = await storeEmail(email, processed);

        if (result.error) {
            errors++;
        } else {
            stored++;
        }

        if (processed % BATCH_SIZE === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const rate = (processed / elapsed * 1).toFixed(0);
            console.log(`  ⚡ ${processed} processed | ${stored} stored | ${errors} errors | ${rate}/s | ${elapsed}s`);
        }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n  ✅ Complete: ${processed} emails processed, ${stored} stored, ${errors} errors in ${elapsed}s`);

    // Get final vector stats
    try {
        const statsRes = await fetch(`${MCP_URL}/vector/stats`);
        const stats = await statsRes.json();
        console.log(`  🧠 Vector Space: ${stats.vectorCount} vectors, ${stats.memoryMB}MB, GPU=${stats.gpu}`);
    } catch { /* bridge might not be running */ }
}

main().catch(err => {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
});
