import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrowserWindow, screen } from 'electron'
import {
  createPanelWindow,
  showPanelWindow,
  showPanelWindowAndStartRecording,
  showPanelWindowAndStartMcpRecording,
  makePanelWindowClosable,
  stopRecordingAndHidePanelWindow,
  WINDOWS
} from '../window'
import { makePanel, makeKeyWindow, makeWindow } from '../panel-window-manager'
import { getRendererHandlers } from '@egoist/tipc/main'

// Mock Electron modules
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  screen: {
    getDisplayNearestPoint: vi.fn(),
    getCursorScreenPoint: vi.fn()
  },
  shell: {
    openExternal: vi.fn()
  },
  app: {
    getPath: vi.fn().mockReturnValue('/mock/path')
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

// Mock config module
vi.mock('../config', () => ({
  configStore: {
    get: vi.fn()
  }
}))

// Mock APP_ID environment variable
process.env.APP_ID = 'app.speakmcp'

describe('Panel Window Behavior', () => {
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
    setAlwaysOnTop: vi.fn(),
    setVisibleOnAllWorkspaces: vi.fn(),
    setSkipTaskbar: vi.fn(),
    setResizable: vi.fn(),
    setMaximizable: vi.fn(),
    setMinimizable: vi.fn(),
    setFullScreenable: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    focus: vi.fn(),
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
    
    // Setup screen mock with default values
    vi.mocked(screen.getCursorScreenPoint).mockReturnValue({ x: 100, y: 100 })
    vi.mocked(screen.getDisplayNearestPoint).mockReturnValue({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 }
    })
    
    // Setup tipc mock
    vi.mocked(getRendererHandlers).mockReturnValue(mockRendererHandlers as any)
  })

  afterEach(() => {
    WINDOWS.clear()
  })

  describe('createPanelWindow', () => {
    it('should create panel window with correct dimensions and properties', () => {
      const window = createPanelWindow()
      
      expect(BrowserWindow).toHaveBeenCalledWith({
        type: 'panel', // Native macOS panel type
        width: 260,
        height: 50,
        show: false,
        autoHideMenuBar: true,
        hiddenInMissionControl: true,
        skipTaskbar: true,
        closable: false,
        maximizable: false,
        frame: false,
        paintWhenInitiallyHidden: true,
        maxWidth: 260,
        maxHeight: 50,
        minWidth: 260,
        minHeight: 50,
        visualEffectState: 'active',
        vibrancy: 'under-window',
        alwaysOnTop: true,
        x: expect.any(Number),
        y: expect.any(Number),
        webPreferences: {
          preload: expect.stringContaining('preload/index.mjs'),
          sandbox: false
        }
      })
      
      expect(WINDOWS.get('panel')).toBe(mockBrowserWindow)
      expect(window).toBe(mockBrowserWindow)
    })

    it('should position panel window in top-right corner', () => {
      const mockScreen = {
        workArea: { x: 100, y: 50, width: 1920, height: 1080 }
      }
      vi.mocked(screen.getDisplayNearestPoint).mockReturnValue(mockScreen)
      
      createPanelWindow()
      
      // Calculate expected position: x = 100 + (1920 - 260) - 10 = 1750, y = 50 + 10 = 60
      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 1750,
          y: 60
        })
      )
    })

    it('should calculate position based on cursor screen', () => {
      const cursorPoint = { x: 500, y: 300 }
      vi.mocked(screen.getCursorScreenPoint).mockReturnValue(cursorPoint)
      
      createPanelWindow()
      
      expect(screen.getCursorScreenPoint).toHaveBeenCalled()
      expect(screen.getDisplayNearestPoint).toHaveBeenCalledWith(cursorPoint)
    })

    it('should convert window to panel type', () => {
      const window = createPanelWindow()
      
      expect(makePanel).toHaveBeenCalledWith(mockBrowserWindow)
    })

    it('should setup panel URL', () => {
      createPanelWindow()
      
      const expectedUrl = import.meta.env.PROD 
        ? 'assets://app/panel'
        : `${process.env.ELECTRON_RENDERER_URL}/panel`
      
      expect(mockBrowserWindow.loadURL).toHaveBeenCalledWith(expectedUrl)
    })

    it('should setup hide event handler to stop recording', () => {
      createPanelWindow()
      
      expect(mockBrowserWindow.on).toHaveBeenCalledWith('hide', expect.any(Function))
      
      // Simulate hide event
      const hideHandler = vi.mocked(mockBrowserWindow.on).mock.calls
        .find(call => call[0] === 'hide')?.[1]
      
      hideHandler?.()
      expect(mockRendererHandlers.stopRecording.send).toHaveBeenCalled()
    })

    it('should setup console message handler for MCP debug logs', () => {
      createPanelWindow()
      
      expect(mockBrowserWindow.webContents.on).toHaveBeenCalledWith(
        'console-message', 
        expect.any(Function)
      )
    })

    it('should not show panel window immediately', () => {
      createPanelWindow()
      
      // showWhenReady is false, so show should not be called on ready-to-show
      expect(mockBrowserWindow.show).not.toHaveBeenCalled()
      expect(mockBrowserWindow.showInactive).not.toHaveBeenCalled()
    })
  })

  describe('showPanelWindow', () => {
    beforeEach(() => {
      createPanelWindow()
      vi.clearAllMocks() // Clear mocks after creation
    })

    it('should show panel window without stealing focus', () => {
      showPanelWindow()
      
      expect(mockBrowserWindow.showInactive).toHaveBeenCalled()
      expect(mockBrowserWindow.show).not.toHaveBeenCalled() // Should not steal focus
    })

    it('should make panel window key window for input', () => {
      showPanelWindow()
      
      expect(makeKeyWindow).toHaveBeenCalledWith(mockBrowserWindow)
    })

    it('should reposition panel window before showing', () => {
      const mockScreen = {
        workArea: { x: 200, y: 100, width: 1680, height: 1050 }
      }
      vi.mocked(screen.getDisplayNearestPoint).mockReturnValue(mockScreen)
      
      showPanelWindow()
      
      // Expected position: x = 200 + (1680 - 260) - 10 = 1610, y = 100 + 10 = 110
      expect(mockBrowserWindow.setPosition).toHaveBeenCalledWith(1610, 110)
    })

    it('should handle case when panel window does not exist', () => {
      WINDOWS.clear() // Remove panel window
      
      // Should not throw error
      expect(() => showPanelWindow()).not.toThrow()
      
      expect(mockBrowserWindow.showInactive).not.toHaveBeenCalled()
      expect(makeKeyWindow).not.toHaveBeenCalled()
    })
  })

  describe('showPanelWindowAndStartRecording', () => {
    beforeEach(() => {
      createPanelWindow()
      vi.clearAllMocks()
    })

    it('should show panel and trigger recording', () => {
      showPanelWindowAndStartRecording()
      
      expect(mockBrowserWindow.showInactive).toHaveBeenCalled()
      expect(makeKeyWindow).toHaveBeenCalledWith(mockBrowserWindow)
      expect(mockRendererHandlers.startRecording.send).toHaveBeenCalled()
    })

    it('should reposition panel before starting recording', () => {
      showPanelWindowAndStartRecording()
      
      expect(mockBrowserWindow.setPosition).toHaveBeenCalled()
    })
  })

  describe('showPanelWindowAndStartMcpRecording', () => {
    beforeEach(() => {
      createPanelWindow()
      vi.clearAllMocks()
    })

    it('should show panel and trigger MCP recording', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      
      showPanelWindowAndStartMcpRecording()
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[MCP-DEBUG] showPanelWindowAndStartMcpRecording called'
      )
      expect(mockBrowserWindow.showInactive).toHaveBeenCalled()
      expect(makeKeyWindow).toHaveBeenCalledWith(mockBrowserWindow)
      expect(mockRendererHandlers.startMcpRecording.send).toHaveBeenCalled()
    })
  })

  describe('makePanelWindowClosable', () => {
    beforeEach(() => {
      createPanelWindow()
      vi.clearAllMocks()
    })

    it('should convert panel to regular window when not closable', () => {
      vi.mocked(mockBrowserWindow.isClosable).mockReturnValue(false)
      
      makePanelWindowClosable()
      
      expect(makeWindow).toHaveBeenCalledWith(mockBrowserWindow)
      expect(mockBrowserWindow.setClosable).toHaveBeenCalledWith(true)
    })

    it('should not convert panel when already closable', () => {
      vi.mocked(mockBrowserWindow.isClosable).mockReturnValue(true)
      
      makePanelWindowClosable()
      
      expect(makeWindow).not.toHaveBeenCalled()
      expect(mockBrowserWindow.setClosable).not.toHaveBeenCalled()
    })

    it('should handle case when panel window does not exist', () => {
      WINDOWS.clear()
      
      expect(() => makePanelWindowClosable()).not.toThrow()
      expect(makeWindow).not.toHaveBeenCalled()
    })
  })

  describe('stopRecordingAndHidePanelWindow', () => {
    beforeEach(() => {
      createPanelWindow()
      vi.clearAllMocks()
    })

    it('should stop recording and hide visible panel', () => {
      vi.mocked(mockBrowserWindow.isVisible).mockReturnValue(true)
      
      stopRecordingAndHidePanelWindow()
      
      expect(mockRendererHandlers.stopRecording.send).toHaveBeenCalled()
      expect(mockBrowserWindow.hide).toHaveBeenCalled()
    })

    it('should stop recording but not hide if panel is not visible', () => {
      vi.mocked(mockBrowserWindow.isVisible).mockReturnValue(false)
      
      stopRecordingAndHidePanelWindow()
      
      expect(mockRendererHandlers.stopRecording.send).toHaveBeenCalled()
      expect(mockBrowserWindow.hide).not.toHaveBeenCalled()
    })

    it('should handle case when panel window does not exist', () => {
      WINDOWS.clear()
      
      expect(() => stopRecordingAndHidePanelWindow()).not.toThrow()
      expect(mockRendererHandlers.stopRecording.send).not.toHaveBeenCalled()
    })
  })

  describe('panel window positioning', () => {
    it('should handle different screen configurations', () => {
      const testCases = [
        {
          screenConfig: { x: 0, y: 0, width: 1920, height: 1080 },
          expected: { x: 1650, y: 10 } // 0 + (1920 - 260) - 10 = 1650
        },
        {
          screenConfig: { x: 1920, y: 0, width: 1920, height: 1080 }, // Second monitor
          expected: { x: 3570, y: 10 } // 1920 + (1920 - 260) - 10 = 3570
        },
        {
          screenConfig: { x: 100, y: 100, width: 1280, height: 720 }, // Smaller screen with offset
          expected: { x: 1110, y: 110 } // 100 + (1280 - 260) - 10 = 1110
        }
      ]
      
      testCases.forEach(({ screenConfig, expected }, index) => {
        // Reset mocks for each test case
        vi.clearAllMocks()
        vi.mocked(BrowserWindow).mockImplementation(() => mockBrowserWindow as any)
        vi.mocked(screen.getDisplayNearestPoint).mockReturnValue({ workArea: screenConfig })
        
        createPanelWindow()
        
        expect(BrowserWindow).toHaveBeenCalledWith(
          expect.objectContaining({
            x: expected.x,
            y: expected.y
          })
        )
        
        WINDOWS.clear()
      })
    })
  })

  describe('panel window properties validation', () => {
    it('should create panel with correct fixed dimensions', () => {
      createPanelWindow()
      
      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 260,
          height: 50,
          minWidth: 260,
          minHeight: 50,
          maxWidth: 260,
          maxHeight: 50
        })
      )
    })

    it('should create panel with correct behavior properties', () => {
      createPanelWindow()
      
      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          show: false,
          frame: false,
          closable: false,
          maximizable: false,
          alwaysOnTop: true,
          skipTaskbar: true,
          hiddenInMissionControl: true,
          paintWhenInitiallyHidden: true
        })
      )
    })

    it('should create panel with correct visual effects', () => {
      createPanelWindow()
      
      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          visualEffectState: 'active',
          vibrancy: 'under-window'
        })
      )
    })
  })

  describe('panel window lifecycle', () => {
    it('should properly clean up panel window on close', () => {
      createPanelWindow()
      
      expect(WINDOWS.has('panel')).toBe(true)
      
      // Trigger close event
      const closeHandler = vi.mocked(mockBrowserWindow.on).mock.calls
        .find(call => call[0] === 'close')?.[1]
      
      closeHandler?.()
      
      expect(WINDOWS.has('panel')).toBe(false)
    })

    it('should handle multiple show/hide cycles', () => {
      createPanelWindow()
      vi.clearAllMocks()
      
      // First show
      showPanelWindow()
      expect(mockBrowserWindow.showInactive).toHaveBeenCalledTimes(1)
      
      // Hide via stopRecordingAndHidePanelWindow
      vi.mocked(mockBrowserWindow.isVisible).mockReturnValue(true)
      stopRecordingAndHidePanelWindow()
      expect(mockBrowserWindow.hide).toHaveBeenCalledTimes(1)
      
      // Show again
      showPanelWindow()
      expect(mockBrowserWindow.showInactive).toHaveBeenCalledTimes(2)
    })
  })

  describe('MCP debug logging', () => {
    it('should filter and log important MCP console messages', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      createPanelWindow()
      
      // Get the console message handler
      const consoleHandler = vi.mocked(mockBrowserWindow.webContents.on).mock.calls
        .find(call => call[0] === 'console-message')?.[1]
      
      expect(consoleHandler).toBeDefined()
      
      // Test filtering of important messages
      const importantMessages = [
        '[MCP-DEBUG] startMcpRecording handler triggered',
        '[MCP-DEBUG] finishMcpRecording handler triggered',
        '[MCP-DEBUG] Using MCP transcription mutation',
        '[MCP-DEBUG] Recording ended, mcpMode: true',
        '[MCP-DEBUG] Setting mcpMode to true'
      ]
      
      importantMessages.forEach(message => {
        consoleHandler?.(null, 'info', message, 1, 'test.js')
        expect(consoleSpy).toHaveBeenCalledWith(`[MCP-DEBUG] 📝 ${message}`)
      })
    })

    it('should ignore non-important MCP messages', () => {
      const consoleSpy = vi.spyOn(console, 'log')
      createPanelWindow()
      
      const consoleHandler = vi.mocked(mockBrowserWindow.webContents.on).mock.calls
        .find(call => call[0] === 'console-message')?.[1]
      
      // Test ignoring of non-important messages
      const ignoredMessages = [
        '[MCP-DEBUG] Some other debug message',
        'Regular console log',
        '[MCP-DEBUG] Not in the filter list'
      ]
      
      ignoredMessages.forEach(message => {
        consoleHandler?.(null, 'info', message, 1, 'test.js')
      })
      
      // Should not have logged any of these
      ignoredMessages.forEach(message => {
        expect(consoleSpy).not.toHaveBeenCalledWith(`[MCP-DEBUG] 📝 ${message}`)
      })
    })
  })
})
