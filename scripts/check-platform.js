#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Platform check script for SpeakMCP build process
 * Validates Node.js version, pnpm, Rust toolchain, and build environment
 */

let hasErrors = false;

function log(message, type = 'info') {
  const prefix = {
    info: '🔍',
    success: '✅', 
    warning: '⚠️',
    error: '❌'
  }[type] || 'ℹ️';
  
  console.log(`${prefix} ${message}`);
  
  if (type === 'error') {
    hasErrors = true;
  }
}

function runCommand(command, silent = false) {
  try {
    return execSync(command, { 
      encoding: 'utf8', 
      stdio: silent ? 'pipe' : 'inherit' 
    }).trim();
  } catch (error) {
    return null;
  }
}

function checkNodeVersion() {
  log('Checking Node.js version...', 'info');
  
  const currentVersion = process.version;
  const nvmrcPath = path.join(__dirname, '..', '.nvmrc');
  
  if (!fs.existsSync(nvmrcPath)) {
    log('No .nvmrc file found', 'warning');
    return;
  }
  
  const expectedVersion = fs.readFileSync(nvmrcPath, 'utf8').trim();
  const currentMajor = parseInt(currentVersion.slice(1).split('.')[0]);
  const expectedMajor = parseInt(expectedVersion.split('.')[0]);
  
  if (currentMajor === expectedMajor) {
    log(`Node.js version ${currentVersion} matches expected major version ${expectedMajor}`, 'success');
  } else {
    log(`Node.js version mismatch. Expected: ${expectedVersion}, Current: ${currentVersion}`, 'error');
    log(`Please switch to Node.js ${expectedVersion} using: nvm use`, 'error');
  }
}

function checkPnpm() {
  log('Checking pnpm installation...', 'info');
  
  const pnpmVersion = runCommand('pnpm --version', true);
  if (!pnpmVersion) {
    log('pnpm is not installed. Please install it with: npm install -g pnpm', 'error');
    return;
  }
  
  log(`pnpm version: ${pnpmVersion}`, 'success');
  
  // Check if pnpm version meets minimum requirement from package.json
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const requiredPnpmVersion = packageJson.engines?.pnpm;
  
  if (requiredPnpmVersion) {
    const minVersion = requiredPnpmVersion.replace('>=', '');
    const currentVersionNum = parseFloat(pnpmVersion);
    const minVersionNum = parseFloat(minVersion);
    
    if (currentVersionNum >= minVersionNum) {
      log(`pnpm version meets requirement: ${requiredPnpmVersion}`, 'success');
    } else {
      log(`pnpm version ${pnpmVersion} does not meet requirement: ${requiredPnpmVersion}`, 'error');
    }
  }
}

function checkRustToolchain() {
  log('Checking Rust toolchain...', 'info');
  
  const rustcVersion = runCommand('rustc --version', true);
  if (!rustcVersion) {
    log('Rust compiler not found. Please install Rust from https://rustup.rs/', 'error');
    return;
  }
  
  log(`Rust compiler: ${rustcVersion}`, 'success');
  
  const cargoVersion = runCommand('cargo --version', true);
  if (!cargoVersion) {
    log('Cargo not found. Please ensure Rust is properly installed', 'error');
    return;
  }
  
  log(`Cargo: ${cargoVersion}`, 'success');
  
  // Check if Cargo.toml exists in speakmcp-rs directory
  const cargoTomlPath = path.join(__dirname, '..', 'speakmcp-rs', 'Cargo.toml');
  if (!fs.existsSync(cargoTomlPath)) {
    log('speakmcp-rs/Cargo.toml not found', 'error');
    return;
  }
  
  log('Rust project structure validated', 'success');
}

function checkBuildTools() {
  log('Checking build tools...', 'info');
  
  // Check if required directories exist
  const requiredDirs = ['src', 'resources', 'scripts'];
  for (const dir of requiredDirs) {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      log(`Required directory missing: ${dir}`, 'error');
    } else {
      log(`Directory found: ${dir}`, 'success');
    }
  }
  
  // Check if modular config files exist
  const configFiles = [
    'build/electron-builder-base.cjs',
    'build/electron-builder-mac.cjs',
    'build/electron-builder-win.cjs',
    'build/electron-builder-linux.cjs'
  ];
  
  for (const configFile of configFiles) {
    const configPath = path.join(__dirname, '..', configFile);
    if (!fs.existsSync(configPath)) {
      log(`Build config missing: ${configFile}`, 'error');
    } else {
      log(`Build config found: ${configFile}`, 'success');
    }
  }
}

function checkEnvironmentVariables() {
  log('Checking environment variables...', 'info');
  
  const platform = os.platform();
  
  if (platform === 'darwin') {
    // Check macOS signing variables
    const macEnvVars = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];
    let hasSigningEnv = true;
    
    for (const envVar of macEnvVars) {
      if (!process.env[envVar]) {
        hasSigningEnv = false;
        break;
      }
    }
    
    if (hasSigningEnv) {
      log('macOS signing environment variables configured', 'success');
    } else {
      log('macOS signing environment variables not all set (APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID)', 'warning');
      log('Code signing may not work without these variables', 'warning');
    }
    
    // Check for certificate
    if (!process.env.CSC_LINK && !process.env.CSC_KEY_PASSWORD) {
      log('Certificate environment variables not set (CSC_LINK, CSC_KEY_PASSWORD)', 'warning');
    } else {
      log('Certificate environment variables configured', 'success');
    }
  }
  
  if (platform === 'win32') {
    // Check Windows signing variables
    if (!process.env.CSC_LINK && !process.env.CSC_KEY_PASSWORD) {
      log('Windows code signing environment variables not set (CSC_LINK, CSC_KEY_PASSWORD)', 'warning');
      log('Code signing may not work without these variables', 'warning');
    } else {
      log('Windows signing environment variables configured', 'success');
    }
  }
}

function checkPlatformSpecific() {
  const platform = os.platform();
  log(`Checking platform-specific requirements for ${platform}...`, 'info');
  
  if (platform === 'darwin') {
    // Check Xcode command line tools
    const xcodeSelect = runCommand('xcode-select -p', true);
    if (xcodeSelect) {
      log('Xcode command line tools installed', 'success');
    } else {
      log('Xcode command line tools not found. Install with: xcode-select --install', 'error');
    }
  }
  
  if (platform === 'win32') {
    // Check for Windows build tools
    const pythonVersion = runCommand('python --version', true);
    if (pythonVersion) {
      log(`Python found: ${pythonVersion}`, 'success');
    } else {
      log('Python not found. Some native modules may need Python to build', 'warning');
    }
  }
  
  if (platform === 'linux') {
    // Check for essential build packages
    const gccVersion = runCommand('gcc --version', true);
    if (gccVersion) {
      log('GCC compiler found', 'success');
    } else {
      log('GCC compiler not found. Install build essentials for your distribution', 'error');
    }
    
    const makeVersion = runCommand('make --version', true);
    if (makeVersion) {
      log('Make utility found', 'success');
    } else {
      log('Make utility not found. Install build essentials for your distribution', 'error');
    }
  }
}

function main() {
  log('Starting platform checks for SpeakMCP build...', 'info');
  console.log();
  
  checkNodeVersion();
  console.log();
  
  checkPnpm();
  console.log();
  
  checkRustToolchain();
  console.log();
  
  checkBuildTools();
  console.log();
  
  checkEnvironmentVariables();
  console.log();
  
  checkPlatformSpecific();
  console.log();
  
  if (hasErrors) {
    log('Platform check failed. Please resolve the errors above before building.', 'error');
    process.exit(1);
  } else {
    log('All platform checks passed! Ready to build SpeakMCP.', 'success');
    process.exit(0);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  checkNodeVersion,
  checkPnpm,
  checkRustToolchain,
  checkBuildTools,
  checkEnvironmentVariables,
  checkPlatformSpecific
};