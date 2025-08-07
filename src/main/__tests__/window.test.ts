import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrowserWindow, screen, app, shell } from 'electron'
import {
  createMainWindow,
  createSetupWindow,
  createPanelWindow,
  showMainWindow,
  showPanelWindow,
  showPanelWindowAndStartRecording,
  showPanelWindowAndStartMcpRecording,
  makePanelWindowClosable,
  stopRecordingAndHidePanelWindow,
  getWindowRendererHandlers,
  WINDOWS
} from '../window'
import { makePanel, makeKeyWindow, makeWindow } from '../panel-window-manager'
import { getRendererHandlers } from '@egoist/tipc/main'
import { configStore } from '../config'

// Mock Electron modules
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  screen: {
    getDisplayNearestPoint: vi.fn(),
    getCursorScreenPoint: vi.fn()
  },
  app: {
    setActivationPolicy: vi.fn(),
    getPath: vi.fn().mockReturnValue('/mock/path'),
    dock: {
      hide: vi.fn(),
      show: vi.fn(),
      isVisible: vi.fn()
    }
  },
  shell: {
    openExternal: vi.fn()
  }
}))

// Mock panel-window-manager (our new implementation)
vi.mock('../panel-window-manager', () => ({
  makePanel: vi.fn(),
  makeKeyWindow: vi.fn(),
  makeWindow: vi.fn()
}))

// Mock TIPC
vi.mock('@egoist/tipc/main', () => ({
  getRendererHandlers: vi.fn()
}))

// Mock config store
vi.mock('../config', () => ({
  configStore: {
    get: vi.fn()
  }
}))

// Mock APP_ID environment variable
process.env.APP_ID = 'app.speakmcp'

describe('Window Management', () => {
  // Mock instances
  const mockBrowserWindow = {
    on: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    setPosition: vi.fn(),
    showInactive: vi.fn(),
    isVisible: vi.fn(),
    isClosable: vi.fn(),
    setClosable: vi.fn(),
    loadURL: vi.fn(),
    webContents: {
      setWindowOpenHandler: vi.fn(),
      on: vi.fn()
    }
  }

  const mockRendererHandlers = {
    startRecording: { send: vi.fn() },
    stopRecording: { send: vi.fn() },
    startMcpRecording: { send: vi.fn() },
    navigate: { send: vi.fn() }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    WINDOWS.clear()
    
    // Setup BrowserWindow mock
    vi.mocked(BrowserWindow).mockImplementation(() => mockBrowserWindow as any)
    
    // Setup screen mock
    vi.mocked(screen.getCursorScreenPoint).mockReturnValue({ x: 100, y: 100 })
    vi.mocked(screen.getDisplayNearestPoint).mockReturnValue({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 }
    } as any)
    
    // Setup tipc mock
    vi.mocked(getRendererHandlers).mockReturnValue(mockRendererHandlers as any)
    
    // Setup config mock
    vi.mocked(configStore.get).mockReturnValue({ hideDockIcon: false })
    
    // Setup dock visibility mock
    vi.mocked(app.dock.isVisible).mockReturnValue(true)
  })

  afterEach(() => {
    WINDOWS.clear()
  })

  describe('createMainWindow', () => {
    it('should create main window with correct options', () => {
      const window = createMainWindow()
      
      expect(BrowserWindow).toHaveBeenCalledWith({
        width: 900,
        height: 670,
        show: false,
        autoHideMenuBar: true,
        titleBarStyle: 'hiddenInset',
        webPreferences: {
          preload: expect.stringContaining('preload/index.mjs'),
          sandbox: false
        }
      })
      
      expect(WINDOWS.get('main')).toBe(mockBrowserWindow)
      expect(window).toBe(mockBrowserWindow)
    })

    it('should setup ready-to-show event handler', () => {
      createMainWindow()
      
      expect(mockBrowserWindow.on).toHaveBeenCalledWith('ready-to-show', expect.any(Function))
      
      // Simulate ready-to-show event
      const readyToShowHandler = vi.mocked(mockBrowserWindow.on).mock.calls
        .find(call => call[0] === 'ready-to-show')?.[1]
      
      readyToShowHandler?.()
      expect(mockBrowserWindow.show).toHaveBeenCalled()
    })

    it('should setup close event handler', () => {
      createMainWindow()
      
      expect(mockBrowserWindow.on).toHaveBeenCalledWith('close', expect.any(Function))
      
      // Simulate close event
      const closeHandler = vi.mocked(mockBrowserWindow.on).mock.calls
        .find(call => call[0] === 'close')?.[1]
      
      closeHandler?.()
      expect(WINDOWS.has('main')).toBe(false)
    })

    it('should setup dock behavior on macOS when hideDockIcon is enabled', () => {
      // Mock process.env.IS_MAC by setting it temporarily
      const originalEnv = (process.env as any).IS_MAC
      (process.env as any).IS_MAC = true
      
      vi.mocked(configStore.get).mockReturnValue({ hideDockIcon: true })
      
      createMainWindow()
      
      // Find and trigger close handler
      const closeHandler = vi.mocked(mockBrowserWindow.on).mock.calls
        .find(call => call[0] === 'close')?.[1]
      closeHandler?.()
      
      expect(app.setActivationPolicy).toHaveBeenCalledWith('accessory')
      expect(app.dock.hide).toHaveBeenCalled()
      
      // Restore original environment
      if (originalEnv === undefined) {
        delete (process.env as any).IS_MAC
      } else {
        (process.env as any).IS_MAC = originalEnv
      }
    })

    it('should setup dock show behavior on macOS', () => {
      // Mock process.env.IS_MAC by setting it temporarily
      const originalEnv = (process.env as any).IS_MAC
      (process.env as any).IS_MAC = true
      
      vi.mocked(configStore.get).mockReturnValue({ hideDockIcon: true })
      vi.mocked(app.dock.isVisible).mockReturnValue(false)
      
      createMainWindow()
      
      // Find and trigger show handler
      const showHandler = vi.mocked(mockBrowserWindow.on).mock.calls
        .find(call => call[0] === 'show')?.[1]
      showHandler?.()
      
      expect(app.dock.show).toHaveBeenCalled()
      
      // Restore original environment
      if (originalEnv === undefined) {
        delete (process.env as any).IS_MAC
      } else {
        (process.env as any).IS_MAC = originalEnv
      }
    })

    it('should load correct URL with custom path', () => {
      createMainWindow({ url: '/custom' })
      
      const expectedUrl = import.meta.env.PROD 
        ? 'assets://app/custom'
        : `${process.env.ELECTRON_RENDERER_URL}/custom`
      
      expect(mockBrowserWindow.loadURL).toHaveBeenCalledWith(expectedUrl)
    })
  })

  describe('createSetupWindow', () => {
    it('should create setup window with correct dimensions', () => {
      const window = createSetupWindow()
      
      expect(BrowserWindow).toHaveBeenCalledWith({
        width: 800,
        height: 600,
        show: false,
        autoHideMenuBar: true,
        titleBarStyle: 'hiddenInset',
        resizable: false,
        webPreferences: {
          preload: expect.any(String),
          sandbox: false
        }
      })
      
      expect(WINDOWS.get('setup')).toBe(mockBrowserWindow)
      expect(window).toBe(mockBrowserWindow)
    })

    it('should load setup URL', () => {
      createSetupWindow()
      
      const expectedUrl = import.meta.env.PROD 
        ? 'assets://app/setup'
        : `${process.env.ELECTRON_RENDERER_URL}/setup`
      
      expect(mockBrowserWindow.loadURL).toHaveBeenCalledWith(expectedUrl)
    })
  })

  describe('showMainWindow', () => {
    it('should show existing main window', () => {
      WINDOWS.set('main', mockBrowserWindow as any)
      
      showMainWindow()
      
      expect(mockBrowserWindow.show).toHaveBeenCalled()
    })

    it('should create new main window if none exists', () => {
      showMainWindow()
      
      expect(BrowserWindow).toHaveBeenCalled()
      expect(WINDOWS.get('main')).toBe(mockBrowserWindow)
    })

    it('should navigate to URL if provided', () => {
      WINDOWS.set('main', mockBrowserWindow as any)
      
      showMainWindow('/settings')
      
      expect(mockRendererHandlers.navigate.send).toHaveBeenCalledWith('/settings')
    })

    it('should navigate when creating new window with URL', () => {
      showMainWindow('/settings')
      
      expect(BrowserWindow).toHaveBeenCalled()
      expect(mockBrowserWindow.loadURL).toHaveBeenCalledWith(
        expect.stringContaining('/settings')
      )
    })
  })

  describe('getWindowRendererHandlers', () => {
    it('should return handlers for existing window', () => {
      WINDOWS.set('main', mockBrowserWindow as any)
      
      const handlers = getWindowRendererHandlers('main')
      
      expect(getRendererHandlers).toHaveBeenCalledWith(mockBrowserWindow.webContents)
      expect(handlers).toBe(mockRendererHandlers)
    })

    it('should return undefined for non-existent window', () => {
      const handlers = getWindowRendererHandlers('main')
      
      expect(handlers).toBeUndefined()
    })
  })

  describe('WINDOWS map management', () => {
    it('should add window to WINDOWS map on creation', () => {
      createMainWindow()
      
      expect(WINDOWS.has('main')).toBe(true)
      expect(WINDOWS.get('main')).toBe(mockBrowserWindow)
    })

    it('should remove window from WINDOWS map on close', () => {
      createMainWindow()
      
      expect(WINDOWS.has('main')).toBe(true)
      
      // Trigger close event
      const closeHandler = vi.mocked(mockBrowserWindow.on).mock.calls
        .find(call => call[0] === 'close')?.[1]
      closeHandler?.()
      
      expect(WINDOWS.has('main')).toBe(false)
    })

    it('should handle multiple window types in WINDOWS map', () => {
      createMainWindow()
      createSetupWindow()
      
      expect(WINDOWS.size).toBe(2)
      expect(WINDOWS.has('main')).toBe(true)
      expect(WINDOWS.has('setup')).toBe(true)
    })
  })

  describe('window security', () => {
    it('should prevent external navigation', () => {
      createMainWindow()
      
      expect(mockBrowserWindow.webContents.setWindowOpenHandler).toHaveBeenCalledWith(
        expect.any(Function)
      )
      
      // Test the handler
      const handler = vi.mocked(mockBrowserWindow.webContents.setWindowOpenHandler).mock.calls[0][0]
      const result = handler({ url: 'https://example.com' })
      
      expect(shell.openExternal).toHaveBeenCalledWith('https://example.com')
      expect(result).toEqual({ action: 'deny' })
    })
  })
})
