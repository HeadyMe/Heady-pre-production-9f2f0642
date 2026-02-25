/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ HCFP Full Auto — HeadySwarm Bootstrap ═══
 *
 * Spins up the HeadySwarm bee colony for continuous, autonomous AI work.
 * Replaces the old crash-prone task dispatcher with bio-inspired swarm intelligence.
 *
 * The swarm manages everything: task selection, parallel execution,
 * error absorption, waggle dance recruitment, and honeycomb persistence.
 */

const path = require("path");
const HeadyClient = require(path.join(__dirname, "..", "heady-hive-sdk"));
const { HeadyClient: Client } = HeadyClient;

const MANAGER_URL = "http://localhost:3301";

async function boot() {
  console.log("═══════════════════════════════════════════════");
  console.log("  🐝 HCFP Full Auto — HeadySwarm Colony");
  console.log("  📡 Powered by heady-hive-sdk Liquid Gateway");
  console.log("═══════════════════════════════════════════════");

  // Initialize SDK client (which auto-initializes the swarm)
  const heady = new Client({
    url: MANAGER_URL,
    apiKey: process.env.HEADY_API_KEY,
    beeCount: 5,
    roundInterval: 120000, // 2 min between rounds (respectful of resources)
  });

  // Verify connection
  try {
    const info = await heady.info();
    console.log(`  ✅ Connected: ${info.connected ? "LIVE" : "DOWN"}`);
    console.log(`  SDK v${info.sdk.version} → ${info.sdk.url}`);
    const gwStats = heady.gatewayStats();
    console.log(`  Providers: ${gwStats.providers.filter(p => p.enabled).length} active`);
  } catch (err) {
    console.error(`  ⚠️  Manager check failed (swarm will still run): ${err.message}`);
  }

  // Start the swarm
  heady.swarm.start();
  global.__headySwarm = heady.swarm; // expose for API routes in heady-manager

  // Log swarm events
  heady.swarm.on("round-complete", (data) => {
    console.log(`\n📊 Swarm Round #${data.round}: ✅${data.ok} ❌${data.err} ⏱${data.durationMs}ms | 🍯${data.honeycombSize} stored`);
  });

  heady.swarm.on("waggle-dance", (data) => {
    if (data.quality >= 70) {
      console.log(`  💃 Waggle! ${data.beeId} found rich ${data.taskCategory} (q:${data.quality})`);
    }
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n🐝 Swarm shutting down gracefully...");
    heady.swarm.stop();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Keep alive
  console.log("\n🐝 Colony is buzzing. Press Ctrl+C to stop.\n");
}

boot().catch(err => {
  console.error("🐝 Swarm boot failed:", err.message);
  // Don't exit — let PM2 handle restart, but with a delay
  setTimeout(() => process.exit(1), 5000);
});
