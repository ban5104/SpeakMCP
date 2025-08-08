import { app } from 'electron'
import Module from 'module'
import path from 'path'
import { pathToFileURL } from 'url'
import { promises as fs } from 'fs'

// Comprehensive list of modules that have ESM resolution issues in ASAR
const PROBLEMATIC_MODULES = [
  // Core ESM modules that commonly cause issues
  'ajv', 'ajv-keywords', 'ajv-formats', 'json-schema-traverse', 'require-from-string',
  'fast-deep-equal', 'json-schema-ref-parser',
  
  // Process spawning modules
  'cross-spawn', 'path-key', 'shebang-command', 'shebang-regex', 'which', 'isexe',
  
  // HTTP and networking modules
  'content-type', 'cors', 'eventsource', 'eventsource-parser', 'express', 
  'express-rate-limit', 'raw-body',
  
  // Validation and schema modules
  'zod', 'zod-to-json-schema', 'pkce-challenge',
  
  // Utility modules
  'semver', 'uuid', 'chalk', 'debug', 'ms',
  
  // MCP-specific modules
  '@modelcontextprotocol/sdk', '@modelcontextprotocol/types'
]

let isPatched = false
let resolveStats = {
  totalAttempts: 0,
  successfulPatches: 0,
  fallbackUsed: 0,
  errors: 0
}

/**
 * Check if a path exists without throwing
 */
async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Get all possible resolution paths for a module
 */
function getResolutionPaths(request: string, resourcesPath: string): string[] {
  const basePaths = [
    path.join(resourcesPath, 'app.asar', 'node_modules'),
    path.join(resourcesPath, 'app.asar.unpacked', 'node_modules'),
    path.join(resourcesPath, 'node_modules'),
    // Additional common Node.js paths
    path.join(process.cwd(), 'node_modules'),
    path.join(path.dirname(process.execPath), '..', 'node_modules')
  ]
  
  const possiblePaths: string[] = []
  
  for (const basePath of basePaths) {
    // Direct module path
    possiblePaths.push(path.join(basePath, request))
    
    // Common entry points
    const commonEntries = ['index.js', 'main.js', 'lib/index.js', 'dist/index.js', 'build/index.js']
    for (const entry of commonEntries) {
      possiblePaths.push(path.join(basePath, request, entry))
    }
    
    // Package.json main field resolution
    possiblePaths.push(path.join(basePath, request, 'package.json'))
  }
  
  return possiblePaths
}

/**
 * Try to resolve a module from package.json main field
 */
async function resolveFromPackageJson(packageJsonPath: string): Promise<string | null> {
  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
    const moduleDir = path.dirname(packageJsonPath)
    
    // Try different main field candidates
    const mainFields = ['main', 'module', 'exports', 'browser']
    
    for (const field of mainFields) {
      if (packageJson[field]) {
        let mainPath: string
        
        if (typeof packageJson[field] === 'string') {
          mainPath = path.resolve(moduleDir, packageJson[field])
        } else if (typeof packageJson[field] === 'object') {
          // Handle exports field
          if (packageJson[field]['.']) {
            mainPath = path.resolve(moduleDir, packageJson[field]['.'])
          } else if (packageJson[field]['import']) {
            mainPath = path.resolve(moduleDir, packageJson[field]['import'])
          } else if (packageJson[field]['require']) {
            mainPath = path.resolve(moduleDir, packageJson[field]['require'])
          } else {
            continue
          }
        } else {
          continue
        }
        
        if (await pathExists(mainPath)) {
          return mainPath
        }
        
        // Try with .js extension
        if (await pathExists(mainPath + '.js')) {
          return mainPath + '.js'
        }
      }
    }
    
    // Fallback to index.js
    const indexPath = path.join(moduleDir, 'index.js')
    if (await pathExists(indexPath)) {
      return indexPath
    }
    
  } catch (error) {
    // Package.json parsing failed
    return null
  }
  
  return null
}

/**
 * Enhanced module resolution for ASAR environments
 */
async function enhancedResolve(request: string, _parent: any): Promise<string | null> {
  if (!process.resourcesPath) {
    return null
  }
  
  console.log(`[Module Resolver] Attempting enhanced resolution for ${request}`)
  resolveStats.totalAttempts++
  
  const possiblePaths = getResolutionPaths(request, process.resourcesPath)
  
  for (const candidatePath of possiblePaths) {
    try {
      // Check if it's a package.json file
      if (candidatePath.endsWith('package.json')) {
        const resolved = await resolveFromPackageJson(candidatePath)
        if (resolved) {
          console.log(`[Module Resolver] Resolved ${request} via package.json: ${resolved}`)
          resolveStats.successfulPatches++
          return resolved
        }
        continue
      }
      
      // Check if the path exists
      if (await pathExists(candidatePath)) {
        // Try to require.resolve it to make sure it's valid
        try {
          const resolved = require.resolve(candidatePath)
          console.log(`[Module Resolver] Enhanced resolution: ${request} -> ${resolved}`)
          resolveStats.successfulPatches++
          return resolved
        } catch (e) {
          // Path exists but require.resolve failed, try next
          continue
        }
      }
    } catch (error) {
      // Continue to next candidate
      continue
    }
  }
  
  console.warn(`[Module Resolver] Enhanced resolution failed for ${request}`)
  resolveStats.errors++
  return null
}

/**
 * Patches Node.js module resolution to handle ESM imports from within ASAR archives.
 * This is a comprehensive patch that handles various edge cases and provides multiple
 * fallback strategies for module resolution in packaged Electron applications.
 */
export function patchModuleResolution(): void {
  // Only patch once and only in production
  if (isPatched) {
    console.log('[Module Resolver] Module resolution already patched')
    return
  }
  
  if (!app.isPackaged) {
    console.log('[Module Resolver] Skipping patch - not running from packaged app')
    return
  }

  console.log('[Module Resolver] Applying comprehensive module resolution patch for ASAR compatibility')

  // Cast to any to access private Node.js internals
  const ModulePrototype = Module as any
  const originalResolveFilename = ModulePrototype._resolveFilename

  ModulePrototype._resolveFilename = function (
    request: string,
    parent: any,
    isMain: boolean,
    options?: any
  ) {
    // Check if this is a problematic module being imported from within ASAR
    const isProblematicModule = PROBLEMATIC_MODULES.some(mod => 
      request === mod || request.startsWith(mod + '/') || request.startsWith('@' + mod + '/')
    )
    
    const isFromASAR = parent?.filename?.includes('app.asar')
    
    if (isProblematicModule && isFromASAR) {
      console.log(`[Module Resolver] Intercepting problematic module resolution: ${request}`)
      
      // Try enhanced async resolution (but we need to make it sync for this context)
      // We'll use a synchronous version for the require.resolve context
      const syncEnhancedResolve = (req: string): string | null => {
        if (!process.resourcesPath) return null
        
        const possiblePaths = getResolutionPaths(req, process.resourcesPath)
        
        for (const candidatePath of possiblePaths) {
          try {
            // For sync version, we can't use async fs.access, so we try require.resolve directly
            if (!candidatePath.endsWith('package.json')) {
              const resolved = require.resolve(candidatePath)
              console.log(`[Module Resolver] Sync resolution: ${req} -> ${resolved}`)
              resolveStats.successfulPatches++
              return resolved
            }
          } catch (e) {
            continue
          }
        }
        
        return null
      }
      
      const enhanced = syncEnhancedResolve(request)
      if (enhanced) {
        return enhanced
      }
    }

    // Try original resolution first
    try {
      return originalResolveFilename.call(this, request, parent, isMain, options)
    } catch (error: any) {
      // If module not found and we're in ASAR, try fallback strategies
      if (error.code === 'MODULE_NOT_FOUND' && isFromASAR) {
        console.log(`[Module Resolver] Original resolution failed for ${request} from ${parent?.filename}`)
        
        // Try comprehensive fallback resolution
        if (!process.resourcesPath) {
          throw error
        }
        
        const fallbackPaths = [
          // Try ASAR packed location
          path.join(process.resourcesPath, 'app.asar', 'node_modules', request),
          // Try unpacked location
          path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', request),
          // Try direct resources location
          path.join(process.resourcesPath, 'node_modules', request),
          // Try current working directory
          path.join(process.cwd(), 'node_modules', request),
          // Try executable directory
          path.join(path.dirname(process.execPath), '..', 'node_modules', request)
        ]

        for (const fallbackPath of fallbackPaths) {
          try {
            const resolved = require.resolve(fallbackPath)
            console.log(`[Module Resolver] Fallback resolution: ${request} -> ${resolved}`)
            resolveStats.fallbackUsed++
            return resolved
          } catch {
            continue
          }
        }

        // Try with common file extensions
        const extensions = ['.js', '.json', '.node', '/index.js', '/main.js']
        for (const fallbackPath of fallbackPaths) {
          for (const ext of extensions) {
            try {
              const pathWithExt = fallbackPath + ext
              const resolved = require.resolve(pathWithExt)
              console.log(`[Module Resolver] Extension fallback: ${request} -> ${resolved}`)
              resolveStats.fallbackUsed++
              return resolved
            } catch {
              continue
            }
          }
        }

        console.error(`[Module Resolver] All resolution strategies failed for ${request}`)
        resolveStats.errors++
      }
      
      throw error
    }
  }

  isPatched = true
  console.log('[Module Resolver] Comprehensive module resolution patch applied successfully')
}

/**
 * Enhanced preloading of critical modules that might have resolution issues.
 * This ensures they're available in the module cache before MCP SDK tries to import them.
 */
export function preloadCriticalModules(): void {
  if (!app.isPackaged) {
    console.log('[Module Resolver] Skipping critical module preload in development')
    return
  }

  console.log('[Module Resolver] Preloading critical modules...')
  let successCount = 0
  let failureCount = 0
  
  for (const mod of PROBLEMATIC_MODULES) {
    try {
      // Try multiple resolution strategies for each module
      const strategies = [
        () => require(mod),
        () => {
          if (process.resourcesPath) {
            return require(path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', mod))
          }
          throw new Error('No resources path')
        },
        () => {
          if (process.resourcesPath) {
            return require(path.join(process.resourcesPath, 'node_modules', mod))
          }
          throw new Error('No resources path')
        }
      ]
      
      let loaded = false
      for (const strategy of strategies) {
        try {
          strategy()
          console.log(`[Module Resolver] Successfully preloaded ${mod}`)
          successCount++
          loaded = true
          break
        } catch (e) {
          continue
        }
      }
      
      if (!loaded) {
        console.warn(`[Module Resolver] Failed to preload ${mod} using all strategies`)
        failureCount++
      }
    } catch (e) {
      console.warn(`[Module Resolver] Failed to preload ${mod}:`, e)
      failureCount++
    }
  }
  
  console.log(`[Module Resolver] Preload complete: ${successCount} successful, ${failureCount} failed`)
}

/**
 * Enhanced ESM hooks registration for better import resolution
 */
export function registerESMHooks(): void {
  if (!app.isPackaged) {
    console.log('[Module Resolver] Skipping ESM hooks in development')
    return
  }

  console.log('[Module Resolver] Registering enhanced ESM resolution hooks...')

  // Override ESM resolution for problematic modules
  const originalUncaughtExceptionHandler = process.listeners('uncaughtException')
  
  process.on('uncaughtException', (error: any) => {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      const moduleName = extractModuleNameFromError(error.message)
      if (moduleName && PROBLEMATIC_MODULES.includes(moduleName)) {
        console.error(`[Module Resolver] Caught ESM resolution error for ${moduleName}, this indicates the module resolution patch may need improvement`)
        
        // Log helpful debugging information
        console.error(`[Module Resolver] Error details:`, {
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 3).join('\n'),
          resourcesPath: process.resourcesPath,
          cwd: process.cwd()
        })
      }
    }
    
    // Re-throw the error so it's handled by the original handlers
    // But first let the original handlers run
    process.nextTick(() => {
      for (const handler of originalUncaughtExceptionHandler) {
        if (typeof handler === 'function') {
          try {
            handler(error, 'uncaughtException')
          } catch (handlerError) {
            console.error('[Module Resolver] Error in uncaught exception handler:', handlerError)
          }
        }
      }
    })
  })

  // Enhance Node.js module search paths with unpacked locations
  if (process.resourcesPath) {
    const Module = require('module')
    const additionalPaths = [
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules'),
      path.join(process.resourcesPath, 'node_modules'),
      path.join(process.cwd(), 'node_modules')
    ]
    
    // Get current module paths for the main process
    const currentPaths = Module._nodeModulePaths(process.resourcesPath)
    
    for (const additionalPath of additionalPaths) {
      if (!currentPaths.includes(additionalPath)) {
        currentPaths.unshift(additionalPath)
        console.log(`[Module Resolver] Added ${additionalPath} to Node module search paths`)
      }
    }
    
    // Patch Module._nodeModulePaths to include our additional paths
    const originalNodeModulePaths = Module._nodeModulePaths
    Module._nodeModulePaths = function(from: string) {
      const originalPaths = originalNodeModulePaths.call(this, from)
      
      // Add our additional paths if not already present
      for (const additionalPath of additionalPaths) {
        if (!originalPaths.includes(additionalPath)) {
          originalPaths.unshift(additionalPath)
        }
      }
      
      return originalPaths
    }
    
    console.log('[Module Resolver] Enhanced Node.js module search paths for ESM compatibility')
  }
}

/**
 * Extract module name from ESM error message
 */
function extractModuleNameFromError(errorMessage: string): string | null {
  // Try to extract module name from various error message patterns
  const patterns = [
    /Cannot find module '([^']+)'/,
    /Cannot resolve module '([^']+)'/,
    /Module not found: '([^']+)'/,
    /Failed to resolve '([^']+)'/
  ]
  
  for (const pattern of patterns) {
    const match = errorMessage.match(pattern)
    if (match) {
      return match[1]
    }
  }
  
  return null
}

/**
 * Get module resolution statistics for debugging
 */
export function getResolutionStats(): {
  totalAttempts: number
  successfulPatches: number
  fallbackUsed: number
  errors: number
  isPatched: boolean
} {
  return {
    ...resolveStats,
    isPatched
  }
}

/**
 * Reset module resolution statistics (for testing)
 */
export function resetResolutionStats(): void {
  resolveStats = {
    totalAttempts: 0,
    successfulPatches: 0,
    fallbackUsed: 0,
    errors: 0
  }
  console.log('[Module Resolver] Resolution statistics reset')
}