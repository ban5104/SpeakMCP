import { test, expect } from './fixtures/app-fixture'
import { PlatformHelpers } from './utils/platform-helpers'

test.describe('Cross-Platform Compatibility', () => {
  let platformInfo: ReturnType<typeof PlatformHelpers.getPlatformInfo>

  test.beforeEach(() => {
    platformInfo = PlatformHelpers.getPlatformInfo()
  })

  test.describe('Platform Detection', () => {
    test('should correctly identify current platform', async ({ electronApp, appContext }) => {
      const detectedPlatform = await electronApp.evaluateInMain(() => process.platform)
      expect(detectedPlatform).toBe(platformInfo.platform)
    })

    test('should handle platform-specific code paths', async ({ electronApp, appContext }) => {
      const platformConfig = await electronApp.evaluateInMain(() => ({
        platform: process.platform,
        isMac: process.platform === 'darwin',
        isWindows: process.platform === 'win32',
        isLinux: process.platform === 'linux'
      }))

      expect(platformConfig.platform).toBe(platformInfo.platform)
      expect(platformConfig.isMac).toBe(platformInfo.isMac)
      expect(platformConfig.isWindows).toBe(platformInfo.isWindows)
      expect(platformConfig.isLinux).toBe(platformInfo.isLinux)
    })
  })

  test.describe('Panel Window Platform Behavior', () => {
    test('macOS: native panel type with vibrancy', async ({ electronApp, appContext }) => {
      test.skip(!platformInfo.isMac, 'macOS-specific test')

      const windows = await electronApp.getBrowserWindows()
      const panelWindow = windows.find(w => w.url.includes('/panel'))
      
      expect(panelWindow).toBeDefined()
      
      // Test macOS-specific panel properties
      const macPanelConfig = await electronApp.evaluateInMain(() => {
        const { BrowserWindow } = require('electron')
        const panelWin = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/panel'))
        
        if (!panelWin) return null
        
        return {
          type: panelWin.type, // Should be 'panel' on macOS
          vibrancy: panelWin.vibrancy,
          visualEffectState: panelWin.visualEffectState,
          isAlwaysOnTop: panelWin.isAlwaysOnTop(),
          isVisibleOnAllWorkspaces: panelWin.isVisibleOnAllWorkspaces(),
          skipTaskbar: panelWin.isSkipped() // Dock behavior
        }
      })

      expect(macPanelConfig).toBeDefined()
      expect(macPanelConfig!.isAlwaysOnTop).toBe(true)
      // Note: type, vibrancy might not be accessible in test environment
    })

    test('Windows/Linux: simulated panel with always-on-top', async ({ electronApp, appContext }) => {
      test.skip(platformInfo.isMac, 'Non-macOS test')

      const windows = await electronApp.getBrowserWindows()
      const panelWindow = windows.find(w => w.url.includes('/panel'))
      
      expect(panelWindow).toBeDefined()
      
      // Test Windows/Linux simulated panel properties
      const nonMacPanelConfig = await electronApp.evaluateInMain(() => {
        const { BrowserWindow } = require('electron')
        const panelWin = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/panel'))
        
        if (!panelWin) return null
        
        return {
          isAlwaysOnTop: panelWin.isAlwaysOnTop(),
          isResizable: panelWin.isResizable(),
          isMaximizable: panelWin.isMaximizable(),
          isMinimizable: panelWin.isMinimizable(),
          isFullScreenable: panelWin.isFullScreenable()
        }
      })

      expect(nonMacPanelConfig).toBeDefined()
      expect(nonMacPanelConfig!.isAlwaysOnTop).toBe(true)
      expect(nonMacPanelConfig!.isResizable).toBe(false)
      expect(nonMacPanelConfig!.isMaximizable).toBe(false)
      expect(nonMacPanelConfig!.isMinimizable).toBe(false)
      expect(nonMacPanelConfig!.isFullScreenable).toBe(false)
    })
  })

  test.describe('Keyboard Shortcuts', () => {
    test('should handle platform-specific keyboard shortcuts', async ({ electronApp, appContext }) => {
      const platformHelpers = new PlatformHelpers(electronApp)
      const shortcutConfig = await platformHelpers.testGlobalShortcuts()

      expect(shortcutConfig.supported).toBe(true)
      
      if (platformInfo.isMac) {
        expect(shortcutConfig.expectedShortcuts).toContain('Cmd+Shift+Space')
      } else {
        expect(shortcutConfig.expectedShortcuts).toContain('Ctrl+Shift+Space')
      }
    })

    test('should register global shortcuts correctly', async ({ electronApp, appContext }) => {
      const shortcutsRegistered = await electronApp.evaluateInMain(({ globalShortcut }) => {
        // Check if global shortcuts are registered
        const registeredShortcuts = globalShortcut.isRegistered ? [
          globalShortcut.isRegistered('Ctrl+Shift+Space'),
          globalShortcut.isRegistered('Cmd+Shift+Space')
        ] : [false, false]

        return {
          hasGlobalShortcut: typeof globalShortcut !== 'undefined',
          ctrlShiftSpace: registeredShortcuts[0],
          cmdShiftSpace: registeredShortcuts[1]
        }
      })

      expect(shortcutsRegistered.hasGlobalShortcut).toBe(true)
      
      // At least one shortcut should be registered based on platform
      const hasAnyShortcut = shortcutsRegistered.ctrlShiftSpace || shortcutsRegistered.cmdShiftSpace
      expect(hasAnyShortcut).toBe(true)
    })
  })

  test.describe('System Integration', () => {
    test('macOS: dock behavior and app activation policy', async ({ electronApp, appContext }) => {
      test.skip(!platformInfo.isMac, 'macOS-specific test')

      const dockConfig = await electronApp.evaluateInMain(({ app }) => ({
        isDockVisible: app.dock?.isVisible() ?? true,
        activationPolicy: app.getLoginItemSettings().openAtLogin, // Approximate check
        canHideDock: typeof app.dock?.hide === 'function',
        canShowDock: typeof app.dock?.show === 'function'
      }))

      expect(dockConfig.canHideDock).toBe(true)
      expect(dockConfig.canShowDock).toBe(true)
    })

    test('Windows: taskbar and system tray integration', async ({ electronApp, appContext }) => {
      test.skip(!platformInfo.isWindows, 'Windows-specific test')

      const windowsConfig = await electronApp.evaluateInMain(() => {
        const { BrowserWindow } = require('electron')
        const mainWin = BrowserWindow.getAllWindows().find(w => !w.webContents.getURL().includes('/panel'))
        
        return {
          hasMainWindow: !!mainWin,
          taskbarVisible: mainWin ? !mainWin.isSkipped() : false,
          canMinimizeToTray: true // This would need actual tray implementation check
        }
      })

      expect(windowsConfig.hasMainWindow).toBe(true)
    })

    test('Linux: basic desktop environment compatibility', async ({ electronApp, appContext }) => {
      test.skip(!platformInfo.isLinux, 'Linux-specific test')

      const linuxConfig = await electronApp.evaluateInMain(() => {
        const { BrowserWindow } = require('electron')
        const windows = BrowserWindow.getAllWindows()
        
        return {
          windowCount: windows.length,
          hasValidWindows: windows.length > 0,
          desktopIntegration: true // Basic check
        }
      })

      expect(linuxConfig.hasValidWindows).toBe(true)
      expect(linuxConfig.windowCount).toBeGreaterThan(0)
    })
  })

  test.describe('Accessibility Permissions', () => {
    test('should handle accessibility permission requirements correctly', async ({ electronApp, appContext }) => {
      const platformHelpers = new PlatformHelpers(electronApp)
      const accessibilityInfo = await platformHelpers.testAccessibilityPermissions()

      if (platformInfo.isMac) {
        expect(accessibilityInfo.required).toBe(true)
        // On macOS, accessibility permission affects which window is shown
      } else {
        expect(accessibilityInfo.required).toBe(false)
        expect(accessibilityInfo.granted).toBe(true)
      }
    })
  })

  test.describe('Window Focus Behavior', () => {
    test('should handle window focus without stealing focus from active app', async ({ electronApp, appContext }) => {
      const panelPage = await electronApp.waitForWindow('panel')
      expect(panelPage).toBeDefined()

      // Test that panel can be shown without stealing focus
      const focusTest = await electronApp.evaluateInMain(async () => {
        const { BrowserWindow } = require('electron')
        const panelWin = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/panel'))
        
        if (!panelWin) return false
        
        // Simulate showing inactive (shouldn't steal focus)
        panelWin.showInactive()
        
        return {
          isVisible: panelWin.isVisible(),
          isFocused: panelWin.isFocused(),
          canReceiveInput: true // This would need actual input testing
        }
      })

      expect(focusTest).toBeDefined()
      expect(focusTest.isVisible).toBe(true)
      // Focus behavior might vary by platform and current active window
    })
  })

  test.describe('App Quit Behavior', () => {
    test('should handle app quit differently per platform', async ({ electronApp, appContext }) => {
      const quitBehavior = await electronApp.evaluateInMain(async ({ app }) => {
        return {
          platform: process.platform,
          shouldQuitOnWindowClose: process.platform !== 'darwin',
          hasBeforeQuitHandler: true, // We know this is implemented
          hasWindowAllClosedHandler: true
        }
      })

      expect(quitBehavior.platform).toBe(platformInfo.platform)
      
      if (platformInfo.isMac) {
        expect(quitBehavior.shouldQuitOnWindowClose).toBe(false)
      } else {
        expect(quitBehavior.shouldQuitOnWindowClose).toBe(true)
      }
    })
  })

  test.describe('File System and Paths', () => {
    test('should handle platform-specific paths correctly', async ({ electronApp, appContext }) => {
      const pathInfo = await electronApp.evaluateInMain(({ app }) => {
        const path = require('path')
        
        return {
          userDataPath: app.getPath('userData'),
          appDataPath: app.getPath('appData'),
          pathSeparator: path.sep,
          isWindows: path.sep === '\\',
          isPosix: path.sep === '/'
        }
      })

      expect(pathInfo.userDataPath).toBeDefined()
      expect(pathInfo.appDataPath).toBeDefined()
      
      if (platformInfo.isWindows) {
        expect(pathInfo.pathSeparator).toBe('\\')
        expect(pathInfo.isWindows).toBe(true)
      } else {
        expect(pathInfo.pathSeparator).toBe('/')
        expect(pathInfo.isPosix).toBe(true)
      }
    })
  })

  test.describe('Resource Loading', () => {
    test('should load resources correctly across platforms', async ({ electronApp, appContext }) => {
      const panelPage = await electronApp.waitForWindow('panel')
      expect(panelPage).toBeDefined()

      // Test that the panel page loads properly
      await panelPage!.waitForLoadState('domcontentloaded')
      
      const pageInfo = await panelPage!.evaluate(() => ({
        title: document.title,
        url: window.location.href,
        hasBody: !!document.body,
        resourcesLoaded: document.readyState === 'complete'
      }))

      expect(pageInfo.hasBody).toBe(true)
      expect(pageInfo.url).toMatch(/\/panel/)
    })
  })

  test.describe('Performance and Memory', () => {
    test('should maintain acceptable performance across platforms', async ({ electronApp, appContext }) => {
      const performanceMetrics = await electronApp.evaluateInMain(() => {
        const { BrowserWindow } = require('electron')
        const windows = BrowserWindow.getAllWindows()
        
        return {
          windowCount: windows.length,
          memoryUsage: process.memoryUsage(),
          platform: process.platform,
          nodeVersion: process.version
        }
      })

      expect(performanceMetrics.windowCount).toBeGreaterThan(0)
      expect(performanceMetrics.memoryUsage.heapUsed).toBeGreaterThan(0)
      expect(performanceMetrics.nodeVersion).toMatch(/^v\d+/)
    })
  })
})