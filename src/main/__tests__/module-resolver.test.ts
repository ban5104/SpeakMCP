import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import Module from 'module'
import path from 'path'

// Mock electron app
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn().mockReturnValue('/mock/appData')
  }
}))

describe('Module Resolver', () => {
  let originalResolveFilename: any
  let patchModuleResolution: any
  let preloadCriticalModules: any
  let registerESMHooks: any
  let app: any
  
  beforeEach(async () => {
    // Dynamic import to avoid hoisting issues
    const moduleResolver = await import('../module-resolver')
    patchModuleResolution = moduleResolver.patchModuleResolution
    preloadCriticalModules = moduleResolver.preloadCriticalModules
    registerESMHooks = moduleResolver.registerESMHooks
    
    // Get the mocked electron app
    const electron = await import('electron')
    app = electron.app
    
    // Store original resolver
    originalResolveFilename = (Module as any)._resolveFilename
    
    // Clear any existing patches
    vi.clearAllMocks()
    
    // Reset the mock app state
    ;(app as any).isPackaged = false
  })
  
  afterEach(() => {
    // Restore original resolver if it was patched
    if (originalResolveFilename) {
      (Module as any)._resolveFilename = originalResolveFilename
    }
  })
  
  describe('patchModuleResolution', () => {
    it('should skip patching in development mode', () => {
      (app as any).isPackaged = false
      
      patchModuleResolution()
      
      // Module resolution should not be patched
      expect((Module as any)._resolveFilename).toBe(originalResolveFilename)
    })
    
    it('should patch module resolution in production mode', () => {
      (app as any).isPackaged = true
      
      patchModuleResolution()
      
      // Module resolution should be patched
      expect((Module as any)._resolveFilename).not.toBe(originalResolveFilename)
    })
    
    it('should resolve problematic modules from ASAR location', () => {
      (app as any).isPackaged = true
      const mockResourcesPath = '/app/resources'
      const originalResourcesPath = process.resourcesPath
      
      // Mock process.resourcesPath
      Object.defineProperty(process, 'resourcesPath', {
        value: mockResourcesPath,
        configurable: true
      })
      
      // Mock require.resolve to simulate successful resolution
      const originalResolve = require.resolve
      require.resolve = vi.fn((request: string) => {
        if (request.includes('ajv')) {
          return '/app/resources/app.asar/node_modules/ajv/dist/ajv.js'
        }
        return originalResolve(request)
      })
      
      try {
        patchModuleResolution()
        
        const patchedResolver = (Module as any)._resolveFilename
        
        // Mock parent from ASAR
        const mockParent = {
          filename: '/app/resources/app.asar/dist/main.js'
        }
        
        // Should resolve ajv from ASAR location
        const result = patchedResolver.call(Module, 'ajv', mockParent, false, {})
        expect(result).toContain('ajv')
        
      } finally {
        require.resolve = originalResolve
        Object.defineProperty(process, 'resourcesPath', {
          value: originalResourcesPath,
          configurable: true
        })
      }
    })
    
    it('should try unpacked location as fallback', () => {
      (app as any).isPackaged = true
      const mockResourcesPath = '/app/resources'
      const originalResourcesPath = process.resourcesPath
      
      // Mock process.resourcesPath
      Object.defineProperty(process, 'resourcesPath', {
        value: mockResourcesPath,
        configurable: true
      })
      
      // Mock require.resolve to fail on ASAR but succeed on unpacked
      const originalResolve = require.resolve
      require.resolve = vi.fn((request: string) => {
        if (request.includes('app.asar/node_modules')) {
          throw new Error('ASAR resolution failed')
        }
        if (request.includes('app.asar.unpacked/node_modules')) {
          return '/app/resources/app.asar.unpacked/node_modules/ajv/dist/ajv.js'
        }
        return originalResolve(request)
      })
      
      try {
        patchModuleResolution()
        
        const patchedResolver = (Module as any)._resolveFilename
        const mockParent = {
          filename: '/app/resources/app.asar/dist/main.js'
        }
        
        const result = patchedResolver.call(Module, 'ajv', mockParent, false, {})
        expect(result).toContain('app.asar.unpacked')
        
      } finally {
        require.resolve = originalResolve
        Object.defineProperty(process, 'resourcesPath', {
          value: originalResourcesPath,
          configurable: true
        })
      }
    })
    
    it('should handle resolution failures gracefully', () => {
      (app as any).isPackaged = true
      
      // Mock require.resolve to always fail
      const originalResolve = require.resolve
      require.resolve = vi.fn(() => {
        const error = new Error('MODULE_NOT_FOUND')
        ;(error as any).code = 'MODULE_NOT_FOUND'
        throw error
      })
      
      try {
        patchModuleResolution()
        
        const patchedResolver = (Module as any)._resolveFilename
        const mockParent = {
          filename: '/app/resources/app.asar/dist/main.js'
        }
        
        expect(() => {
          patchedResolver.call(Module, 'ajv', mockParent, false, {})
        }).toThrow('MODULE_NOT_FOUND')
        
      } finally {
        require.resolve = originalResolve
      }
    })
    
    it('should resolve all problematic modules', () => {
      (app as any).isPackaged = true
      const mockResourcesPath = '/app/resources'
      const originalResourcesPath = process.resourcesPath
      
      Object.defineProperty(process, 'resourcesPath', {
        value: mockResourcesPath,
        configurable: true
      })
      
      const originalResolve = require.resolve
      require.resolve = vi.fn((request: string) => {
        // Simulate successful resolution for all problematic modules
        return `/app/resources/app.asar/node_modules/${request}/index.js`
      })
      
      const problematicModules = [
        'ajv', 'ajv-keywords', 'content-type', 'cors', 'cross-spawn',
        'eventsource', 'eventsource-parser', 'express', 'express-rate-limit',
        'pkce-challenge', 'raw-body', 'zod', 'zod-to-json-schema'
      ]
      
      try {
        patchModuleResolution()
        
        const patchedResolver = (Module as any)._resolveFilename
        const mockParent = {
          filename: '/app/resources/app.asar/dist/main.js'
        }
        
        // Test each problematic module
        for (const moduleName of problematicModules) {
          const result = patchedResolver.call(Module, moduleName, mockParent, false, {})
          expect(result).toContain(moduleName)
          expect(require.resolve).toHaveBeenCalledWith(expect.stringContaining(moduleName))
        }
        
      } finally {
        require.resolve = originalResolve
        Object.defineProperty(process, 'resourcesPath', {
          value: originalResourcesPath,
          configurable: true
        })
      }
    })
    
    it('should not interfere with non-problematic modules', () => {
      (app as any).isPackaged = true
      
      patchModuleResolution()
      
      const patchedResolver = (Module as any)._resolveFilename
      const mockParent = {
        filename: '/app/resources/app.asar/dist/main.js'
      }
      
      // Mock the original resolver to track calls
      const originalCall = vi.fn().mockReturnValue('/some/path/fs.js')
      originalResolveFilename.call = originalCall
      
      // Non-problematic module should use original resolution
      const result = patchedResolver.call(Module, 'fs', mockParent, false, {})
      expect(originalCall).toHaveBeenCalled()
    })
  })
  
  describe('preloadCriticalModules', () => {
    it('should skip preloading in development mode', () => {
      (app as any).isPackaged = false
      const consoleSpy = vi.spyOn(console, 'log')
      
      preloadCriticalModules()
      
      // Should not log any preload messages
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Preloaded'))
    })
    
    it('should preload critical modules in production', () => {
      (app as any).isPackaged = true
      const consoleSpy = vi.spyOn(console, 'log')
      
      // Mock require to succeed
      const originalRequire = global.require
      global.require = vi.fn().mockReturnValue({})
      
      try {
        preloadCriticalModules()
        
        // Should log successful preloads
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Preloaded ajv'))
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Preloaded cross-spawn'))
        
      } finally {
        global.require = originalRequire
      }
    })
    
    it('should handle preload failures gracefully', () => {
      (app as any).isPackaged = true
      const consoleSpy = vi.spyOn(console, 'warn')
      
      // Mock require to fail
      const originalRequire = global.require
      global.require = vi.fn().mockImplementation(() => {
        throw new Error('Module not found')
      })
      
      try {
        preloadCriticalModules()
        
        // Should log warnings for failed preloads
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to preload ajv'))
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to preload cross-spawn'))
        
      } finally {
        global.require = originalRequire
      }
    })
  })
  
  describe('registerESMHooks', () => {
    it('should skip ESM hooks in development mode', () => {
      (app as any).isPackaged = false
      const consoleSpy = vi.spyOn(console, 'log')
      
      registerESMHooks()
      
      // Should not log hook registration
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Added unpacked modules path'))
    })
    
    it('should register ESM hooks in production with resourcesPath', () => {
      (app as any).isPackaged = true
      const mockResourcesPath = '/app/resources'
      const originalResourcesPath = process.resourcesPath
      
      Object.defineProperty(process, 'resourcesPath', {
        value: mockResourcesPath,
        configurable: true
      })
      
      const consoleSpy = vi.spyOn(console, 'log')
      
      try {
        registerESMHooks()
        
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Added unpacked modules path'))
        
      } finally {
        Object.defineProperty(process, 'resourcesPath', {
          value: originalResourcesPath,
          configurable: true
        })
      }
    })
    
    it('should handle uncaught ESM resolution errors', () => {
      (app as any).isPackaged = true
      const consoleSpy = vi.spyOn(console, 'error')
      
      registerESMHooks()
      
      // Simulate an ESM resolution error
      const error = new Error('Cannot resolve module cross-spawn')
      ;(error as any).code = 'ERR_MODULE_NOT_FOUND'
      
      process.emit('uncaughtException', error)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Caught ESM resolution error for cross-spawn')
      )
    })
  })
  
  describe('Integration tests', () => {
    it('should handle complete module resolution workflow', () => {
      (app as any).isPackaged = true
      const mockResourcesPath = '/app/resources'
      const originalResourcesPath = process.resourcesPath
      
      Object.defineProperty(process, 'resourcesPath', {
        value: mockResourcesPath,
        configurable: true
      })
      
      const originalResolve = require.resolve
      const originalRequire = global.require
      
      // Mock successful resolution and require
      require.resolve = vi.fn((request: string) => {
        return `/app/resources/app.asar/node_modules/${request}/index.js`
      })
      global.require = vi.fn().mockReturnValue({})
      
      try {
        // Apply all patches
        patchModuleResolution()
        preloadCriticalModules()
        registerESMHooks()
        
        // Verify the complete workflow worked
        expect((Module as any)._resolveFilename).not.toBe(originalResolveFilename)
        expect(global.require).toHaveBeenCalledWith('ajv')
        expect(global.require).toHaveBeenCalledWith('cross-spawn')
        
      } finally {
        require.resolve = originalResolve
        global.require = originalRequire
        Object.defineProperty(process, 'resourcesPath', {
          value: originalResourcesPath,
          configurable: true
        })
      }
    })
    
    it('should handle mixed success/failure scenarios', () => {
      (app as any).isPackaged = true
      const mockResourcesPath = '/app/resources'
      const originalResourcesPath = process.resourcesPath
      
      Object.defineProperty(process, 'resourcesPath', {
        value: mockResourcesPath,
        configurable: true
      })
      
      const originalResolve = require.resolve
      const originalRequire = global.require
      
      // Mock mixed success/failure
      require.resolve = vi.fn((request: string) => {
        if (request.includes('ajv')) {
          return `/app/resources/app.asar/node_modules/${request}/index.js`
        }
        throw new Error('Module not found')
      })
      
      global.require = vi.fn().mockImplementation((moduleName: string) => {
        if (moduleName === 'ajv') {
          return {}
        }
        throw new Error('Module not found')
      })
      
      const consoleSpy = vi.spyOn(console, 'warn')
      
      try {
        patchModuleResolution()
        preloadCriticalModules()
        
        // Should handle partial failures gracefully
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to preload cross-spawn')
        )
        
      } finally {
        require.resolve = originalResolve
        global.require = originalRequire
        Object.defineProperty(process, 'resourcesPath', {
          value: originalResourcesPath,
          configurable: true
        })
      }
    })
  })
})
