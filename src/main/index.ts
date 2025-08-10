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
import { isAccessibilityGranted } from "./utils"
import { shutdownManager } from "./shutdown-manager"

registerServeSchema()

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId(process.env.APP_ID)

  Menu.setApplicationMenu(createAppMenu())

  registerIpcMain(router)

  registerServeProtocol()

  // Check accessibility permissions dynamically at startup
  if (isAccessibilityGranted()) {
    createMainWindow()
  } else {
    createSetupWindow()
  }

  createPanelWindow()

  listenToKeyboardEvents()

  initTray()

  import("./updater").then((res) => res.init()).catch(console.error)

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on("activate", function () {
    // Always check permissions fresh when app is activated
    if (isAccessibilityGranted()) {
      if (!WINDOWS.get("main")) {
        createMainWindow()
      }
    } else {
      if (!WINDOWS.get("setup")) {
        createSetupWindow()
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
