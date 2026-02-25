const { AutoSuccessEngine } = require('../src/hc_auto_success');

console.log("🚀 Starting Full-Throttle Auto-Flow Success Mode...");

const engine = new AutoSuccessEngine({
    interval: 100, // 100ms cycles instead of 30,000s for hyper-speed processing
    batchSize: 50 // Process 50 at a time
});

engine.start();

// Let it chew through the 200 items, then exit
setTimeout(() => {
    engine.stop();
    console.log("✅ Full-Throttle Pipeline Complete.");
    process.exit(0);
}, 2000);
