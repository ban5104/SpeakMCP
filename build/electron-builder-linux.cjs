// @ts-check

/**
 * Linux-specific electron-builder configuration
 * Extends the base configuration with Linux-specific settings
 * @type {Partial<import('electron-builder').Configuration>}
 */
module.exports = {
  linux: {
    target: [
      {
        target: "AppImage",
        arch: ["x64"]
      },
      {
        target: "snap",
        arch: ["x64"]
      },
      {
        target: "deb", 
        arch: ["x64"]
      }
    ],
    
    // Fixed: Proper maintainer information instead of generic electronjs.org
    maintainer: "SpeakMCP Team <support@speakmcp.dev>",
    category: "Utility",
    
    // Linux-specific binary path
    binaries: ["resources/bin/speakmcp-rs"],
    
    // Desktop integration
    desktop: {
      Name: "SpeakMCP",
      Comment: "AI-powered voice interface for MCP tools",
      Categories: "Utility;AudioVideo;",
      Keywords: "voice;ai;mcp;automation;",
    },
    
    // Linux-specific optimizations
    synopsis: "AI-powered voice interface for MCP tools",
    description: "SpeakMCP provides a voice-controlled interface to interact with MCP (Model Context Protocol) tools using AI.",
  },
  
  appImage: {
    artifactName: "${name}-${version}.${ext}",
    // AppImage-specific settings
    license: "LICENSE",
    category: "Utility",
  },
  
  snap: {
    // Snap package settings
    summary: "AI-powered voice interface for MCP tools",
    description: "SpeakMCP provides a voice-controlled interface to interact with MCP (Model Context Protocol) tools using AI.",
    category: "utilities",
    
    // Snap permissions/plugs
    plugs: [
      "default",
      "audio-record",
      "audio-playback",
      "camera",
      "desktop",
      "desktop-legacy",
      "home",
      "network",
      "removable-media",
      "unity7"
    ],
    
    // Build settings
    buildPackages: ["libnss3-dev", "libatk-bridge2.0-dev", "libdrm2-dev"],
  },
  
  deb: {
    // Debian package settings
    priority: "optional",
    depends: ["gconf2", "gconf-service", "libnotify4", "libappindicator1", "libxtst6", "libnss3"],
    
    // Package metadata
    packageCategory: "utils",
    synopsis: "AI-powered voice interface for MCP tools",
  }
};