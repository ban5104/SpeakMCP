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
    const signScript = path.join('..', 'scripts', 'sign-binary.sh');
    if (fs.existsSync(signScript)) {
      console.log('🔐 Signing Rust binary...');
      execSync('sh ../scripts/sign-binary.sh', { stdio: 'inherit' });
    }
  }
  
} catch (error) {
  console.error('❌ Failed to build Rust binary:', error.message);
  process.exit(1);
}