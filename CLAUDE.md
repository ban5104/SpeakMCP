# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Package Management & Dependencies
- `pnpm install` - Install all dependencies
- `pnpm run fix-pnpm-windows` - Fix pnpm Windows compatibility issues (Windows only)
- `pnpm run rebuild` - Rebuild native Electron dependencies

### Development & Build
- `pnpm dev` - Start development server with hot reload
- `pnpm start` - Preview production build locally
- `pnpm build` - Full production build (includes typecheck + electron-vite build + Rust binary)
- `pnpm run build-rs` - Build only the Rust binary component
- `pnpm typecheck` - Run TypeScript type checking for both node and web targets
- `pnpm typecheck:node` - Type check main/preload processes only
- `pnpm typecheck:web` - Type check renderer process only

### Code Quality & Testing
- `pnpm lint` - Run ESLint and auto-fix issues (flat config with TypeScript & React support)
- `pnpm format` - Format code with Prettier
- `vitest` - Run tests (configured with jsdom environment)
- `vitest --coverage` - Run tests with coverage report

**ESLint Configuration**: Modern flat config (`eslint.config.js`) with:
- TypeScript support via `@typescript-eslint`
- React and React Hooks rules
- Lenient settings for development workflow
- Proper ignore patterns for build artifacts and Rust code

### Platform-Specific Builds
- `pnpm build:mac` - Build macOS distribution
- `pnpm build:win` - Build Windows distribution  
- `pnpm build:linux` - Build Linux distribution
- `pnpm build:unpack` - Build unpacked development version
- `pnpm release` - Create and publish release

## Architecture Overview

SpeakMCP is an AI-powered dictation tool built with Electron that integrates with Model Context Protocol (MCP) servers. The app allows voice-to-text transcription with intelligent post-processing and tool integration.

### Core Architecture Components

**Multi-Process Electron App:**
- **Main Process** (`src/main/`): System integration, keyboard events, API communication
- **Renderer Process** (`src/renderer/`): React-based UI for settings and recording interface  
- **Preload Scripts** (`src/preload/`): Secure IPC bridge between main and renderer
- **Rust Binary** (`speakmcp-rs/`): Low-level keyboard monitoring and text injection

**Key Services:**
- **MCP Service** (`src/main/mcp-service.ts`): Manages Model Context Protocol server connections and tool execution
- **LLM Service** (`src/main/llm.ts`): Handles post-processing of transcripts with various AI providers
- **Keyboard Service** (`src/main/keyboard.ts`): Global hotkey handling and text insertion
- **TIPC Router** (`src/main/tipc.ts`): Type-safe IPC communication layer

### Speech-to-Text Flow
1. User holds Ctrl key → keyboard service detects hotkey
2. Audio recording starts → saves to WebM format
3. Audio sent to STT provider (OpenAI Whisper, Groq, or Lightning Whisper MLX)
4. Optional post-processing via LLM providers (OpenAI, Groq, Gemini)
5. For MCP mode: transcript processed with available MCP tools
6. Final text inserted into active application via accessibility APIs

### MCP Integration Details
- **Client Implementation**: Uses `@modelcontextprotocol/sdk` for server communication
- **Server Management**: Dynamic loading/unloading of MCP servers via stdio transport
- **Tool Discovery**: Automatic discovery and registration of tools from connected servers
- **Fallback Tools**: Built-in tools (file operations, notifications) when no MCP servers configured
- **Tool Execution**: Supports both server tools and local fallback tools

### Configuration Management
- **Main Config**: Stored via `electron-store` in `src/main/config.ts`
- **MCP Config**: Separate JSON configuration for MCP servers
- **Provider Settings**: API keys, base URLs, model selections for STT/LLM providers

## Key Files & Directories

### Source Structure
- `src/main/index.ts` - Application entry point and window management
- `src/main/tipc.ts` - Main IPC router with all API endpoints
- `src/main/mcp-service.ts` - MCP server management and tool execution
- `src/main/keyboard.ts` - Global keyboard event handling
- `src/renderer/src/App.tsx` - Main React application component
- `src/shared/types.ts` - Shared TypeScript interfaces

### Configuration Files
- `electron-vite.config.ts` - Electron + Vite build configuration
- `electron-builder.config.cjs` - App packaging and distribution settings
- `vitest.config.ts` - Test runner configuration with jsdom setup
- `components.json` - Shadcn/ui component configuration

### Rust Component
- `speakmcp-rs/src/main.rs` - System-level keyboard and accessibility integration
- `scripts/build-rs.js` - Cross-platform Rust build script

## Recent Updates (August 2025)

### Major Fixes & Improvements
1. **Accessibility Permission System Overhaul**:
   - Fixed stale permission caching preventing proper detection after app restart
   - Implemented dynamic permission polling with automatic UI transitions
   - Improved app restart flow with proper cleanup and error handling
   - **Result**: Seamless permission flow without manual restarts

2. **Keyboard Monitoring System Fix**:
   - Fixed Rust binary path resolution in packaged applications
   - Added comprehensive debugging and error handling
   - **Result**: Voice recording via Ctrl key now works reliably

3. **Node.js Version Compatibility**:
   - Updated from Node.js 18.20.0 to support 24.x
   - Maintained backward compatibility with 18.20.0+
   - **Result**: Supports modern Node.js versions

4. **Development Infrastructure**:
   - Added modern ESLint flat configuration
   - Enhanced debugging capabilities across the application
   - Improved error messaging and diagnostics

### Current Status
- ✅ macOS accessibility permissions work seamlessly
- ✅ Voice recording functionality fully operational
- ✅ App restart issues resolved
- ✅ Modern toolchain compatibility (Node.js 24.x, ESLint 9.x)
- ✅ Comprehensive debugging and error handling

## Development Notes

### Platform Support & Architecture
- **Shared Codebase**: ~80% of code is platform-agnostic (Electron main/renderer, React UI, MCP integration)
- **Platform-Specific Components**:
  - Rust binary (`speakmcp-rs/`) - handles keyboard/accessibility APIs differently per platform
  - Build configurations and native dependencies
  - System integration modules
- **macOS**: Full support with accessibility API integration
- **Windows**: Full support with Win32 APIs  
- **Linux**: Experimental support

### Fork Maintenance Considerations
**Pros for maintaining fork**:
- Most application logic is shared across platforms
- Platform differences isolated to Rust binary and build configs
- Modern architecture with good separation of concerns
- Bug fixes and features benefit all platforms simultaneously

**Challenges**:
- Need Rust toolchain for both Windows and macOS
- Different native build environments (Xcode vs Visual Studio Build Tools)
- Testing required on both platforms
- Dependency compatibility across Electron versions

### Known Issues & Solutions

#### macOS Accessibility Permissions (RESOLVED)
**Previous Problem**: App showed "Enable in System Settings" even after granting accessibility permissions, and failed to restart properly after permission changes.

**Root Causes Identified & Fixed**:
1. **Stale Permission Caching**: Main process cached permission status at startup and never refreshed it
2. **Poor Restart Flow**: App restart had race conditions and improper window cleanup
3. **Missing Dynamic Detection**: Setup window didn't poll for permission changes
4. **Code Signing**: macOS requires proper signing for accessibility APIs

**Solutions Implemented**:
1. **Dynamic Permission Checking** (`src/main/index.ts`):
   - Removed cached `accessibilityGranted` variable
   - Permission status now checked fresh each time
   - App activation event properly checks permissions

2. **Improved Restart Flow** (`src/main/tipc.ts`):
   - Added proper window cleanup with delays
   - Fixed race conditions in restart sequence
   - Better error handling during restart

3. **Auto-Permission Detection** (`src/renderer/src/pages/setup.tsx`):
   - Added React Query polling every 2 seconds
   - Automatic switch to main window when permissions granted
   - No restart required after granting permissions

4. **Proper Code Signing**:
   ```bash
   pnpm build:unpack
   codesign --force --deep --sign - dist/mac-arm64/speakmcp.app
   ```

**Current Behavior**: App automatically detects permission changes without restart and seamlessly transitions from setup to main window.

#### Keyboard Monitoring & Rust Binary Issues (RESOLVED)
**Previous Problem**: Voice recording not working - Ctrl key detection failed due to keyboard monitoring process not starting.

**Root Cause**: Rust binary path resolution failed in packaged apps because binary was located in `app.asar.unpacked/resources/bin/` instead of expected `process.resourcesPath/resources/bin/`.

**Solution Implemented** (`src/main/keyboard.ts`):
- **Smart Path Resolution**: Added `getPackagedBinaryPath()` function that checks multiple locations:
  1. `process.resourcesPath/resources/bin/speakmcp-rs` (electron-builder extraResources)
  2. `process.resourcesPath/app.asar.unpacked/resources/bin/speakmcp-rs` (electron-vite + electron-builder)
  3. `__dirname/../../resources/bin/speakmcp-rs` (development)
- **Comprehensive Debugging**: Added debug logging for path resolution and process spawning
- **Proper Error Handling**: Better error messages and process monitoring

**Current Behavior**: Keyboard monitoring starts automatically when accessibility permissions are granted, enabling voice recording via Ctrl key shortcuts.

#### Node.js Version Compatibility (RESOLVED)
**Previous Problem**: Build failures due to Node.js version mismatch (18.20.0 vs 24.5.0).

**Solution**: Updated version constraints in multiple files:
- `package.json`: `"engines": { "node": ">=18.20.0" }` (removed upper limit)
- `.nvmrc`: Updated from `18.20.0` to `24.5.0`
- `.node-version`: Updated from `18.20.0` to `24.5.0`

#### Dependency Issues
- `@egoist/electron-panel-window@^8.0.3` - Critical dependency for panel window functionality
- Consider alternatives if installation issues persist:
  - `@akiflow/electron-panel-window` (more recently maintained)
  - Custom panel implementation using native Electron APIs
- Use `pnpm install --ignore-scripts` as temporary workaround for native build issues

### Testing Strategy
- Unit tests with Vitest + jsdom for React components
- Integration tests for MCP service functionality  
- E2E tests for recording workflow
- Platform-specific tests for keyboard/accessibility features

### Security Considerations
- API keys stored securely via electron-store
- MCP servers run in isolated processes
- Accessibility permissions required for text insertion
- No sensitive data logged or transmitted

### MCP Development
- Test MCP servers using `scripts/mock-mcp-server.mjs`
- MCP config validation in `src/main/__tests__/mcp-config-validation.test.ts`
- Server connection testing and debugging via debug logs prefixed with `[MCP-DEBUG]`

### Resource Packaging & Build Issues

#### Resource Inclusion Fix (Resolved)
The build process had an issue where the Rust binary and resource files weren't being included in the final Electron app package. This was resolved by:

**Root Cause**: `extraResources` configuration in `electron-builder.config.cjs` wasn't properly copying the `resources/` folder to the built app.

**Solution**: Added post-build scripts that automatically copy resources after electron-builder runs:
- `copy-resources-mac`: `cp -r resources dist/mac*/speakmcp.app/Contents/Resources/`
- `copy-resources-win`: `xcopy /E /I /Y resources dist\\win-unpacked\\resources`
- `copy-resources-linux`: `cp -r resources dist/linux*/resources/`

**Key Files Modified**:
- `package.json` - Added resource copy scripts to build commands
- `src/main/tray.ts` - Updated icon paths to use `process.resourcesPath` when packaged
- `src/main/keyboard.ts` - Binary path already correctly configured

#### Build Verification Checklist
Before considering a build ready for deployment:
1. ✅ Run `pnpm build:unpack` without manual file copying
2. ✅ Verify binary exists: `ls dist/mac*/speakmcp.app/Contents/Resources/resources/bin/speakmcp-rs`
3. ✅ Verify icons exist: `ls dist/mac*/speakmcp.app/Contents/Resources/resources/*.png`
4. ✅ Launch app: `open dist/mac*/speakmcp.app`
5. ✅ Confirm app processes running: `ps aux | grep speakmcp | grep -v grep`
6. ✅ Test tray icon loads without "Failed to load image" errors
7. ✅ Verify keyboard monitoring starts (check for Rust binary spawn)

#### Resource Path Patterns
- **Development**: `resources/bin/speakmcp-rs` (relative to project root)
- **Packaged**: `process.resourcesPath/resources/bin/speakmcp-rs`
- **Icons**: Same pattern for all `.png` and `.ico` files in `resources/`

## Build Dependencies

**Native Dependencies:**
- Rust toolchain for `speakmcp-rs` binary
- Node.js 18+ and pnpm package manager
- Platform-specific build tools (Xcode on macOS, Visual Studio Build Tools on Windows)

**Key NPM Scripts Interdependencies:**
- `build` command runs `typecheck` → `electron-vite build` → `build-rs`
- `build-rs` compiles Rust binary and copies to `resources/bin/`
- Platform builds (`build:mac`, `build:win`) use `electron-builder` with specific configurations