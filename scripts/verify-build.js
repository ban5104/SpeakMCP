#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

function verifyBuild() {
  console.log('🔍 Verifying build integrity...\n')
  
  // Determine app path based on platform
  const platform = process.platform
  let appPath, unpackedPath
  
  if (platform === 'darwin') {
    appPath = path.join(projectRoot, 'dist/mac-arm64/speakmcp.app/Contents/Resources/app.asar')
    unpackedPath = path.join(projectRoot, 'dist/mac-arm64/speakmcp.app/Contents/Resources/app.asar.unpacked')
  } else if (platform === 'win32') {
    appPath = path.join(projectRoot, 'dist/win-unpacked/resources/app.asar')
    unpackedPath = path.join(projectRoot, 'dist/win-unpacked/resources/app.asar.unpacked')
  } else {
    appPath = path.join(projectRoot, 'dist/linux-unpacked/resources/app.asar')
    unpackedPath = path.join(projectRoot, 'dist/linux-unpacked/resources/app.asar.unpacked')
  }
  
  // Check if ASAR exists
  if (!fs.existsSync(appPath)) {
    console.error('❌ ASAR not found at', appPath)
    console.error('   Please run "pnpm build:unpack" first')
    process.exit(1)
  }
  
  console.log('📦 Found ASAR archive at:', appPath)
  
  // Check if unpacked folder exists (for asarUnpack modules)
  if (fs.existsSync(unpackedPath)) {
    console.log('📂 Found unpacked modules at:', unpackedPath)
    
    // Check for ajv in unpacked
    const ajvUnpacked = path.join(unpackedPath, 'node_modules/ajv')
    if (fs.existsSync(ajvUnpacked)) {
      console.log('✅ ajv is unpacked (asarUnpack working)')
    }
    
    // Check for MCP SDK in unpacked
    const mcpUnpacked = path.join(unpackedPath, 'node_modules/@modelcontextprotocol')
    if (fs.existsSync(mcpUnpacked)) {
      console.log('✅ @modelcontextprotocol is unpacked (asarUnpack working)')
    }
  }
  
  // List critical modules in ASAR
  console.log('\n📋 Checking critical modules in ASAR...')
  
  let asarContents
  try {
    asarContents = execSync(`npx asar list "${appPath}"`, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr warnings
    })
  } catch (error) {
    console.error('❌ Failed to list ASAR contents')
    process.exit(1)
  }
  
  let allFound = true
  
  const requiredModules = [
    { path: '/node_modules/ajv/package.json', name: 'ajv package.json' },
    { path: '/node_modules/ajv/lib/ajv.js', name: 'ajv main file' },
    { path: '/node_modules/@modelcontextprotocol/sdk/package.json', name: 'MCP SDK package.json' },
    { path: '/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js', name: 'MCP SDK client' },
  ]
  
  // Check if module resolver is bundled in main index.js
  const mainIndexPath = '/out/main/index.js'
  if (asarContents.includes(mainIndexPath)) {
    console.log('✅ Found: Main bundle (includes module resolver)')
  } else {
    console.error('❌ Missing: Main bundle')
    allFound = false
  }
  for (const module of requiredModules) {
    if (asarContents.includes(module.path)) {
      console.log(`✅ Found: ${module.name}`)
    } else {
      // Check if it's in unpacked instead
      const unpackedModulePath = path.join(unpackedPath, module.path)
      if (fs.existsSync(unpackedModulePath)) {
        console.log(`✅ Found (unpacked): ${module.name}`)
      } else {
        console.error(`❌ Missing: ${module.name}`)
        allFound = false
      }
    }
  }
  
  // Check file sizes to ensure modules are complete
  console.log('\n📏 Checking module integrity...')
  
  if (fs.existsSync(unpackedPath)) {
    const ajvPath = path.join(unpackedPath, 'node_modules/ajv/lib/ajv.js')
    if (fs.existsSync(ajvPath)) {
      const stats = fs.statSync(ajvPath)
      if (stats.size > 1000) {
        console.log(`✅ ajv main file size OK (${stats.size} bytes)`)
      } else {
        console.error(`❌ ajv main file seems corrupted (${stats.size} bytes)`)
        allFound = false
      }
    }
  }
  
  if (allFound) {
    console.log('\n✅ Build verification passed! All critical modules are present.')
    console.log('\n🚀 You can now test the packaged app:')
    if (platform === 'darwin') {
      console.log('   codesign --force --deep --sign - dist/mac-arm64/speakmcp.app')
      console.log('   open dist/mac-arm64/speakmcp.app')
    } else if (platform === 'win32') {
      console.log('   .\\dist\\win-unpacked\\speakmcp.exe')
    }
  } else {
    console.error('\n❌ Build verification failed! Some modules are missing.')
    console.error('\nTroubleshooting steps:')
    console.error('1. Run "pnpm install" to ensure all dependencies are installed')
    console.error('2. Run "pnpm build:unpack" to rebuild the app')
    console.error('3. Check the build logs for any errors')
    process.exit(1)
  }
}

// Run verification
verifyBuild()