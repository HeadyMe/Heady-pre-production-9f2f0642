// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/routes/imagination-routes.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * Heady Imagination API Routes (imagination-routes.js)
 * 
 * REST API endpoints for the Imagination Engine.
 * Provides: concept generation, evaluation, IP discovery, experimentation,
 * primitive management, and system introspection.
 */

const { imagination } = require('../hc_imagination');
const express = require('express');
const router = express.Router();

// ============================================================================
// INITIALIZATION
// ============================================================================

// Ensure imagination engine is initialized
let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await imagination.init();
    initialized = true;
  }
}

// ============================================================================
// PRIMITIVE MANAGEMENT
// ============================================================================

/**
 * POST /api/imagination/primitives
 * Add new primitives to the library
 */
router.post('/primitives', async (req, res) => {
  await ensureInit();
  
  const { primitives } = req.body;
  if (!Array.isArray(primitives)) {
    return res.status(400).json({ error: 'primitives must be an array' });
  }
  
  const added = [];
  for (const p of primitives) {
    const primitive = imagination.addPrimitive(
      p.kind,
      p.description,
      p.source_ref || 'api',
      p.tags || [],
      p.embedding
    );
    added.push(primitive);
  }
  
  await imagination.savePrimitives();
  
  res.json({
    added: added.length,
    primitives: added
  });
});

/**
 * GET /api/imagination/primitives
 * List all primitives with optional filtering
 */
router.get('/primitives', async (req, res) => {
  await ensureInit();
  
  const { kind, tag, minWeight } = req.query;
  let primitives = Array.from(imagination.primitives.values());
  
  if (kind) {
    primitives = primitives.filter(p => p.kind === kind);
  }
  if (tag) {
    primitives = primitives.filter(p => p.tags.includes(tag));
  }
  if (minWeight) {
    primitives = primitives.filter(p => p.weight >= parseFloat(minWeight));
  }
  
  res.json({
    count: primitives.length,
    primitives: primitives.map(p => ({
      id: p.id,
      kind: p.kind,
      description: p.description.substring(0, 100),
      tags: p.tags,
      weight: p.weight,
      success_count: p.success_count,
      last_used: p.last_used
    }))
  });
});

/**
 * POST /api/imagination/extract-primitives
 * Extract primitives from source code/text
 */
router.post('/extract-primitives', async (req, res) => {
  await ensureInit();
  
  const { source, source_type } = req.body;
  if (!source) {
    return res.status(400).json({ error: 'source is required' });
  }
  
  const extracted = await imagination.extractPrimitives(source, source_type || 'code');
  
  res.json({
    extracted: extracted.length,
    primitives: extracted
  });
});

// ============================================================================
// CONCEPT GENERATION & MANAGEMENT
// ============================================================================

/**
 * POST /api/imagination/imagine
 * Run imagination cycle and generate new concepts
 */
router.post('/imagine', async (req, res) => {
  await ensureInit();
  
  const { batch_size, auto_evaluate = true } = req.body;
  
  const concepts = await imagination.imagine(batch_size);
  
  if (auto_evaluate) {
    for (const concept of concepts) {
      await imagination.evaluateConcept(concept);
    }
    await imagination.saveConcepts();
  }
  
  res.json({
    generated: concepts.length,
    concepts: concepts.map(c => ({
      id: c.id,
      title: c.title,
      summary: c.summary,
      status: c.status,
      scores: c.scores,
      recombination_op: c.recombination_op
    }))
  });
});

/**
 * GET /api/imagination/concepts
 * List concepts with filtering
 */
router.get('/concepts', async (req, res) => {
  await ensureInit();
  
  const { status, min_novelty, min_usefulness, max_risk, limit = 20 } = req.query;
  
  let concepts = Array.from(imagination.concepts.values());
  
  if (status) {
    concepts = concepts.filter(c => c.status === status);
  }
  if (min_novelty) {
    concepts = concepts.filter(c => c.scores.novelty >= parseFloat(min_novelty));
  }
  if (min_usefulness) {
    concepts = concepts.filter(c => c.scores.usefulness >= parseFloat(min_usefulness));
  }
  if (max_risk) {
    concepts = concepts.filter(c => c.scores.risk <= parseFloat(max_risk));
  }
  
  concepts = concepts.slice(0, parseInt(limit));
  
  res.json({
    count: concepts.length,
    total: imagination.concepts.size,
    concepts: concepts.map(c => ({
      id: c.id,
      title: c.title,
      summary: c.summary,
      status: c.status,
      scores: c.scores,
      recombination_op: c.recombination_op,
      primitive_count: c.primitive_ids.length,
      created_at: c.created_at
    }))
  });
});

/**
 * GET /api/imagination/concepts/:id
 * Get full details of a specific concept
 */
router.get('/concepts/:id', async (req, res) => {
  await ensureInit();
  
  const concept = imagination.concepts.get(req.params.id);
  if (!concept) {
    return res.status(404).json({ error: 'Concept not found' });
  }
  
  // Enrich with primitive details
  const primitives = concept.primitive_ids
    .map(id => imagination.primitives.get(id))
    .filter(Boolean);
  
  res.json({
    ...concept,
    primitives: primitives.map(p => ({
      id: p.id,
      kind: p.kind,
      description: p.description
    }))
  });
});

/**
 * POST /api/imagination/concepts/:id/evaluate
 * Re-evaluate a concept
 */
router.post('/concepts/:id/evaluate', async (req, res) => {
  await ensureInit();
  
  const concept = imagination.concepts.get(req.params.id);
  if (!concept) {
    return res.status(404).json({ error: 'Concept not found' });
  }
  
  await imagination.evaluateConcept(concept);
  await imagination.saveConcepts();
  
  res.json({
    id: concept.id,
    scores: concept.scores,
    status: concept.status,
    risk_notes: concept.risk_notes
  });
});

/**
 * POST /api/imagination/concepts/:id/feedback
 * Provide human feedback on a concept
 */
router.post('/concepts/:id/feedback', async (req, res) => {
  await ensureInit();
  
  const { success, notes, human_tags } = req.body;
  const concept = imagination.concepts.get(req.params.id);
  
  if (!concept) {
    return res.status(404).json({ error: 'Concept not found' });
  }
  
  // Update primitive weights based on feedback
  imagination.updatePrimitiveWeights(concept.id, success);
  imagination.updateOperatorStats(concept.recombination_op, success);
  
  // Update concept status
  concept.status = success ? 'tested' : 'discarded';
  if (notes) concept.risk_notes.push(`Human feedback: ${notes}`);
  if (human_tags) concept.human_tags = human_tags;
  
  await imagination.saveConcepts();
  await imagination.savePrimitives();
  
  res.json({
    id: concept.id,
    status: concept.status,
    message: success ? 'Concept marked as successful' : 'Concept marked as failed'
  });
});

/**
 * GET /api/imagination/hot-concepts
 * Get hot concepts ready for elaboration
 */
router.get('/hot-concepts', async (req, res) => {
  await ensureInit();
  
  const hot = imagination.getHotConcepts();
  
  res.json({
    count: hot.length,
    concepts: hot.map(c => ({
      id: c.id,
      title: c.title,
      summary: c.summary,
      scores: c.scores,
      why_hot: `Novelty: ${c.scores.novelty.toFixed(2)}, Usefulness: ${c.scores.usefulness.toFixed(2)}`
    }))
  });
});

/**
 * GET /api/imagination/top-concepts
 * Get top concepts by composite score
 */
router.get('/top-concepts', async (req, res) => {
  await ensureInit();
  
  const { count = 10, min_status = 'raw' } = req.query;
  const top = imagination.getTopConcepts(parseInt(count), min_status);
  
  res.json({
    count: top.length,
    concepts: top.map(c => ({
      id: c.id,
      title: c.title,
      summary: c.summary,
      composite_score: c.compositeScore,
      scores: {
        novelty: c.scores.novelty,
        usefulness: c.scores.usefulness,
        risk: c.scores.risk
      },
      status: c.status
    }))
  });
});

// ============================================================================
// RECOMBINATION OPERATORS (Manual)
// ============================================================================

/**
 * POST /api/imagination/operators/blend
 * Manually blend two primitives
 */
router.post('/operators/blend', async (req, res) => {
  await ensureInit();
  
  const { primitive_a_id, primitive_b_id } = req.body;
  
  const primA = imagination.primitives.get(primitive_a_id);
  const primB = imagination.primitives.get(primitive_b_id);
  
  if (!primA || !primB) {
    return res.status(400).json({ error: 'One or both primitives not found' });
  }
  
  const concept = imagination.blend(primA, primB);
  await imagination.evaluateConcept(concept);
  await imagination.saveConcepts();
  
  res.json({
    concept: {
      id: concept.id,
      title: concept.title,
      summary: concept.summary,
      scores: concept.scores
    }
  });
});

/**
 * POST /api/imagination/operators/substitute
 * Manually substitute a primitive in a concept
 */
router.post('/operators/substitute', async (req, res) => {
  await ensureInit();
  
  const { concept_id, new_primitive_id } = req.body;
  
  const concept = imagination.concepts.get(concept_id);
  const prim = imagination.primitives.get(new_primitive_id);
  
  if (!concept || !prim) {
    return res.status(400).json({ error: 'Concept or primitive not found' });
  }
  
  const newConcept = imagination.substitute(concept, prim);
  await imagination.evaluateConcept(newConcept);
  await imagination.saveConcepts();
  
  res.json({
    concept: {
      id: newConcept.id,
      title: newConcept.title,
      summary: newConcept.summary,
      scores: newConcept.scores
    }
  });
});

/**
 * POST /api/imagination/operators/extend
 * Manually extend a concept with a primitive
 */
router.post('/operators/extend', async (req, res) => {
  await ensureInit();
  
  const { concept_id, new_primitive_id } = req.body;
  
  const concept = imagination.concepts.get(concept_id);
  const prim = imagination.primitives.get(new_primitive_id);
  
  if (!concept || !prim) {
    return res.status(400).json({ error: 'Concept or primitive not found' });
  }
  
  const newConcept = imagination.extend(concept, prim);
  await imagination.evaluateConcept(newConcept);
  await imagination.saveConcepts();
  
  res.json({
    concept: {
      id: newConcept.id,
      title: newConcept.title,
      summary: newConcept.summary,
      scores: newConcept.scores
    }
  });
});

/**
 * POST /api/imagination/operators/invert
 * Manually invert a primitive
 */
router.post('/operators/invert', async (req, res) => {
  await ensureInit();
  
  const { primitive_id } = req.body;
  
  const prim = imagination.primitives.get(primitive_id);
  if (!prim) {
    return res.status(400).json({ error: 'Primitive not found' });
  }
  
  const concept = imagination.invert(prim);
  await imagination.evaluateConcept(concept);
  await imagination.saveConcepts();
  
  res.json({
    concept: {
      id: concept.id,
      title: concept.title,
      summary: concept.summary,
      scores: concept.scores
    }
  });
});

/**
 * POST /api/imagination/operators/morph
 * Manually morph two concepts
 */
router.post('/operators/morph', async (req, res) => {
  await ensureInit();
  
  const { concept_a_id, concept_b_id, alpha = 0.5 } = req.body;
  
  const conceptA = imagination.concepts.get(concept_a_id);
  const conceptB = imagination.concepts.get(concept_b_id);
  
  if (!conceptA || !conceptB) {
    return res.status(400).json({ error: 'One or both concepts not found' });
  }
  
  const concept = imagination.morph(conceptA, conceptB, alpha);
  await imagination.evaluateConcept(concept);
  await imagination.saveConcepts();
  
  res.json({
    concept: {
      id: concept.id,
      title: concept.title,
      summary: concept.summary,
      scores: concept.scores
    }
  });
});

// ============================================================================
// IP DISCOVERY
// ============================================================================

/**
 * POST /api/imagination/concepts/:id/prior-art
 * Search prior art for a concept
 */
router.post('/concepts/:id/prior-art', async (req, res) => {
  await ensureInit();
  
  const priorArt = await imagination.searchPriorArt(req.params.id);
  
  res.json({
    concept_id: req.params.id,
    prior_art_count: priorArt.length,
    prior_art: priorArt
  });
});

/**
 * POST /api/imagination/concepts/:id/ip-package
 * Create IP package for a concept
 */
router.post('/concepts/:id/ip-package', async (req, res) => {
  await ensureInit();
  
  const concept = imagination.concepts.get(req.params.id);
  if (!concept) {
    return res.status(404).json({ error: 'Concept not found' });
  }
  
  const pkg = await imagination.createIPPackage(req.params.id);
  
  res.json({
    package: {
      id: pkg.id,
      concept_id: pkg.concept_id,
      claims_count: pkg.claims.length,
      prior_art_count: pkg.prior_art_list.length,
      ip_posture: pkg.ip_posture,
      human_review_status: pkg.human_review_status,
      specification: {
        title: pkg.specification.title,
        summary: pkg.specification.summary
      }
    }
  });
});

/**
 * GET /api/imagination/ip-packages
 * List all IP packages
 */
router.get('/ip-packages', async (req, res) => {
  await ensureInit();
  
  const { status, posture } = req.query;
  
  let packages = Array.from(imagination.ipPackages.values());
  
  if (status) {
    packages = packages.filter(p => p.human_review_status === status);
  }
  if (posture) {
    packages = packages.filter(p => p.ip_posture === posture);
  }
  
  res.json({
    count: packages.length,
    packages: packages.map(p => ({
      id: p.id,
      concept_id: p.concept_id,
      title: p.specification.title,
      ip_posture: p.ip_posture,
      human_review_status: p.human_review_status,
      claims_count: p.claims.length,
      created_at: p.created_at
    }))
  });
});

/**
 * GET /api/imagination/ip-packages/:id
 * Get full IP package details
 */
router.get('/ip-packages/:id', async (req, res) => {
  await ensureInit();
  
  const pkg = imagination.ipPackages.get(req.params.id);
  if (!pkg) {
    return res.status(404).json({ error: 'IP package not found' });
  }
  
  res.json(pkg);
});

/**
 * POST /api/imagination/ip-packages/:id/review
 * Update human review status of IP package
 */
router.post('/ip-packages/:id/review', async (req, res) => {
  await ensureInit();
  
  const { status, notes } = req.body;
  
  const pkg = imagination.ipPackages.get(req.params.id);
  if (!pkg) {
    return res.status(404).json({ error: 'IP package not found' });
  }
  
  pkg.human_review_status = status;
  if (notes) pkg.review_notes = notes;
  
  await imagination.saveIPPackages();
  
  res.json({
    id: pkg.id,
    human_review_status: pkg.human_review_status,
    message: `IP package marked as ${status}`
  });
});

// ============================================================================
// META-LEARNING & SYSTEM STATS
// ============================================================================

/**
 * GET /api/imagination/stats
 * Get imagination system statistics
 */
router.get('/stats', async (req, res) => {
  await ensureInit();
  
  const stats = imagination.getStats();
  
  res.json({
    ...stats,
    config: {
      noveltyThreshold: imagination.config.noveltyThreshold,
      usefulnessThreshold: imagination.config.usefulnessThreshold,
      riskThreshold: imagination.config.riskThreshold,
      recombinationIntervalMinutes: imagination.config.recombinationIntervalMinutes
    }
  });
});

/**
 * POST /api/imagination/tournament
 * Run tournament to select best concept
 */
router.post('/tournament', async (req, res) => {
  await ensureInit();
  
  const { concept_ids } = req.body;
  
  if (!Array.isArray(concept_ids) || concept_ids.length < 2) {
    return res.status(400).json({ error: 'Need at least 2 concept IDs' });
  }
  
  const winner = imagination.runTournament(concept_ids);
  const winningConcept = imagination.concepts.get(winner);
  
  res.json({
    winner_id: winner,
    winner: winningConcept ? {
      id: winningConcept.id,
      title: winningConcept.title,
      scores: winningConcept.scores
    } : null,
    participants: concept_ids.length
  });
});

/**
 * POST /api/imagination/auto-cycle
 * Run full autonomous imagination cycle
 */
router.post('/auto-cycle', async (req, res) => {
  await ensureInit();
  
  const { 
    generate_count = 5,
    elaborate_hot = true,
    create_ip_packages = false 
  } = req.body;
  
  const results = {
    generated: [],
    elaborated: [],
    ip_packages: []
  };
  
  // 1. Generate new concepts
  const newConcepts = await imagination.imagine(generate_count);
  results.generated = newConcepts.map(c => c.id);
  
  // 2. Elaborate hot concepts
  if (elaborate_hot) {
    const hot = imagination.getHotConcepts().slice(0, 3);
    for (const concept of hot) {
      concept.status = 'refined';
      results.elaborated.push(concept.id);
    }
    await imagination.saveConcepts();
  }
  
  // 3. Create IP packages for top concepts
  if (create_ip_packages) {
    const top = imagination.getTopConcepts(3, 'refined');
    for (const concept of top) {
      if (concept.scores.novelty > 0.7 && concept.scores.usefulness > 0.6) {
        const pkg = await imagination.createIPPackage(concept.id);
        results.ip_packages.push(pkg.id);
      }
    }
  }
  
  res.json({
    cycle_complete: true,
    ...results,
    stats: imagination.getStats()
  });
});

// ============================================================================
// SAFETY & ETHICS
// ============================================================================

/**
 * POST /api/imagination/safety-check
 * Run safety check on text or concept
 */
router.post('/safety-check', async (req, res) => {
  await ensureInit();
  
  const { text, concept_id } = req.body;
  
  let checkText = text;
  if (concept_id) {
    const concept = imagination.concepts.get(concept_id);
    if (concept) {
      checkText = `${concept.title} ${concept.summary} ${concept.mechanism}`;
    }
  }
  
  if (!checkText) {
    return res.status(400).json({ error: 'Provide text or concept_id' });
  }
  
  const violations = [];
  const amber = [];
  
  // Check hard constraints
  for (const constraint of imagination.config.hardConstraints) {
    const violation = await imagination.checkConstraintViolation({ title: checkText, summary: '', mechanism: '' }, constraint);
    if (violation) {
      violations.push(constraint);
    }
  }
  
  // Check amber zones
  for (const zone of imagination.config.amberZones) {
    const match = await imagination.checkAmberZone({ title: checkText, summary: '' }, zone);
    if (match) {
      amber.push(zone);
    }
  }
  
  const safe = violations.length === 0;
  
  res.json({
    safe,
    violations,
    amber_zones: amber,
    recommendation: safe 
      ? (amber.length > 0 ? 'Requires review' : 'Proceed')
      : 'BLOCKED - Hard constraint violation'
  });
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = router;
