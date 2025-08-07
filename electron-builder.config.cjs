// @ts-check

const baseConfig = require('./build/electron-builder-base.cjs');
const macConfig = require('./build/electron-builder-mac.cjs');
const winConfig = require('./build/electron-builder-win.cjs');
const linuxConfig = require('./build/electron-builder-linux.cjs');

/**
 * Main electron-builder configuration
 * Merges base configuration with platform-specific settings
 * @type {import('electron-builder').Configuration}
 */
function createConfig() {
  // Deep merge function to properly combine configurations
  function deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  // Start with base config and merge platform-specific configs
  let config = { ...baseConfig };
  
  // Merge platform-specific configurations
  config = deepMerge(config, macConfig);
  config = deepMerge(config, winConfig);
  config = deepMerge(config, linuxConfig);
  
  return config;
}

module.exports = createConfig();
