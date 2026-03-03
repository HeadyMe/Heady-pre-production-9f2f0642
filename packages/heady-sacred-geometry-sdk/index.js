/**
 * @headyme/sacred-geometry-sdk
 *
 * Sacred Geometry framework for autonomous multi-agent orchestration.
 * Derives ALL system parameters from three mathematical roots:
 *   φ (PHI = 1.618...)  — Golden Ratio
 *   Base-13             — Proprietary tier system
 *   Log-42              — Logarithmic scaling
 *
 * © 2026 Heady Systems LLC. All rights reserved.
 */

'use strict';

const principles = require('./lib/principles');
const spatial = require('./lib/spatial-embedder');
const octree = require('./lib/octree-manager');
const templates = require('./lib/template-engine');
const capacity = require('./lib/capacity-planner');

module.exports = {
    // ── Core Constants ──
    PHI: principles.PHI,
    PHI_INV: principles.PHI_INV,
    PHI_SQ: principles.PHI_SQ,
    PHI_CUBE: principles.PHI_CUBE,
    BASE: principles.BASE,
    LOG_BASE: principles.LOG_BASE,
    FIB: principles.FIB,

    // ── Principles Module ──
    principles,

    // ── Spatial Embedding ──
    spatial,
    SpatialEmbedder: spatial.SpatialEmbedder,

    // ── Octree Memory ──
    octree,
    OctreeManager: octree.OctreeManager,

    // ── Template Engine ──
    templates,
    TemplateEngine: templates.TemplateEngine,

    // ── Capacity Planning ──
    capacity,
    CapacityPlanner: capacity.CapacityPlanner,

    // ── Convenience Re-exports ──
    phiScale: principles.phiScale,
    goldenSplit: principles.goldenSplit,
    phiBackoff: principles.phiBackoff,
    phiThresholds: principles.phiThresholds,
    phiHarmonics: principles.phiHarmonics,
    toBase13: principles.toBase13,
    fromBase13: principles.fromBase13,
    log42: principles.log42,
    toTier: principles.toTier,
    capacityParams: principles.capacityParams,
    designTokens: principles.designTokens,
    goldenColor: principles.goldenColor,
    phiTiming: principles.phiTiming,
};
