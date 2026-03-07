/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

const express = require('../core/heady-server');
const liquidAutonomyController = require("../services/liquid-autonomy-controller");

const router = express.Router();

router.get("/health", (_req, res) => {
    res.json(liquidAutonomyController.health());
});

router.get("/blueprint", (_req, res) => {
    res.json({ ok: true, blueprint: liquidAutonomyController.getBlueprint(), ts: new Date().toISOString() });
});

router.post("/admin-trigger", (req, res) => {
    const trigger = liquidAutonomyController.enqueueAdminTrigger(req.body || {});
    res.status(202).json({ ok: true, trigger, ts: new Date().toISOString() });
});

router.post("/heartbeat/run", (req, res) => {
    const jobId = req.body?.jobId || "";
    const run = liquidAutonomyController.runHeartbeatJob(jobId);
    if (!run) {
        return res.status(404).json({ ok: false, error: `Unknown heartbeat job: ${jobId}` });
    }

    return res.status(202).json({ ok: true, run, ts: new Date().toISOString() });
});

module.exports = router;
