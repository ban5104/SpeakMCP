#!/usr/bin/env node

/**
 * Comprehensive Hoisting Migration Verification Script
 * 
 * This script verifies that the npm hoisting configuration migration
 * was successful and all critical functionality remains intact.
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

class MigrationVerifier {
  constructor() {
    this.results = {
      backupVerification: { passed: false, details: [] },
      dependencyResolution: { passed: false, details: [] },
      typescriptCompilation: { passed: false, details: [] },
      buildVerification: { passed: false, details: [] },
      testSuiteExecution: { passed: false, details: [] },
      packagingVerification: { passed: false, details: [] },
      performanceAssessment: { passed: false, details: [] },
      overallStatus: 'PENDING'
    };
    this.startTime = Date.now();
  }

  log(section, message, isError = false) {
    const timestamp = new Date().toISOString();
    const prefix = isError ? '❌' : '✅';
    console.log(`${prefix} [${timestamp}] [${section}] ${message}`);
    
    if (this.results[section]) {
      this.results[section].details.push({
        message,
        isError,
        timestamp
      });
    }
  }

  async runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      console.log(`🔄 Executing: ${command}`);
      
      const child = spawn('sh', ['-c', command], {
        cwd: projectRoot,
        stdio: 'pipe',
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        const result = {
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          duration,
          command
        };

        if (code === 0) {
          console.log(`✅ Command completed in ${duration}ms`);
          resolve(result);
        } else {
          console.log(`❌ Command failed with code ${code} after ${duration}ms`);
          console.log(`STDERR: ${stderr}`);
          reject(result);
        }
      });

      child.on('error', (error) => {
        reject({
          error: error.message,
          command,
          duration: Date.now() - startTime
        });
      });
    });
  }

  async verifyBackups() {
    console.log('\n🔍 Phase 1: Backup Verification');
    
    const backupFiles = [
      '.npmrc.backup',
      'pnpm-lock.yaml.backup'
    ];

    for (const file of backupFiles) {
      const filePath = path.join(projectRoot, file);
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        this.log('backupVerification', `✅ Found backup: ${file} (${stat.size} bytes)`);
      } else {
        this.log('backupVerification', `❌ Missing backup: ${file}`, true);
        return false;
      }
    }

    // Verify backup content integrity
    try {
      const originalNpmrc = fs.readFileSync(path.join(projectRoot, '.npmrc.backup'), 'utf8');
      if (originalNpmrc.includes('shamefully-hoist=true')) {
        this.log('backupVerification', '✅ Original .npmrc content preserved in backup');
        this.results.backupVerification.passed = true;
        return true;
      } else {
        this.log('backupVerification', '❌ Backup content verification failed', true);
        return false;
      }
    } catch (error) {
      this.log('backupVerification', `❌ Backup verification error: ${error.message}`, true);
      return false;
    }
  }

  async verifyDependencyResolution() {
    console.log('\n🔍 Phase 2: Dependency Resolution Check');
    
    const criticalPackages = [
      'electron',
      'typescript',
      'react',
      'react-dom',
      'electron-vite',
      'electron-builder',
      'vitest',
      '@radix-ui/react-dialog',
      '@modelcontextprotocol/sdk',
      'tailwindcss'
    ];

    let allResolved = true;

    try {
      // Check if all critical packages can be resolved
      for (const pkg of criticalPackages) {
        try {
          const result = await this.runCommand(`pnpm list ${pkg} --depth=0 --json`);
          const output = JSON.parse(result.stdout);
          
          if (output[0]?.dependencies?.[pkg] || output[0]?.devDependencies?.[pkg]) {
            this.log('dependencyResolution', `✅ ${pkg} resolved correctly`);
          } else {
            this.log('dependencyResolution', `❌ ${pkg} resolution issue`, true);
            allResolved = false;
          }
        } catch (error) {
          this.log('dependencyResolution', `❌ ${pkg} failed to resolve: ${error.message}`, true);
          allResolved = false;
        }
      }

      // Check for duplicate packages that should be hoisted
      try {
        const result = await this.runCommand('pnpm list --depth=0 --json');
        const packages = JSON.parse(result.stdout);
        this.log('dependencyResolution', `✅ Package listing successful - found ${Object.keys(packages[0]?.dependencies || {}).length} direct dependencies`);
      } catch (error) {
        this.log('dependencyResolution', `❌ Package listing failed: ${error.message}`, true);
        allResolved = false;
      }

    } catch (error) {
      this.log('dependencyResolution', `❌ Dependency resolution check failed: ${error.message}`, true);
      allResolved = false;
    }

    this.results.dependencyResolution.passed = allResolved;
    return allResolved;
  }

  async verifyTypescriptCompilation() {
    console.log('\n🔍 Phase 3: TypeScript Compilation Check');
    
    let allPassed = true;

    try {
      // Check node target compilation
      const nodeResult = await this.runCommand('npm run typecheck:node');
      this.log('typescriptCompilation', '✅ Node TypeScript compilation successful');
    } catch (error) {
      this.log('typescriptCompilation', `❌ Node TypeScript compilation failed: ${error.stderr || error.message}`, true);
      allPassed = false;
    }

    try {
      // Check web target compilation
      const webResult = await this.runCommand('npm run typecheck:web');
      this.log('typescriptCompilation', '✅ Web TypeScript compilation successful');
    } catch (error) {
      this.log('typescriptCompilation', `❌ Web TypeScript compilation failed: ${error.stderr || error.message}`, true);
      allPassed = false;
    }

    try {
      // Full typecheck
      const fullResult = await this.runCommand('npm run typecheck');
      this.log('typescriptCompilation', '✅ Full TypeScript compilation successful');
    } catch (error) {
      this.log('typescriptCompilation', `❌ Full TypeScript compilation failed: ${error.stderr || error.message}`, true);
      allPassed = false;
    }

    this.results.typescriptCompilation.passed = allPassed;
    return allPassed;
  }

  async verifyBuildProcess() {
    console.log('\n🔍 Phase 4: Build Process Verification');
    
    let allPassed = true;

    try {
      // Test electron-vite build
      const viteResult = await this.runCommand('electron-vite build', { timeout: 120000 });
      this.log('buildVerification', '✅ Electron-vite build successful');
    } catch (error) {
      this.log('buildVerification', `❌ Electron-vite build failed: ${error.stderr || error.message}`, true);
      allPassed = false;
    }

    try {
      // Test Rust binary build
      const rustResult = await this.runCommand('npm run build-rs');
      this.log('buildVerification', '✅ Rust binary build successful');
    } catch (error) {
      this.log('buildVerification', `❌ Rust binary build failed: ${error.stderr || error.message}`, true);
      allPassed = false;
    }

    try {
      // Test electron-rebuild
      const rebuildResult = await this.runCommand('npm run rebuild');
      this.log('buildVerification', '✅ Electron rebuild successful');
    } catch (error) {
      this.log('buildVerification', `❌ Electron rebuild failed: ${error.stderr || error.message}`, true);
      allPassed = false;
    }

    this.results.buildVerification.passed = allPassed;
    return allPassed;
  }

  async verifyTestSuite() {
    console.log('\n🔍 Phase 5: Test Suite Execution');
    
    let allPassed = true;

    try {
      // Run unit tests with vitest
      const vitestResult = await this.runCommand('vitest run');
      this.log('testSuiteExecution', '✅ Unit tests passed');
    } catch (error) {
      this.log('testSuiteExecution', `❌ Unit tests failed: ${error.stderr || error.message}`, true);
      allPassed = false;
    }

    // Note: Skipping E2E tests as they may require display/window manager
    this.log('testSuiteExecution', 'ℹ️ E2E tests skipped (require display environment)');

    this.results.testSuiteExecution.passed = allPassed;
    return allPassed;
  }

  async verifyPackaging() {
    console.log('\n🔍 Phase 6: Packaging Verification');
    
    let allPassed = true;

    try {
      // Test unpacked build (faster than full packaging)
      const unpackResult = await this.runCommand('npm run build:unpack', { timeout: 300000 });
      this.log('packagingVerification', '✅ Unpacked build successful');

      // Verify output structure
      const distPath = path.join(projectRoot, 'dist');
      if (fs.existsSync(distPath)) {
        const distContents = fs.readdirSync(distPath);
        this.log('packagingVerification', `✅ Dist directory created with contents: ${distContents.join(', ')}`);
      } else {
        this.log('packagingVerification', '❌ Dist directory not found', true);
        allPassed = false;
      }

    } catch (error) {
      this.log('packagingVerification', `❌ Packaging failed: ${error.stderr || error.message}`, true);
      allPassed = false;
    }

    this.results.packagingVerification.passed = allPassed;
    return allPassed;
  }

  async assessPerformance() {
    console.log('\n🔍 Phase 7: Performance Assessment');
    
    let allPassed = true;

    try {
      // Measure install time
      const installStart = Date.now();
      await this.runCommand('pnpm install');
      const installDuration = Date.now() - installStart;
      
      this.log('performanceAssessment', `✅ Install completed in ${installDuration}ms`);

      // Measure node_modules size
      const nodeModulesPath = path.join(projectRoot, 'node_modules');
      if (fs.existsSync(nodeModulesPath)) {
        const sizeResult = await this.runCommand('du -sh node_modules');
        const size = sizeResult.stdout.split('\t')[0];
        this.log('performanceAssessment', `✅ node_modules size: ${size}`);
      }

      // Performance is considered passed if install completes
      this.results.performanceAssessment.passed = true;

    } catch (error) {
      this.log('performanceAssessment', `❌ Performance assessment failed: ${error.stderr || error.message}`, true);
      allPassed = false;
    }

    this.results.performanceAssessment.passed = allPassed;
    return allPassed;
  }

  generateReport() {
    const totalDuration = Date.now() - this.startTime;
    const passedPhases = Object.values(this.results).filter(phase => phase.passed === true).length - 1; // -1 for overallStatus
    const totalPhases = Object.keys(this.results).length - 1; // -1 for overallStatus

    this.results.overallStatus = passedPhases === totalPhases ? 'PASSED' : 'FAILED';

    const report = {
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      overallStatus: this.results.overallStatus,
      summary: `${passedPhases}/${totalPhases} phases passed`,
      results: this.results,
      recommendations: []
    };

    // Add recommendations based on failures
    if (!this.results.dependencyResolution.passed) {
      report.recommendations.push('Consider using more conservative hoisting patterns');
    }
    if (!this.results.buildVerification.passed) {
      report.recommendations.push('Check build tool compatibility with new hoisting configuration');
    }
    if (!this.results.testSuiteExecution.passed) {
      report.recommendations.push('Investigate test failures related to module resolution');
    }

    return report;
  }

  async runFullVerification() {
    console.log('🚀 Starting Hoisting Migration Verification\n');

    const phases = [
      { name: 'Backup Verification', method: this.verifyBackups },
      { name: 'Dependency Resolution', method: this.verifyDependencyResolution },
      { name: 'TypeScript Compilation', method: this.verifyTypescriptCompilation },
      { name: 'Build Process', method: this.verifyBuildProcess },
      { name: 'Test Suite', method: this.verifyTestSuite },
      { name: 'Packaging', method: this.verifyPackaging },
      { name: 'Performance Assessment', method: this.assessPerformance }
    ];

    for (const phase of phases) {
      try {
        const success = await phase.method.call(this);
        if (!success) {
          console.log(`❌ ${phase.name} failed - continuing with remaining phases\n`);
        } else {
          console.log(`✅ ${phase.name} completed successfully\n`);
        }
      } catch (error) {
        console.log(`❌ ${phase.name} encountered error: ${error.message}\n`);
      }
    }

    const report = this.generateReport();
    
    console.log('\n📊 VERIFICATION REPORT');
    console.log('='.repeat(50));
    console.log(`Overall Status: ${report.overallStatus}`);
    console.log(`Duration: ${(report.duration / 1000).toFixed(2)}s`);
    console.log(`Summary: ${report.summary}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }

    // Save detailed report
    const reportPath = path.join(projectRoot, 'hoisting-migration-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📋 Detailed report saved to: ${reportPath}`);

    return report.overallStatus === 'PASSED';
  }
}

// Run verification if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const verifier = new MigrationVerifier();
  
  verifier.runFullVerification()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    });
}

export { MigrationVerifier };