// @ts-check

/**
 * Base electron-builder configuration shared across all platforms
 * Contains common settings that apply to all builds
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: "app.speakmcp",
  productName: "SpeakMCP",
  directories: {
    buildResources: "build",
  },
  
  // Optimized file exclusions - only exclude what's necessary
  files: [
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
    "!speakmcp-rs/*",
    "!docs/*",
    "!test/*",
    "!**/__tests__/*",
    "!*.test.*",
    "!*.spec.*"
  ],
  
  // Optimized asarUnpack - only include specific necessary files instead of entire node_modules
  asarUnpack: [
    "resources/**",
    "node_modules/**/node_modules/**", // Only nested node_modules if needed
    "node_modules/**/*.node", // Native modules
    "node_modules/**/*.dll", // Windows native libraries
    "node_modules/**/*.dylib", // macOS native libraries  
    "node_modules/**/*.so" // Linux native libraries
  ],
  
  // Build optimizations
  compression: "maximum",
  
  // Use pnpm instead of npm
  npmRebuild: "pnpm",
  
  // Publishing configuration
  publish: {
    provider: "github",
    owner: "aj47",
    repo: "SpeakMCP",
  },
  
  // Common build settings
  removePackageScripts: true,
  
  // Artifact name template used across platforms
  artifactNameTemplate: "${productName}-${version}-${arch}.${ext}",
};