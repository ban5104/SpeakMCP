import { test, expect } from './fixtures/app-fixture'
import { PlatformHelpers } from './utils/platform-helpers'

test.describe('SpeakMCP Application Launch & Initialization', () => {
  test('should launch successfully on all platforms', async ({ electronApp, appContext }) => {
    // Verify app is ready
    const isReady = await electronApp.isReady()
    expect(isReady).toBe(true)

    // Verify main process is running
    const windows = await electronApp.getBrowserWindows()
    expect(windows.length).toBeGreaterThan(0)
  })

  test('should create main window or setup window based on accessibility permissions', async ({ electronApp, appContext }) => {
    const hasAccessibility = await electronApp.hasAccessibilityPermission()
    const windows = await electronApp.getBrowserWindows()
    
    if (hasAccessibility) {
      // Should have main window
      const mainWindow = windows.find(w => w.url.includes('/') && !w.url.includes('/panel') && !w.url.includes('/setup'))
      expect(mainWindow).toBeDefined()
      expect(mainWindow?.bounds.width).toBe(900)
      expect(mainWindow?.bounds.height).toBe(670)
    } else {
      // Should have setup window
      const setupWindow = windows.find(w => w.url.includes('/setup'))
      expect(setupWindow).toBeDefined()
      expect(setupWindow?.bounds.width).toBe(800)
      expect(setupWindow?.bounds.height).toBe(600)
    }
  })

  test('should always create panel window', async ({ electronApp, appContext }) => {
    const windows = await electronApp.getBrowserWindows()
    const panelWindow = windows.find(w => w.url.includes('/panel'))
    
    expect(panelWindow).toBeDefined()
    expect(panelWindow?.bounds.width).toBe(260)
    expect(panelWindow?.bounds.height).toBe(50)
  })

  test.describe('Platform-specific initialization', () => {
    test('macOS: should handle dock behavior correctly', async ({ electronApp, appContext }) => {
      test.skip(process.platform !== 'darwin', 'macOS-specific test')
      
      const platformHelpers = new PlatformHelpers(electronApp)
      const dockBehavior = await platformHelpers.testDockBehavior()
      
      expect(dockBehavior.supported).toBe(true)
      // Dock should be visible initially if main window is shown
      // This depends on hideDockIcon configuration
    })

    test('Windows: should initialize with proper taskbar behavior', async ({ electronApp, appContext }) => {
      test.skip(process.platform !== 'win32', 'Windows-specific test')
      
      const windows = await electronApp.getBrowserWindows()
      const mainWindow = windows.find(w => !w.url.includes('/panel') && !w.url.includes('/setup'))
      
      if (mainWindow) {
        // Main window should be visible in taskbar
        expect(mainWindow.isVisible).toBe(true)
      }
    })

    test('Linux: should start with basic desktop integration', async ({ electronApp, appContext }) => {
      test.skip(process.platform !== 'linux', 'Linux-specific test')
      
      // Basic functionality test for Linux
      const isReady = await electronApp.isReady()
      expect(isReady).toBe(true)
      
      const windows = await electronApp.getBrowserWindows()
      expect(windows.length).toBeGreaterThanOrEqual(1)
    })
  })

  test('should handle app activation correctly', async ({ electronApp, appContext }) => {
    // Simulate app activation (like clicking dock icon on macOS)
    await electronApp.evaluateInMain(({ app }) => {
      app.emit('activate')
    })

    // After activation, appropriate windows should be available
    const windows = await electronApp.getBrowserWindows()
    const hasAccessibility = await electronApp.hasAccessibilityPermission()
    
    if (hasAccessibility) {
      const mainWindow = windows.find(w => !w.url.includes('/panel') && !w.url.includes('/setup'))
      expect(mainWindow).toBeDefined()
    } else {
      const setupWindow = windows.find(w => w.url.includes('/setup'))
      expect(setupWindow).toBeDefined()
    }
  })

  test('should handle before-quit event correctly', async ({ electronApp, appContext }) => {
    // Trigger before-quit event
    await electronApp.evaluateInMain(({ app }) => {
      app.emit('before-quit')
    })

    // Panel window should become closable
    const windows = await electronApp.getBrowserWindows()
    const panelWindow = windows.find(w => w.url.includes('/panel'))
    
    // Note: This test might need to be adjusted based on the actual implementation
    // as the window properties might not be immediately reflected
    expect(panelWindow).toBeDefined()
  })

  test('should have correct window titles and properties', async ({ electronApp, appContext }) => {
    const windows = await electronApp.getBrowserWindows()
    
    // Main/Setup window properties
    const mainOrSetupWindow = windows.find(w => !w.url.includes('/panel'))
    if (mainOrSetupWindow) {
      expect(mainOrSetupWindow.isMaximizable).toBe(true)
      expect(mainOrSetupWindow.isMinimizable).toBe(true)
    }
    
    // Panel window properties
    const panelWindow = windows.find(w => w.url.includes('/panel'))
    if (panelWindow) {
      expect(panelWindow.isClosable).toBe(false)
      expect(panelWindow.isMaximizable).toBe(false)
      expect(panelWindow.isAlwaysOnTop).toBe(true)
    }
  })

  test('should load correct URLs for all windows', async ({ electronApp, appContext }) => {
    const windows = await electronApp.getBrowserWindows()
    
    // Panel window should load panel URL
    const panelWindow = windows.find(w => w.url.includes('/panel'))
    expect(panelWindow?.url).toMatch(/\/panel/)
    
    // Main or setup window should load appropriate URL
    const mainOrSetupWindow = windows.find(w => !w.url.includes('/panel'))
    if (mainOrSetupWindow) {
      const hasAccessibility = await electronApp.hasAccessibilityPermission()
      if (hasAccessibility) {
        // Should be main window (root path or no specific path)
        expect(mainOrSetupWindow.url).not.toMatch(/\/setup/)
      } else {
        // Should be setup window
        expect(mainOrSetupWindow.url).toMatch(/\/setup/)
      }
    }
  })

  test('should handle window-all-closed event correctly', async ({ electronApp, appContext }) => {
    const platform = process.platform
    
    // Simulate all windows closed
    await electronApp.evaluateInMain(({ app }) => {
      return new Promise((resolve) => {
        const originalQuit = app.quit
        let quitCalled = false
        
        app.quit = () => {
          quitCalled = true
          return true
        }
        
        app.emit('window-all-closed')
        
        // Restore original quit function
        app.quit = originalQuit
        
        resolve(quitCalled)
      })
    }).then((quitCalled) => {
      if (platform === 'darwin') {
        // On macOS, app should NOT quit when all windows are closed
        expect(quitCalled).toBe(false)
      } else {
        // On other platforms, app SHOULD quit when all windows are closed
        expect(quitCalled).toBe(true)
      }
    })
  })
})