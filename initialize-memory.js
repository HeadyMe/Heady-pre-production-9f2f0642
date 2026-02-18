/**
 * 🧠 PERSISTENT MEMORY INITIALIZATION
 * Sets up the game-changer memory system
 */

const { HeadyPersistentMemory } = require('./src/heady-persistent-memory');
const fs = require('fs').promises;
const path = require('path');

async function initializeMemory() {
  console.log('🧠 Initializing persistent memory system...');
  
  const memory = new HeadyPersistentMemory({
    memoryPath: path.join(__dirname, '.heady-memory')
  });
  
  // Start background analysis
  memory.startBackgroundAnalysis();
  
  // Test memory operations
  const testReq = {
    userId: 'test-user',
    path: '/api/test',
    method: 'GET',
    body: { test: 'data' },
    headers: { 'user-agent': 'test-agent' }
  };
  
  // Test context loading
  const context = await memory.loadContextForRequest(testReq);
  console.log(`✅ Context loaded in ${context.loadTimeMs}ms`);
  
  // Test memory search
  const searchResults = await memory.searchMemory(['test', 'data']);
  console.log(`✅ Memory search found ${searchResults.length} results`);
  
  // Get stats
  const stats = memory.getStats();
  console.log('📊 Memory Stats:');
  console.log(`  Reads: ${stats.reads}`);
  console.log(`  Cache Hit Rate: ${stats.cacheHitRate}`);
  console.log(`  Memory Path: ${stats.memoryPath}`);
  
  return { memory, stats };
}

initializeMemory().catch(console.error);
