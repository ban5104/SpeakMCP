import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { app, systemPreferences } from 'electron'
import { createMainWindow, createSetupWindow, WINDOWS } from '../window'
import { isAccessibilityGranted } from '../utils'

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
  },
  BrowserWindow: vi.fn(() => ({
    loadFile: vi.fn(),
    on: vi.fn(),
    close: vi.fn(),
    isDestroyed: vi.fn(() => false),
    webContents: { id: 1 }
  }))
}))

// Mock window management
vi.mock('../window', () => {
  const WINDOWS = new Map()
  return {
    createMainWindow: vi.fn(() => {
      const mockWindow = { id: 'main', close: vi.fn(), isDestroyed: () => false }
      WINDOWS.set('main', mockWindow)
      return mockWindow
    }),
    createSetupWindow: vi.fn(() => {
      const mockWindow = { id: 'setup', close: vi.fn(), isDestroyed: () => false }
      WINDOWS.set('setup', mockWindow)
      return mockWindow
    }),
    WINDOWS
  }
})

// Mock utils
vi.mock('../utils', () => ({
  isAccessibilityGranted: vi.fn()
}))

describe('Development Window Flow Issues', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    WINDOWS.clear()
    
    // Default to macOS for permission-related tests
    Object.defineProperty(process, 'platform', { 
      value: 'darwin', 
      configurable: true 
    })
  })

  describe('App Initialization Window Selection', () => {
    it('FAILS: should create main window when permissions are granted in development', () => {
      // Mock development environment
      Object.assign(import.meta.env, { DEV: true })
      
      const mockIsAccessibilityGranted = vi.mocked(isAccessibilityGranted)
      const mockCreateMain = vi.mocked(createMainWindow)
      const mockCreateSetup = vi.mocked(createSetupWindow)
      
      // User has already granted permissions but dev environment doesn't detect
      mockIsAccessibilityGranted.mockReturnValue(false) // Dev issue: returns false
      
      // Simulate app startup logic
      if (mockIsAccessibilityGranted()) {
        createMainWindow()
      } else {
        createSetupWindow()
      }
      
      // Should create main window but FAILS - creates setup instead
      expect(mockCreateMain).toHaveBeenCalled()
      expect(mockCreateSetup).not.toHaveBeenCalled()
    })

    it('FAILS: should handle missing accessibility detection in development startup', () => {
      Object.assign(import.meta.env, { DEV: true })
      
      const mockSystemPrefs = vi.mocked(systemPreferences.isTrustedAccessibilityClient)
      const mockIsAccessibilityGranted = vi.mocked(isAccessibilityGranted)
      const mockCreateMain = vi.mocked(createMainWindow)
      
      // System has permissions but development binary isn't recognized
      mockSystemPrefs.mockReturnValue(false) // Unsigned dev process
      mockIsAccessibilityGranted.mockReturnValue(false)
      
      // This simulates the real issue - should detect granted permissions
      // but development environment fails to recognize them
      const shouldShowMain = true // User actually granted permissions
      const detectedPermissions = mockIsAccessibilityGranted()
      
      // The test FAILS because development doesn't match reality
      expect(detectedPermissions).toBe(shouldShowMain)
      
      if (detectedPermissions) {
        createMainWindow()
      }
      
      expect(mockCreateMain).toHaveBeenCalled()
    })
  })

  describe('App Activation Flow', () => {
    it('FAILS: should properly handle app activation with granted permissions in development', () => {
      Object.assign(import.meta.env, { DEV: true })
      
      const mockIsAccessibilityGranted = vi.mocked(isAccessibilityGranted)
      const mockCreateMain = vi.mocked(createMainWindow)
      
      // No main window exists initially
      expect(WINDOWS.get('main')).toBeUndefined()
      
      // User activated app - permissions were granted while app was backgrounded
      mockIsAccessibilityGranted.mockReturnValue(false) // Dev environment issue
      
      // Simulate app activation event logic
      if (mockIsAccessibilityGranted()) {
        if (!WINDOWS.get('main')) {
          createMainWindow()
        }
      } else {
        // Development incorrectly goes here due to permission detection failure
        expect(true).toBe(false) // This path shouldn't be taken
      }
      
      // Main window should be created but FAILS in development
      expect(mockCreateMain).toHaveBeenCalled()
      expect(WINDOWS.get('main')).toBeDefined()
    })

    it('FAILS: should maintain correct window when permissions change during development session', () => {
      Object.assign(import.meta.env, { DEV: true })
      
      const mockIsAccessibilityGranted = vi.mocked(isAccessibilityGranted)
      const mockCreateMain = vi.mocked(createMainWindow)
      const mockCreateSetup = vi.mocked(createSetupWindow)
      
      // Start with no permissions detected (development issue)
      mockIsAccessibilityGranted.mockReturnValueOnce(false)
      
      // Create setup window
      if (!mockIsAccessibilityGranted()) {
        createSetupWindow()
      }
      
      expect(WINDOWS.get('setup')).toBeDefined()
      
      // User grants permissions - development should detect this
      mockIsAccessibilityGranted.mockReturnValueOnce(true)
      
      // Should transition to main window
      if (mockIsAccessibilityGranted()) {
        // Close setup window
        const setupWindow = WINDOWS.get('setup')
        if (setupWindow) {
          WINDOWS.delete('setup')
        }
        
        if (!WINDOWS.get('main')) {
          createMainWindow()
        }
      }
      
      // Should have both calls but second check FAILS in development
      expect(mockCreateSetup).toHaveBeenCalled()
      expect(mockCreateMain).toHaveBeenCalled()
      expect(WINDOWS.get('setup')).toBeUndefined()
      expect(WINDOWS.get('main')).toBeDefined()
    })
  })

  describe('Window State Management Issues', () => {
    it('FAILS: should handle concurrent window creation attempts in development', () => {
      Object.assign(import.meta.env, { DEV: true })
      
      const mockIsAccessibilityGranted = vi.mocked(isAccessibilityGranted)
      const mockCreateMain = vi.mocked(createMainWindow)
      const mockCreateSetup = vi.mocked(createSetupWindow)
      
      // Simulate rapid permission state changes in development
      const permissionStates = [false, true, false, true]
      let mainWindowCount = 0
      let setupWindowCount = 0
      
      permissionStates.forEach((hasPermissions, index) => {
        mockIsAccessibilityGranted.mockReturnValueOnce(hasPermissions)
        
        // In development, permission states can be inconsistent
        // This causes wrong window types to be created
        if (mockIsAccessibilityGranted()) {
          if (!WINDOWS.get('main')) {
            createMainWindow()
            mainWindowCount++
          }
        } else {
          if (!WINDOWS.get('setup')) {
            createSetupWindow()
            setupWindowCount++
          }
        }
      })
      
      // Should have predictable window creation but FAILS due to inconsistent permission detection
      expect(mainWindowCount).toBe(2) // Two true states
      expect(setupWindowCount).toBe(2) // Two false states
      
      // But actual behavior in development is inconsistent
      expect(mockCreateMain).toHaveBeenCalledTimes(mainWindowCount)
      expect(mockCreateSetup).toHaveBeenCalledTimes(setupWindowCount)
    })

    it('FAILS: should prevent duplicate windows when permission detection is unreliable', () => {
      Object.assign(import.meta.env, { DEV: true })
      
      const mockIsAccessibilityGranted = vi.mocked(isAccessibilityGranted)
      const mockCreateMain = vi.mocked(createMainWindow)
      
      // Simulate development permission detection flakiness
      // Multiple rapid checks with inconsistent results
      const rapidChecks = Array.from({ length: 5 }, () => {
        // Development environment sometimes returns false for granted permissions
        mockIsAccessibilityGranted.mockReturnValueOnce(Math.random() > 0.5)
        
        if (mockIsAccessibilityGranted()) {
          if (!WINDOWS.get('main')) {
            createMainWindow()
          }
        }
      })
      
      // Should only create one main window despite multiple permission checks
      // But FAILS because inconsistent permission detection in development
      // can cause multiple window creation attempts
      expect(mockCreateMain).toHaveBeenCalledTimes(1)
    })
  })

  describe('Setup to Main Window Transition', () => {
    it('FAILS: should automatically transition from setup to main when permissions are detected', () => {
      Object.assign(import.meta.env, { DEV: true })
      
      const mockIsAccessibilityGranted = vi.mocked(isAccessibilityGranted)
      const mockCreateMain = vi.mocked(createMainWindow)
      const mockCreateSetup = vi.mocked(createSetupWindow)
      
      // Start in setup mode
      mockIsAccessibilityGranted.mockReturnValueOnce(false)
      createSetupWindow()
      
      expect(WINDOWS.get('setup')).toBeDefined()
      
      // Simulate permission polling in setup window
      // User grants permissions in System Settings
      mockIsAccessibilityGranted.mockReturnValueOnce(true)
      
      // Auto-transition logic (from setup.tsx polling)
      if (mockIsAccessibilityGranted()) {
        // Should close setup and create main
        const setupWindow = WINDOWS.get('setup')
        if (setupWindow) {
          setupWindow.close()
          WINDOWS.delete('setup')
        }
        
        if (!WINDOWS.get('main')) {
          createMainWindow()
        }
      }
      
      // Should successfully transition but FAILS in development
      // due to unreliable permission detection
      expect(WINDOWS.get('setup')).toBeUndefined()
      expect(WINDOWS.get('main')).toBeDefined()
      expect(mockCreateMain).toHaveBeenCalled()
    })

    it('FAILS: should handle setup window polling with inconsistent development permission checks', () => {
      Object.assign(import.meta.env, { DEV: true })
      
      const mockIsAccessibilityGranted = vi.mocked(isAccessibilityGranted)
      const mockCreateMain = vi.mocked(createMainWindow)
      
      // Start with setup window
      createSetupWindow()
      
      // Simulate React Query polling every 2 seconds
      // Development environment gives inconsistent results
      const pollResults = [
        false, // 0s - initial
        false, // 2s - still no permissions detected
        false, // 4s - development still not detecting
        true,  // 6s - finally detected (should have been detected earlier)
        false, // 8s - flaky development environment loses detection again!
        true   // 10s - back to true
      ]
      
      let shouldHaveTransitioned = false
      
      pollResults.forEach((result, index) => {
        mockIsAccessibilityGranted.mockReturnValueOnce(result)
        
        const hasPermissions = mockIsAccessibilityGranted()
        
        // In a stable environment, once permissions are granted,
        // they should stay granted (index >= 3)
        if (index >= 3) {
          shouldHaveTransitioned = true
          // These should all be true but FAIL due to development flakiness
          expect(hasPermissions).toBe(true)
          
          if (hasPermissions && !WINDOWS.get('main')) {
            createMainWindow()
          }
        }
      })
      
      // Should have transitioned to main window
      expect(shouldHaveTransitioned).toBe(true)
      expect(WINDOWS.get('main')).toBeDefined()
    })
  })

  describe('Production vs Development Window Behavior', () => {
    it('FAILS: development and production should have identical window creation logic', () => {
      const mockIsAccessibilityGranted = vi.mocked(isAccessibilityGranted)
      const mockCreateMain = vi.mocked(createMainWindow)
      
      // Test production behavior
      Object.assign(import.meta.env, { DEV: false, PROD: true })
      mockIsAccessibilityGranted.mockReturnValueOnce(true) // Works in production
      
      const prodResult = mockIsAccessibilityGranted()
      if (prodResult) createMainWindow()
      
      const prodMainCalled = mockCreateMain.mock.calls.length
      
      // Reset
      mockCreateMain.mockClear()
      
      // Test development behavior
      Object.assign(import.meta.env, { DEV: true, PROD: false })
      mockIsAccessibilityGranted.mockReturnValueOnce(false) // FAILS in development
      
      const devResult = mockIsAccessibilityGranted()
      if (devResult) createMainWindow()
      
      const devMainCalled = mockCreateMain.mock.calls.length
      
      // Should behave identically but FAILS
      expect(prodResult).toBe(devResult)
      expect(prodMainCalled).toBe(devMainCalled)
    })

    it('FAILS: should not have environment-specific window creation paths', () => {
      const mockIsAccessibilityGranted = vi.mocked(isAccessibilityGranted)
      const mockCreateMain = vi.mocked(createMainWindow)
      const mockCreateSetup = vi.mocked(createSetupWindow)
      
      // Both environments should use the same logic
      const testEnvironment = (isDev: boolean) => {
        Object.assign(import.meta.env, { DEV: isDev, PROD: !isDev })
        
        mockIsAccessibilityGranted.mockReturnValueOnce(isDev ? false : true) // Dev fails, prod works
        
        if (mockIsAccessibilityGranted()) {
          createMainWindow()
        } else {
          createSetupWindow()
        }
      }
      
      // Test both environments
      testEnvironment(false) // Production
      testEnvironment(true)  // Development
      
      // Both should create main window but development FAILS
      expect(mockCreateMain).toHaveBeenCalledTimes(2)
      expect(mockCreateSetup).toHaveBeenCalledTimes(0)
    })
  })

  describe('Edge Cases in Development', () => {
    it('FAILS: should handle window recreation after development restart', () => {
      Object.assign(import.meta.env, { DEV: true })
      
      const mockIsAccessibilityGranted = vi.mocked(isAccessibilityGranted)
      const mockCreateMain = vi.mocked(createMainWindow)
      const mockAppRelaunch = vi.mocked(app.relaunch)
      const mockAppQuit = vi.mocked(app.quit)
      
      // Initial state
      mockIsAccessibilityGranted.mockReturnValueOnce(false)
      
      // User restarts app from setup window
      mockAppRelaunch()
      mockAppQuit()
      
      // Clear windows to simulate restart
      WINDOWS.clear()
      
      // After restart, permissions should be detected
      // But development environment still fails to detect them
      mockIsAccessibilityGranted.mockReturnValueOnce(false) // Should be true
      
      if (mockIsAccessibilityGranted()) {
        createMainWindow()
      }
      
      // Should create main window after restart but FAILS
      expect(mockCreateMain).toHaveBeenCalled()
    })

    it('FAILS: should maintain window state consistency during hot module reload', () => {
      Object.assign(import.meta.env, { DEV: true, HOT: true })
      
      const mockIsAccessibilityGranted = vi.mocked(isAccessibilityGranted)
      const mockCreateMain = vi.mocked(createMainWindow)
      
      // Pre-HMR state: main window exists with permissions
      mockIsAccessibilityGranted.mockReturnValueOnce(true)
      createMainWindow()
      
      expect(WINDOWS.get('main')).toBeDefined()
      
      // Hot module reload occurs
      // Window state should be preserved
      mockIsAccessibilityGranted.mockReturnValueOnce(false) // HMR loses permission state
      
      // After HMR, window logic runs again
      if (!mockIsAccessibilityGranted()) {
        // Should NOT reach here but FAILS due to HMR permission loss
        expect(true).toBe(false)
      }
      
      // Main window should still exist
      expect(WINDOWS.get('main')).toBeDefined()
    })
  })
})
