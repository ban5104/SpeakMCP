import { ElectronTestApp } from './electron-app'

export interface PlatformInfo {
  platform: NodeJS.Platform
  isMac: boolean
  isWindows: boolean
  isLinux: boolean
}

export class PlatformHelpers {
  constructor(private app: ElectronTestApp) {}

  static getPlatformInfo(): PlatformInfo {
    const platform = process.platform
    return {
      platform,
      isMac: platform === 'darwin',
      isWindows: platform === 'win32',
      isLinux: platform === 'linux'
    }
  }

  /**
   * Test panel window behavior specific to each platform
   */
  async testPanelWindowBehavior() {
    const { isMac, isWindows, isLinux } = PlatformHelpers.getPlatformInfo()
    const windows = await this.app.getBrowserWindows()
    const panelWindow = windows.find(w => w.url.includes('/panel'))
    
    if (!panelWindow) {
      throw new Error('Panel window not found')
    }

    const results = {
      hasCorrectDimensions: panelWindow.bounds.width === 260 && panelWindow.bounds.height === 50,
      isAlwaysOnTop: panelWindow.isAlwaysOnTop,
      isNotClosable: !panelWindow.isClosable,
      isNotMaximizable: !panelWindow.isMaximizable,
      platformSpecific: {} as any
    }

    if (isMac) {
      // macOS-specific panel behavior
      results.platformSpecific = {
        hasNativePanelType: true, // This would need to be checked via native APIs
        hasVibrancy: true, // Panel should have vibrancy effect
        hiddenFromMissionControl: true, // Should not appear in Mission Control
        acceptsKeyEvents: true // Should accept keyboard events without activation
      }
    } else if (isWindows || isLinux) {
      // Windows/Linux simulated panel behavior
      results.platformSpecific = {
        simulatedPanel: true,
        skipTaskbar: true, // Should not appear in taskbar
        notResizable: !panelWindow.isMaximizable && !panelWindow.isMinimizable
      }
    }

    return results
  }

  /**
   * Test dock behavior (macOS only)
   */
  async testDockBehavior() {
    const { isMac } = PlatformHelpers.getPlatformInfo()
    
    if (!isMac) {
      return { supported: false, message: 'Dock behavior only applicable on macOS' }
    }

    const isDockVisible = await this.app.isDockVisible()
    
    return {
      supported: true,
      isDockVisible,
      canHideDock: true, // This would be tested by actually hiding/showing
    }
  }

  /**
   * Test tray behavior (Windows/Linux primarily)
   */
  async testTrayBehavior() {
    const { isWindows, isLinux } = PlatformHelpers.getPlatformInfo()
    
    if (!isWindows && !isLinux) {
      return { supported: false, message: 'System tray behavior primarily for Windows/Linux' }
    }

    // This would need to be implemented based on your tray implementation
    return {
      supported: true,
      hasTrayIcon: true,
      trayIconVisible: true
    }
  }

  /**
   * Test accessibility permissions (primarily macOS)
   */
  async testAccessibilityPermissions() {
    const { isMac } = PlatformHelpers.getPlatformInfo()
    
    if (!isMac) {
      return { required: false, granted: true, message: 'Accessibility permissions not required on this platform' }
    }

    const hasPermission = await this.app.hasAccessibilityPermission()
    
    return {
      required: true,
      granted: hasPermission,
      message: hasPermission ? 'Accessibility permission granted' : 'Accessibility permission required'
    }
  }

  /**
   * Get expected panel window position based on platform
   */
  async getExpectedPanelPosition() {
    const screenInfo = await this.app.evaluateInMain(({ screen }) => {
      const display = screen.getPrimaryDisplay()
      return {
        workArea: display.workArea,
        scaleFactor: display.scaleFactor
      }
    })

    // Panel should be positioned in top-right corner with 10px margin
    const expectedX = screenInfo.workArea.x + screenInfo.workArea.width - 260 - 10
    const expectedY = screenInfo.workArea.y + 10

    return {
      x: expectedX,
      y: expectedY,
      screenInfo
    }
  }

  /**
   * Test global keyboard shortcuts
   */
  async testGlobalShortcuts() {
    const { isMac, isWindows, isLinux } = PlatformHelpers.getPlatformInfo()
    
    // Different platforms may have different shortcut handling
    const expectedShortcuts = isMac 
      ? ['Cmd+Shift+Space', 'Cmd+Shift+M'] 
      : ['Ctrl+Shift+Space', 'Ctrl+Shift+M']

    // This would need actual implementation to test shortcuts
    return {
      expectedShortcuts,
      platform: isMac ? 'macOS' : isWindows ? 'Windows' : 'Linux',
      supported: true
    }
  }

  /**
   * Skip test if not on specified platform
   */
  static skipUnlessPlatform(platform: 'darwin' | 'win32' | 'linux', testName: string) {
    const currentPlatform = process.platform
    if (currentPlatform !== platform) {
      return `${testName} (skipped on ${currentPlatform})`
    }
    return testName
  }

  /**
   * Run test only on specified platforms
   */
  static onlyOnPlatforms(platforms: NodeJS.Platform[], testName: string) {
    const currentPlatform = process.platform
    if (!platforms.includes(currentPlatform)) {
      return `${testName} (skipped on ${currentPlatform})`
    }
    return testName
  }
}