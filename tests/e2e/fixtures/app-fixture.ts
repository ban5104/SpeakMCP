import { test as base, expect } from '@playwright/test'
import { ElectronTestApp, ElectronAppContext } from '../utils/electron-app'

export interface AppFixtures {
  electronApp: ElectronTestApp
  appContext: ElectronAppContext
}

export const test = base.extend<AppFixtures>({
  electronApp: async ({}, use) => {
    const electronApp = new ElectronTestApp()
    await use(electronApp)
    await electronApp.close()
  },

  appContext: async ({ electronApp }, use) => {
    const context = await electronApp.launch()
    
    // Wait for app to be fully ready
    await electronApp.isReady()
    
    await use(context)
  },
})

export { expect } from '@playwright/test'