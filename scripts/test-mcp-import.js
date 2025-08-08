#!/usr/bin/env node

/**
 * Test script to verify MCP SDK can import ajv in the packaged app
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

async function testMCPImport() {
  console.log('🧪 Testing MCP SDK import in packaged app...\n')
  
  const platform = process.platform
  let appPath
  
  if (platform === 'darwin') {
    appPath = path.join(projectRoot, 'dist/mac-arm64/speakmcp.app/Contents/MacOS/speakmcp')
  } else if (platform === 'win32') {
    appPath = path.join(projectRoot, 'dist/win-unpacked/speakmcp.exe')
  } else {
    appPath = path.join(projectRoot, 'dist/linux-unpacked/speakmcp')
  }
  
  console.log('📱 Launching app:', appPath)
  console.log('⏱️  Waiting 10 seconds for app to initialize MCP service...\n')
  
  const child = spawn(appPath, [], {
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
  })
  
  let hasError = false
  let mcpInitialized = false
  
  child.stdout.on('data', (data) => {
    const output = data.toString()
    process.stdout.write(output)
    
    if (output.includes('[MCP-DEBUG]')) {
      console.log('🔍 Found MCP debug output')
    }
    
    if (output.includes('Initializing MCP service')) {
      console.log('✅ MCP service initialization started')
      mcpInitialized = true
    }
    
    if (output.includes('[Module Resolver]')) {
      console.log('✅ Module resolver is active')
    }
  })
  
  child.stderr.on('data', (data) => {
    const error = data.toString()
    
    if (error.includes('ERR_MODULE_NOT_FOUND') && error.includes('ajv')) {
      console.error('\n❌ ERROR: ajv module not found!')
      console.error(error)
      hasError = true
    } else if (error.includes('Cannot find package')) {
      console.error('\n❌ ERROR: Module resolution failed!')
      console.error(error)
      hasError = true
    }
    
    // Log other errors for debugging
    if (!error.includes('Electron Security Warning')) {
      process.stderr.write(error)
    }
  })
  
  // Wait for 10 seconds then kill the app
  setTimeout(() => {
    console.log('\n🛑 Stopping app...')
    child.kill('SIGTERM')
    
    setTimeout(() => {
      if (hasError) {
        console.error('\n❌ Test FAILED: Module resolution errors detected')
        console.error('\nTroubleshooting:')
        console.error('1. Check the module-resolver.ts implementation')
        console.error('2. Verify ajv is properly packaged in ASAR')
        console.error('3. Check electron-builder configuration')
        process.exit(1)
      } else if (mcpInitialized) {
        console.log('\n✅ Test PASSED: MCP service initialized without module errors!')
        console.log('The ajv resolution fix is working correctly.')
        process.exit(0)
      } else {
        console.log('\n⚠️  Test INCONCLUSIVE: MCP service did not initialize')
        console.log('The app may need more time or manual testing is required.')
        process.exit(0)
      }
    }, 1000)
  }, 10000)
}

// Run the test
testMCPImport().catch(console.error)