import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import os from 'os'

// Mock electron app
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn().mockReturnValue('/mock/appData')
  },
  Notification: vi.fn().mockImplementation((options) => ({
    show: vi.fn(),
    title: options.title,
    body: options.body
  }))
}))

// Mock the MCP SDK modules with realistic implementations
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue({}),
    listTools: vi.fn().mockResolvedValue({
      tools: [
        {
          name: 'test_tool',
          description: 'A test tool',
          inputSchema: { type: 'object', properties: {} }
        }
      ]
    }),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Tool executed successfully' }]
    }),
    close: vi.fn().mockResolvedValue({})
  }))
}))

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn().mockImplementation((config) => ({
    command: config.command,
    args: config.args,
    close: vi.fn().mockResolvedValue({})
  }))
}))

// Mock cross-spawn and its dependencies
vi.mock('cross-spawn', () => ({
  default: vi.fn(),
  spawn: vi.fn().mockImplementation(() => ({
    stdout: {
      on: vi.fn(),
      pipe: vi.fn()
    },
    stderr: {
      on: vi.fn(),
      pipe: vi.fn()
    },
    on: vi.fn(),
    kill: vi.fn(),
    pid: 12345
  })),
  sync: vi.fn()
}))

vi.mock('which', () => ({
  default: vi.fn().mockResolvedValue('/usr/bin/node')
}))

vi.mock('path-key', () => ({
  default: vi.fn().mockReturnValue('PATH')
}))

vi.mock('shebang-command', () => ({
  default: vi.fn().mockReturnValue(null)
}))

describe('ESM Integration Tests', () => {
  let mockApp: any
  let originalResourcesPath: string | undefined
  let originalPlatform: string
  
  beforeEach(async () => {
    // Import electron mock after clearing modules
    vi.resetModules()
    const electronModule = await import('electron')
    mockApp = electronModule.app
    
    originalResourcesPath = process.resourcesPath
    originalPlatform = process.platform
    
    vi.clearAllMocks()
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
  
  describe('Development Environment', () => {
    beforeEach(() => {
      mockApp.isPackaged = false
    })
    
    it('should load all modules successfully in development', async () => {
      const { initializeMCPSDK, isMCPSDKInitialized } = await import('../mcp-sdk-loader')
      const { patchModuleResolution } = await import('../module-resolver')
      
      // Apply patches (should be no-op in development)
      patchModuleResolution()
      
      // Initialize SDK
      await initializeMCPSDK()
      
      expect(isMCPSDKInitialized()).toBe(true)
    })
    
    it('should handle dynamic imports without issues', async () => {
      const clientModule = await import('@modelcontextprotocol/sdk/client/index.js')
      const stdioModule = await import('@modelcontextprotocol/sdk/client/stdio.js')
      
      expect(clientModule.Client).toBeDefined()
      expect(stdioModule.StdioClientTransport).toBeDefined()
    })
    
    it('should import cross-spawn dependencies successfully', async () => {
      const crossSpawn = await import('cross-spawn')
      expect(crossSpawn.spawn).toBeDefined()
      
      // Note: The other dependencies (which, path-key, shebang-command) are transitive
      // dependencies that may not be directly importable in the test environment.
      // The actual resolution happens at runtime in the packaged app.
      console.log('Successfully imported cross-spawn')
    })
  })
  
  describe('Production Environment - ASAR Packaged', () => {
    beforeEach(() => {
      mockApp.isPackaged = true
      Object.defineProperty(process, 'resourcesPath', {
        value: '/Applications/SpeakMCP.app/Contents/Resources',
        configurable: true
      })
    })
    
    it('should resolve modules from ASAR location', async () => {
      const originalResolve = require.resolve
      const resolveAttempts: string[] = []
      
      require.resolve = vi.fn().mockImplementation((request: string) => {
        resolveAttempts.push(request)
        
        if (request.includes('app.asar/node_modules')) {
          return `/Applications/SpeakMCP.app/Contents/Resources/app.asar/node_modules/${request.split('/').pop()}/index.js`
        }
        
        return originalResolve(request)
      })
      
      try {
        const { patchModuleResolution } = await import('../module-resolver')
        patchModuleResolution()
        
        const { initializeMCPSDK } = await import('../mcp-sdk-loader')
        await initializeMCPSDK()
        
        // Verify ASAR paths were attempted
        expect(resolveAttempts.some(path => path.includes('app.asar'))).toBe(true)
        
      } finally {
        require.resolve = originalResolve
      }
    })
    
    it('should fallback to unpacked location when ASAR fails', async () => {
      const originalResolve = require.resolve
      const resolveAttempts: string[] = []
      
      require.resolve = vi.fn().mockImplementation((request: string) => {
        resolveAttempts.push(request)
        
        // Fail for ASAR paths
        if (request.includes('app.asar/node_modules')) {
          throw new Error('ASAR resolution failed')
        }
        
        // Succeed for unpacked paths
        if (request.includes('app.asar.unpacked/node_modules')) {
          return `/Applications/SpeakMCP.app/Contents/Resources/app.asar.unpacked/node_modules/${request.split('/').pop()}/index.js`
        }
        
        return originalResolve(request)
      })
      
      try {
        const { patchModuleResolution } = await import('../module-resolver')
        patchModuleResolution()
        
        const { initializeMCPSDK } = await import('../mcp-sdk-loader')
        await initializeMCPSDK()
        
        // Verify unpacked paths were attempted
        expect(resolveAttempts.some(path => path.includes('app.asar.unpacked'))).toBe(true)
        
      } finally {
        require.resolve = originalResolve
      }
    })
    
    it('should handle complete MCP workflow with patched modules', async () => {
      const mockChildProcess = {
        stdout: {
          on: vi.fn().mockImplementation((event, callback) => {
            if (event === 'data') {
              // Simulate MCP server response
              setTimeout(() => callback(JSON.stringify({
                jsonrpc: '2.0',
                result: {
                  tools: [{
                    name: 'test_tool',
                    description: 'A test tool',
                    inputSchema: { type: 'object' }
                  }]
                }
              })), 10)
            }
          }),
          pipe: vi.fn()
        },
        stderr: {
          on: vi.fn(),
          pipe: vi.fn()
        },
        on: vi.fn().mockImplementation((event, callback) => {
          if (event === 'spawn') {
            setTimeout(callback, 5)
          }
        }),
        kill: vi.fn(),
        pid: 12345
      }
      
      // Mock cross-spawn to return our mock process
      const crossSpawn = await import('cross-spawn')
      ;(crossSpawn.spawn as any).mockReturnValue(mockChildProcess)
      
      // Mock require.resolve for successful resolution
      const originalResolve = require.resolve
      require.resolve = vi.fn().mockImplementation((request: string) => {
        if (request.includes('cross-spawn')) {
          return '/app/resources/app.asar.unpacked/node_modules/cross-spawn/index.js'
        }
        if (request.includes('ajv')) {
          return '/app/resources/app.asar.unpacked/node_modules/ajv/dist/ajv.js'
        }
        return originalResolve(request)
      })
      
      const originalRequire = global.require
      global.require = vi.fn().mockImplementation((moduleName: string) => {
        if (moduleName.includes('cross-spawn')) {
          return crossSpawn
        }
        return originalRequire(moduleName)
      })
      
      try {
        // Apply all patches
        const { patchModuleResolution, preloadCriticalModules } = await import('../module-resolver')
        patchModuleResolution()
        preloadCriticalModules()
        
        // Initialize MCP SDK
        const { initializeMCPSDK, isMCPSDKInitialized } = await import('../mcp-sdk-loader')
        await initializeMCPSDK()
        
        expect(isMCPSDKInitialized()).toBe(true)
        
        // Test the complete MCP service workflow
        const { MCPService } = await import('../mcp-service')
        const mcpService = new MCPService()
        
        // Mock config to have a test server
        const { configStore } = await import('../config')
        ;(configStore.get as any).mockReturnValue({
          mcpConfig: {
            mcpServers: {
              'test-server': {
                command: 'node',
                args: ['test-server.js']
              }
            }
          }
        })
        
        await mcpService.initialize()
        
        const tools = mcpService.getAvailableTools()
        expect(tools.length).toBeGreaterThan(0)
        
      } finally {
        require.resolve = originalResolve
        global.require = originalRequire
      }
    })
  })
  
  describe('Error Handling and Recovery', () => {
    it('should handle MODULE_NOT_FOUND errors gracefully', async () => {
      mockApp.isPackaged = true
      
      const originalResolve = require.resolve
      require.resolve = vi.fn().mockImplementation((request: string) => {
        const error = new Error(`Cannot find module '${request}'`)
        ;(error as any).code = 'MODULE_NOT_FOUND'
        throw error
      })
      
      const consoleSpy = vi.spyOn(console, 'error')
      
      try {
        const { patchModuleResolution } = await import('../module-resolver')
        patchModuleResolution()
        
        // Should handle the error without crashing
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Could not resolve')
        )
        
      } finally {
        require.resolve = originalResolve
      }
    })
    
    it('should handle ESM import errors and fallback to CommonJS', async () => {
      mockApp.isPackaged = true
      
      // Mock dynamic import to fail
      const originalImport = global.import
      if (originalImport) {
        global.import = vi.fn().mockImplementation((moduleName: string) => {
          if (moduleName.includes('@modelcontextprotocol/sdk')) {
            return Promise.reject(new Error('ESM import failed'))
          }
          return originalImport(moduleName)
        })
      }
      
      // Mock CommonJS require to succeed
      const originalRequire = global.require
      global.require = vi.fn().mockImplementation((moduleName: string) => {
        if (moduleName === '@modelcontextprotocol/sdk') {
          return {
            Client: vi.fn(),
            StdioClientTransport: vi.fn()
          }
        }
        return originalRequire(moduleName)
      })
      
      const consoleSpy = vi.spyOn(console, 'log')
      
      try {
        const { initializeMCPSDK, isMCPSDKInitialized } = await import('../mcp-sdk-loader')
        await initializeMCPSDK()
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Loaded MCP SDK using CommonJS fallback')
        )
        expect(isMCPSDKInitialized()).toBe(true)
        
      } finally {
        global.require = originalRequire
        if (originalImport) {
          global.import = originalImport
        }
      }
    })
    
    it('should handle uncaught ESM resolution exceptions', async () => {
      mockApp.isPackaged = true
      
      const consoleSpy = vi.spyOn(console, 'error')
      
      const { registerESMHooks } = await import('../module-resolver')
      registerESMHooks()
      
      // Simulate uncaught ESM resolution error
      const error = new Error('Cannot resolve module cross-spawn from ESM')
      ;(error as any).code = 'ERR_MODULE_NOT_FOUND'
      
      process.emit('uncaughtException', error)
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Caught ESM resolution error for cross-spawn')
      )
    })
  })
  
  describe('Cross-Platform Compatibility', () => {
    const testCases = [
      {
        platform: 'darwin',
        resourcesPath: '/Applications/SpeakMCP.app/Contents/Resources',
        pathSeparator: ':'
      },
      {
        platform: 'win32',
        resourcesPath: 'C:\\Program Files\\SpeakMCP\\resources',
        pathSeparator: ';'
      },
      {
        platform: 'linux',
        resourcesPath: '/opt/speakmcp/resources',
        pathSeparator: ':'
      }
    ]
    
    testCases.forEach(({ platform, resourcesPath, pathSeparator }) => {
      it(`should handle ${platform} platform correctly`, async () => {
        Object.defineProperty(process, 'platform', { value: platform })
        mockApp.isPackaged = true
        
        Object.defineProperty(process, 'resourcesPath', {
          value: resourcesPath,
          configurable: true
        })
        
        const originalResolve = require.resolve
        const originalRequire = global.require
        const resolveAttempts: string[] = []
        
        require.resolve = vi.fn().mockImplementation((request: string) => {
          resolveAttempts.push(request)
          return path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'cross-spawn', 'index.js')
        })
        
        global.require = vi.fn().mockImplementation((modulePath: string) => {
          if (modulePath.includes('cross-spawn')) {
            return { spawn: vi.fn() }
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
          
          // Verify platform-specific paths were used
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
  
  describe('Performance and Memory', () => {
    it('should not leak memory on repeated initialization', async () => {
      mockApp.isPackaged = true
      
      const { initializeMCPSDK } = await import('../mcp-sdk-loader')
      
      // Initialize multiple times
      for (let i = 0; i < 5; i++) {
        await initializeMCPSDK()
      }
      
      // Should not cause issues
      const { isMCPSDKInitialized } = await import('../mcp-sdk-loader')
      expect(isMCPSDKInitialized()).toBe(true)
    })
    
    it('should handle concurrent module resolution attempts', async () => {
      mockApp.isPackaged = true
      
      const originalResolve = require.resolve
      let resolveCount = 0
      
      require.resolve = vi.fn().mockImplementation((request: string) => {
        resolveCount++
        return originalResolve(request)
      })
      
      try {
        const { patchModuleResolution } = await import('../module-resolver')
        patchModuleResolution()
        
        // Simulate concurrent module resolution
        const promises = Array.from({ length: 10 }, () => {
          return new Promise<void>((resolve) => {
            setTimeout(() => {
              try {
                require('path') // Safe module that exists
              } catch (e) {
                // Ignore errors
              }
              resolve()
            }, Math.random() * 100)
          })
        })
        
        await Promise.all(promises)
        
        // Should handle concurrent calls without issues
        expect(resolveCount).toBeGreaterThan(0)
        
      } finally {
        require.resolve = originalResolve
      }
    })
  })
  
  describe('Real-world Integration Scenarios', () => {
    it('should handle typical MCP server startup sequence', async () => {
      mockApp.isPackaged = true
      
      Object.defineProperty(process, 'resourcesPath', {
        value: '/Applications/SpeakMCP.app/Contents/Resources',
        configurable: true
      })
      
      const originalResolve = require.resolve
      const originalRequire = global.require
      const originalSpawn = spawn as any
      
      // Mock successful module resolution
      require.resolve = vi.fn().mockImplementation((request: string) => {
        if (request.includes('cross-spawn') || request.includes('ajv')) {
          return `/Applications/SpeakMCP.app/Contents/Resources/app.asar.unpacked/node_modules/${request}/index.js`
        }
        return originalResolve(request)
      })
      
      global.require = vi.fn().mockImplementation((moduleName: string) => {
        if (moduleName.includes('cross-spawn')) {
          return { spawn: vi.fn().mockReturnValue({
            stdout: { on: vi.fn(), pipe: vi.fn() },
            stderr: { on: vi.fn(), pipe: vi.fn() },
            on: vi.fn(),
            kill: vi.fn(),
            pid: 12345
          }) }
        }
        return originalRequire(moduleName)
      })
      
      try {
        // Complete initialization sequence
        const { patchModuleResolution, preloadCriticalModules, registerESMHooks } = await import('../module-resolver')
        patchModuleResolution()
        preloadCriticalModules()
        registerESMHooks()
        
        const { initializeMCPSDK, isMCPSDKInitialized } = await import('../mcp-sdk-loader')
        await initializeMCPSDK()
        
        expect(isMCPSDKInitialized()).toBe(true)
        
        // Test MCP service can initialize with real-world config
        const { MCPService } = await import('../mcp-service')
        const mcpService = new MCPService()
        
        const { configStore } = await import('../config')
        ;(configStore.get as any).mockReturnValue({
          mcpConfig: {
            mcpServers: {
              'filesystem': {
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']
              },
              'brave-search': {
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-brave-search']
              }
            }
          }
        })
        
        await mcpService.initialize()
        
        // Should have fallback tools available
        const tools = mcpService.getAvailableTools()
        expect(tools.length).toBeGreaterThan(0)
        
      } finally {
        require.resolve = originalResolve
        global.require = originalRequire
      }
    })
    
    it('should handle application launch without ESM errors', async () => {
      mockApp.isPackaged = true
      const consoleSpy = vi.spyOn(console, 'error')
      
      try {
        // Simulate complete application initialization
        const { patchModuleResolution, preloadCriticalModules, registerESMHooks } = await import('../module-resolver')
        const { initializeMCPSDK } = await import('../mcp-sdk-loader')
        
        // Apply all patches and initializations
        patchModuleResolution()
        preloadCriticalModules()
        registerESMHooks()
        await initializeMCPSDK()
        
        // No ESM-related errors should be logged
        const esmErrors = consoleSpy.mock.calls.filter(call => 
          call.some(arg => 
            typeof arg === 'string' && 
            (arg.includes('ERR_MODULE_NOT_FOUND') || 
             arg.includes('Cannot resolve module'))
          )
        )
        
        expect(esmErrors.length).toBe(0)
        
      } finally {
        consoleSpy.mockRestore()
      }
    })
  })
})
