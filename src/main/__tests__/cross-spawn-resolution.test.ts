import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'

// Mock electron app
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn().mockReturnValue('/mock/appData')
  }
}))

describe('Cross-Spawn Resolution Tests', () => {
  let mockApp: any
  let originalResourcesPath: string | undefined
  let originalPlatform: string
  
  beforeEach(() => {
    const { app } = require('electron')
    mockApp = app
    originalResourcesPath = process.resourcesPath
    originalPlatform = process.platform
    
    vi.clearAllMocks()
    vi.resetModules()
  })
  
  afterEach(() => {
    if (originalResourcesPath !== undefined) {
      Object.defineProperty(process, 'resourcesPath', {
        value: originalResourcesPath,
        configurable: true
      })
    }
    
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true
    })
  })
  
  describe('Cross-Spawn Module Loading', () => {
    it('should load cross-spawn in development environment', async () => {
      mockApp.isPackaged = false
      
      const crossSpawn = await import('cross-spawn')
      expect(crossSpawn.spawn).toBeDefined()
      expect(typeof crossSpawn.spawn).toBe('function')
    })
    
    it('should resolve cross-spawn from ASAR in production', async () => {
      mockApp.isPackaged = true
      const mockResourcesPath = '/Applications/SpeakMCP.app/Contents/Resources'
      
      Object.defineProperty(process, 'resourcesPath', {
        value: mockResourcesPath,
        configurable: true
      })
      
      const originalResolve = require.resolve
      const resolveAttempts: string[] = []
      
      require.resolve = vi.fn().mockImplementation((request: string) => {
        resolveAttempts.push(request)
        
        if (request.includes('cross-spawn') && request.includes('app.asar')) {
          return path.join(mockResourcesPath, 'app.asar', 'node_modules', 'cross-spawn', 'index.js')
        }
        
        return originalResolve(request)
      })
      
      try {
        const { patchModuleResolution } = await import('../module-resolver')
        patchModuleResolution()
        
        // Simulate cross-spawn being required from within ASAR
        const MockModule = require('module')
        const patchedResolver = (MockModule as any)._resolveFilename
        
        const mockParent = {
          filename: path.join(mockResourcesPath, 'app.asar', 'dist', 'main.js')
        }
        
        const result = patchedResolver.call(MockModule, 'cross-spawn', mockParent, false, {})
        
        expect(result).toContain('cross-spawn')
        expect(result).toContain('app.asar')
        
      } finally {
        require.resolve = originalResolve
      }
    })
    
    it('should fallback to unpacked cross-spawn when ASAR fails', async () => {
      mockApp.isPackaged = true
      const mockResourcesPath = '/Applications/SpeakMCP.app/Contents/Resources'
      
      Object.defineProperty(process, 'resourcesPath', {
        value: mockResourcesPath,
        configurable: true
      })
      
      const originalResolve = require.resolve
      require.resolve = vi.fn().mockImplementation((request: string) => {
        if (request.includes('app.asar/node_modules/cross-spawn')) {
          throw new Error('ASAR resolution failed')
        }
        
        if (request.includes('app.asar.unpacked/node_modules/cross-spawn')) {
          return path.join(mockResourcesPath, 'app.asar.unpacked', 'node_modules', 'cross-spawn', 'index.js')
        }
        
        return originalResolve(request)
      })
      
      try {
        const { patchModuleResolution } = await import('../module-resolver')
        patchModuleResolution()
        
        const MockModule = require('module')
        const patchedResolver = (MockModule as any)._resolveFilename
        
        const mockParent = {
          filename: path.join(mockResourcesPath, 'app.asar', 'dist', 'main.js')
        }
        
        const result = patchedResolver.call(MockModule, 'cross-spawn', mockParent, false, {})
        
        expect(result).toContain('cross-spawn')
        expect(result).toContain('app.asar.unpacked')
        
      } finally {
        require.resolve = originalResolve
      }
    })
  })
  
  describe('Cross-Spawn Dependencies Resolution', () => {
    const crossSpawnDependencies = [
      'which',
      'path-key', 
      'shebang-command'
    ]
    
    crossSpawnDependencies.forEach((dependency) => {
      it(`should resolve ${dependency} from ASAR location`, async () => {
        mockApp.isPackaged = true
        const mockResourcesPath = '/Applications/SpeakMCP.app/Contents/Resources'
        
        Object.defineProperty(process, 'resourcesPath', {
          value: mockResourcesPath,
          configurable: true
        })
        
        const originalResolve = require.resolve
        require.resolve = vi.fn().mockImplementation((request: string) => {
          if (request === dependency || request.startsWith(dependency + '/')) {
            return path.join(mockResourcesPath, 'app.asar', 'node_modules', dependency, 'index.js')
          }
          return originalResolve(request)
        })
        
        try {
          const { patchModuleResolution } = await import('../module-resolver')
          patchModuleResolution()
          
          const MockModule = require('module')
          const patchedResolver = (MockModule as any)._resolveFilename
          
          const mockParent = {
            filename: path.join(mockResourcesPath, 'app.asar', 'node_modules', 'cross-spawn', 'index.js')
          }
          
          const result = patchedResolver.call(MockModule, dependency, mockParent, false, {})
          
          expect(result).toContain(dependency)
          expect(require.resolve).toHaveBeenCalledWith(
            expect.stringContaining(dependency)
          )
          
        } finally {
          require.resolve = originalResolve
        }
      })
    })
    
    it('should handle all cross-spawn dependencies in a single resolution pass', async () => {
      mockApp.isPackaged = true
      const mockResourcesPath = '/Applications/SpeakMCP.app/Contents/Resources'
      
      Object.defineProperty(process, 'resourcesPath', {
        value: mockResourcesPath,
        configurable: true
      })
      
      const originalResolve = require.resolve
      const resolveAttempts = new Set<string>()
      
      require.resolve = vi.fn().mockImplementation((request: string) => {
        resolveAttempts.add(request)
        
        // Mock successful resolution for all cross-spawn dependencies
        if (crossSpawnDependencies.some(dep => request === dep || request.startsWith(dep + '/'))) {
          return path.join(mockResourcesPath, 'app.asar', 'node_modules', request.split('/')[0], 'index.js')
        }
        
        if (request === 'cross-spawn' || request.startsWith('cross-spawn/')) {
          return path.join(mockResourcesPath, 'app.asar', 'node_modules', 'cross-spawn', 'index.js')
        }
        
        return originalResolve(request)
      })
      
      try {
        const { patchModuleResolution } = await import('../module-resolver')
        patchModuleResolution()
        
        const MockModule = require('module')
        const patchedResolver = (MockModule as any)._resolveFilename
        
        const mockParent = {
          filename: path.join(mockResourcesPath, 'app.asar', 'dist', 'main.js')
        }
        
        // Resolve cross-spawn and its dependencies
        const crossSpawnResult = patchedResolver.call(MockModule, 'cross-spawn', mockParent, false, {})
        expect(crossSpawnResult).toContain('cross-spawn')
        
        for (const dependency of crossSpawnDependencies) {
          const depResult = patchedResolver.call(MockModule, dependency, mockParent, false, {})
          expect(depResult).toContain(dependency)
        }
        
        // Verify all dependencies were attempted to be resolved
        expect(resolveAttempts.size).toBeGreaterThanOrEqual(4) // cross-spawn + 3 dependencies
        
      } finally {
        require.resolve = originalResolve
      }
    })
  })
  
  describe('Cross-Spawn Execution in Production', () => {
    it('should execute cross-spawn with resolved dependencies', async () => {
      mockApp.isPackaged = true
      const mockResourcesPath = '/Applications/SpeakMCP.app/Contents/Resources'
      
      Object.defineProperty(process, 'resourcesPath', {
        value: mockResourcesPath,
        configurable: true
      })
      
      const originalResolve = require.resolve
      const originalRequire = global.require
      
      // Mock successful resolution
      require.resolve = vi.fn().mockImplementation((request: string) => {
        return path.join(mockResourcesPath, 'app.asar.unpacked', 'node_modules', request.split('/')[0], 'index.js')
      })
      
      // Mock cross-spawn functionality
      const mockSpawn = vi.fn().mockReturnValue({
        stdout: { on: vi.fn(), pipe: vi.fn() },
        stderr: { on: vi.fn(), pipe: vi.fn() },
        on: vi.fn(),
        kill: vi.fn(),
        pid: 12345
      })
      
      global.require = vi.fn().mockImplementation((modulePath: string) => {
        if (modulePath.includes('cross-spawn')) {
          return { spawn: mockSpawn }
        }
        if (modulePath.includes('which')) {
          return vi.fn().mockResolvedValue('/usr/bin/node')
        }
        if (modulePath.includes('path-key')) {
          return vi.fn().mockReturnValue('PATH')
        }
        if (modulePath.includes('shebang-command')) {
          return vi.fn().mockReturnValue(null)
        }
        return originalRequire(modulePath)
      })
      
      try {
        const { patchModuleResolution, preloadCriticalModules } = await import('../module-resolver')
        patchModuleResolution()
        preloadCriticalModules()
        
        // Test that cross-spawn can be used after patches
        const crossSpawnPath = path.join(
          mockResourcesPath,
          'app.asar.unpacked',
          'node_modules',
          'cross-spawn',
          'index.js'
        )
        
        const crossSpawn = global.require(crossSpawnPath)
        const child = crossSpawn.spawn('echo', ['test'])
        
        expect(mockSpawn).toHaveBeenCalledWith('echo', ['test'])
        expect(child.pid).toBe(12345)
        
      } finally {
        require.resolve = originalResolve
        global.require = originalRequire
      }
    })
    
    it('should handle cross-spawn import in MCP SDK context', async () => {
      mockApp.isPackaged = true
      const mockResourcesPath = '/Applications/SpeakMCP.app/Contents/Resources'
      
      Object.defineProperty(process, 'resourcesPath', {
        value: mockResourcesPath,
        configurable: true
      })
      
      const originalResolve = require.resolve
      const originalRequire = global.require
      
      // Mock the scenario where MCP SDK tries to import cross-spawn
      require.resolve = vi.fn().mockImplementation((request: string) => {
        if (request === 'cross-spawn') {
          return path.join(mockResourcesPath, 'app.asar.unpacked', 'node_modules', 'cross-spawn', 'index.js')
        }
        return originalResolve(request)
      })
      
      global.require = vi.fn().mockImplementation((modulePath: string) => {
        if (modulePath.includes('cross-spawn')) {
          return {
            spawn: vi.fn().mockReturnValue({
              stdout: { on: vi.fn(), pipe: vi.fn() },
              stderr: { on: vi.fn(), pipe: vi.fn() },
              on: vi.fn().mockImplementation((event, callback) => {
                if (event === 'spawn') setTimeout(callback, 10)
              }),
              kill: vi.fn(),
              pid: 54321
            })
          }
        }
        return originalRequire(modulePath)
      })
      
      try {
        const { patchModuleResolution, preloadCriticalModules } = await import('../module-resolver')
        patchModuleResolution()
        preloadCriticalModules()
        
        const { initializeMCPSDK, isMCPSDKInitialized } = await import('../mcp-sdk-loader')
        await initializeMCPSDK()
        
        expect(isMCPSDKInitialized()).toBe(true)
        
        // Verify cross-spawn was preloaded
        expect(global.require).toHaveBeenCalledWith(
          expect.stringContaining('cross-spawn')
        )
        
        // Test MCP service can use cross-spawn
        const { MCPService } = await import('../mcp-service')
        const mcpService = new MCPService()
        
        const { configStore } = await import('../config')
        ;(configStore.get as any).mockReturnValue({
          mcpConfig: {
            mcpServers: {
              'test-server': {
                command: 'node',
                args: ['server.js']
              }
            }
          }
        })
        
        await mcpService.initialize()
        
        // Should initialize without cross-spawn resolution errors
        const tools = mcpService.getAvailableTools()
        expect(tools.length).toBeGreaterThanOrEqual(4) // At least fallback tools
        
      } finally {
        require.resolve = originalResolve
        global.require = originalRequire
      }
    })
  })
  
  describe('Platform-specific Cross-Spawn Behavior', () => {
    const platforms = [
      { name: 'macOS', platform: 'darwin', resourcesPath: '/Applications/SpeakMCP.app/Contents/Resources' },
      { name: 'Windows', platform: 'win32', resourcesPath: 'C:\\Program Files\\SpeakMCP\\resources' },
      { name: 'Linux', platform: 'linux', resourcesPath: '/opt/speakmcp/resources' }
    ]
    
    platforms.forEach(({ name, platform, resourcesPath }) => {
      it(`should resolve cross-spawn on ${name}`, async () => {
        Object.defineProperty(process, 'platform', { value: platform })
        mockApp.isPackaged = true
        
        Object.defineProperty(process, 'resourcesPath', {
          value: resourcesPath,
          configurable: true
        })
        
        const originalResolve = require.resolve
        const originalRequire = global.require
        
        require.resolve = vi.fn().mockImplementation((request: string) => {
          if (request.includes('cross-spawn')) {
            return path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'cross-spawn', 'index.js')
          }
          return originalResolve(request)
        })
        
        global.require = vi.fn().mockImplementation((modulePath: string) => {
          if (modulePath.includes('cross-spawn')) {
            return {
              spawn: vi.fn().mockReturnValue({
                stdout: { on: vi.fn() },
                stderr: { on: vi.fn() },
                on: vi.fn(),
                kill: vi.fn(),
                pid: 99999
              })
            }
          }
          return originalRequire(modulePath)
        })
        
        try {
          const { patchModuleResolution, preloadCriticalModules } = await import('../module-resolver')
          patchModuleResolution()
          preloadCriticalModules()
          
          // Verify platform-appropriate path was used
          const expectedPath = path.join(
            resourcesPath,
            'app.asar.unpacked',
            'node_modules',
            'cross-spawn',
            'index.js'
          )
          
          expect(global.require).toHaveBeenCalledWith(expectedPath)
          
        } finally {
          require.resolve = originalResolve
          global.require = originalRequire
        }
      })
    })
  })
  
  describe('Error Recovery for Cross-Spawn', () => {
    it('should handle cross-spawn resolution failure gracefully', async () => {
      mockApp.isPackaged = true
      
      const originalResolve = require.resolve
      require.resolve = vi.fn().mockImplementation((request: string) => {
        if (request.includes('cross-spawn')) {
          const error = new Error('MODULE_NOT_FOUND: cross-spawn')
          ;(error as any).code = 'MODULE_NOT_FOUND'
          throw error
        }
        return originalResolve(request)
      })
      
      const consoleSpy = vi.spyOn(console, 'warn')
      
      try {
        const { preloadCriticalModules } = await import('../module-resolver')
        preloadCriticalModules()
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to preload cross-spawn')
        )
        
      } finally {
        require.resolve = originalResolve
      }
    })
    
    it('should continue MCP initialization even if cross-spawn fails', async () => {
      mockApp.isPackaged = true
      
      const originalRequire = global.require
      global.require = vi.fn().mockImplementation((moduleName: string) => {
        if (moduleName.includes('cross-spawn')) {
          throw new Error('Cross-spawn not found')
        }
        return originalRequire(moduleName)
      })
      
      try {
        const { preloadCriticalModules } = await import('../module-resolver')
        const { initializeMCPSDK, isMCPSDKInitialized } = await import('../mcp-sdk-loader')
        
        preloadCriticalModules()
        await initializeMCPSDK()
        
        // SDK should still initialize successfully
        expect(isMCPSDKInitialized()).toBe(true)
        
      } finally {
        global.require = originalRequire
      }
    })
    
    it('should fallback to system cross-spawn when ASAR resolution fails', async () => {
      mockApp.isPackaged = true
      const mockResourcesPath = '/Applications/SpeakMCP.app/Contents/Resources'
      
      Object.defineProperty(process, 'resourcesPath', {
        value: mockResourcesPath,
        configurable: true
      })
      
      const originalResolve = require.resolve
      const resolveAttempts: string[] = []
      
      require.resolve = vi.fn().mockImplementation((request: string) => {
        resolveAttempts.push(request)
        
        // Fail for ASAR and unpacked paths
        if (request.includes('app.asar') && request.includes('cross-spawn')) {
          throw new Error('ASAR resolution failed')
        }
        
        // Succeed for system path
        if (request === 'cross-spawn') {
          return '/usr/local/lib/node_modules/cross-spawn/index.js'
        }
        
        return originalResolve(request)
      })
      
      try {
        const { patchModuleResolution } = await import('../module-resolver')
        patchModuleResolution()
        
        const MockModule = require('module')
        const patchedResolver = (MockModule as any)._resolveFilename
        
        const mockParent = {
          filename: path.join(mockResourcesPath, 'app.asar', 'dist', 'main.js')
        }
        
        const result = patchedResolver.call(MockModule, 'cross-spawn', mockParent, false, {})
        
        // Should eventually resolve to system location
        expect(result).toContain('cross-spawn')
        expect(resolveAttempts.length).toBeGreaterThan(1) // Multiple resolution attempts
        
      } finally {
        require.resolve = originalResolve
      }
    })
  })
})
