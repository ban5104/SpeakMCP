# Architecture Solution: AJV Module Resolution in Packaged Electron App

## Root Cause Analysis

### The Problem
The packaged Electron app fails with:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'ajv' imported from 
.../app.asar/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js
```

### Why This Happens

1. **ESM Import Resolution in ASAR**: 
   - `@modelcontextprotocol/sdk` uses ESM syntax: `import Ajv from "ajv"`
   - Node.js ESM loader cannot resolve bare module specifiers from within ASAR archives
   - The ASAR filesystem abstraction doesn't fully support ESM module resolution algorithm

2. **pnpm Symlinking Structure**:
   - pnpm creates symlinks: `node_modules/ajv` → `.pnpm/ajv@6.12.6/node_modules/ajv`
   - During packaging, electron-builder follows symlinks and includes the actual files
   - However, the ESM resolver in production doesn't handle this correctly within ASAR

3. **Hoisting Configuration**:
   - While `ajv` is hoisted to root `node_modules/`, the ESM resolution still fails
   - The issue isn't about missing files but about module resolution mechanics

## Solution Architecture

### Primary Solution: Patch ESM Module Resolution

Create a custom module loader patch that helps Node.js resolve modules within ASAR archives.

```
┌─────────────────────────────────────────────────────┐
│                  Electron Main Process               │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐   │
│  │         Module Resolution Patch              │   │
│  │  - Intercepts ESM import failures            │   │
│  │  - Maps bare specifiers to ASAR paths       │   │
│  └─────────────────────────────────────────────┘   │
│                        ↓                            │
│  ┌─────────────────────────────────────────────┐   │
│  │        @modelcontextprotocol/sdk            │   │
│  │         import Ajv from "ajv"                │   │
│  └─────────────────────────────────────────────┘   │
│                        ↓                            │
│  ┌─────────────────────────────────────────────┐   │
│  │              ASAR Archive                    │   │
│  │  /node_modules/ajv/... ✓                    │   │
│  │  /node_modules/@modelcontextprotocol/... ✓  │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Implementation Strategy

## Step 1: Create Module Resolution Patch

**File: `/Users/ben/projects/SpeakMCP/src/main/module-resolver.ts`**

```typescript
import { app } from 'electron'
import Module from 'module'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

export function patchModuleResolution(): void {
  // Only patch in production when running from ASAR
  if (!app.isPackaged) {
    return
  }

  const originalResolveFilename = Module._resolveFilename
  
  Module._resolveFilename = function (request: string, parent: any, isMain: boolean) {
    // Handle ajv and other problematic modules
    if (request === 'ajv' || request.startsWith('ajv/')) {
      try {
        // Try to resolve from app.asar root
        const asarPath = path.join(process.resourcesPath, 'app.asar', 'node_modules', request)
        return asarPath
      } catch (e) {
        // Fall back to original resolution
      }
    }
    
    try {
      return originalResolveFilename.call(this, request, parent, isMain)
    } catch (error: any) {
      // If module not found and we're in ASAR, try alternative resolution
      if (error.code === 'MODULE_NOT_FOUND' && parent?.filename?.includes('app.asar')) {
        const alternatives = [
          path.join(process.resourcesPath, 'app.asar', 'node_modules', request),
          path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', request),
        ]
        
        for (const altPath of alternatives) {
          try {
            require.resolve(altPath)
            return altPath
          } catch {
            // Continue to next alternative
          }
        }
      }
      throw error
    }
  }
}
```

## Step 2: Update Main Process Entry

**Modify: `/Users/ben/projects/SpeakMCP/src/main/index.ts`**

Add at the very beginning (before any imports that might use MCP SDK):

```typescript
import { patchModuleResolution } from './module-resolver'
patchModuleResolution()

// Rest of imports...
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
```

## Step 3: Alternative - Unpack Critical Dependencies

**Modify: `/Users/ben/projects/SpeakMCP/electron-builder.config.cjs`**

```javascript
module.exports = {
  // ... existing config ...
  
  // Unpack modules that have ESM resolution issues
  asarUnpack: [
    "node_modules/ajv/**/*",
    "node_modules/@modelcontextprotocol/**/*"
  ],
  
  // ... rest of config
}
```

## Step 4: Fallback - Bundle Dependencies

If the above solutions don't work, bundle the problematic dependencies:

**Create: `/Users/ben/projects/SpeakMCP/scripts/bundle-deps.js`**

```javascript
import { build } from 'esbuild'
import path from 'path'

async function bundleDependencies() {
  await build({
    entryPoints: ['node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    outfile: 'out/bundled/mcp-client.js',
    external: ['electron', 'child_process', 'fs', 'path', 'os', 'crypto', 'util'],
    treeShaking: true,
  })
}

bundleDependencies()
```

## Step 5: Verification Strategy

### Build Verification Script

**Create: `/Users/ben/projects/SpeakMCP/scripts/verify-build.js`**

```javascript
#!/usr/bin/env node
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

function verifyBuild() {
  console.log('🔍 Verifying build integrity...')
  
  const appPath = process.platform === 'darwin' 
    ? 'dist/mac-arm64/speakmcp.app/Contents/Resources/app.asar'
    : 'dist/win-unpacked/resources/app.asar'
  
  // Check if ASAR exists
  if (!fs.existsSync(appPath)) {
    console.error('❌ ASAR not found at', appPath)
    process.exit(1)
  }
  
  // List critical modules in ASAR
  const asarContents = execSync(`npx asar list "${appPath}"`, { encoding: 'utf8' })
  
  const requiredModules = [
    '/node_modules/ajv/package.json',
    '/node_modules/ajv/lib/ajv.js',
    '/node_modules/@modelcontextprotocol/sdk/package.json',
    '/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js'
  ]
  
  for (const module of requiredModules) {
    if (!asarContents.includes(module)) {
      console.error(`❌ Missing required module: ${module}`)
      process.exit(1)
    }
    console.log(`✅ Found: ${module}`)
  }
  
  console.log('✅ Build verification passed!')
}

verifyBuild()
```

## Step 6: Update Package Scripts

**Modify: `/Users/ben/projects/SpeakMCP/package.json`**

```json
{
  "scripts": {
    // ... existing scripts ...
    "verify-build": "node scripts/verify-build.js",
    "build:unpack": "npm run build && electron-builder --dir && npm run copy-resources-mac && npm run verify-build",
    // ... rest
  }
}
```

## Long-term Maintenance Considerations

### 1. Dependency Management
- **Explicit Dependencies**: Add critical transitive dependencies as direct dependencies
- **Version Pinning**: Pin versions to avoid breaking changes
- **Regular Audits**: Check for ESM compatibility in new dependencies

### 2. Build Pipeline
- **CI Verification**: Add build verification to CI/CD pipeline
- **Module Testing**: Test module resolution in packaged app during CI
- **Platform Testing**: Verify on all target platforms

### 3. Migration Path
- **Consider Bundling**: For production, consider bundling all dependencies with esbuild/webpack
- **ESM to CJS**: If issues persist, consider transpiling ESM modules to CommonJS
- **Electron Forge**: Consider migrating to Electron Forge which handles these issues better

## Immediate Action Plan

1. **Quick Fix** (5 minutes):
   - Add `asarUnpack` configuration for immediate relief
   
2. **Proper Fix** (30 minutes):
   - Implement module resolution patch
   - Test with unpacked build
   - Verify with packaged app

3. **Verification** (10 minutes):
   - Run verification script
   - Test MCP functionality
   - Check other dependencies

## Risk Assessment

### Low Risk
- ✅ asarUnpack solution - well-tested, increases app size slightly
- ✅ Module resolution patch - isolated change, only affects production

### Medium Risk
- ⚠️ Bundling dependencies - may cause issues with native modules
- ⚠️ Direct dependency addition - increases maintenance burden

### High Risk
- ❌ Switching to shamefully-hoist - defeats purpose of migration
- ❌ Disabling ASAR packaging - security and performance implications

## Recommended Solution

**Primary Approach**: Implement the module resolution patch (Step 1-2)
**Fallback**: Use asarUnpack for problematic modules (Step 3)
**Long-term**: Consider bundling strategy for production builds

This solution maintains the benefits of selective hoisting while ensuring reliable module resolution in production.