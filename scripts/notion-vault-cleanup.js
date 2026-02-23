#!/usr/bin/env node
/**
 * Notion Vault Cleanup — Archive Non-Heady Pages
 * 
 * Scans the entire Notion workspace and archives any page/database
 * that is NOT part of the Heady Knowledge Vault hierarchy.
 * 
 * Archiving is REVERSIBLE — pages go to Notion Trash (30-day recovery).
 * 
 * Usage: node scripts/notion-vault-cleanup.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const https = require("https");
const fs = require("fs");
const path = require("path");

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_VERSION = "2022-06-28";
const LOG_PATH = path.join(__dirname, "..", "data", "notion-cleanup-log.json");

// Known Heady Knowledge Vault page IDs (from sync state)
const VAULT_ROOT_ID = "30ede7a6-5427-8122-8719-e79b4945e897";
const HEADY_PAGE_IDS = new Set();

// Load all known Heady page IDs from sync state
try {
    const state = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "notion-sync-state.json"), "utf8"));
    for (const id of Object.values(state.pages || {})) {
        HEADY_PAGE_IDS.add(id.replace(/-/g, ""));
    }
} catch { /* state may not exist */ }

function notionRequest(method, endpoint, body) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const options = {
            hostname: "api.notion.com",
            path: `/v1${endpoint}`,
            method,
            headers: {
                "Authorization": `Bearer ${NOTION_TOKEN}`,
                "Notion-Version": NOTION_VERSION,
                "Content-Type": "application/json",
                ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
            },
            timeout: 30000,
        };
        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (c) => (data += c));
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) reject(new Error(`Notion ${res.statusCode}: ${parsed.message || data.substring(0, 200)}`));
                    else resolve(parsed);
                } catch { reject(new Error(`Parse error: ${data.substring(0, 200)}`)); }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
        if (payload) req.write(payload);
        req.end();
    });
}

function isHeadyPage(page) {
    const id = page.id.replace(/-/g, "");
    // Direct match
    if (HEADY_PAGE_IDS.has(id)) return true;
    // Child of vault root
    const parentId = (page.parent?.page_id || "").replace(/-/g, "");
    if (HEADY_PAGE_IDS.has(parentId)) return true;
    // Check title for Heady keywords
    const title = page.properties?.title?.title?.[0]?.plain_text || "";
    if (/heady|knowledge vault/i.test(title)) return true;
    return false;
}

async function searchAll(objectType) {
    const results = [];
    let cursor = undefined;
    let page = 0;
    while (true) {
        page++;
        const body = {
            page_size: 100,
            filter: { property: "object", value: objectType },
        };
        if (cursor) body.start_cursor = cursor;
        const resp = await notionRequest("POST", "/search", body);
        results.push(...(resp.results || []));
        if (!resp.has_more || !resp.next_cursor) break;
        cursor = resp.next_cursor;
        if (page > 10) break; // safety cap
    }
    return results;
}

async function archivePage(pageId) {
    return notionRequest("PATCH", `/pages/${pageId}`, { archived: true });
}

async function archiveBlock(blockId) {
    // For databases that are block children
    return notionRequest("DELETE", `/blocks/${blockId}`);
}

(async () => {
    if (!NOTION_TOKEN) {
        console.error("❌ NOTION_TOKEN not set");
        process.exit(1);
    }

    console.log("🧹 Notion Vault Cleanup — Scanning workspace...\n");

    // Fetch all pages
    const allPages = await searchAll("page");
    console.log(`Found ${allPages.length} pages total\n`);

    const toArchive = [];
    const kept = [];

    for (const p of allPages) {
        const title = p.properties?.title?.title?.[0]?.plain_text || "(untitled)";
        const icon = p.icon?.emoji || "";

        if (p.archived) continue; // already archived

        if (isHeadyPage(p)) {
            kept.push({ id: p.id, title: `${icon} ${title}`, reason: "Heady page" });
        } else {
            toArchive.push({ id: p.id, title: `${icon} ${title}`, parent: p.parent?.type || "unknown" });
        }
    }

    // Also check databases
    const allDbs = await searchAll("database");
    console.log(`Found ${allDbs.length} databases total\n`);

    for (const db of allDbs) {
        if (db.archived) continue;
        const title = db.title?.[0]?.plain_text || "(untitled db)";
        const parentId = (db.parent?.page_id || "").replace(/-/g, "");
        if (HEADY_PAGE_IDS.has(parentId)) {
            kept.push({ id: db.id, title, reason: "Heady database" });
        } else {
            toArchive.push({ id: db.id, title, parent: db.parent?.type || "unknown", isDb: true });
        }
    }

    console.log(`\n📋 Summary:`);
    console.log(`   Keep: ${kept.length} Heady pages/databases`);
    console.log(`   Archive: ${toArchive.length} non-Heady items\n`);

    console.log("─── KEEPING ───");
    for (const k of kept) console.log(`  ✅ ${k.title}`);

    console.log("\n─── ARCHIVING ───");
    const archived = [];
    const errors = [];

    for (const item of toArchive) {
        try {
            console.log(`  🗑️  Archiving: ${item.title} (${item.id.substring(0, 8)})`);
            await archivePage(item.id);
            archived.push(item);
            // Rate limit: 300ms between requests
            await new Promise(r => setTimeout(r, 300));
        } catch (err) {
            console.log(`  ⚠️  Failed: ${item.title} — ${err.message}`);
            errors.push({ ...item, error: err.message });
        }
    }

    // Save cleanup log
    const log = {
        ts: new Date().toISOString(),
        totalScanned: allPages.length + allDbs.length,
        kept: kept.length,
        archived: archived.length,
        errors: errors.length,
        archivedItems: archived,
        errorItems: errors,
        keptItems: kept,
    };

    const dataDir = path.dirname(LOG_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));

    console.log(`\n✅ Cleanup complete!`);
    console.log(`   Archived: ${archived.length} items`);
    console.log(`   Errors: ${errors.length}`);
    console.log(`   Log saved to: ${LOG_PATH}`);
})();
