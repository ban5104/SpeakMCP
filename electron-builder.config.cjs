// @ts-check

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: "app.speakmcp",
  productName: "SpeakMCP",
  directories: {
    buildResources: "build",
  },
  files: [
    "out/**/*",
    "!**/.vscode/*",
    "!src/*",
    "!scripts/*",
    "!electron.vite.config.{js,ts,mjs,cjs}",
    "!{.eslintignore,.eslintrc.cjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}",
    "!{.env,.env.*,.npmrc,pnpm-lock.yaml}",
    "!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}",
    "!*.{js,cjs,mjs,ts}",
    "!components.json",
    "!.prettierrc",
    '!speakmcp-rs/*'
  ],
  extraResources: [
    "resources/**/*"
  ],
  // Unpack modules that have ESM resolution issues in ASAR
  // This is a comprehensive list including the full dependency chain of problematic modules
  asarUnpack: [
    // Core MCP SDK modules
    "**/node_modules/@modelcontextprotocol/**",
    
    // AJV and its ecosystem (used by MCP SDK for validation)
    "**/node_modules/ajv/**",
    "**/node_modules/ajv-keywords/**",
    "**/node_modules/ajv-formats/**",
    "**/node_modules/json-schema-traverse/**",
    "**/node_modules/require-from-string/**",
    "**/node_modules/fast-deep-equal/**",
    "**/node_modules/json-schema-ref-parser/**",
    
    // cross-spawn and its complete dependency chain
    "**/node_modules/cross-spawn/**",
    "**/node_modules/path-key/**",
    "**/node_modules/shebang-command/**",
    "**/node_modules/shebang-regex/**",
    "**/node_modules/which/**",
    "**/node_modules/isexe/**",
    
    // Additional ESM modules that may cause issues
    "**/node_modules/content-type/**",
    "**/node_modules/cors/**",
    "**/node_modules/eventsource/**",
    "**/node_modules/eventsource-parser/**",
    "**/node_modules/express/**",
    "**/node_modules/express-rate-limit/**",
    "**/node_modules/pkce-challenge/**",
    "**/node_modules/raw-body/**",
    
    // Zod and related modules
    "**/node_modules/zod/**",
    "**/node_modules/zod-to-json-schema/**",
    
    // Node.js utility modules that may have ESM issues
    "**/node_modules/semver/**",
    "**/node_modules/uuid/**",
    "**/node_modules/chalk/**",
    "**/node_modules/debug/**",
    "**/node_modules/ms/**",
    
    // TypeScript and compilation related (if dynamically loaded)
    "**/node_modules/typescript/**",
    "**/node_modules/ts-node/**",
    
    // Any modules with native bindings or complex resolution
    "**/node_modules/**/*.node",
    "**/node_modules/**/binding.gyp",
    "**/node_modules/**/prebuilds/**",
    
    // Development dependencies that might be loaded dynamically
    "**/node_modules/vitest/**",
    "**/node_modules/playwright/**",
    
    // Fallback patterns for any missed ESM modules
    "**/node_modules/**/{package.json,*.mjs,*.mts}",
    "**/node_modules/**/{exports,main,module,types}/**"
  ],
  win: {
    executableName: "speakmcp",
  },
  nsis: {
    artifactName: "${name}-${version}-setup.${ext}",
    shortcutName: "${productName}",
    uninstallDisplayName: "${productName}",
    createDesktopShortcut: "always",
  },
  mac: {
    binaries: ["resources/bin/speakmcp-rs"],
    artifactName: "${productName}-${version}-${arch}.${ext}",
    entitlementsInherit: "build/entitlements.mac.plist",
    identity: process.env.CSC_NAME || null,  // Use ad-hoc signing when no certificate is available
    extendInfo: [
      {
        NSCameraUsageDescription:
          "Application requests access to the device's camera.",
      },
      {
        NSMicrophoneUsageDescription:
          "Application requests access to the device's microphone.",
      },
      {
        NSDocumentsFolderUsageDescription:
          "Application requests access to the user's Documents folder.",
      },
      {
        NSDownloadsFolderUsageDescription:
          "Application requests access to the user's Downloads folder.",
      },
    ],
    notarize: process.env.APPLE_TEAM_ID
      ? {
          teamId: process.env.APPLE_TEAM_ID,
        }
      : undefined,
  },
  dmg: {
    artifactName: "${productName}-${version}-${arch}.${ext}",
  },
  linux: {
    target: ["AppImage", "snap", "deb"],
    maintainer: "electronjs.org",
    category: "Utility",
  },
  appImage: {
    artifactName: "${name}-${version}.${ext}",
  },
  npmRebuild: true,
  publish: {
    provider: "github",
    owner: "aj47",
    repo: "SpeakMCP",
  },
  removePackageScripts: true,
}
