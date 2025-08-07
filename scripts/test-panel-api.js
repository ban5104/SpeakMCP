#!/usr/bin/env node

/**
 * Test script to verify Electron's native panel window support
 * This tests if we can use BrowserWindow with type: 'panel' directly
 * without the @egoist/electron-panel-window dependency
 */

const { app, BrowserWindow } = require('electron')

app.whenReady().then(() => {
  console.log('Testing Electron native panel window support...')
  console.log('Platform:', process.platform)
  console.log('Electron version:', process.versions.electron)
  console.log('Node version:', process.versions.node)
  
  try {
    // Test creating a panel window
    const panelWindow = new BrowserWindow({
      width: 260,
      height: 50,
      type: 'panel', // macOS only
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false
    })
    
    console.log('✅ Panel window created successfully')
    console.log('Panel window type:', panelWindow.getType ? panelWindow.getType() : 'method not available')
    
    // Test window level settings (similar to makeKeyWindow behavior)
    if (process.platform === 'darwin') {
      panelWindow.setAlwaysOnTop(true, 'floating')
      console.log('✅ Set window level to floating')
      
      // Test visibility without focus
      panelWindow.showInactive()
      console.log('✅ Window shown without activating')
    }
    
    // Clean up
    setTimeout(() => {
      panelWindow.destroy()
      app.quit()
    }, 2000)
    
  } catch (error) {
    console.error('❌ Error creating panel window:', error)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  app.quit()
})