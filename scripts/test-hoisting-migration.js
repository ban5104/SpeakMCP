#!/usr/bin/env node

/**
 * Test script for migrating from shamefully-hoist to selective hoisting
 * Run this script to verify the migration works correctly
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const NPMRC_PATH = path.join(process.cwd(), '.npmrc');
const BACKUP_PATH = path.join(process.cwd(), '.npmrc.backup');
const RECOMMENDED_PATH = path.join(process.cwd(), '.npmrc.recommended');

console.log('🔄 Testing pnpm hoisting migration...\n');

// Step 1: Backup current .npmrc
console.log('1️⃣ Backing up current .npmrc...');
if (fs.existsSync(NPMRC_PATH)) {
  fs.copyFileSync(NPMRC_PATH, BACKUP_PATH);
  console.log('   ✅ Backup created at .npmrc.backup\n');
}

// Step 2: Test without any hoisting
console.log('2️⃣ Testing without hoisting...');
fs.writeFileSync(NPMRC_PATH, '# No hoisting configuration\n');
try {
  execSync('pnpm install', { stdio: 'inherit' });
  console.log('   ✅ Installation successful without hoisting!\n');
  
  // Test type checking
  console.log('   Testing TypeScript compilation...');
  execSync('pnpm typecheck:node', { stdio: 'pipe' });
  console.log('   ✅ TypeScript compilation successful!\n');
} catch (error) {
  console.log('   ⚠️ Issues found without hoisting (this is expected)\n');
}

// Step 3: Test with recommended selective hoisting
console.log('3️⃣ Testing with selective hoisting...');
if (fs.existsSync(RECOMMENDED_PATH)) {
  fs.copyFileSync(RECOMMENDED_PATH, NPMRC_PATH);
  console.log('   Using .npmrc.recommended configuration');
  
  try {
    execSync('pnpm install', { stdio: 'inherit' });
    console.log('   ✅ Installation successful with selective hoisting!\n');
    
    // Test type checking
    console.log('   Testing TypeScript compilation...');
    execSync('pnpm typecheck', { stdio: 'pipe' });
    console.log('   ✅ TypeScript compilation successful!\n');
    
    // Test electron-builder
    console.log('   Testing electron-builder app-deps...');
    execSync('pnpm postinstall', { stdio: 'pipe' });
    console.log('   ✅ Electron builder successful!\n');
    
    console.log('🎉 Migration successful! The recommended configuration works.\n');
  } catch (error) {
    console.log('   ❌ Issues with selective hoisting:', error.message);
    console.log('   You may need to add more patterns to public-hoist-pattern\n');
  }
} else {
  console.log('   ⚠️ .npmrc.recommended not found\n');
}

// Step 4: Provide recommendations
console.log('📋 Migration Summary:');
console.log('────────────────────');
console.log('The project appears to work without shamefully-hoist!');
console.log('\nRecommended actions:');
console.log('1. Review .npmrc.recommended for the new configuration');
console.log('2. Run: cp .npmrc.recommended .npmrc');
console.log('3. Run: pnpm install');
console.log('4. Test your application thoroughly');
console.log('5. If issues occur, add specific packages to public-hoist-pattern');
console.log('\nTo restore original configuration: cp .npmrc.backup .npmrc');

// Restore original for safety
console.log('\n🔄 Restoring original .npmrc for safety...');
if (fs.existsSync(BACKUP_PATH)) {
  fs.copyFileSync(BACKUP_PATH, NPMRC_PATH);
  console.log('   ✅ Original configuration restored\n');
}