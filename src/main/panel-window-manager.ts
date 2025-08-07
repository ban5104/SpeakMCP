import { BrowserWindow } from 'electron'

/**
 * Platform-agnostic panel window manager
 * Replaces @egoist/electron-panel-window dependency
 */
export class PanelWindowManager {
  private static instance: PanelWindowManager
  
  static getInstance(): PanelWindowManager {
    if (!this.instance) {
      this.instance = new PanelWindowManager()
    }
    return this.instance
  }

  /**
   * Convert BrowserWindow to panel-style window
   * On macOS: Uses native 'panel' type (set at creation) + additional properties
   * On Windows/Linux: Simulates with window properties
   */
  makePanel(win: BrowserWindow): void {
    if (process.platform === 'darwin') {
      // macOS: Panel type is already set at creation, add remaining properties
      win.setAlwaysOnTop(true, 'floating')
      win.setVisibleOnAllWorkspaces(true)
      // Ensure it doesn't appear in dock switcher
      win.setSkipTaskbar(true)
      
    } else {
      // Windows/Linux: Simulate panel behavior
      win.setAlwaysOnTop(true)
      win.setSkipTaskbar(true)
      win.setResizable(false)
      win.setMaximizable(false)
      win.setMinimizable(false)
      win.setFullScreenable(false)
    }
  }

  /**
   * Enable keyboard input without stealing focus
   * On macOS: Uses showInactive() + window level manipulation
   * On Windows/Linux: Uses show() with focus prevention
   */
  makeKeyWindow(win: BrowserWindow): void {
    if (process.platform === 'darwin') {
      // macOS: Set window level to accept key events without activation
      win.setAlwaysOnTop(true, 'floating')
      // Ensure window can receive keyboard events
      win.setIgnoreMouseEvents(false)
      // Focus window for keyboard input without activating app
      win.focus()
      
    } else {
      // Windows/Linux: Show window without stealing focus from active app
      if (!win.isVisible()) {
        win.showInactive()
      }
      // Set focus for keyboard input
      win.focus()
    }
  }

  /**
   * Convert panel back to regular window
   * Primarily used before app quit to ensure clean shutdown
   */
  makeWindow(win: BrowserWindow): void {
    if (process.platform === 'darwin') {
      // Reset window level
      win.setAlwaysOnTop(false)
      win.setVisibleOnAllWorkspaces(false)
      
    } else {
      // Windows/Linux: Reset window properties
      win.setAlwaysOnTop(false)
      win.setSkipTaskbar(false)
      win.setResizable(true)
      win.setMaximizable(true)
      win.setMinimizable(true)
      win.setFullScreenable(true)
    }
    
    // Ensure window is closable for quit
    win.setClosable(true)
  }
}

// Export singleton functions for drop-in replacement
export const makePanel = (win: BrowserWindow) => 
  PanelWindowManager.getInstance().makePanel(win)

export const makeKeyWindow = (win: BrowserWindow) => 
  PanelWindowManager.getInstance().makeKeyWindow(win)

export const makeWindow = (win: BrowserWindow) => 
  PanelWindowManager.getInstance().makeWindow(win)