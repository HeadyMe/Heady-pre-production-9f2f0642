/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
const { SecretRotation } = require('../src/security/secret-rotation');

console.log("🛡️ [Heady-Pipeline] Initializing Automated Secret Rotation Daemon");

async function runRotationSweep() {
    console.log(`[${new Date().toISOString()}] Executing scheduled rotation...`);
    try {
        const status = await SecretRotation.auditSecrets();
        console.log("Rotation Status:", JSON.stringify(status, null, 2));
    } catch (err) {
        console.error("Rotation failure:", err.message);
    }
}

// Run immediately
runRotationSweep();

// Run every 12 hours
setInterval(runRotationSweep, 12 * 60 * 60 * 1000);

console.log("✅ Secret Rotation Daemon is now active in background memory.");
