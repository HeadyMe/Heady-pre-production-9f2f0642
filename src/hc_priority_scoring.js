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
// ║  FILE: src/hc_priority_scoring.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// Priority scoring algorithm for FMSAP
function calculateScanPriority(file) {
  const now = new Date();
  let score = 0;
  
  // Recency (0-25 points)
  const daysSinceScan = Math.floor((now - new Date(file.last_scan)) / (1000 * 60 * 60 * 24));
  score += Math.min(daysSinceScan / 7 * 25, 25);
  
  // Criticality (0-30 points)
  const criticalityMap = {"core": 30, "supporting": 20, "experimental": 10};
  score += criticalityMap[file.criticality] || 0;
  
  // Change frequency (0-20 points)
  score += Math.min(file.edit_count_last_30_days * 2, 20);
  
  // Dependency breadth (0-15 points)
  score += Math.min(file.dependencies.length * 3, 15);
  
  // Unresolved insights (0-10 points)
  score += Math.min(file.improvement_backlog.length * 2, 10);
  
  return Math.round(score);
}

module.exports = { calculateScanPriority };
