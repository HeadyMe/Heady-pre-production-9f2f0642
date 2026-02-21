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
