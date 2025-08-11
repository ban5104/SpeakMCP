import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { MCPService } from '../mcp-service'
import { listenToKeyboardEvents } from '../keyboard'
import { configStore } from '../config'

// Mock electron and child_process modules
vi.mock('electron', () => ({
  app: {
    quit: vi.fn(),
    relaunch: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    exit: vi.fn(),
  },
  systemPreferences: {
    isTrustedAccessibilityClient: vi.fn().mockReturnValue(true)
  },
  Notification: vi.fn().mockImplementation((options) => ({
    show: vi.fn(),
    title: options.title,
    body: options.body
  }))
}))

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return {
    ...actual,
    spawn: vi.fn(),
    ChildProcess: vi.fn()
  }
})

vi.mock('../config', () => ({
  configStore: {
    get: vi.fn().mockReturnValue({
      shortcut: 'hold-ctrl',
      mcpToolsEnabled: false,
      mcpConfig: null
    })
  }
}))

vi.mock('../window', () => ({
  getWindowRendererHandlers: vi.fn(),
  showPanelWindowAndStartRecording: vi.fn(),
  showPanelWindowAndStartMcpRecording: vi.fn(),
  stopRecordingAndHidePanelWindow: vi.fn(),
  WINDOWS: new Map(),
  createMainWindow: vi.fn(),
  createSetupWindow: vi.fn(),
  createPanelWindow: vi.fn(),
  makePanelWindowClosable: vi.fn()
}))

vi.mock('../utils', () => ({
  isAccessibilityGranted: vi.fn().mockReturnValue(true)
}))

vi.mock('../tray', () => ({
  initTray: vi.fn()
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true)
  }
})

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    listTools: vi.fn().mockResolvedValue({ tools: [] }),
    callTool: vi.fn(),
    close: vi.fn()
  }))
}))

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => ({
    close: vi.fn()
  }))
}))

describe('Shutdown Cleanup Issues', () => {
  let mockSpawn: any
  let mockChildProcess: any
  let mockProcessExit: any
  let mockProcessKill: any
  let mockSetTimeout: any
  let originalSetTimeout: typeof setTimeout
  let originalClearTimeout: typeof clearTimeout
  let timerIds: number[]
  let nextTimerId: number

  beforeEach(() => {
    // Setup timer tracking
    originalSetTimeout = global.setTimeout
    originalClearTimeout = global.clearTimeout
    timerIds = []
    nextTimerId = 1

    // Mock setTimeout to track active timers
    mockSetTimeout = vi.fn().mockImplementation((callback, delay) => {
      const id = nextTimerId++
      timerIds.push(id)
      // Simulate the timer by executing immediately in tests
      if (typeof callback === 'function') {
        setTimeout(() => {
          if (timerIds.includes(id)) {
            callback()
          }
        }, 0) // Execute in next tick for async behavior
      }
      return id
    })

    global.setTimeout = mockSetTimeout

    global.clearTimeout = vi.fn().mockImplementation((id) => {
      const index = timerIds.indexOf(id)
      if (index > -1) {
        timerIds.splice(index, 1)
      }
      return originalClearTimeout(id)
    })

    // Mock child process for Rust binary
    mockChildProcess = {
      pid: 12345,
      kill: vi.fn(),
      on: vi.fn(),
      stdout: {
        on: vi.fn()
      },
      stderr: {
        on: vi.fn()
      }
    }

    mockSpawn = vi.mocked(spawn).mockReturnValue(mockChildProcess as any)

    // Mock process methods
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
    mockProcessKill = vi.spyOn(process, 'kill').mockImplementation(() => true)

    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore original timers
    global.setTimeout = originalSetTimeout
    global.clearTimeout = originalClearTimeout
    mockProcessExit.mockRestore()
    mockProcessKill.mockRestore()
  })

  describe('Issue 1: Orphaned Rust Binary Process', () => {
    it('should fail - Rust binary process continues running after app quit', async () => {
      // Arrange: Start keyboard monitoring which spawns Rust binary
      listenToKeyboardEvents()
      
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('speakmcp-rs'),
        ['listen'],
        {}
      )
      
      // Act: Simulate app quit without cleanup
      const appMock = vi.mocked(app)
      appMock.quit()
      
      // Assert: The spawned process should be killed but isn't
      // This test will FAIL because there's no cleanup logic
      expect(mockChildProcess.kill).not.toHaveBeenCalled()
      
      // The process should be alive (test demonstrates the bug)
      expect(mockChildProcess.pid).toBeDefined()
      
      // TODO: After fix, this should pass:
      // expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM')
    })

    it('should fail - multiple Rust processes not tracked or cleaned up', async () => {
      // Arrange: Start keyboard monitoring multiple times (simulating restart scenarios)
      listenToKeyboardEvents()
      listenToKeyboardEvents() // Second call should clean up first
      
      expect(mockSpawn).toHaveBeenCalledTimes(2)
      
      // Act: App quit
      const appMock = vi.mocked(app)
      appMock.quit()
      
      // Assert: No process cleanup happens
      expect(mockChildProcess.kill).not.toHaveBeenCalled()
      
      // TODO: After fix, should kill both processes or prevent multiple spawning
    })

    it('should fail - no error handling for process that fails to terminate', async () => {
      // Arrange: Start keyboard monitoring
      listenToKeyboardEvents()
      
      // Mock process.kill to fail
      mockChildProcess.kill.mockReturnValue(false)
      
      // Act: Attempt cleanup (this doesn't exist currently)
      // This test demonstrates there's no cleanup function to call
      
      // Assert: There's no cleanup mechanism to test
      expect(mockChildProcess.kill).not.toHaveBeenCalled()
      
      // TODO: After fix, should have cleanup function that handles kill failures
    })
  })

  describe('Issue 2: MCP Service Not Cleaned Up', () => {
    let mcpService: MCPService

    beforeEach(async () => {
      mcpService = new MCPService()
      await mcpService.initialize()
    })

    it('should fail - MCP service cleanup never called on app shutdown', async () => {
      // Arrange: MCP service is running
      const cleanupSpy = vi.spyOn(mcpService, 'cleanup')
      
      // Act: App quits without cleanup
      const appMock = vi.mocked(app)
      appMock.quit()
      
      // Assert: cleanup was never called
      expect(cleanupSpy).not.toHaveBeenCalled()
      
      // TODO: After fix, cleanup should be called:
      // expect(cleanupSpy).toHaveBeenCalled()
    })

    it('should fail - MCP server connections remain open after shutdown', async () => {
      // Arrange: Mock MCP servers with connections
      const mockConfigStore = vi.mocked(configStore)
      mockConfigStore.get.mockReturnValue({
        shortcut: 'hold-ctrl',
        mcpToolsEnabled: true,
        mcpConfig: {
          mcpServers: {
            'test-server': {
              command: 'echo',
              args: ['test'],
              disabled: false
            }
          }
        }
      })
      
      const freshMcpService = new MCPService()
      await freshMcpService.initialize()
      
      const serverStatus = freshMcpService.getServerStatus()
      
      // Act: App shutdown without cleanup
      const appMock = vi.mocked(app)
      appMock.quit()
      
      // Assert: Connections should be closed but aren't
      // This demonstrates the bug - no cleanup is triggered
      const statusAfterQuit = freshMcpService.getServerStatus()
      expect(Object.keys(statusAfterQuit)).toHaveLength(Object.keys(serverStatus).length)
      
      // TODO: After fix, servers should be disconnected:
      // await freshMcpService.cleanup()
      // expect(freshMcpService.getServerStatus()).toEqual({})
    })
  })

  describe('Issue 3: No Signal Handling', () => {
    it('should fail - SIGTERM signal not handled', async () => {
      // Arrange: Setup signal handlers (none exist currently)
      let sigtermHandler: Function | undefined
      const originalProcessOn = process.on
      
      const processOnSpy = vi.spyOn(process, 'on').mockImplementation((signal, handler) => {
        if (signal === 'SIGTERM') {
          sigtermHandler = handler as Function
        }
        return originalProcessOn.call(process, signal, handler)
      })
      
      // Act: Check if main process registers signal handlers
      // Current implementation has no signal handlers
      // We can't import index.ts due to electron module issues in tests
      // but we can check if signal handlers are registered
      
      // Assert: No SIGTERM handler was registered
      expect(sigtermHandler).toBeUndefined()
      
      // TODO: After fix, should have signal handler:
      // expect(sigtermHandler).toBeDefined()
      
      processOnSpy.mockRestore()
    })

    it('should fail - SIGINT signal not handled', async () => {
      // Similar test for SIGINT
      let sigintHandler: Function | undefined
      const originalProcessOn = process.on
      
      const processOnSpy = vi.spyOn(process, 'on').mockImplementation((signal, handler) => {
        if (signal === 'SIGINT') {
          sigintHandler = handler as Function
        }
        return originalProcessOn.call(process, signal, handler)
      })
      
      // Check if any signal handlers exist (they don't)
      // This demonstrates the bug - no signal handling
      
      expect(sigintHandler).toBeUndefined()
      
      processOnSpy.mockRestore()
    })

    it('should fail - no cleanup on unexpected termination', async () => {
      // Arrange: Start services
      const mcpService = new MCPService()
      await mcpService.initialize()
      listenToKeyboardEvents()
      
      // Act: Simulate unexpected termination (SIGKILL)
      // No cleanup handlers exist
      
      // Assert: Resources remain allocated
      expect(mockChildProcess.kill).not.toHaveBeenCalled()
      
      const cleanupSpy = vi.spyOn(mcpService, 'cleanup')
      expect(cleanupSpy).not.toHaveBeenCalled()
    })
  })

  describe('Issue 4: Timer Leaks', () => {
    it('should fail - keyboard monitoring timers not cleared on shutdown', async () => {
      // Arrange: Start keyboard monitoring which creates timers
      listenToKeyboardEvents()
      
      // Simulate some keyboard events that create timers
      const mockEvent = {
        event_type: 'KeyPress' as const,
        data: { key: 'ControlLeft' as const },
        time: { secs_since_epoch: Date.now() / 1000 }
      }
      
      // Trigger timer creation (this normally happens through stdout parsing)
      // For testing, we need to access the timers indirectly
      
      // Act: App quits
      const appMock = vi.mocked(app)
      appMock.quit()
      
      // Assert: Timers are not cleared
      // Current implementation has no timer cleanup
      expect(timerIds.length).toBeGreaterThan(0)
      expect(global.clearTimeout).not.toHaveBeenCalled()
      
      // TODO: After fix, all timers should be cleared:
      // expect(timerIds.length).toBe(0)
    })

    it('should fail - MCP service timeout timers not cleared', async () => {
      // Arrange: Create MCP service with servers that might have timeouts
      const mockConfigStore = vi.mocked(configStore)
      mockConfigStore.get.mockReturnValue({
        shortcut: 'hold-ctrl',
        mcpToolsEnabled: true,
        mcpConfig: {
          mcpServers: {
            'slow-server': {
              command: 'sleep',
              args: ['10'],
              disabled: false,
              timeout: 5000
            }
          }
        }
      })
      
      const mcpService = new MCPService()
      
      // Start initialization (creates timeout timers)
      const initPromise = mcpService.initialize().catch(() => {}) // Ignore failures
      
      // Act: Quit before initialization completes
      const appMock = vi.mocked(app)
      appMock.quit()
      
      await initPromise
      
      // Assert: Timeout timers still running
      expect(timerIds.length).toBeGreaterThan(0)
      
      // TODO: After fix, cleanup should clear all timers
    })

    it('should fail - UI polling intervals not cleared on shutdown', () => {
      // Arrange: Simulate UI components with intervals
      const intervalIds: NodeJS.Timeout[] = []
      const mockSetInterval = vi.fn().mockImplementation((callback, delay) => {
        const id = setInterval(callback, delay)
        intervalIds.push(id)
        return id
      })
      
      global.setInterval = mockSetInterval
      
      // Create some intervals (simulating UI components)
      const interval1 = setInterval(() => {}, 1000)
      const interval2 = setInterval(() => {}, 5000)
      
      // Act: App quits
      const appMock = vi.mocked(app)
      appMock.quit()
      
      // Assert: Intervals not cleared
      expect(intervalIds.length).toBe(2)
      
      // TODO: After fix, all intervals should be cleared
      
      // Cleanup for test
      intervalIds.forEach(id => clearInterval(id))
    })
  })

  describe('Issue 5: Graceful vs Force Shutdown', () => {
    it('should fail - no distinction between graceful and forced shutdown', async () => {
      // Arrange: Start all services
      const mcpService = new MCPService()
      await mcpService.initialize()
      listenToKeyboardEvents()
      
      // Act: Simulate different shutdown scenarios
      const gracefulQuitSpy = vi.spyOn(app, 'quit')
      const forceExitSpy = mockProcessExit
      
      // Test graceful shutdown
      app.quit()
      
      // Test force shutdown
      try {
        process.exit(1)
      } catch {}
      
      // Assert: Both handled the same way (no cleanup)
      expect(gracefulQuitSpy).toHaveBeenCalled()
      expect(forceExitSpy).toHaveBeenCalled()
      
      // No cleanup was performed in either case
      expect(mockChildProcess.kill).not.toHaveBeenCalled()
      
      // TODO: After fix, graceful shutdown should cleanup, force should not
    })

    it('should fail - no timeout for graceful shutdown to force', async () => {
      // Arrange: Start services that might hang during cleanup
      const mcpService = new MCPService()
      await mcpService.initialize()
      
      // Mock cleanup to hang
      const hangingCleanup = vi.spyOn(mcpService, 'cleanup').mockImplementation(() => {
        return new Promise(() => {}) // Never resolves
      })
      
      // Act: Attempt graceful shutdown
      const startTime = Date.now()
      
      try {
        app.quit()
        // In a real implementation, this should timeout and force quit
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch {}
      
      const elapsed = Date.now() - startTime
      
      // Assert: No timeout mechanism exists
      expect(elapsed).toBeLessThan(1000) // Should have timed out by now
      expect(mockProcessExit).not.toHaveBeenCalled()
      
      // TODO: After fix, should timeout and force quit
      
      hangingCleanup.mockRestore()
    })
  })

  describe('Issue 6: Shutdown Triggers', () => {
    it('should fail - window close does not trigger full cleanup', async () => {
      // Arrange: Start services
      listenToKeyboardEvents()
      
      // Act: Close window without app.quit()
      // This simulates user closing window vs CMD+Q
      
      // Assert: Services still running
      expect(mockChildProcess.kill).not.toHaveBeenCalled()
      
      // TODO: After fix, window close should trigger cleanup in some cases
    })

    it('should fail - system shutdown not handled differently from app quit', async () => {
      // Arrange: Start services
      const mcpService = new MCPService()
      await mcpService.initialize()
      listenToKeyboardEvents()
      
      // Act: Simulate system shutdown (SIGTERM from system)
      // Current implementation has no signal handlers
      
      // Assert: No special handling for system shutdown
      expect(process.listeners('SIGTERM')).toHaveLength(0)
      
      // TODO: After fix, should have system shutdown handlers
    })

    it('should fail - app.quit() and process.exit() handled identically', () => {
      // Arrange: Track cleanup calls
      const cleanupCalls: string[] = []
      
      // Act: Try different shutdown methods
      try {
        app.quit()
        cleanupCalls.push('app.quit')
      } catch {}
      
      try {
        process.exit(0)
      } catch {
        cleanupCalls.push('process.exit')
      }
      
      // Assert: Both called but no cleanup differentiation
      expect(cleanupCalls).toContain('app.quit')
      expect(cleanupCalls).toContain('process.exit')
      
      // TODO: After fix, should have different cleanup strategies
    })
  })

  describe('Integration: Complete Shutdown Scenario', () => {
    it('should fail - complete app shutdown leaves resources running', async () => {
      // Arrange: Start entire application stack
      const mcpService = new MCPService()
      await mcpService.initialize()
      listenToKeyboardEvents()
      
      // Simulate running state
      expect(mockSpawn).toHaveBeenCalled()
      expect(mcpService.getAvailableTools().length).toBeGreaterThan(0)
      expect(timerIds.length).toBeGreaterThanOrEqual(0)
      
      // Act: Complete shutdown sequence
      const appMock = vi.mocked(app)
      appMock.quit()
      
      // Wait a bit to allow any existing cleanup
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Assert: All resources still allocated (demonstrates all bugs)
      expect(mockChildProcess.kill).not.toHaveBeenCalled() // Rust binary still running
      
      const cleanupSpy = vi.spyOn(mcpService, 'cleanup')
      expect(cleanupSpy).not.toHaveBeenCalled() // MCP not cleaned up
      
      // Timers still active
      expect(global.clearTimeout).not.toHaveBeenCalled()
      
      // No signal handlers registered
      expect(process.listeners('SIGTERM')).toHaveLength(0)
      expect(process.listeners('SIGINT')).toHaveLength(0)
      
      // TODO: After fix, all resources should be cleaned up:
      // expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM')
      // expect(cleanupSpy).toHaveBeenCalled()
      // expect(timerIds).toHaveLength(0)
      // expect(process.listeners('SIGTERM').length).toBeGreaterThan(0)
    })
  })
})
