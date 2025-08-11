import { app, Menu } from "electron"
import { electronApp, optimizer } from "@electron-toolkit/utils"
import { registerIpcMain } from "@egoist/tipc/main"
import {
  createMainWindow,
  createPanelWindow,
  createSetupWindow,
  makePanelWindowClosable,
  WINDOWS,
} from "./window"
import { listenToKeyboardEvents } from "./keyboard"
import { router } from "./tipc"
import { registerServeProtocol, registerServeSchema } from "./serve"
import { createAppMenu } from "./menu"
import { initTray } from "./tray"
import { isAccessibilityGrantedAsync, isAccessibilityGrantedSync, refreshPermissionCache } from "./utils"
import { shutdownManager } from "./shutdown-manager"

registerServeSchema()

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId(process.env.APP_ID)

  Menu.setApplicationMenu(createAppMenu())

  registerIpcMain(router)

  registerServeProtocol()

  // Check accessibility permissions dynamically at startup
  // Use async version for development mode with enhanced detection
  console.log('[APP-STARTUP] Checking accessibility permissions...')
  let hasPermissions: boolean
  
  try {
    hasPermissions = await isAccessibilityGrantedAsync()
  } catch (error) {
    console.error('[APP-STARTUP] Error checking permissions, falling back to sync check:', error)
    hasPermissions = isAccessibilityGrantedSync()
  }
  
  console.log(`[APP-STARTUP] Accessibility permissions: ${hasPermissions}`)
  
  if (hasPermissions) {
    console.log('[APP-STARTUP] Creating main window')
    createMainWindow()
  } else {
    console.log('[APP-STARTUP] Creating setup window')
    createSetupWindow()
  }

  createPanelWindow()

  // Initialize keyboard listening asynchronously
  listenToKeyboardEvents().catch((error) => {
    console.error('[APP-STARTUP] Error starting keyboard events:', error)
  })

  initTray()

  import("./updater").then((res) => res.init()).catch(console.error)

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on("activate", async function () {
    // Always check permissions fresh when app is activated
    // Force refresh cache in development to ensure fresh check
    refreshPermissionCache()
    
    console.log('[APP-ACTIVATE] App activated, checking permissions...')
    
    let hasPermissions: boolean
    try {
      hasPermissions = await isAccessibilityGrantedAsync()
    } catch (error) {
      console.error('[APP-ACTIVATE] Error checking permissions, falling back to sync check:', error)
      hasPermissions = isAccessibilityGrantedSync()
    }
    
    console.log(`[APP-ACTIVATE] Accessibility permissions: ${hasPermissions}`)
    
    if (hasPermissions) {
      if (!WINDOWS.get("main")) {
        console.log('[APP-ACTIVATE] Creating main window')
        createMainWindow()
      }
      // Close setup window if it exists and we have permissions
      const setupWindow = WINDOWS.get("setup")
      if (setupWindow && !setupWindow.isDestroyed()) {
        console.log('[APP-ACTIVATE] Closing setup window (permissions granted)')
        setupWindow.close()
        WINDOWS.delete("setup")
      }
    } else {
      if (!WINDOWS.get("setup")) {
        console.log('[APP-ACTIVATE] Creating setup window')
        createSetupWindow()
      }
      // Close main window if it exists and we don't have permissions
      const mainWindow = WINDOWS.get("main")
      if (mainWindow && !mainWindow.isDestroyed()) {
        console.log('[APP-ACTIVATE] Closing main window (permissions revoked)')
        mainWindow.close()
        WINDOWS.delete("main")
      }
    }
  })

  app.on("before-quit", async (event) => {
    console.log("[SHUTDOWN-DEBUG] App before-quit event triggered")
    
    if (!shutdownManager.isShutdownInProgress()) {
      // Prevent default quit to run cleanup first
      event.preventDefault()
      
      try {
        console.log("[SHUTDOWN-DEBUG] Starting graceful shutdown...")
        await shutdownManager.gracefulShutdown()
        makePanelWindowClosable()
        console.log("[SHUTDOWN-DEBUG] Graceful shutdown completed, quitting app")
        app.quit()
      } catch (error) {
        console.error("[SHUTDOWN-DEBUG] Graceful shutdown failed:", error)
        console.log("[SHUTDOWN-DEBUG] Attempting force shutdown...")
        await shutdownManager.forceShutdown()
        makePanelWindowClosable()
        app.quit()
      }
    } else {
      // Shutdown already in progress, allow quit
      makePanelWindowClosable()
    }
  })

  app.on("will-quit", async (event) => {
    console.log("[SHUTDOWN-DEBUG] App will-quit event triggered")
    
    if (!shutdownManager.isShutdownInProgress()) {
      // Prevent default quit to run cleanup first
      event.preventDefault()
      
      try {
        console.log("[SHUTDOWN-DEBUG] Force shutdown from will-quit")
        await shutdownManager.forceShutdown()
        console.log("[SHUTDOWN-DEBUG] Force shutdown completed")
        app.quit()
      } catch (error) {
        console.error("[SHUTDOWN-DEBUG] Force shutdown failed:", error)
        // Continue with quit anyway
      }
    }
  })
})

// System signal handlers for graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[SHUTDOWN-DEBUG] SIGTERM received")
  try {
    await shutdownManager.gracefulShutdown(5000) // Shorter timeout for system signals
    app.quit()
  } catch (error) {
    console.error("[SHUTDOWN-DEBUG] SIGTERM graceful shutdown failed:", error)
    process.exit(1)
  }
})

process.on("SIGINT", async () => {
  console.log("[SHUTDOWN-DEBUG] SIGINT received")
  try {
    await shutdownManager.gracefulShutdown(5000) // Shorter timeout for system signals
    app.quit()
  } catch (error) {
    console.error("[SHUTDOWN-DEBUG] SIGINT graceful shutdown failed:", error)
    process.exit(1)
  }
})

// Handle uncaught exceptions and cleanup
process.on("uncaughtException", async (error) => {
  console.error("[SHUTDOWN-DEBUG] Uncaught exception:", error)
  try {
    await shutdownManager.forceShutdown()
  } catch (cleanupError) {
    console.error("[SHUTDOWN-DEBUG] Cleanup after uncaught exception failed:", cleanupError)
  }
  process.exit(1)
})

process.on("unhandledRejection", async (reason, promise) => {
  console.error("[SHUTDOWN-DEBUG] Unhandled rejection at:", promise, "reason:", reason)
  try {
    await shutdownManager.forceShutdown()
  } catch (cleanupError) {
    console.error("[SHUTDOWN-DEBUG] Cleanup after unhandled rejection failed:", cleanupError)
  }
  process.exit(1)
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
