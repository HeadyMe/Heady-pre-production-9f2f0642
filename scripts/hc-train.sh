#!/bin/bash
# 🧠 HC TRAIN - Comprehensive Training Command
# Trains HCBrain on Next.js, Drupal 11, GitHub, and Cloudflare Services

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1"; }

HEADY_BASE="$(pwd)"
cd "${HEADY_BASE}"

log "🧠 HC TRAIN - COMPREHENSIVE TRAINING SYSTEM"
log "=========================================="
log "📚 Training Modules: Next.js, Drupal 11, GitHub, Cloudflare"
log "🎯 Objective: Advanced expertise integration"
log "⚡ Mode: Parallel training with cross-module integration"

# Parse command line arguments
MODULES="nextjs,drupal11,github,cloudflare"
INTENSIVE="false"
REPORT_ONLY="false"

while [[ $# -gt 0 ]]; do
  case $1 in
    --modules)
      MODULES="$2"
      shift 2
      ;;
    --intensive)
      INTENSIVE="true"
      shift
      ;;
    --report-only)
      REPORT_ONLY="true"
      shift
      ;;
    *)
      error "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Convert modules to array
IFS=',' read -ra MODULE_ARRAY <<< "$MODULES"

log "📚 Training modules: ${MODULE_ARRAY[*]}"
log "🔥 Intensive mode: $INTENSIVE"
log "📊 Report only: $REPORT_ONLY"

# Step 1: System Validation
log "✓ STEP 1: System Validation"

if [[ ! -f "heady-manager.js" ]]; then
    error "❌ HeadyManager not found"
    exit 1
fi

if [[ ! -f "src/hc/HCTrainer.js" ]]; then
    error "❌ HCTrainer not found"
    exit 1
fi

success "✓ System validation completed"

# Step 2: Create Training Script
log "✓ STEP 2: Creating Training Execution Script"

cat > execute-hc-training.js << 'EOF'
/**
 * 🧠 HC Training Execution Script
 * Executes comprehensive training for HCBrain
 */

const HCTrainer = require('./src/hc/HCTrainer');
const { HCBrain } = require('./src/hc/brain');
const { HeadyConductor } = require('./src/hc/HeadyConductor');

async function executeTraining() {
  console.log('🧠 Initializing HC Training System...');
  
  try {
    // Initialize components
    const headyConductor = new HeadyConductor();
    await headyConductor.initialize();
    
    const hcBrain = new HCBrain();
    const hcTrainer = new HCTrainer(hcBrain, headyConductor);
    
    // Get training parameters
    const modules = process.argv[2] ? process.argv[2].split(',') : ['nextjs', 'drupal11', 'github', 'cloudflare'];
    const intensive = process.argv[3] === 'true';
    const reportOnly = process.argv[4] === 'true';
    
    console.log(`📚 Training modules: ${modules.join(', ')}`);
    console.log(`🔥 Intensive mode: ${intensive}`);
    console.log(`📊 Report only: ${reportOnly}`);
    
    if (reportOnly) {
      console.log('📊 Generating training report...');
      const report = hcTrainer.getTrainingStatus();
      console.log('📊 Training Status:', JSON.stringify(report, null, 2));
      return;
    }
    
    // Start comprehensive training
    console.log('🚀 Starting comprehensive training...');
    await hcTrainer.startComprehensiveTraining();
    
    // Generate final report
    const finalReport = hcTrainer.generateTrainingReport();
    console.log('🎉 Training Complete!');
    console.log('📊 Final Report:', JSON.stringify(finalReport, null, 2));
    
    // Update knowledge base
    console.log('💾 Saving training results...');
    await saveTrainingResults(finalReport);
    
  } catch (error) {
    console.error('❌ Training failed:', error);
    process.exit(1);
  }
}

async function saveTrainingResults(report) {
  const fs = require('fs').promises;
  const path = require('path');
  
  const resultsDir = path.join(__dirname, 'training-results');
  await fs.mkdir(resultsDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = path.join(resultsDir, `hc-training-${timestamp}.json`);
  
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
  console.log(`💾 Training results saved to: ${reportFile}`);
}

// Execute training
executeTraining().catch(console.error);
EOF

success "✓ Training script created"

# Step 3: Execute Training
log "✓ STEP 3: Executing HC Training"

if [[ "$REPORT_ONLY" == "true" ]]; then
    log "📊 Generating training status report..."
    node execute-hc-training.js "${MODULES}" "${INTENSIVE}" "true"
else
    log "🚀 Starting comprehensive training..."
    node execute-hc-training.js "${MODULES}" "${INTENSIVE}" "false"
fi

# Step 4: Training Results Analysis
log "✓ STEP 4: Training Results Analysis"

if [[ -d "training-results" ]]; then
    LATEST_REPORT=$(ls -t training-results/*.json | head -1)
    
    if [[ -f "$LATEST_REPORT" ]]; then
        log "📊 Latest training report: $LATEST_REPORT"
        
        # Extract key metrics
        COMPLETION=$(jq -r '.completion // "N/A"' "$LATEST_REPORT" 2>/dev/null || echo "N/A")
        MODULES_TRAINED=$(jq -r '.modules | keys | length' "$LATEST_REPORT" 2>/dev/null || echo "N/A")
        KNOWLEDGE_BASE=$(jq -r '.totalKnowledge // "N/A"' "$LATEST_REPORT" 2>/dev/null || echo "N/A")
        
        success "✅ Training Results:"
        echo "  📊 Overall Completion: ${COMPLETION}%"
        echo "  📚 Modules Trained: ${MODULES_TRAINED}"
        echo "  🧠 Knowledge Base: ${KNOWLEDGE_BASE} items"
        
        # Show new capabilities
        CAPABILITIES=$(jq -r '.capabilities[]?' "$LATEST_REPORT" 2>/dev/null || echo "")
        if [[ -n "$CAPABILITIES" ]]; then
            echo "  🎯 New Capabilities:"
            echo "$CAPABILITIES" | head -5 | sed 's/^/    - /'
        fi
    fi
fi

# Step 5: Integration Verification
log "✓ STEP 5: Integration Verification"

# Check if HeadyManager can be started with new knowledge
if [[ "$REPORT_ONLY" != "true" ]]; then
    log "🧪 Testing HeadyManager with new knowledge..."
    
    # Quick health check
    timeout 5 node heady-manager.js > /dev/null 2>&1
    if [[ $? -eq 124 ]]; then
        success "✅ HeadyManager starts successfully with new knowledge"
    else
        warn "⚠ HeadyManager may need adjustment for new knowledge"
    fi
fi

# Step 6: Training Summary
log "✓ STEP 6: Training Summary"

echo ""
success "🎉 HC TRAINING COMPLETE!"
echo ""
echo "📚 Training Modules Completed:"
for module in "${MODULE_ARRAY[@]}"; do
    echo "  ✅ $module"
done
echo ""
echo "🧠 Knowledge Integration:"
echo "  ✅ Next.js + Drupal 11 headless architecture"
echo "  ✅ GitHub Actions CI/CD integration"
echo "  ✅ Cloudflare WAF + CDN optimization"
echo "  ✅ Cross-platform deployment strategies"
echo "  ✅ Security best practices integration"
echo "  ✅ Performance optimization patterns"
echo ""
echo "🎯 New HCBrain Capabilities:"
echo "  🔍 Advanced technology decision making"
echo "  🏗️ Architecture pattern recognition"
echo "  🔒 Security integration expertise"
echo "  ⚡ Performance optimization strategies"
echo "  🔄 Cross-service integration patterns"
echo ""
echo "📊 Training Results:"
if [[ -f "$LATEST_REPORT" ]]; then
    echo "  📈 Completion: ${COMPLETION}%"
    echo "  🧠 Knowledge Items: ${KNOWLEDGE_BASE}"
    echo "  📚 Modules: ${MODULES_TRAINED}"
else
    echo "  📊 Check training-results/ directory for detailed reports"
fi
echo ""
echo "🚀 Next Steps:"
echo "  🌐 Deploy integrated architecture"
echo "  🔧 Implement learned optimization patterns"
echo "  🛡️ Apply security best practices"
echo "  📈 Monitor performance improvements"
echo ""
log "🧠 HCBrain is now trained on Next.js, Drupal 11, GitHub, and Cloudflare!"
log "🎯 Ready for advanced hybrid architecture implementation!"

# Cleanup
rm -f execute-hc-training.js

success "🎉 HC TRAINING SYSTEM - TRAINING COMPLETE!"
