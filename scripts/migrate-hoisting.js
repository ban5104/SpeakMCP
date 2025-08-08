#!/usr/bin/env node

/**
 * Automated Hoisting Migration Script
 * 
 * This script automates the process of migrating from shamefully-hoist=true
 * to a proper public-hoist-pattern configuration.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { MigrationVerifier } from './verify-hoisting-migration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

class HoistingMigrator {
  constructor() {
    this.configOptions = ['conservative', 'moderate', 'aggressive', 'fallback'];
    this.backupsCreated = false;
  }

  log(message, isError = false) {
    const timestamp = new Date().toISOString();
    const prefix = isError ? '❌' : '✅';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async createBackups() {
    this.log('Creating configuration backups...');
    
    const filesToBackup = [
      { src: '.npmrc', dest: '.npmrc.backup' },
      { src: 'pnpm-lock.yaml', dest: 'pnpm-lock.yaml.backup' }
    ];

    for (const file of filesToBackup) {
      const srcPath = path.join(projectRoot, file.src);
      const destPath = path.join(projectRoot, file.dest);
      
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        this.log(`Backed up ${file.src} to ${file.dest}`);
      } else {
        this.log(`Warning: ${file.src} not found, skipping backup`);
      }
    }
    
    this.backupsCreated = true;
    return true;
  }

  async applyConfiguration(configType = 'conservative') {
    if (!this.configOptions.includes(configType)) {
      throw new Error(`Invalid configuration type: ${configType}. Available options: ${this.configOptions.join(', ')}`);
    }

    const configFile = `.npmrc.${configType}`;
    const configPath = path.join(projectRoot, configFile);
    const targetPath = path.join(projectRoot, '.npmrc');

    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configFile}`);
    }

    this.log(`Applying ${configType} configuration...`);
    fs.copyFileSync(configPath, targetPath);
    this.log(`Configuration applied: ${configFile} -> .npmrc`);

    return true;
  }

  async cleanInstall() {
    this.log('Performing clean install with new configuration...');
    
    try {
      // Remove existing node_modules and lockfile
      const nodeModulesPath = path.join(projectRoot, 'node_modules');
      const lockfilePath = path.join(projectRoot, 'pnpm-lock.yaml');
      
      if (fs.existsSync(nodeModulesPath)) {
        execSync('rm -rf node_modules', { cwd: projectRoot, stdio: 'inherit' });
        this.log('Removed existing node_modules');
      }
      
      if (fs.existsSync(lockfilePath)) {
        fs.unlinkSync(lockfilePath);
        this.log('Removed existing pnpm-lock.yaml');
      }

      // Fresh install
      execSync('pnpm install', { cwd: projectRoot, stdio: 'inherit' });
      this.log('Clean install completed successfully');
      
      return true;
    } catch (error) {
      this.log(`Clean install failed: ${error.message}`, true);
      return false;
    }
  }

  async performMigration(configType = 'conservative', skipVerification = false) {
    console.log('🚀 Starting Hoisting Migration Process\n');
    
    try {
      // Step 1: Create backups
      if (!this.backupsCreated) {
        await this.createBackups();
      }

      // Step 2: Apply configuration
      await this.applyConfiguration(configType);

      // Step 3: Clean install
      const installSuccess = await this.cleanInstall();
      if (!installSuccess) {
        throw new Error('Clean install failed');
      }

      // Step 4: Verification (optional)
      if (!skipVerification) {
        console.log('\n🔍 Running verification...');
        const verifier = new MigrationVerifier();
        const verificationPassed = await verifier.runFullVerification();
        
        if (!verificationPassed) {
          this.log('Verification failed - consider rolling back or trying a different configuration', true);
          return false;
        }
      }

      console.log('\n🎉 Migration completed successfully!');
      console.log(`Applied configuration: ${configType}`);
      console.log('Next steps:');
      console.log('1. Test your application thoroughly');
      console.log('2. Run your test suite');
      console.log('3. Try building and packaging');
      console.log('4. If issues arise, use the rollback scripts');

      return true;

    } catch (error) {
      this.log(`Migration failed: ${error.message}`, true);
      
      if (this.backupsCreated) {
        console.log('\n🔄 To rollback, run:');
        console.log('  ./scripts/rollback-quick.sh');
      }
      
      return false;
    }
  }

  async interactiveMigration() {
    console.log('🎯 Interactive Hoisting Migration\n');
    console.log('Available configuration options:');
    console.log('1. conservative - Maximum compatibility (recommended for first migration)');
    console.log('2. moderate - Balanced approach');
    console.log('3. aggressive - Minimal hoisting for strict isolation');
    console.log('4. fallback - Emergency fallback with legacy-style behavior\n');

    // Since we can't use readline in this environment, we'll default to conservative
    const selectedConfig = 'conservative';
    console.log(`Using default configuration: ${selectedConfig}\n`);

    return await this.performMigration(selectedConfig);
  }
}

// CLI handling
if (import.meta.url === `file://${process.argv[1]}`) {
  const migrator = new HoistingMigrator();
  const args = process.argv.slice(2);
  
  const configType = args[0] || 'conservative';
  const skipVerification = args.includes('--skip-verification');

  if (args.includes('--interactive')) {
    migrator.interactiveMigration()
      .then(success => process.exit(success ? 0 : 1))
      .catch(error => {
        console.error('Migration failed:', error);
        process.exit(1);
      });
  } else {
    migrator.performMigration(configType, skipVerification)
      .then(success => process.exit(success ? 0 : 1))
      .catch(error => {
        console.error('Migration failed:', error);
        process.exit(1);
      });
  }
}

export { HoistingMigrator };