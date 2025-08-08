import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  initializeMCPSDK,
  getMCPClient,
  getStdioClientTransport,
  isMCPSDKInitialized
} from '../mcp-sdk-loader'
import path from 'path'

// Mock electron app
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn().mockReturnValue('/mock/appData')
  }
}))

// Mock the MCP SDK modules
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    listTools: vi.fn().mockResolvedValue({ tools: [] }),
    callTool: vi.fn(),
    close: vi.fn()
  }))
}))

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => ({
    close: vi.fn()
  }))
}))

describe('MCP SDK Loader', () => {
  let mockApp: any
  let originalResourcesPath: string | undefined
  
  beforeEach(() => {
    const { app } = require('electron')
    mockApp = app
    mockApp.isPackaged = false
    
    originalResourcesPath = process.resourcesPath
    
    vi.clearAllMocks()
    
    // Reset the SDK loader state by clearing the module cache
    vi.resetModules()
  })
  
  afterEach(() => {
    if (originalResourcesPath !== undefined) {
      Object.defineProperty(process, 'resourcesPath', {
        value: originalResourcesPath,
        configurable: true
      })
    }
  })
  
  describe('initializeMCPSDK', () => {
    it('should initialize SDK in development mode', async () => {
      mockApp.isPackaged = false
      
      await initializeMCPSDK()
      
      expect(isMCPSDKInitialized()).toBe(true)
      expect(() => getMCPClient()).not.toThrow()
      expect(() => getStdioClientTransport()).not.toThrow()
    })
    
    it('should initialize SDK in production mode with successful preload', async () => {
      mockApp.isPackaged = true
      const mockResourcesPath = '/app/resources'
      
      Object.defineProperty(process, 'resourcesPath', {
        value: mockResourcesPath,
        configurable: true
      })
      
      // Mock successful cross-spawn preload
      const originalRequire = global.require
      global.require = vi.fn().mockImplementation((modulePath: string) => {
        if (modulePath.includes('cross-spawn')) {
          return { spawn: vi.fn() }
        }
        return originalRequire(modulePath)
      })
      
      try {
        await initializeMCPSDK()
        
        expect(isMCPSDKInitialized()).toBe(true)
        expect(global.require).toHaveBeenCalledWith(
          expect.stringContaining('cross-spawn')
        )
        
      } finally {
        global.require = originalRequire
      }
    })
    
    it('should handle cross-spawn preload failure gracefully', async () => {
      mockApp.isPackaged = true
      const mockResourcesPath = '/app/resources'
      
      Object.defineProperty(process, 'resourcesPath', {
        value: mockResourcesPath,
        configurable: true
      })
      
      // Mock cross-spawn preload failure
      const originalRequire = global.require
      global.require = vi.fn().mockImplementation((modulePath: string) => {
        if (modulePath.includes('cross-spawn')) {
          throw new Error('Module not found')
        }
        return originalRequire(modulePath)
      })
      
      const consoleSpy = vi.spyOn(console, 'warn')
      
      try {
        await initializeMCPSDK()
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to preload cross-spawn')
        )
        expect(isMCPSDKInitialized()).toBe(true)
        
      } finally {
        global.require = originalRequire
      }
    })
    
    it('should fallback to CommonJS when dynamic import fails', async () => {
      // Mock dynamic import to fail
      const originalImport = global.import
      if (originalImport) {
        global.import = vi.fn().mockRejectedValue(new Error('ESM import failed'))
      }
      
      // Mock CommonJS require to succeed
      const mockSDK = {
        Client: vi.fn(),
        StdioClientTransport: vi.fn()
      }
      
      const originalRequire = global.require
      global.require = vi.fn().mockImplementation((moduleName: string) => {
        if (moduleName === '@modelcontextprotocol/sdk') {
          return mockSDK
        }
        return originalRequire(moduleName)
      })
      
      const consoleSpy = vi.spyOn(console, 'error')
      const consoleLogSpy = vi.spyOn(console, 'log')
      
      try {
        await initializeMCPSDK()
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to load MCP SDK modules')
        )
        expect(consoleLogSpy).toHaveBeenCalledWith(
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
    
    it('should throw error when both dynamic import and CommonJS fail', async () => {
      // Mock both dynamic import and CommonJS require to fail
      const originalImport = global.import
      if (originalImport) {
        global.import = vi.fn().mockRejectedValue(new Error('ESM import failed'))
      }
      
      const originalRequire = global.require
      global.require = vi.fn().mockImplementation((moduleName: string) => {
        if (moduleName === '@modelcontextprotocol/sdk') {
          throw new Error('CommonJS require failed')
        }
        return originalRequire(moduleName)
      })
      
      const consoleSpy = vi.spyOn(console, 'error')
      
      try {
        await expect(initializeMCPSDK()).rejects.toThrow(
          'Failed to load MCP SDK modules. The application cannot continue.'
        )
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('CommonJS fallback also failed')
        )
        expect(isMCPSDKInitialized()).toBe(false)
        
      } finally {
        global.require = originalRequire
        if (originalImport) {
          global.import = originalImport
        }
      }
    })
    
    it('should handle successful dynamic imports with correct module paths', async () => {
      const clientModule = {
        Client: vi.fn().mockImplementation(() => ({
          connect: vi.fn(),
          listTools: vi.fn().mockResolvedValue({ tools: [] })
        }))
      }
      
      const stdioModule = {
        StdioClientTransport: vi.fn().mockImplementation(() => ({
          close: vi.fn()
        }))
      }
      
      // Mock dynamic import to return specific modules
      const originalImport = global.import
      if (originalImport) {
        global.import = vi.fn().mockImplementation((moduleName: string) => {
          if (moduleName === '@modelcontextprotocol/sdk/client/index.js') {
            return Promise.resolve(clientModule)
          }
          if (moduleName === '@modelcontextprotocol/sdk/client/stdio.js') {
            return Promise.resolve(stdioModule)
          }
          return originalImport(moduleName)
        })
      }
      
      const consoleSpy = vi.spyOn(console, 'log')
      
      try {
        await initializeMCPSDK()
        
        expect(global.import).toHaveBeenCalledWith('@modelcontextprotocol/sdk/client/index.js')
        expect(global.import).toHaveBeenCalledWith('@modelcontextprotocol/sdk/client/stdio.js')
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Successfully loaded MCP SDK modules')
        )
        expect(isMCPSDKInitialized()).toBe(true)
        
      } finally {
        if (originalImport) {
          global.import = originalImport
        }
      }
    })
    
    it('should handle different resource path configurations', async () => {
      mockApp.isPackaged = true
      
      const testPaths = [
        '/Applications/SpeakMCP.app/Contents/Resources',
        '/usr/local/lib/speakmcp/resources',
        'C:\\Program Files\\SpeakMCP\\resources'
      ]
      
      for (const testPath of testPaths) {
        Object.defineProperty(process, 'resourcesPath', {
          value: testPath,
          configurable: true
        })
        
        const originalRequire = global.require
        global.require = vi.fn().mockImplementation((modulePath: string) => {
          if (modulePath.includes('cross-spawn')) {
            return { spawn: vi.fn() }
          }
          return originalRequire(modulePath)
        })
        
        try {
          // Reset SDK state
          vi.resetModules()
          
          await initializeMCPSDK()
          
          expect(global.require).toHaveBeenCalledWith(
            expect.stringMatching(new RegExp(testPath.replace(/\\/g, '\\\\')))
          )
          
        } finally {
          global.require = originalRequire
        }
      }
    })
  })
  
  describe('getMCPClient', () => {
    it('should return Client after successful initialization', async () => {
      await initializeMCPSDK()
      
      const Client = getMCPClient()
      expect(Client).toBeDefined()
      expect(typeof Client).toBe('function')
    })
    
    it('should throw error if not initialized', () => {
      expect(() => getMCPClient()).toThrow(
        'MCP SDK not initialized. Call initializeMCPSDK() first.'
      )
    })
  })
  
  describe('getStdioClientTransport', () => {
    it('should return StdioClientTransport after successful initialization', async () => {
      await initializeMCPSDK()
      
      const StdioClientTransport = getStdioClientTransport()
      expect(StdioClientTransport).toBeDefined()
      expect(typeof StdioClientTransport).toBe('function')
    })
    
    it('should throw error if not initialized', () => {
      expect(() => getStdioClientTransport()).toThrow(
        'MCP SDK not initialized. Call initializeMCPSDK() first.'
      )
    })
  })
  
  describe('isMCPSDKInitialized', () => {
    it('should return false before initialization', () => {
      expect(isMCPSDKInitialized()).toBe(false)
    })
    
    it('should return true after successful initialization', async () => {
      await initializeMCPSDK()
      expect(isMCPSDKInitialized()).toBe(true)
    })
    
    it('should return false after failed initialization', async () => {
      // Mock both dynamic import and CommonJS require to fail
      const originalImport = global.import
      if (originalImport) {
        global.import = vi.fn().mockRejectedValue(new Error('ESM import failed'))
      }
      
      const originalRequire = global.require
      global.require = vi.fn().mockImplementation((moduleName: string) => {
        if (moduleName === '@modelcontextprotocol/sdk') {
          throw new Error('CommonJS require failed')
        }
        return originalRequire(moduleName)
      })
      
      try {
        await expect(initializeMCPSDK()).rejects.toThrow()
        expect(isMCPSDKInitialized()).toBe(false)
        
      } finally {
        global.require = originalRequire
        if (originalImport) {
          global.import = originalImport
        }
      }
    })
  })
  
  describe('Cross-platform compatibility', () => {
    const platforms = ['win32', 'darwin', 'linux']
    const originalPlatform = process.platform
    
    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })
    
    it.each(platforms)('should work on %s platform', async (platform) => {
      Object.defineProperty(process, 'platform', { value: platform })
      mockApp.isPackaged = true
      
      const mockResourcesPath = platform === 'win32' 
        ? 'C:\\Program Files\\SpeakMCP\\resources'
        : '/Applications/SpeakMCP.app/Contents/Resources'
      
      Object.defineProperty(process, 'resourcesPath', {
        value: mockResourcesPath,
        configurable: true
      })
      
      const originalRequire = global.require
      global.require = vi.fn().mockImplementation((modulePath: string) => {
        if (modulePath.includes('cross-spawn')) {
          return { spawn: vi.fn() }
        }
        return originalRequire(modulePath)
      })
      
      try {
        await initializeMCPSDK()
        
        expect(isMCPSDKInitialized()).toBe(true)
        
        // Verify correct path format for platform
        const expectedPath = path.join(
          mockResourcesPath,
          'app.asar.unpacked',
          'node_modules',
          'cross-spawn',
          'index.js'
        )
        
        expect(global.require).toHaveBeenCalledWith(expectedPath)
        
      } finally {
        global.require = originalRequire
      }
    })
  })
  
  describe('Error scenarios and recovery', () => {
    it('should handle partial module loading', async () => {
      // Mock scenario where Client loads but StdioClientTransport fails
      const originalImport = global.import
      if (originalImport) {
        global.import = vi.fn().mockImplementation((moduleName: string) => {
          if (moduleName === '@modelcontextprotocol/sdk/client/index.js') {
            return Promise.resolve({ Client: vi.fn() })
          }
          if (moduleName === '@modelcontextprotocol/sdk/client/stdio.js') {
            return Promise.reject(new Error('StdioClientTransport import failed'))
          }
          return originalImport(moduleName)
        })
      }
      
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
      
      try {
        await initializeMCPSDK()
        
        // Should fallback to CommonJS and succeed
        expect(isMCPSDKInitialized()).toBe(true)
        
      } finally {
        global.require = originalRequire
        if (originalImport) {
          global.import = originalImport
        }
      }
    })
    
    it('should handle multiple initialization attempts', async () => {
      // First initialization should succeed
      await initializeMCPSDK()
      expect(isMCPSDKInitialized()).toBe(true)
      
      // Second initialization should not cause issues
      await initializeMCPSDK()
      expect(isMCPSDKInitialized()).toBe(true)
      
      // Client and transport should still be accessible
      expect(() => getMCPClient()).not.toThrow()
      expect(() => getStdioClientTransport()).not.toThrow()
    })
    
    it('should handle concurrent initialization attempts', async () => {
      // Start multiple initialization attempts simultaneously
      const promises = [
        initializeMCPSDK(),
        initializeMCPSDK(),
        initializeMCPSDK()
      ]
      
      await Promise.all(promises)
      
      expect(isMCPSDKInitialized()).toBe(true)
      expect(() => getMCPClient()).not.toThrow()
      expect(() => getStdioClientTransport()).not.toThrow()
    })
  })
})
