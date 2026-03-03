#!/usr/bin/env node
/**
 * Google Takeout Processor for Gemini Conversations
 *
 * Processes exported Gemini conversations from Google Takeout and converts
 * them to structured markdown files in docs/research/inbox/ for auto-ingest.
 *
 * USAGE:
 *   1. Go to https://takeout.google.com
 *   2. Select "Gemini Apps" only
 *   3. Export and download the .zip
 *   4. Extract to any folder
 *   5. Run: node scripts/research-ingest/takeout-processor.js <path-to-extracted-folder>
 *
 * The processor will:
 *   - Find all conversation JSON/HTML files
 *   - Convert each to a properly formatted .md
 *   - Place them in docs/research/inbox/
 *   - The auto_research_ingest pipeline handler picks them up from there
 *
 * © HeadySystems Inc.
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const INBOX_DIR = path.join(REPO_ROOT, "docs/research/inbox");
const ARCHIVE_DIR = path.join(REPO_ROOT, "docs/research");

// Ensure inbox exists
fs.mkdirSync(INBOX_DIR, { recursive: true });

function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60);
}

/**
 * Process a single Takeout conversation file.
 * Supports both JSON (structured) and HTML (rendered) formats.
 */
function processFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath, ext);

    if (ext === ".json") {
        return processJSON(filePath, basename);
    } else if (ext === ".html") {
        return processHTML(filePath, basename);
    }
    return null;
}

function processJSON(filePath, basename) {
    const raw = fs.readFileSync(filePath, "utf8");
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        console.warn(`  ⚠️ Skipping invalid JSON: ${filePath}`);
        return null;
    }

    // Google Takeout Gemini format: array of conversations or single conversation
    const conversations = Array.isArray(data) ? data : [data];

    const results = [];
    for (const conv of conversations) {
        const title = conv.title || conv.name || basename;
        const turns = [];

        // Handle various Takeout JSON structures
        const messages =
            conv.messages || conv.turns || conv.content || conv.entries || [];

        for (const msg of messages) {
            const role = msg.role || msg.author || (msg.isUser ? "user" : "model");
            const text =
                msg.text ||
                msg.content ||
                msg.parts?.map((p) => p.text || "").join("\n") ||
                "";

            if (!text.trim()) continue;

            const label =
                role === "user" || role === "human" ? "## 🧑 You" : "## 🤖 Gemini";
            turns.push(`${label}\n\n${text.trim()}`);
        }

        if (turns.length === 0) continue;

        const markdown = buildMarkdown(title, turns, filePath);
        const outName = `gemini-takeout-${slugify(title)}.md`;
        results.push({ filename: outName, content: markdown, turns: turns.length });
    }

    return results;
}

function processHTML(filePath, basename) {
    const html = fs.readFileSync(filePath, "utf8");

    // Basic HTML → text extraction (no dependency needed)
    const title =
        html.match(/<title>(.*?)<\/title>/i)?.[1] || basename;

    // Extract text blocks, strip tags
    const textContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    const markdown = buildMarkdown(title, [`## 📄 Full Export\n\n${textContent}`], filePath);
    const outName = `gemini-takeout-${slugify(title)}.md`;
    return [{ filename: outName, content: markdown, turns: 1 }];
}

function buildMarkdown(title, turns, sourceFile) {
    const header = [
        `# ${title}`,
        "",
        "> [!CAUTION]",
        "> This document was auto-imported from a Google Takeout Gemini export.",
        "> Content may describe external entities not affiliated with HeadySystems Inc.",
        "> Review before integrating into project documentation.",
        "",
        `> **Source:** Google Takeout (${path.basename(sourceFile)})`,
        `> **Processed:** ${new Date().toISOString()}`,
        `> **Turns:** ${turns.length}`,
        "",
        "---",
        "",
    ].join("\n");

    return header + turns.join("\n\n---\n\n");
}

/**
 * Recursively find all processable files in a directory.
 */
function findFiles(dir) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findFiles(full));
        } else if (/\.(json|html)$/i.test(entry.name)) {
            results.push(full);
        }
    }
    return results;
}

// ─── Main ────────────────────────────────────────────────────────────
function main() {
    const inputDir = process.argv[2];
    if (!inputDir) {
        console.error("Usage: node takeout-processor.js <path-to-takeout-folder>");
        console.error("");
        console.error("Steps:");
        console.error("  1. Go to https://takeout.google.com");
        console.error('  2. Select "Gemini Apps" and export');
        console.error("  3. Extract the downloaded .zip");
        console.error("  4. Run this script with the extracted folder path");
        process.exit(1);
    }

    const resolved = path.resolve(inputDir);
    if (!fs.existsSync(resolved)) {
        console.error(`❌ Path not found: ${resolved}`);
        process.exit(1);
    }

    console.log(`📂 Scanning: ${resolved}`);
    const files = findFiles(resolved);
    console.log(`📄 Found ${files.length} processable files\n`);

    let total = 0;
    for (const file of files) {
        console.log(`  Processing: ${path.relative(resolved, file)}`);
        const results = processFile(file);
        if (!results) continue;

        for (const { filename, content, turns } of results) {
            const outPath = path.join(INBOX_DIR, filename);
            fs.writeFileSync(outPath, content, "utf8");
            console.log(`    ✅ → ${filename} (${turns} turns)`);
            total++;
        }
    }

    console.log(`\n🎉 Processed ${total} conversations → ${INBOX_DIR}`);
    console.log("Run the auto_research_ingest pipeline task to classify and archive them.");
}

main();
