import { defineConfig } from '@playwright/test'
import * as path from 'path'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false, // Electron apps should run in sequence
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Only one worker for Electron tests
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    process.env.CI ? ['github'] : ['list']
  ],
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'electron-main',
      testMatch: /.*\.e2e\.spec\.ts$/,
      use: {
        // Custom options for Electron testing
      }
    }
  ],
  outputDir: 'test-results/',
})