/**
 * Re-export phi-math from project root shared/ directory
 * This bridge ensures modules in src/ subdirectories can resolve shared/phi-math
 * via relative paths like ../../shared/phi-math
 */
module.exports = require('../../shared/phi-math');
