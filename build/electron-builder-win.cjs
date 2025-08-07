// @ts-check

/**
 * Windows-specific electron-builder configuration
 * Extends the base configuration with Windows-specific settings
 * @type {Partial<import('electron-builder').Configuration>}
 */
module.exports = {
  win: {
    executableName: "speakmcp",
    // Windows-specific binary path (with .exe extension)
    binaries: ["resources/bin/speakmcp-rs.exe"],
    
    // Windows build targets
    target: [
      {
        target: "nsis",
        arch: ["x64", "ia32"]
      },
      {
        target: "portable", 
        arch: ["x64"]
      }
    ],
    
    // Windows-specific optimizations
    requestedExecutionLevel: "asInvoker",
    
    // Icon and signing
    icon: "build/icon.png",
    publisherName: "SpeakMCP Team",
  },
  
  nsis: {
    artifactName: "${name}-${version}-setup.${ext}",
    shortcutName: "${productName}",
    uninstallDisplayName: "${productName}",
    createDesktopShortcut: "always",
    createStartMenuShortcut: true,
    
    // NSIS installer optimizations
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    
    // Installer appearance
    installerIcon: "build/icon.png",
    uninstallerIcon: "build/icon.png",
    
    // Registry and file associations
    perMachine: false,
    allowElevation: true,
    
    // Modern installer UI
    installerHeaderIcon: "build/icon.png",
    deleteAppDataOnUninstall: true,
  },
  
  portable: {
    artifactName: "${productName}-${version}-portable.${ext}",
  }
};