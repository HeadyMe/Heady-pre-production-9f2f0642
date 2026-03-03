#!/usr/bin/env node
/**
 * ═══ Heady Hive SDK — Deterministic Smoke Test ═══
 *
 * Verifies every layer of the SDK actually works.
 * Run: node heady-hive-sdk/test-sdk.js
 *
 * Exit code 0 = all pass, 1 = failures found.
 */

const path = require("path");

// Load .env BEFORE importing SDK
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

let pass = 0;
let fail = 0;

function test(name, fn) {
    try {
        const result = fn();
        if (result instanceof Promise) {
            return result
                .then(() => { pass++; console.log(`  ✅ ${name}`); })
                .catch(e => { fail++; console.log(`  ❌ ${name}: ${e.message}`); });
        }
        pass++;
        console.log(`  ✅ ${name}`);
    } catch (e) {
        fail++;
        console.log(`  ❌ ${name}: ${e.message}`);
    }
}

async function run() {
    console.log("\n═══ Heady Hive SDK Smoke Test ═══\n");

    // ── Test 1: SDK loads ──
    let SDK;
    test("1. SDK loads without error", () => {
        SDK = require("./index");
        if (!SDK.HeadyClient) throw new Error("HeadyClient not exported");
        if (!SDK.HeadyGateway) throw new Error("HeadyGateway not exported");
        if (!SDK.version) throw new Error("No version");
    });
    if (!SDK) { console.log("\n💀 SDK failed to load. Cannot continue.\n"); process.exit(1); }

    // ── Test 2: Providers load from env ──
    let providers;
    test("2. createProviders() returns providers with keys", () => {
        providers = SDK.createProviders();
        console.log(`     Found ${providers.length} providers: ${providers.map(p => p.name).join(", ")}`);
        if (providers.length < 1) throw new Error("No providers found — check API keys in .env");
    });

    // ── Test 3: process.env not mutated ──
    test("3. GOOGLE_API_KEY not deleted from process.env", () => {
        const before = process.env.GOOGLE_API_KEY;
        SDK.createProviders();
        const after = process.env.GOOGLE_API_KEY;
        if (before && !after) throw new Error("GOOGLE_API_KEY was deleted from process.env!");
    });

    // ── Test 4: HeadyClient instantiates ──
    let client;
    test("4. HeadyClient instantiates with gateway + subclients", () => {
        client = new SDK.HeadyClient({ url: "http://localhost:3301" });
        if (!client.gateway) throw new Error("No gateway");
        if (!client.brain) throw new Error("No brain subclient");
        if (!client.battle) throw new Error("No battle subclient");
        if (!client.swarm) throw new Error("No swarm subclient");
        console.log(`     Gateway has ${client.gateway.providers.length} providers registered`);
    });

    // ── Test 5: Gateway stats returns valid object ──
    test("5. gateway.getStats() returns valid object", () => {
        const stats = client.gatewayStats();
        if (typeof stats.totalRequests !== "number") throw new Error("Missing totalRequests");
        if (typeof stats.cacheHits !== "number") throw new Error("Missing cacheHits");
        if (!stats.providers) throw new Error("Missing providers array");
    });

    // ── Test 6: Cache round-trip works ──
    test("6. Cache set/get round-trip works", () => {
        const gw = client.gateway;
        gw._setCache("test-msg", "test-system", { ok: true, response: "cached!" });
        const cached = gw._checkCache("test-msg", "test-system");
        if (!cached) throw new Error("Cache miss on immediate read-back");
        if (cached.response !== "cached!") throw new Error("Cache returned wrong value");
    });

    // ── Test 7: Swarm creates bees ──
    test("7. Swarm colony spawns bees", () => {
        const swarm = client.swarm;
        if (!swarm.bees || swarm.bees.length === 0) throw new Error("No bees spawned");
        console.log(`     Colony: ${swarm.bees.length} bees, ${swarm.flowerField.length} flowers`);
    });

    // ── Test 8: Live chat request (uses real API key) ──
    if (providers && providers.length > 0) {
        await test("8. gateway.chat('ping') returns real response", async () => {
            const result = await client.gateway.chat("Reply with exactly: pong", {
                system: "You are a test bot. Reply with exactly what is asked, nothing more.",
                maxTokens: 10,
                temperature: 0,
            });
            if (!result.ok) throw new Error(`Chat returned ok:false — ${result.error || JSON.stringify(result)}`);
            if (!result.response) throw new Error(`Empty response from engine=${result.engine} model=${result.model} race=${JSON.stringify(result.race)}`);
            console.log(`     Engine: ${result.engine} | Model: ${result.model} | Latency: ${result.latency}ms | Response: "${result.response.substring(0, 50)}"`);
        });
    } else {
        fail++;
        console.log("  ❌ 8. SKIPPED — no providers available (missing API keys)");
    }

    // ── Summary ──
    console.log(`\n═══ Results: ${pass} passed, ${fail} failed ═══\n`);
    process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error("Fatal:", e); process.exit(1); });
