import { spawn, ChildProcess } from "child_process"
import path from "path"
import fs from "fs"
import { systemPreferences } from "electron"
import {
  getWindowRendererHandlers,
  showPanelWindowAndStartRecording,
  showPanelWindowAndStartMcpRecording,
  stopRecordingAndHidePanelWindow,
  WINDOWS,
} from "./window"
import { configStore } from "./config"
import { state } from "./state"
import { isAccessibilityGrantedAsync, isAccessibilityGrantedSync, refreshPermissionCache } from "./utils"
import { shutdownManager } from "./shutdown-manager"

let binaryName: string;
let currentKeyboardProcess: ChildProcess | null = null;

switch (process.platform) {
  case 'darwin': // This is macOS
    binaryName = 'speakmcp-rs';
    break;
  case 'win32': // This is Windows
    binaryName = 'speakmcp-rs.exe';
    break;
  case 'linux': // This is Linux
    binaryName = 'speakmcp-rs';
    break;
  default:
    throw new Error(`Unsupported platform for rdev: ${process.platform}`);
}

// When packaged, the binary could be in either location depending on electron-builder config
const getPackagedBinaryPath = () => {
  // Try process.resourcesPath first (electron-builder extraResources)
  if (process.resourcesPath) {
    const resourcesPath = path.join(process.resourcesPath, 'resources', 'bin', binaryName)
    if (fs.existsSync(resourcesPath)) {
      return resourcesPath
    }
    
    // Try app.asar.unpacked location (electron-vite + electron-builder)
    const asarUnpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'bin', binaryName)
    if (fs.existsSync(asarUnpackedPath)) {
      return asarUnpackedPath
    }
  }
  
  // Development path
  return path.join(__dirname, `../../resources/bin/${binaryName}`)
}

const rdevPath = getPackagedBinaryPath()

// Check if the Rust binary exists
const isBinaryAvailable = () => {
  try {
    return fs.existsSync(rdevPath)
  } catch (error) {
    return false
  }
}

type RdevEvent = {
  event_type: "KeyPress" | "KeyRelease"
  data: {
    key: "ControlLeft" | "BackSlash" | string
  }
  time: {
    secs_since_epoch: number
  }
}

export const writeText = (text: string) => {
  return new Promise<void>((resolve, reject) => {
    if (!isBinaryAvailable()) {
      console.warn("⚠️  Rust binary not available - text insertion disabled")
      console.warn("💡 Install Rust toolchain and run 'pnpm run build-rs' to enable text insertion")
      // Resolve gracefully instead of rejecting to prevent app crashes
      resolve()
      return
    }

    const child: ChildProcess = spawn(rdevPath, ["write", text])

    let stderr = ""

    child.stderr?.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("error", (error) => {
      reject(new Error(`Failed to spawn process: ${error.message}`))
    })

    child.on("close", (code) => {
      // writeText will trigger KeyPress event of the key A
      // I don't know why
      keysPressed.clear()

      if (code === 0) {
        resolve()
      } else {
        const errorMessage = `child process exited with code ${code}${stderr.trim() ? `. stderr: ${stderr.trim()}` : ""}`
        reject(new Error(errorMessage))
      }
    })
  })
}

const parseEvent = (event: any) => {
  try {
    const e = JSON.parse(String(event))
    e.data = JSON.parse(e.data)
    return e as RdevEvent
  } catch {
    return null
  }
}

// keys that are currently pressed down without releasing
// excluding ctrl
// when other keys are pressed, pressing ctrl will not start recording
const keysPressed = new Map<string, number>()

const hasRecentKeyPress = () => {
  if (keysPressed.size === 0) return false

  const now = Date.now() / 1000
  return [...keysPressed.values()].some((time) => {
    // 10 seconds
    // for some weird reasons sometime KeyRelease event is missing for some keys
    // so they stay in the map
    // therefore we have to check if the key was pressed in the last 10 seconds
    return now - time < 10
  })
}

export async function listenToKeyboardEvents() {
  // If already running, don't start another process
  if (currentKeyboardProcess && !currentKeyboardProcess.killed) {
    console.log(`[KEYBOARD-DEBUG] Keyboard monitoring already running (PID: ${currentKeyboardProcess.pid})`)
    return
  }

  let isHoldingCtrlKey = false
  let startRecordingTimer: NodeJS.Timeout | undefined
  let isPressedCtrlKey = false

  // Double-tap Control detection state
  let lastCtrlPressTime = 0
  let doubleTapTimer: NodeJS.Timeout | undefined
  const DOUBLE_TAP_WINDOW = 300 // 300ms window for double-tap detection

  // MCP tool calling state
  let isHoldingCtrlAltKey = false
  let startMcpRecordingTimer: NodeJS.Timeout | undefined
  let isPressedCtrlAltKey = false

  console.log(`[KEYBOARD-DEBUG] Starting keyboard listener...`)
  console.log(`[KEYBOARD-DEBUG] Binary path: ${rdevPath}`)
  console.log(`[KEYBOARD-DEBUG] Binary available: ${isBinaryAvailable()}`)

  // Check accessibility permissions with enhanced detection for development
  let hasPermissions: boolean
  try {
    hasPermissions = await isAccessibilityGrantedAsync()
  } catch (error) {
    console.error('[KEYBOARD-DEBUG] Error checking permissions async, using sync fallback:', error)
    hasPermissions = isAccessibilityGrantedSync()
  }
  
  console.log(`[KEYBOARD-DEBUG] Accessibility granted: ${hasPermissions}`)

  if (!hasPermissions) {
    console.log(`[KEYBOARD-DEBUG] ❌ Accessibility not granted, keyboard monitoring disabled`)
    return
  }

  if (!isBinaryAvailable()) {
    console.log(`[KEYBOARD-DEBUG] ❌ Rust binary not available at: ${rdevPath}`)
    return
  }

  const cancelRecordingTimer = () => {
    if (startRecordingTimer) {
      clearTimeout(startRecordingTimer)
      startRecordingTimer = undefined
    }
  }

  const cancelMcpRecordingTimer = () => {
    if (startMcpRecordingTimer) {
      clearTimeout(startMcpRecordingTimer)
      startMcpRecordingTimer = undefined
    }
  }

  const clearDoubleTapTimer = () => {
    if (doubleTapTimer) {
      clearTimeout(doubleTapTimer)
      doubleTapTimer = undefined
    }
  }

  const handleEvent = (e: RdevEvent) => {
    console.log(`[MCP-DEBUG] Key event: ${e.event_type} - ${e.data.key}`)

    if (e.event_type === "KeyPress") {
      if (e.data.key === "ControlLeft") {
        isPressedCtrlKey = true
        console.log(`[MCP-DEBUG] ControlLeft pressed, isPressedCtrlKey: ${isPressedCtrlKey}`)
      }

      if (e.data.key === "Alt") {
        isPressedCtrlAltKey = isPressedCtrlKey && true
        console.log(`[MCP-DEBUG] Alt pressed, isPressedCtrlKey: ${isPressedCtrlKey}, isPressedCtrlAltKey: ${isPressedCtrlAltKey}`)
      }

      if (e.data.key === "Escape" && state.isRecording) {
        console.log(`[MCP-DEBUG] Escape pressed while recording, stopping recording`)
        const win = WINDOWS.get("panel")
        if (win) {
          stopRecordingAndHidePanelWindow()
        }

        return
      }

      // Handle MCP tool calling shortcuts
      const config = configStore.get()
      console.log(`[MCP-DEBUG] Config check - mcpToolsEnabled: ${config.mcpToolsEnabled}, mcpToolsShortcut: ${config.mcpToolsShortcut}`)

      if (config.mcpToolsEnabled && config.mcpToolsShortcut === "ctrl-alt-slash") {
        console.log(`[MCP-DEBUG] Checking ctrl-alt-slash shortcut - key: ${e.data.key}, isPressedCtrlKey: ${isPressedCtrlKey}, isPressedCtrlAltKey: ${isPressedCtrlAltKey}`)
        if (e.data.key === "Slash" && isPressedCtrlKey && isPressedCtrlAltKey) {
          console.log(`[MCP-DEBUG] ✅ Ctrl+Alt+Slash detected! Triggering MCP recording`)
          getWindowRendererHandlers("panel")?.startOrFinishMcpRecording.send()
          return
        }
      }

      if (config.shortcut === "ctrl-slash") {
        if (e.data.key === "Slash" && isPressedCtrlKey) {
          getWindowRendererHandlers("panel")?.startOrFinishRecording.send()
        }
      } else if (config.shortcut === "double-tap-ctrl") {
        if (e.data.key === "ControlLeft") {
          if (hasRecentKeyPress()) {
            console.log("ignore ctrl because other keys are pressed", [
              ...keysPressed.keys(),
            ])
            return
          }

          const currentTime = Date.now()
          const timeSinceLastTap = currentTime - lastCtrlPressTime

          if (timeSinceLastTap <= DOUBLE_TAP_WINDOW && lastCtrlPressTime > 0) {
            // Double-tap detected!
            console.log("Double-tap Control detected! Starting recording")
            clearDoubleTapTimer()
            lastCtrlPressTime = 0 // Reset to prevent triple-tap
            getWindowRendererHandlers("panel")?.startOrFinishRecording.send()
          } else {
            // First tap or too long since last tap
            lastCtrlPressTime = currentTime
            clearDoubleTapTimer()
            
            // Set timer to reset if no second tap occurs
            doubleTapTimer = setTimeout(() => {
              lastCtrlPressTime = 0
            }, DOUBLE_TAP_WINDOW)
          }
        } else {
          keysPressed.set(e.data.key, e.time.secs_since_epoch)
          clearDoubleTapTimer()
          lastCtrlPressTime = 0 // Reset double-tap detection when other keys are pressed
        }
      } else {
        if (e.data.key === "ControlLeft") {
          if (hasRecentKeyPress()) {
            console.log("ignore ctrl because other keys are pressed", [
              ...keysPressed.keys(),
            ])
            return
          }

          if (startRecordingTimer) {
            // console.log('already started recording timer')
            return
          }

          startRecordingTimer = setTimeout(() => {
            isHoldingCtrlKey = true

            console.log("start recording")

            showPanelWindowAndStartRecording()
          }, 800)
        } else if (e.data.key === "Alt" && isPressedCtrlKey && config.mcpToolsEnabled && config.mcpToolsShortcut === "hold-ctrl-alt") {
          console.log(`[MCP-DEBUG] Hold-ctrl-alt shortcut detected - Alt pressed while ControlLeft held`)

          if (hasRecentKeyPress()) {
            console.log("[MCP-DEBUG] Ignoring ctrl+alt because other keys are pressed", [
              ...keysPressed.keys(),
            ])
            return
          }

          if (startMcpRecordingTimer) {
            console.log("[MCP-DEBUG] MCP recording timer already started, ignoring")
            return
          }

          // Cancel the regular recording timer since we're starting MCP mode
          console.log("[MCP-DEBUG] Cancelling regular recording timer for MCP mode")
          cancelRecordingTimer()

          console.log("[MCP-DEBUG] Starting MCP recording timer (800ms)")
          startMcpRecordingTimer = setTimeout(() => {
            isHoldingCtrlAltKey = true
            console.log(`[MCP-DEBUG] ✅ MCP recording timer triggered! isHoldingCtrlAltKey set to: ${isHoldingCtrlAltKey}`)

            console.log("[MCP-DEBUG] Starting MCP recording")

            showPanelWindowAndStartMcpRecording()
          }, 800)
        } else {
          keysPressed.set(e.data.key, e.time.secs_since_epoch)
          cancelRecordingTimer()
          cancelMcpRecordingTimer()

          // when holding ctrl key, pressing any other key will stop recording
          if (isHoldingCtrlKey) {
            stopRecordingAndHidePanelWindow()
          }

          // when holding ctrl+alt key, pressing any other key will stop MCP recording
          if (isHoldingCtrlAltKey) {
            stopRecordingAndHidePanelWindow()
          }

          isHoldingCtrlKey = false
          isHoldingCtrlAltKey = false
        }
      }
    } else if (e.event_type === "KeyRelease") {
      console.log(`[MCP-DEBUG] Key release: ${e.data.key}`)
      keysPressed.delete(e.data.key)

      if (e.data.key === "ControlLeft") {
        isPressedCtrlKey = false
        console.log(`[MCP-DEBUG] ControlLeft released, isPressedCtrlKey: ${isPressedCtrlKey}`)
      }

      if (e.data.key === "Alt") {
        isPressedCtrlAltKey = false
        console.log(`[MCP-DEBUG] Alt released, isPressedCtrlAltKey: ${isPressedCtrlAltKey}`)
      }

      if (configStore.get().shortcut === "ctrl-slash" || configStore.get().shortcut === "double-tap-ctrl") return

      cancelRecordingTimer()
      cancelMcpRecordingTimer()

      if (e.data.key === "ControlLeft") {
        console.log("release ctrl")
        if (isHoldingCtrlKey) {
          getWindowRendererHandlers("panel")?.finishRecording.send()
        } else {
          stopRecordingAndHidePanelWindow()
        }

        isHoldingCtrlKey = false
      }

      if (e.data.key === "Alt") {
        console.log(`[MCP-DEBUG] release alt - isHoldingCtrlAltKey: ${isHoldingCtrlAltKey}`)
        if (isHoldingCtrlAltKey) {
          console.log("[MCP-DEBUG] ✅ Finishing MCP recording")
          const panelHandlers = getWindowRendererHandlers("panel")
          console.log(`[MCP-DEBUG] Panel handlers available: ${!!panelHandlers}`)
          panelHandlers?.finishMcpRecording.send()
          console.log("[MCP-DEBUG] finishMcpRecording.send() called")
        } else {
          console.log("[MCP-DEBUG] ❌ Stopping recording and hiding panel (not holding)")
          stopRecordingAndHidePanelWindow()
        }

        isHoldingCtrlAltKey = false
      }
    }
  }

  console.log(`[KEYBOARD-DEBUG] Starting keyboard monitoring process: ${rdevPath} listen`)
  currentKeyboardProcess = spawn(rdevPath, ["listen"], {})

  // Track the process for cleanup during shutdown
  shutdownManager.trackProcess("keyboard-monitor", currentKeyboardProcess)

  currentKeyboardProcess.on("error", (error) => {
    console.error(`[KEYBOARD-DEBUG] ❌ Failed to spawn keyboard monitoring process:`, error)
    shutdownManager.untrackProcess("keyboard-monitor")
    currentKeyboardProcess = null
  })

  currentKeyboardProcess.on("close", (code) => {
    console.log(`[KEYBOARD-DEBUG] ⚠️ Keyboard monitoring process closed with code: ${code}`)
    shutdownManager.untrackProcess("keyboard-monitor")
    currentKeyboardProcess = null
  })

  currentKeyboardProcess.stdout?.on("data", (data) => {
    if (import.meta.env.DEV) {
      console.log(String(data))
    }

    const event = parseEvent(data)
    if (!event) return

    handleEvent(event)
  })
}
