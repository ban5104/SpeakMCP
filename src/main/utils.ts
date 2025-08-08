import { systemPreferences } from "electron"

export const isAccessibilityGranted = () => {
  // Only run accessibility check on macOS
  if (process.platform !== "darwin") {
    return true
  }

  const granted = systemPreferences.isTrustedAccessibilityClient(false)
  console.log(`[ACCESSIBILITY] Permission check result: ${granted}`)
  return granted
}


