/**
 * @fileoverview Main exports for Heady VSA Integration
 * @version 1.0.0
 */

const { Hypervector, DEFAULT_DIMENSIONALITY, PHI } = require('./hypervector');
const { VSACodebook } = require('./codebook');
const { VSASemanticGates, CSLInterpreter } = require('./vsa-csl-bridge');

module.exports = {
  // Core VSA
  Hypervector,
  VSACodebook,

  // CSL Integration
  VSASemanticGates,
  CSLInterpreter,

  // Constants
  DEFAULT_DIMENSIONALITY,
  PHI
};
