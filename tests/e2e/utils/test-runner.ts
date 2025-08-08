import { spawn, ChildProcess } from 'child_process'
import { ElectronTestApp } from './electron-app'

/**
 * Test runner utilities for E2E tests
 */
export class TestRunner {
  private static buildProcess: ChildProcess | null = null
  private static isBuilt = false

  /**
   * Ensure the Electron app is built before running tests
   */
  static async ensureAppBuilt(): Promise<void> {
    if (this.isBuilt) return

    console.log('Building Electron app for E2E tests...')
    
    return new Promise((resolve, reject) => {
      const buildProcess = spawn('npm', ['run', 'build'], {
        stdio: 'pipe',
        shell: true
      })

      let output = ''
      let errorOutput = ''

      buildProcess.stdout?.on('data', (data) => {
        output += data.toString()
        process.stdout.write(data)
      })

      buildProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString()
        process.stderr.write(data)
      })

      buildProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Electron app built successfully')
          this.isBuilt = true
          resolve()
        } else {
          console.error('❌ Failed to build Electron app')
          console.error('Error output:', errorOutput)
          reject(new Error(`Build failed with code ${code}`))
        }
      })

      buildProcess.on('error', (error) => {
        console.error('❌ Build process error:', error)
        reject(error)
      })
    })
  }

  /**
   * Run specific test suite
   */
  static async runTestSuite(suiteName: string): Promise<void> {
    await this.ensureAppBuilt()
    
    return new Promise((resolve, reject) => {
      const testProcess = spawn('npx', ['playwright', 'test', `--grep`, suiteName], {
        stdio: 'inherit',
        shell: true
      })

      testProcess.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Tests failed with code ${code}`))
        }
      })

      testProcess.on('error', reject)
    })
  }

  /**
   * Run all E2E tests
   */
  static async runAllTests(): Promise<void> {
    await this.ensureAppBuilt()
    
    return new Promise((resolve, reject) => {
      const testProcess = spawn('npx', ['playwright', 'test'], {
        stdio: 'inherit',
        shell: true
      })

      testProcess.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Tests failed with code ${code}`))
        }
      })

      testProcess.on('error', reject)
    })
  }

  /**
   * Generate test report
   */
  static async generateReport(): Promise<void> {
    return new Promise((resolve, reject) => {
      const reportProcess = spawn('npx', ['playwright', 'show-report'], {
        stdio: 'inherit',
        shell: true
      })

      reportProcess.on('close', resolve)
      reportProcess.on('error', reject)
    })
  }

  /**
   * Clean up test artifacts
   */
  static async cleanup(): Promise<void> {
    // Clean up any test artifacts
    const { rm } = await import('fs/promises')
    
    try {
      await rm('test-results', { recursive: true, force: true })
      console.log('✅ Cleaned up test artifacts')
    } catch (error) {
      // Ignore cleanup errors
      console.log('ℹ️ No test artifacts to clean up')
    }
  }

  /**
   * Setup test environment
   */
  static async setupTestEnvironment(): Promise<void> {
    // Set environment variables for testing
    process.env.NODE_ENV = 'test'
    process.env.ELECTRON_IS_DEV = '0'
    process.env.DISABLE_AUTO_UPDATER = '1'
    
    console.log('✅ Test environment configured')
  }

  /**
   * Validate test prerequisites
   */
  static async validatePrerequisites(): Promise<void> {
    const electronApp = new ElectronTestApp()
    const platform = electronApp.getPlatformInfo()
    
    console.log(`🔍 Running tests on ${platform.platform}`)
    
    // Check if required dependencies are available
    try {
      await import('playwright')
      console.log('✅ Playwright available')
    } catch {
      throw new Error('Playwright not installed. Run: npm install playwright')
    }

    try {
      await import('playwright-electron')
      console.log('✅ Playwright-electron available')
    } catch {
      throw new Error('Playwright-electron not installed. Run: npm install playwright-electron')
    }

    // Platform-specific checks
    if (platform.isMac) {
      console.log('ℹ️ macOS detected - accessibility permissions may be required')
    } else if (platform.isWindows) {
      console.log('ℹ️ Windows detected - testing Windows-specific features')
    } else if (platform.isLinux) {
      console.log('ℹ️ Linux detected - testing basic functionality')
    }
  }

  /**
   * Run tests with full setup
   */
  static async runWithSetup(): Promise<void> {
    try {
      console.log('🚀 Starting E2E test suite...')
      
      await this.validatePrerequisites()
      await this.setupTestEnvironment()
      await this.cleanup() // Clean up before running
      await this.runAllTests()
      
      console.log('🎉 All tests completed successfully!')
      
    } catch (error) {
      console.error('❌ Test suite failed:', error)
      throw error
    }
  }
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  TestRunner.runWithSetup().catch(() => process.exit(1))
}