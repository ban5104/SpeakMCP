import { ElectronApplication, Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import * as path from 'path'
import { BrowserWindow } from 'electron'

export interface ElectronAppContext {
  app: ElectronApplication
  mainWindow: Page | null
  panelWindow: Page | null
  setupWindow: Page | null
}

export class ElectronTestApp {
  private app: ElectronApplication | null = null
  private windows: Map<string, Page> = new Map()
  private platform = process.platform

  /**
   * Launch the Electron application
   */
  async launch(): Promise<ElectronAppContext> {
    const appPath = path.join(__dirname, '../../../out/main/index.js')
    
    this.app = await electron.launch({
      args: [appPath],
      // Enable debugging in headed mode
      executablePath: process.env.CI ? undefined : undefined,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '0',
        // Disable auto-updater in tests
        DISABLE_AUTO_UPDATER: '1',
      }
    })

    // Wait for app to be ready
    await this.app.waitForEvent('window')

    return {
      app: this.app,
      mainWindow: await this.getWindow('main'),
      panelWindow: await this.getWindow('panel'),
      setupWindow: await this.getWindow('setup')
    }
  }

  /**
   * Get a specific window by its ID
   */
  async getWindow(windowId: string): Promise<Page | null> {
    if (!this.app) return null

    try {
      // Get all pages
      const pages = this.app.windows()
      
      for (const page of pages) {
        // Check if this page matches our window ID by URL pattern
        const url = page.url()
        if (url.includes(`/${windowId}`) || (windowId === 'main' && url.endsWith('/') && !url.includes('/panel') && !url.includes('/setup'))) {
          this.windows.set(windowId, page)
          return page
        }
      }

      return null
    } catch (error) {
      console.error(`Failed to get window ${windowId}:`, error)
      return null
    }
  }

  /**
   * Wait for a window to be created
   */
  async waitForWindow(windowId: string, timeout = 10000): Promise<Page> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      const window = await this.getWindow(windowId)
      if (window) {
        return window
      }
      await this.sleep(100)
    }
    
    throw new Error(`Window ${windowId} not found within ${timeout}ms`)
  }

  /**
   * Check if the app is ready
   */
  async isReady(): Promise<boolean> {
    if (!this.app) return false
    
    try {
      const isReady = await this.app.evaluate(async ({ app }) => app.isReady())
      return isReady
    } catch {
      return false
    }
  }

  /**
   * Get the main process evaluation context
   */
  async evaluateInMain<T>(fn: (context: any) => T | Promise<T>): Promise<T> {
    if (!this.app) throw new Error('App not launched')
    return this.app.evaluate(fn)
  }

  /**
   * Check if accessibility permissions are granted (macOS)
   */
  async hasAccessibilityPermission(): Promise<boolean> {
    if (this.platform !== 'darwin') return true
    
    return this.evaluateInMain(({ systemPreferences }) => {
      return systemPreferences.isTrustedAccessibilityClient(false)
    })
  }

  /**
   * Get all BrowserWindows
   */
  async getBrowserWindows(): Promise<any[]> {
    return this.evaluateInMain(({ BrowserWindow }) => {
      return BrowserWindow.getAllWindows().map(win => ({
        id: win.id,
        title: win.getTitle(),
        bounds: win.getBounds(),
        isVisible: win.isVisible(),
        isFocused: win.isFocused(),
        isAlwaysOnTop: win.isAlwaysOnTop(),
        isClosable: win.isClosable(),
        isMaximizable: win.isMaximizable(),
        isMinimizable: win.isMinimizable(),
        url: win.webContents.getURL()
      }))
    })
  }

  /**
   * Check if panel window has correct properties
   */
  async isPanelWindowConfigured(): Promise<boolean> {
    const windows = await this.getBrowserWindows()
    const panelWindow = windows.find(w => w.url.includes('/panel'))
    
    if (!panelWindow) return false
    
    // Check panel-specific properties
    return (
      panelWindow.isAlwaysOnTop &&
      !panelWindow.isClosable &&
      !panelWindow.isMaximizable &&
      panelWindow.bounds.width === 260 &&
      panelWindow.bounds.height === 50
    )
  }

  /**
   * Simulate global keyboard shortcut
   */
  async sendGlobalShortcut(shortcut: string): Promise<void> {
    await this.evaluateInMain(async ({ globalShortcut }) => {
      // This would need to be implemented based on your keyboard service
      // For now, we'll simulate the shortcut trigger
      return Promise.resolve()
    })
  }

  /**
   * Get panel window position
   */
  async getPanelWindowPosition(): Promise<{ x: number, y: number } | null> {
    const windows = await this.getBrowserWindows()
    const panelWindow = windows.find(w => w.url.includes('/panel'))
    
    if (!panelWindow) return null
    
    return { x: panelWindow.bounds.x, y: panelWindow.bounds.y }
  }

  /**
   * Check if app is in dock (macOS)
   */
  async isDockVisible(): Promise<boolean> {
    if (this.platform !== 'darwin') return true
    
    return this.evaluateInMain(async ({ app }) => {
      return app.dock.isVisible()
    })
  }

  /**
   * Close the application gracefully
   */
  async close(): Promise<void> {
    if (!this.app) return

    try {
      // Close all windows first
      const pages = this.app.windows()
      await Promise.all(pages.map(page => page.close().catch(() => {})))
      
      // Quit the application
      await this.app.close()
      this.app = null
      this.windows.clear()
    } catch (error) {
      console.error('Error closing app:', error)
      // Force close if graceful close fails
      if (this.app) {
        try {
          await this.app.close()
        } catch {}
      }
    }
  }

  /**
   * Take screenshot of specific window
   */
  async screenshot(windowId: string, path?: string): Promise<Buffer> {
    const window = this.windows.get(windowId) || await this.getWindow(windowId)
    if (!window) throw new Error(`Window ${windowId} not found`)
    
    return window.screenshot({ path })
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get platform-specific information
   */
  getPlatformInfo() {
    return {
      platform: this.platform,
      isMac: this.platform === 'darwin',
      isWindows: this.platform === 'win32',
      isLinux: this.platform === 'linux'
    }
  }
}