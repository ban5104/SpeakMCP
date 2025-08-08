#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const binaryPath = path.join(__dirname, 'resources/bin/speakmcp-rs');

console.log('Testing keyboard event capture...');
console.log('Binary path:', binaryPath);
console.log('Press some keys (Ctrl, Alt, etc.) to test. Press Ctrl+C to exit.\n');

const child = spawn(binaryPath, ['listen']);

child.stdout.on('data', (data) => {
  const str = data.toString();
  try {
    const event = JSON.parse(str);
    if (event.event_type === 'KeyPress' || event.event_type === 'KeyRelease') {
      const keyData = JSON.parse(event.data);
      console.log(`[${event.event_type}] Key: ${keyData.key}`);
    }
  } catch (e) {
    console.log('Raw output:', str);
  }
});

child.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});

child.on('error', (error) => {
  console.error('Failed to spawn process:', error);
});

child.on('close', (code) => {
  console.log(`Process exited with code ${code}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  child.kill();
  process.exit(0);
});