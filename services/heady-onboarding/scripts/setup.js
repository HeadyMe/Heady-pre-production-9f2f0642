#!/usr/bin/env node

console.log('🚀 HeadyMe Onboarding Setup');
console.log('============================\n');

// Check Node version
const nodeVersion = process.versions.node;
if (parseInt(nodeVersion.split('.')[0]) < 18) {
  console.error('❌ Node.js 18 or higher is required');
  process.exit(1);
}

console.log('✅ Node.js version:', nodeVersion);

// Check for .env file
const fs = require('fs');
const path = require('path');

if (!fs.existsSync('.env')) {
  console.log('⚠️  .env file not found. Creating from .env.example...');
  fs.copyFileSync('.env.example', '.env');
  console.log('✅ Created .env file');
  console.log('\n⚠️  IMPORTANT: Edit .env and add your credentials before continuing\n');
  process.exit(0);
}

console.log('✅ .env file found');
console.log('\n📦 Next steps:');
console.log('1. Edit .env with your credentials');
console.log('2. Run: npx prisma generate');
console.log('3. Run: npx prisma db push');
console.log('4. Run: npm run dev');
console.log('\n🎉 Setup complete!');
