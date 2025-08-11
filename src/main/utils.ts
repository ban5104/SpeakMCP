import { systemPreferences } from "electron"

// Configuration constants - moved from magic numbers
const PERMISSION_CONFIG = {
  DEV_CACHE_DURATION: 30000, // 30 seconds cache for development
  DEV_RETRY_ATTEMPTS: 3,
  DEV_RETRY_DELAY: 1000, // 1 second between retries
  LOG_PREFIX: '[PERMISSION-DEBUG]'
} as const

// Cache for development mode to track permission state across quick restarts
let devPermissionCache: { granted: boolean; lastCheck: number } | null = null

/**
 * Determines if the current process is running in development mode
 */
const isDevelopment = (): boolean => {
  return import.meta.env?.DEV === true || process.env.NODE_ENV === 'development'
}

/**
 * Safely detects if running in an unsigned development process
 * Uses modern alternatives to deprecated process.mainModule
 */
const isUnsignedDevelopmentProcess = (): boolean => {
  if (!isDevelopment()) {
    return false
  }

  try {
    // Use safer path detection without exposing full system paths in logs
    const execPath = process.execPath?.toLowerCase() || ''
    const argv0 = process.argv0?.toLowerCase() || ''
    
    // Check for common development process indicators
    const isDev = execPath.includes('electron') || 
                 execPath.includes('node_modules') ||
                 argv0.includes('electron')
    
    return isDev
  } catch (error) {
    // Don't expose error details that might contain system information
    console.warn(`${PERMISSION_CONFIG.LOG_PREFIX} Could not detect process type`)
    return false
  }
}

/**
 * Development-specific permission checking with retry logic
 * Separated from main logic for better testing and security
 */
const checkAccessibilityWithRetry = async (retries: number = PERMISSION_CONFIG.DEV_RETRY_ATTEMPTS): Promise<boolean> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = systemPreferences.isTrustedAccessibilityClient(false)
      
      if (isDevelopment()) {
        console.log(`${PERMISSION_CONFIG.LOG_PREFIX} Attempt ${attempt + 1}/${retries}: ${result ? 'granted' : 'denied'}`)
        
        // In development, if we get false, wait and try again
        // This helps with timing issues and unsigned process identity problems
        if (!result && attempt < retries - 1) {
          console.log(`${PERMISSION_CONFIG.LOG_PREFIX} Retrying in ${PERMISSION_CONFIG.DEV_RETRY_DELAY}ms...`)
          await new Promise(resolve => setTimeout(resolve, PERMISSION_CONFIG.DEV_RETRY_DELAY))
          continue
        }
      }
      
      return result
    } catch (error) {
      // Sanitized error logging - don't expose system details
      console.error(`${PERMISSION_CONFIG.LOG_PREFIX} Permission check failed (attempt ${attempt + 1}):`, 
        error instanceof Error ? error.message : 'Unknown error')
      
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, PERMISSION_CONFIG.DEV_RETRY_DELAY))
      }
    }
  }
  
  return false
}

/**
 * Development-specific fallback permission checking
 * SECURITY: Removed config-based permission bypass vulnerability
 */
const checkDevPermissionFallback = (): boolean => {
  if (!isDevelopment()) {
    return false
  }

  try {
    // Try a secondary permission check - still uses system API only
    // SECURITY: Only rely on system API, never config-based assumptions
    const result = systemPreferences.isTrustedAccessibilityClient(false)
    
    if (result) {
      console.log(`${PERMISSION_CONFIG.LOG_PREFIX} Fallback check successful - permissions granted`)
      return true
    }

    // SECURITY: Removed the config-based permission bypass logic
    // API keys DO NOT imply accessibility permissions - this was a security vulnerability
    
  } catch (error) {
    // Sanitized error logging
    console.error(`${PERMISSION_CONFIG.LOG_PREFIX} Fallback permission check failed:`, 
      error instanceof Error ? error.message : 'Unknown error')
  }
  
  return false
}

/**
 * Main permission checking function - backwards compatible
 * Returns boolean for production, Promise<boolean> for development mode
 */
export function isAccessibilityGranted(): boolean
export function isAccessibilityGranted(): Promise<boolean>
export function isAccessibilityGranted(): boolean | Promise<boolean> {
  // Only run accessibility check on macOS
  if (process.platform !== "darwin") {
    return true
  }

  try {
    // Production mode - use direct system check (synchronous)
    if (!isDevelopment()) {
      return systemPreferences.isTrustedAccessibilityClient(false)
    }

    // Development mode - use enhanced checking (asynchronous)
    return checkDevelopmentPermissions()
  } catch (error) {
    // Standardized error handling
    console.error(`${PERMISSION_CONFIG.LOG_PREFIX} Permission check error:`, 
      error instanceof Error ? error.message : 'Unknown error')
    
    // Fallback to synchronous check
    return systemPreferences.isTrustedAccessibilityClient(false)
  }
}

/**
 * Async version that always returns a Promise (for explicit async usage)
 */
export const isAccessibilityGrantedAsync = async (): Promise<boolean> => {
  const result = isAccessibilityGranted()
  return result instanceof Promise ? await result : result
}

/**
 * Development-specific permission checking logic
 * Extracted for better separation of concerns and testability
 */
const checkDevelopmentPermissions = async (): Promise<boolean> => {
  const now = Date.now()
  
  console.log(`${PERMISSION_CONFIG.LOG_PREFIX} Development mode detected, using enhanced permission checking`)
  
  // Check if we have recent cached result
  if (devPermissionCache && (now - devPermissionCache.lastCheck) < PERMISSION_CONFIG.DEV_CACHE_DURATION) {
    console.log(`${PERMISSION_CONFIG.LOG_PREFIX} Using cached result: ${devPermissionCache.granted ? 'granted' : 'denied'}`)
    return devPermissionCache.granted
  }

  console.log(`${PERMISSION_CONFIG.LOG_PREFIX} Performing fresh permission check with retries...`)
  
  // Try the standard check first with retries
  let hasPermissions = await checkAccessibilityWithRetry()
  
  // If standard check fails in development, try fallback methods
  if (!hasPermissions && isUnsignedDevelopmentProcess()) {
    console.log(`${PERMISSION_CONFIG.LOG_PREFIX} Standard check failed for unsigned process, trying fallback...`)
    hasPermissions = checkDevPermissionFallback()
  }

  // Cache the result for development
  devPermissionCache = {
    granted: hasPermissions,
    lastCheck: now
  }
  
  console.log(`${PERMISSION_CONFIG.LOG_PREFIX} Final result: ${hasPermissions ? 'granted' : 'denied'}`)
  return hasPermissions
}

/**
 * Synchronous version for backwards compatibility and immediate checks
 * Simplified logic with standardized error handling
 */
export const isAccessibilityGrantedSync = (): boolean => {
  // Only run accessibility check on macOS
  if (process.platform !== "darwin") {
    return true
  }

  try {
    // In development mode, check cache first
    if (isDevelopment() && devPermissionCache) {
      const now = Date.now()
      if ((now - devPermissionCache.lastCheck) < PERMISSION_CONFIG.DEV_CACHE_DURATION) {
        console.log(`${PERMISSION_CONFIG.LOG_PREFIX} Using cached sync result: ${devPermissionCache.granted ? 'granted' : 'denied'}`)
        return devPermissionCache.granted
      }
    }

    const result = systemPreferences.isTrustedAccessibilityClient(false)
    
    // Update cache in development
    if (isDevelopment()) {
      devPermissionCache = {
        granted: result,
        lastCheck: Date.now()
      }
      console.log(`${PERMISSION_CONFIG.LOG_PREFIX} Sync check result: ${result ? 'granted' : 'denied'}`)
    }
    
    return result
  } catch (error) {
    // Standardized error handling
    console.error(`${PERMISSION_CONFIG.LOG_PREFIX} Sync permission check error:`, 
      error instanceof Error ? error.message : 'Unknown error')
    
    // Safe fallback
    return false
  }
}

/**
 * Force refresh permission cache (useful for development)
 * Simplified with better logging
 */
export const refreshPermissionCache = (): void => {
  if (isDevelopment()) {
    console.log(`${PERMISSION_CONFIG.LOG_PREFIX} Force refreshing permission cache`)
    devPermissionCache = null
  }
}


