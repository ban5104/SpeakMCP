#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure resources/bin directory exists
const binDir = path.join(__dirname, '..', 'resources', 'bin');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

// Change to speakmcp-rs directory
const rustDir = path.join(__dirname, '..', 'speakmcp-rs');
process.chdir(rustDir);

console.log('Building Rust binary...');

try {
  // Check if cargo is available
  try {
    execSync('cargo --version', { stdio: 'pipe' });
  } catch (cargoError) {
    console.log('⚠️  Cargo not found, skipping Rust binary build');
    console.log('💡 Install Rust toolchain to enable full functionality');
    process.exit(0);
  }

  // Build the Rust binary in release mode
  execSync('cargo build --release', { stdio: 'inherit' });
  
  // Determine the binary name based on platform
  const binaryName = process.platform === 'win32' ? 'speakmcp-rs.exe' : 'speakmcp-rs';
  const sourcePath = path.join('target', 'release', binaryName);
  const targetPath = path.join('..', 'resources', 'bin', binaryName);
  
  // Copy the binary to resources/bin
  fs.copyFileSync(sourcePath, targetPath);
  
  console.log(`✅ Rust binary built and copied to resources/bin/${binaryName}`);
  
  // On macOS, run the signing script if it exists
  if (process.platform === 'darwin') {
    const projectRoot = path.join(__dirname, '..');
    const signScript = path.join(projectRoot, 'scripts', 'sign-binary.sh');
    if (fs.existsSync(signScript)) {
      console.log('🔐 Signing Rust binary...');
      // Change back to project root for signing
      process.chdir(projectRoot);
      execSync('bash scripts/sign-binary.sh', { stdio: 'inherit' });
    }
  }
  
} catch (error) {
  console.error('❌ Failed to build Rust binary:', error.message);
  process.exit(1);
}