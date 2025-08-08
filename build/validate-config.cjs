#!/usr/bin/env node
// @ts-check

/**
 * Configuration validation utility
 * Validates the modular electron-builder configuration
 */

const path = require('path');

async function validateConfiguration() {
  try {
    console.log('🔍 Validating electron-builder configuration...\n');
    
    // Load the main config
    const mainConfig = require('../electron-builder.config.cjs');
    
    // Validation checks
    const checks = [
      {
        name: 'Uses pnpm instead of npm',
        test: () => mainConfig.npmRebuild === 'pnpm',
        fix: '✅ npmRebuild set to "pnpm"'
      },
      {
        name: 'macOS binaries use build-time path (no runtime detection)',
        test: () => mainConfig.mac?.binaries?.[0] === 'resources/bin/speakmcp-rs',
        fix: '✅ macOS binaries use static path'
      },
      {
        name: 'Windows binaries include .exe extension',
        test: () => mainConfig.win?.binaries?.[0] === 'resources/bin/speakmcp-rs.exe',
        fix: '✅ Windows binaries use .exe extension'
      },
      {
        name: 'Optimized asarUnpack (no full node_modules)',
        test: () => !mainConfig.asarUnpack.includes('node_modules/**'),
        fix: '✅ asarUnpack optimized for native modules only'
      },
      {
        name: 'Proper Linux maintainer information',
        test: () => mainConfig.linux?.maintainer?.includes('SpeakMCP Team'),
        fix: '✅ Linux maintainer properly set'
      },
      {
        name: 'Compression enabled',
        test: () => mainConfig.compression === 'maximum',
        fix: '✅ Maximum compression enabled'
      },
      {
        name: 'Excludes test files and directories',
        test: () => mainConfig.files.some(pattern => pattern.includes('!test') || pattern.includes('!**/__tests__') || pattern.includes('!*.test.') || pattern.includes('!*.spec.')),
        fix: '✅ Test files and directories excluded'
      }
    ];
    
    let allPassed = true;
    
    for (const check of checks) {
      if (check.test()) {
        console.log(check.fix);
      } else {
        console.log(`❌ ${check.name}`);
        allPassed = false;
      }
    }
    
    console.log('\n📊 Configuration structure:');
    console.log(`- Base config: ${path.relative(process.cwd(), require.resolve('./electron-builder-base.cjs'))}`);
    console.log(`- macOS config: ${path.relative(process.cwd(), require.resolve('./electron-builder-mac.cjs'))}`);
    console.log(`- Windows config: ${path.relative(process.cwd(), require.resolve('./electron-builder-win.cjs'))}`);
    console.log(`- Linux config: ${path.relative(process.cwd(), require.resolve('./electron-builder-linux.cjs'))}`);
    
    console.log(`\n📁 Total files excluded: ${mainConfig.files.length}`);
    console.log(`🗜️  AsarUnpack patterns: ${mainConfig.asarUnpack.length}`);
    
    if (allPassed) {
      console.log('\n✅ All configuration validations passed!');
      return true;
    } else {
      console.log('\n❌ Some validations failed. Please check the configuration.');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Configuration validation failed:', error.message);
    return false;
  }
}

// Run validation if called directly
if (require.main === module) {
  validateConfiguration().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { validateConfiguration };