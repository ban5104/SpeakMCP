import { ChildProcess } from "child_process"

export interface CleanupTask {
  name: string
  cleanup: () => Promise<void> | void
  priority: number // Lower numbers run first
}

export interface ProcessTracker {
  pid: number
  process: ChildProcess
  name: string
}

export class ShutdownManager {
  private cleanupTasks: Map<string, CleanupTask> = new Map()
  private trackedProcesses: Map<string, ProcessTracker> = new Map()
  private trackedTimers: Set<NodeJS.Timeout> = new Set()
  private trackedIntervals: Set<NodeJS.Timeout> = new Set()
  private isShuttingDown = false
  private shutdownPromise: Promise<void> | null = null

  constructor() {
    // Override global timer functions to track them
    this.setupTimerTracking()
  }

  /**
   * Register a cleanup task to run during shutdown
   */
  registerCleanupTask(task: CleanupTask): void {
    this.cleanupTasks.set(task.name, task)
    console.log(`[SHUTDOWN-DEBUG] Registered cleanup task: ${task.name} (priority: ${task.priority})`)
  }

  /**
   * Unregister a cleanup task
   */
  unregisterCleanupTask(name: string): void {
    this.cleanupTasks.delete(name)
    console.log(`[SHUTDOWN-DEBUG] Unregistered cleanup task: ${name}`)
  }

  /**
   * Track a child process for cleanup during shutdown
   */
  trackProcess(name: string, process: ChildProcess): void {
    if (!process.pid) {
      console.warn(`[SHUTDOWN-DEBUG] Cannot track process ${name}: no PID`)
      return
    }

    this.trackedProcesses.set(name, {
      pid: process.pid,
      process,
      name
    })

    console.log(`[SHUTDOWN-DEBUG] Tracking process: ${name} (PID: ${process.pid})`)

    // Clean up when process exits naturally
    process.on('exit', () => {
      this.untrackProcess(name)
    })
  }

  /**
   * Stop tracking a process
   */
  untrackProcess(name: string): void {
    const tracker = this.trackedProcesses.get(name)
    if (tracker) {
      this.trackedProcesses.delete(name)
      console.log(`[SHUTDOWN-DEBUG] Untracked process: ${name} (PID: ${tracker.pid})`)
    }
  }

  /**
   * Get list of tracked processes
   */
  getTrackedProcesses(): ProcessTracker[] {
    return Array.from(this.trackedProcesses.values())
  }

  /**
   * Setup timer tracking to prevent leaks
   */
  private setupTimerTracking(): void {
    // Skip timer tracking in test environment to avoid conflicts
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      console.log(`[SHUTDOWN-DEBUG] Timer tracking disabled in test environment`)
      return
    }

    const originalSetTimeout = global.setTimeout
    const originalSetInterval = global.setInterval
    const originalClearTimeout = global.clearTimeout
    const originalClearInterval = global.clearInterval

    global.setTimeout = ((callback: any, delay?: number, ...args: any[]) => {
      const id = originalSetTimeout(callback, delay, ...args)
      this.trackedTimers.add(id)
      return id
    }) as typeof setTimeout

    global.setInterval = ((callback: any, delay?: number, ...args: any[]) => {
      const id = originalSetInterval(callback, delay, ...args)
      this.trackedIntervals.add(id)
      return id
    }) as typeof setInterval

    global.clearTimeout = (id?: NodeJS.Timeout | number | string) => {
      if (id) {
        this.trackedTimers.delete(id as NodeJS.Timeout)
        originalClearTimeout(id as NodeJS.Timeout)
      }
    }

    global.clearInterval = (id?: NodeJS.Timeout | number | string) => {
      if (id) {
        this.trackedIntervals.delete(id as NodeJS.Timeout)
        originalClearInterval(id as NodeJS.Timeout)
      }
    }

    console.log(`[SHUTDOWN-DEBUG] Timer tracking enabled`)
  }

  /**
   * Clear all tracked timers and intervals
   */
  private clearAllTimers(): void {
    console.log(`[SHUTDOWN-DEBUG] Clearing ${this.trackedTimers.size} timers and ${this.trackedIntervals.size} intervals`)

    for (const timerId of this.trackedTimers) {
      clearTimeout(timerId)
    }
    this.trackedTimers.clear()

    for (const intervalId of this.trackedIntervals) {
      clearInterval(intervalId)
    }
    this.trackedIntervals.clear()
  }

  /**
   * Terminate all tracked processes
   */
  private async terminateProcesses(force = false): Promise<void> {
    const processes = Array.from(this.trackedProcesses.values())
    if (processes.length === 0) return

    console.log(`[SHUTDOWN-DEBUG] Terminating ${processes.length} processes (force: ${force})`)

    const terminationPromises = processes.map(async (tracker) => {
      try {
        const signal = force ? 'SIGKILL' : 'SIGTERM'
        console.log(`[SHUTDOWN-DEBUG] Sending ${signal} to process: ${tracker.name} (PID: ${tracker.pid})`)
        
        const killed = tracker.process.kill(signal)
        if (!killed) {
          console.warn(`[SHUTDOWN-DEBUG] Failed to send ${signal} to process ${tracker.name}`)
        }

        // Wait for process to exit (up to 5 seconds)
        return new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(`[SHUTDOWN-DEBUG] Process ${tracker.name} did not exit after ${signal}`)
            resolve()
          }, 5000)

          tracker.process.on('exit', () => {
            clearTimeout(timeout)
            console.log(`[SHUTDOWN-DEBUG] Process ${tracker.name} exited`)
            resolve()
          })
        })
      } catch (error) {
        console.error(`[SHUTDOWN-DEBUG] Error terminating process ${tracker.name}:`, error)
      }
    })

    await Promise.all(terminationPromises)
    this.trackedProcesses.clear()
  }

  /**
   * Perform graceful shutdown with timeout
   */
  async gracefulShutdown(timeoutMs = 10000): Promise<void> {
    if (this.isShuttingDown) {
      // Return existing shutdown promise if already in progress
      return this.shutdownPromise || Promise.resolve()
    }

    this.isShuttingDown = true
    console.log(`[SHUTDOWN-DEBUG] Starting graceful shutdown (timeout: ${timeoutMs}ms)`)

    this.shutdownPromise = this.performShutdown(false, timeoutMs)
    return this.shutdownPromise
  }

  /**
   * Perform forced shutdown immediately
   */
  async forceShutdown(): Promise<void> {
    if (this.isShuttingDown && this.shutdownPromise) {
      // If graceful shutdown is in progress, wait for it or force it
      console.log(`[SHUTDOWN-DEBUG] Forcing shutdown while graceful shutdown in progress`)
    }

    this.isShuttingDown = true
    console.log(`[SHUTDOWN-DEBUG] Starting forced shutdown`)

    return this.performShutdown(true, 5000)
  }

  /**
   * Check if shutdown is in progress
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown
  }

  /**
   * Internal shutdown implementation
   */
  private async performShutdown(force: boolean, timeoutMs: number): Promise<void> {
    const startTime = Date.now()

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Shutdown timeout after ${timeoutMs}ms`))
        }, timeoutMs)
      })

      // Create cleanup promise
      const cleanupPromise = this.runCleanupSequence(force)

      // Race between cleanup and timeout
      await Promise.race([cleanupPromise, timeoutPromise])

      const elapsed = Date.now() - startTime
      console.log(`[SHUTDOWN-DEBUG] ✅ Shutdown completed successfully in ${elapsed}ms`)

    } catch (error) {
      const elapsed = Date.now() - startTime
      console.error(`[SHUTDOWN-DEBUG] ❌ Shutdown failed after ${elapsed}ms:`, error)

      if (!force) {
        console.log(`[SHUTDOWN-DEBUG] Attempting force shutdown after timeout`)
        await this.performShutdown(true, 5000)
      }
    }
  }

  /**
   * Run the cleanup sequence
   */
  private async runCleanupSequence(force: boolean): Promise<void> {
    try {
      // Step 1: Run registered cleanup tasks in priority order
      if (!force) {
        await this.runCleanupTasks()
      }

      // Step 2: Clear all timers and intervals
      this.clearAllTimers()

      // Step 3: Terminate all tracked processes
      await this.terminateProcesses(force)

      console.log(`[SHUTDOWN-DEBUG] All cleanup tasks completed`)

    } catch (error) {
      console.error(`[SHUTDOWN-DEBUG] Error during cleanup sequence:`, error)
      throw error
    }
  }

  /**
   * Run all registered cleanup tasks in priority order
   */
  private async runCleanupTasks(): Promise<void> {
    const tasks = Array.from(this.cleanupTasks.values())
      .sort((a, b) => a.priority - b.priority)

    console.log(`[SHUTDOWN-DEBUG] Running ${tasks.length} cleanup tasks`)

    for (const task of tasks) {
      try {
        console.log(`[SHUTDOWN-DEBUG] Running cleanup task: ${task.name}`)
        await task.cleanup()
        console.log(`[SHUTDOWN-DEBUG] ✅ Completed cleanup task: ${task.name}`)
      } catch (error) {
        console.error(`[SHUTDOWN-DEBUG] ❌ Error in cleanup task ${task.name}:`, error)
        // Continue with other cleanup tasks even if one fails
      }
    }
  }
}

// Global singleton instance
export const shutdownManager = new ShutdownManager()