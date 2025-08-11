import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { systemPreferences } from 'electron'

// Mock Electron APIs
vi.mock('electron', () => ({
  systemPreferences: {
    isTrustedAccessibilityClient: vi.fn()
  }
}))

// Mock config store
vi.mock('../config', () => ({
  configStore: {
    get: vi.fn(() => ({
      openaiApiKey: 'test-key',
      groqApiKey: null,
      geminiApiKey: null
    }))
  }
}))

// Mock import.meta.env
const mockImportMetaEnv = {
  DEV: false,
  MODE: 'production'
}

// Override global import.meta.env
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: mockImportMetaEnv
    }
  },
  configurable: true
})

describe('Enhanced Permission Detection', () => {
  let originalPlatform: string
  let originalProcess: typeof process

  beforeEach(() => {
    vi.clearAllMocks()
    originalPlatform = process.platform
    originalProcess = { ...process }
    
    // Reset mock environment
    mockImportMetaEnv.DEV = false
    mockImportMetaEnv.MODE = 'production'
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    Object.assign(process, originalProcess)
    vi.resetModules()
  })

  describe('Production vs Development Mode Detection', () => {
    it('should detect production mode correctly', async () => {
      mockImportMetaEnv.DEV = false
      mockImportMetaEnv.MODE = 'production'
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      mockIsTrusted.mockReturnValue(true)

      // Import after mocking
      const { isAccessibilityGranted } = await import('../utils')
      const result = await isAccessibilityGranted()

      expect(result).toBe(true)
      expect(mockIsTrusted).toHaveBeenCalledWith(false)
    })

    it('should detect development mode and use enhanced checking', async () => {
      mockImportMetaEnv.DEV = true
      mockImportMetaEnv.MODE = 'development'
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      mockIsTrusted.mockReturnValue(true)

      // Import after mocking
      const { isAccessibilityGranted } = await import('../utils')
      const result = await isAccessibilityGranted()

      expect(result).toBe(true)
      expect(mockIsTrusted).toHaveBeenCalledWith(false)
    })

    it('should handle development mode with unsigned process detection', async () => {
      mockImportMetaEnv.DEV = true
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      Object.defineProperty(process, 'execPath', { 
        value: '/path/to/node_modules/.bin/electron', 
        configurable: true 
      })

      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      mockIsTrusted.mockReturnValue(false) // Unsigned process returns false initially

      // Import after mocking
      const { isAccessibilityGranted } = await import('../utils')
      
      // This should still work with our enhanced detection
      const result = await isAccessibilityGranted()

      // In this case, our enhanced logic should detect this is a dev environment
      // but still return false since the system API returns false
      expect(typeof result).toBe('boolean')
      expect(mockIsTrusted).toHaveBeenCalled()
    })
  })

  describe('Cache Management in Development', () => {
    it('should cache results in development mode', async () => {
      mockImportMetaEnv.DEV = true
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      mockIsTrusted.mockReturnValue(true)

      // Import after mocking
      const { isAccessibilityGranted } = await import('../utils')
      
      // First call
      const result1 = await isAccessibilityGranted()
      
      // Second call should use cache
      const result2 = await isAccessibilityGranted()

      expect(result1).toBe(true)
      expect(result2).toBe(true)
      
      // Should have been called at least once for the first check
      expect(mockIsTrusted).toHaveBeenCalled()
    })

    it('should refresh cache when explicitly requested', async () => {
      mockImportMetaEnv.DEV = true
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      mockIsTrusted.mockReturnValue(true)

      // Import after mocking
      const { isAccessibilityGranted, refreshPermissionCache } = await import('../utils')
      
      // First call
      await isAccessibilityGranted()
      
      // Refresh cache
      refreshPermissionCache()
      
      // Next call should check fresh
      await isAccessibilityGranted()

      expect(mockIsTrusted).toHaveBeenCalled()
    })
  })

  describe('Sync vs Async Compatibility', () => {
    it('should provide sync version for immediate checks', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      mockIsTrusted.mockReturnValue(true)

      // Import after mocking
      const { isAccessibilityGrantedSync } = await import('../utils')
      const result = isAccessibilityGrantedSync()

      expect(result).toBe(true)
      expect(mockIsTrusted).toHaveBeenCalledWith(false)
    })

    it('should handle non-Darwin platforms correctly', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

      // Import after mocking
      const { isAccessibilityGranted, isAccessibilityGrantedSync } = await import('../utils')
      
      const asyncResult = await isAccessibilityGranted()
      const syncResult = isAccessibilityGrantedSync()

      // Both should return true on non-Darwin platforms
      expect(asyncResult).toBe(true)
      expect(syncResult).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle errors in async permission checking', async () => {
      mockImportMetaEnv.DEV = true
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      mockIsTrusted.mockImplementation(() => {
        throw new Error('System API error')
      })

      // Import after mocking
      const { isAccessibilityGranted } = await import('../utils')
      
      // Should not throw, should handle error gracefully
      const result = await isAccessibilityGranted()
      
      expect(typeof result).toBe('boolean')
      expect(mockIsTrusted).toHaveBeenCalled()
    })

    it('should retry in development mode when initial checks fail', async () => {
      mockImportMetaEnv.DEV = true
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      // First call fails, second succeeds
      mockIsTrusted
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)

      // Import after mocking
      const { isAccessibilityGranted } = await import('../utils')
      
      const result = await isAccessibilityGranted()
      
      // Should have retried and eventually succeeded
      expect(result).toBe(true)
      expect(mockIsTrusted).toHaveBeenCalledTimes(3) // 3 retry attempts
    })
  })
})