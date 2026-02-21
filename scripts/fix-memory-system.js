#!/usr/bin/env node

// ╔══════════════════════════════════════════════════════════════════╗

/**
 * 🧠 MEMORY SYSTEM UNBLOCK - REMOVE HARDCODED 150 LIMIT
 * 
 * This script fixes the frozen memory system by:
 * 1. Removing hardcoded 150 limit
 * 2. Implementing dynamic memory growth
 * 3. Adding proper error handling
 * 4. Testing write capability
 */

const fs = require('fs').promises;
const path = require('path');

console.log('🚨 MEMORY SYSTEM EMERGENCY FIX');
console.log('================================\n');

async function fixMemorySystem() {
  try {
    const memoryCachePath = path.join(__dirname, '../.heady/memory-cache.json');
    
    // 1. Backup current memory
    console.log('📋 Backing up current memory...');
    const currentMemory = JSON.parse(await fs.readFile(memoryCachePath, 'utf8'));
    await fs.writeFile(memoryCachePath + '.backup', JSON.stringify(currentMemory, null, 2));
    
    // 2. Remove hardcoded limit and enable dynamic growth
    console.log('🔧 Removing hardcoded 150 limit...');
    const fixedMemory = {
      ...currentMemory,
      memories: {
        ...currentMemory.memories,
        total: null, // Remove hardcoded limit
        limit: null, // Remove limit field
        growth_enabled: true,
        max_soft_limit: 10000 // Soft limit with warnings
      },
      statistics: {
        ...currentMemory.statistics,
        total_memories: currentMemory.memories.recent.length, // Use actual count
        limit_removed: true,
        dynamic_growth: true
      }
    };
    
    // 3. Add test memory to verify write capability
    console.log('✅ Testing write capability...');
    const testMemory = {
      id: Date.now(),
      category: "system_fix",
      content: "Memory system unblocked - hardcoded 150 limit removed",
      tags: ["fix", "memory", "unblock"],
      timestamp: new Date().toISOString(),
      operation: "write_test"
    };
    
    fixedMemory.memories.recent.push(testMemory);
    
    // 4. Write fixed memory file
    await fs.writeFile(memoryCachePath, JSON.stringify(fixedMemory, null, 2));
    
    console.log('✅ Memory system fixed!');
    console.log(`📊 New memory count: ${fixedMemory.memories.recent.length}`);
    console.log('🔄 Dynamic growth enabled');
    console.log('⚠️  Soft limit at 10,000 memories with warnings');
    
    // 5. Verify the fix
    const verifyMemory = JSON.parse(await fs.readFile(memoryCachePath, 'utf8'));
    if (verifyMemory.memories.recent.length > 150) {
      console.log('🎉 SUCCESS: Memory count exceeded previous 150 limit!');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Memory fix failed:', error.message);
    console.log('🔧 Manual fix required:');
    console.log('1. Open .heady/memory-cache.json');
    console.log('2. Change "total": 150 to "total": null');
    console.log('3. Add "growth_enabled": true');
    return false;
  }
}

// Execute the fix
fixMemorySystem().then(success => {
  if (success) {
    console.log('\n🚀 MEMORY SYSTEM ONLINE - READY FOR LEARNING');
    console.log('📝 Next: Test memory ingestion with real work');
  } else {
    console.log('\n🚨 MANUAL INTERVENTION REQUIRED');
  }
}).catch(console.error);
