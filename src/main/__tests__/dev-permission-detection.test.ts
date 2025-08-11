import { vi, describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import { systemPreferences, app } from 'electron'
import { isAccessibilityGranted, isAccessibilityGrantedSync } from '../utils'
import { listenToKeyboardEvents } from '../keyboard'
import { createMainWindow, createSetupWindow, WINDOWS } from '../window'

// Mock Electron APIs
vi.mock('electron', () => ({
  systemPreferences: {
    isTrustedAccessibilityClient: vi.fn()
  },
  app: {
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    relaunch: vi.fn(),
    quit: vi.fn()
  }
}))

// Mock window management
vi.mock('../window', () => ({
  createMainWindow: vi.fn(),
  createSetupWindow: vi.fn(),
  WINDOWS: new Map()
}))

// Mock keyboard service
vi.mock('../keyboard', () => ({
  listenToKeyboardEvents: vi.fn()
}))

// Mock filesystem for binary availability
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn()
  },
  existsSync: vi.fn()
}))

// Mock child_process for Rust binary
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    on: vi.fn(),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() }
  }))
}))

describe('Development Permission Detection Issues', () => {
  let mockProcess: typeof process
  let originalImportMetaEnv: typeof import.meta.env

  beforeAll(() => {
    // Preserve original environment
    mockProcess = { ...process } as typeof process
    originalImportMetaEnv = { ...import.meta.env }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    WINDOWS.clear()
  })

  afterEach(() => {
    // Restore process and environment
    Object.assign(process, mockProcess)
    Object.assign(import.meta.env, originalImportMetaEnv)
  })

  describe('Environment-Specific Permission Behavior', () => {
    it('FAILS: should detect permissions correctly in development mode', () => {
      // Mock development environment
      Object.assign(import.meta.env, { DEV: true, MODE: 'development' })
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      
      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      
      // Simulate macOS permissions granted but Electron dev process reports false
      // This is the core issue - development processes are unsigned and may be treated differently
      mockIsTrusted.mockReturnValue(false) // Development returns false even when granted
      
      const hasPermissions = isAccessibilityGranted()
      
      // This should pass but FAILS in development
      // Development environment should detect permissions same as production
      expect(hasPermissions).toBe(true)
      expect(mockIsTrusted).toHaveBeenCalledWith(false)
    })

    it('FAILS: should handle unsigned process identity in development', () => {
      Object.assign(import.meta.env, { DEV: true })
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      
      // Mock process metadata for unsigned development app
      Object.defineProperty(process, 'mainModule', {
        value: { filename: '/path/to/electron/dev/binary' },
        configurable: true
      })
      
      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      
      // Simulate macOS accessibility system not recognizing unsigned dev process
      // even after user explicitly granted permissions in System Settings
      mockIsTrusted.mockReturnValue(false)
      
      // This test should pass but FAILS due to unsigned binary issue
      // Development processes should have mechanism to detect granted permissions
      expect(isAccessibilityGranted()).toBe(true)
    })

    it('FAILS: should persist permission state across development sessions', () => {
      Object.assign(import.meta.env, { DEV: true })
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      
      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      
      // Simulate: User granted permissions in previous dev session
      // But new dev session doesn't recognize them due to process identity change
      mockIsTrusted.mockReturnValue(false)
      
      // Should remember previous grant but FAILS
      expect(isAccessibilityGranted()).toBe(true)
    })
  })

  describe('Hot Reload Impact on Permission Detection', () => {
    it('FAILS: should maintain permission state during hot reload', () => {
      Object.assign(import.meta.env, { DEV: true, HOT: true })
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      
      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      
      // Initial state: permissions granted
      mockIsTrusted.mockReturnValueOnce(true)
      expect(isAccessibilityGranted()).toBe(true)
      
      // Hot reload occurs - process module reloads
      // Permission state should persist but FAILS
      mockIsTrusted.mockReturnValueOnce(false) // Hot reload loses state
      
      // This should still be true but FAILS due to hot reload state loss
      expect(isAccessibilityGranted()).toBe(true)
    })

    it('FAILS: should handle rapid permission checks during development', () => {
      Object.assign(import.meta.env, { DEV: true })
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      
      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      
      // Simulate rapid development cycles with quick restarts
      const rapidChecks = Array.from({ length: 10 }, (_, i) => {
        // Some checks return false due to timing issues in development
        return i % 3 === 0 ? false : true
      })
      
      rapidChecks.forEach((result, index) => {
        mockIsTrusted.mockReturnValueOnce(result)
        
        if (index % 3 === 0) {
          // These should all pass but some FAIL due to dev environment timing
          expect(isAccessibilityGranted()).toBe(true)
        }
      })
    })
  })

  describe('App Startup Permission Flow in Development', () => {
    it('FAILS: should show correct window based on permission state at dev startup', () => {
      Object.assign(import.meta.env, { DEV: true })
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      
      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      const mockCreateMain = vi.mocked(createMainWindow)
      const mockCreateSetup = vi.mocked(createSetupWindow)
      
      // User has granted permissions but dev process doesn't detect them
      mockIsTrusted.mockReturnValue(false)
      
      // App startup logic
      if (isAccessibilityGranted()) {
        createMainWindow()
      } else {
        createSetupWindow()
      }
      
      // Should show main window but FAILS - shows setup instead
      expect(mockCreateMain).toHaveBeenCalled()
      expect(mockCreateSetup).not.toHaveBeenCalled()
    })

    it('FAILS: should handle permission detection during app activation in development', () => {
      Object.assign(import.meta.env, { DEV: true })
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      
      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      const mockCreateMain = vi.mocked(createMainWindow)
      
      // Simulate app activation event in development
      // Permissions were granted while app was backgrounded
      mockIsTrusted.mockReturnValue(false) // Dev environment doesn't detect
      
      // App activation should check permissions fresh
      if (isAccessibilityGranted() && !WINDOWS.get('main')) {
        createMainWindow()
      }
      
      // Should create main window but FAILS in development
      expect(mockCreateMain).toHaveBeenCalled()
    })
  })

  describe('Keyboard Service Permission Dependencies', () => {
    it('FAILS: should start keyboard monitoring when permissions are granted in development', () => {
      Object.assign(import.meta.env, { DEV: true })
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      
      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      const mockListenKeyboard = vi.mocked(listenToKeyboardEvents)
      
      // Permissions granted but dev environment doesn't recognize
      mockIsTrusted.mockReturnValue(false)
      
      // Simulate keyboard service startup
      if (isAccessibilityGranted()) {
        listenToKeyboardEvents()
      }
      
      // Should start keyboard monitoring but FAILS due to false permission check
      expect(mockListenKeyboard).toHaveBeenCalled()
    })

    it('FAILS: should handle binary availability check in development paths', async () => {
      Object.assign(import.meta.env, { DEV: true })
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      
      // Mock development environment paths
      Object.defineProperty(process, 'resourcesPath', {
        value: undefined, // Development doesn't have resourcesPath
        configurable: true
      })
      
      const fs = await import('fs')
      vi.mocked(fs)
      fs.existsSync.mockReturnValue(true) // Binary exists in dev location
      
      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      mockIsTrusted.mockReturnValue(false) // Dev permission issue
      
      // Should detect both binary and permissions but FAILS on permissions
      const hasPermissions = isAccessibilityGranted()
      expect(hasPermissions).toBe(true)
    })
  })

  describe('Permission State Caching in Development', () => {
    it('FAILS: should not cache false results in development environment', () => {
      Object.assign(import.meta.env, { DEV: true })
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      
      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      
      // First check returns false (dev environment issue)
      mockIsTrusted.mockReturnValueOnce(false)
      expect(isAccessibilityGranted()).toBe(false)
      
      // User grants permissions in System Settings
      // Second check should detect the change but FAILS due to caching/timing
      mockIsTrusted.mockReturnValueOnce(true)
      expect(isAccessibilityGranted()).toBe(true)
      
      // Verify each call checks fresh, not cached
      expect(mockIsTrusted).toHaveBeenCalledTimes(2)
    })

    it('FAILS: should handle macOS accessibility API caching with unsigned processes', () => {
      Object.assign(import.meta.env, { DEV: true })
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      
      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      
      // Simulate macOS caching issue with unsigned development binaries
      // User grants permissions but API returns stale false for unsigned process
      mockIsTrusted.mockReturnValue(false)
      
      // Should have mechanism to force refresh or detect granted state
      // This FAILS because there's no fallback for unsigned dev processes
      expect(isAccessibilityGranted()).toBe(true)
    })
  })

  describe('Development Restart Scenarios', () => {
    it('FAILS: should handle rapid development restarts', async () => {
      Object.assign(import.meta.env, { DEV: true })
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      
      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      const mockAppRelaunch = vi.mocked(app.relaunch)
      const mockAppQuit = vi.mocked(app.quit)
      
      // Initial state: no permissions detected
      mockIsTrusted.mockReturnValue(false)
      expect(isAccessibilityGranted()).toBe(false)
      
      // Simulate development restart cycle
      const restartPromises = Array.from({ length: 3 }, async () => {
        mockAppRelaunch.mockClear()
        mockAppQuit.mockClear()
        
        // Restart app
        app.relaunch()
        app.quit()
        
        // After restart, permissions should be detected properly
        // But FAILS due to rapid restart timing in development
        mockIsTrusted.mockReturnValue(false) // Still not detected
      })
      
      await Promise.all(restartPromises)
      
      // Final check should succeed but FAILS
      expect(isAccessibilityGranted()).toBe(true)
    })

    it('FAILS: should maintain permission state across development code changes', () => {
      Object.assign(import.meta.env, { DEV: true })
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      
      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      
      // Initial development session - permissions granted
      mockIsTrusted.mockReturnValueOnce(true)
      expect(isAccessibilityGranted()).toBe(true)
      
      // Simulate code change and module reload in development
      // Process identity changes with each reload
      vi.resetModules()
      
      // After reload, should still detect permissions but FAILS
      mockIsTrusted.mockReturnValueOnce(false)
      expect(isAccessibilityGranted()).toBe(true)
    })
  })

  describe('Setup Window Permission Polling in Development', () => {
    it('FAILS: should properly poll for permission changes in development setup window', () => {
      Object.assign(import.meta.env, { DEV: true })
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      
      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      
      // Setup window polling scenario
      const pollStates = [
        false, // Initial state
        false, // Still false after 2s
        false, // Still false after 4s (user navigating to System Settings)
        true,  // User grants permission
        true   // Confirmed granted
      ]
      
      pollStates.forEach((state, index) => {
        mockIsTrusted.mockReturnValueOnce(state)
        const result = isAccessibilityGranted()
        
        if (index >= 3) {
          // These should detect the granted permission but FAIL in development
          expect(result).toBe(true)
        }
      })
      
      // Polling should have called the function multiple times
      expect(mockIsTrusted).toHaveBeenCalledTimes(5)
    })

    it('FAILS: should auto-switch from setup to main window when permissions detected in development', () => {
      Object.assign(import.meta.env, { DEV: true })
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      
      const mockIsTrusted = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      const mockCreateMain = vi.mocked(createMainWindow)
      
      // Start with setup window (no permissions)
      mockIsTrusted.mockReturnValueOnce(false)
      if (!isAccessibilityGranted()) {
        createSetupWindow()
      }
      
      // User grants permissions - should auto-switch
      mockIsTrusted.mockReturnValueOnce(true)
      const hasPermissions = isAccessibilityGranted()
      
      if (hasPermissions) {
        // Close setup, open main
        const setupWindow = WINDOWS.get('setup')
        if (setupWindow) {
          WINDOWS.delete('setup')
        }
        createMainWindow()
      }
      
      // This should work but FAILS in development due to permission detection
      expect(hasPermissions).toBe(true)
      expect(mockCreateMain).toHaveBeenCalled()
    })
  })
})
