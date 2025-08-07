// @ts-check

/**
 * macOS-specific electron-builder configuration
 * Extends the base configuration with macOS-specific settings
 * @type {Partial<import('electron-builder').Configuration>}
 */
module.exports = {
  mac: {
    // Fixed: Use build-time platform detection instead of runtime
    binaries: ["resources/bin/speakmcp-rs"],
    artifactName: "${productName}-${version}-${arch}.${ext}",
    entitlementsInherit: "build/entitlements.mac.plist",
    identity: process.env.CSC_NAME || "Apple Development",
    
    // macOS permissions - required for app functionality
    extendInfo: {
      NSCameraUsageDescription: "Application requests access to the device's camera.",
      NSMicrophoneUsageDescription: "Application requests access to the device's microphone.",
      NSDocumentsFolderUsageDescription: "Application requests access to the user's Documents folder.",
      NSDownloadsFolderUsageDescription: "Application requests access to the user's Downloads folder.",
    },
    
    // Code signing and notarization
    notarize: process.env.APPLE_TEAM_ID
      ? {
          teamId: process.env.APPLE_TEAM_ID,
        }
      : undefined,
      
    // macOS-specific build optimizations
    target: [
      {
        target: "dmg",
        arch: ["x64", "arm64"]
      }
    ],
    
    // Additional macOS settings for better app behavior
    hardenedRuntime: true,
    gatekeeperAssess: false,
  },
  
  dmg: {
    artifactName: "${productName}-${version}-${arch}.${ext}",
    // DMG appearance optimizations
    background: null,
    iconSize: 80,
    window: {
      width: 540,
      height: 380
    },
    contents: [
      {
        x: 130,
        y: 220
      },
      {
        x: 410,
        y: 220,
        type: "link",
        path: "/Applications"
      }
    ]
  }
};