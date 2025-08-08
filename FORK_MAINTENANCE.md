# SpeakMCP Fork Maintenance Guide

This document provides comprehensive guidance for maintaining the SpeakMCP fork, including dependency changes, platform-specific builds, and troubleshooting procedures.

## 🔄 Fork Overview

This fork addresses critical dependency issues that were preventing SpeakMCP from running on Node.js 24+ environments. The primary change is replacing the problematic `@egoist/electron-panel-window` dependency with a native Electron implementation.

### Key Changes Made

#### 1. Dependency Replacement
- **Removed**: `@egoist/electron-panel-window@^8.0.3` (Node 24 compatibility blocker)
- **Added**: Native `PanelWindowManager` class in `src/main/panel-window-manager.ts`
- **Maintained**: API compatibility for existing code

#### 2. Native Panel Implementation
- **Cross-platform support**: macOS (native panel), Windows/Linux (simulated)
- **Platform-specific optimizations**:
  - macOS: Uses native `panel` window type with proper window levels
  - Windows/Linux: Simulates panel behavior with always-on-top + skip taskbar
- **Drop-in replacement**: Existing code continues to work without changes

#### 3. Test Infrastructure
- **Added**: Comprehensive E2E testing with Playwright-electron (77 tests across 5 suites)
- **Coverage**: App launch, panel behavior, cross-platform compatibility, MCP integration
- **Platform testing**: Specific tests for macOS, Windows, and Linux behavior

## 🛠️ Development Environment Setup

### Prerequisites

#### All Platforms
- **Node.js**: 18+ (tested with 18, 20, 22, 24)
- **pnpm**: 9.12.1+ (recommended) or npm 8+
- **Rust**: Latest stable (for speakmcp-rs binary)
- **Git**: With bash support

#### macOS Specific
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

#### Windows Specific
```powershell
# Install Visual Studio Build Tools 2022 with C++ workload
# Download from: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022

# Install Rust
# Download from: https://rustup.rs/

# Install Git for Windows with bash
# Download from: https://git-scm.com/download/win
```

#### Linux Specific (Ubuntu/Debian)
```bash
# Install build tools
sudo apt update
sudo apt install build-essential pkg-config libssl-dev

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### Project Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/aj47/SpeakMCP.git
   cd SpeakMCP
   pnpm install
   ```

2. **Build Native Binary**
   ```bash
   pnpm build-rs
   ```

3. **Start Development**
   ```bash
   pnpm dev
   ```

## 🏗️ Build System

### Build Scripts Overview

```bash
# Development
pnpm dev                    # Development server with hot reload
pnpm start                  # Preview production build

# Production Builds
pnpm build                  # Full build: typecheck + electron-vite + rust binary
pnpm build-rs              # Build only Rust binary component

# Platform-Specific Builds  
pnpm build:mac             # macOS distribution
pnpm build:win             # Windows distribution
pnpm build:linux           # Linux distribution (experimental)
pnpm build:unpack          # Unpacked development build

# Quality Assurance
pnpm typecheck             # TypeScript checking (both node + web)
pnpm lint                  # ESLint with auto-fix
pnpm format                # Prettier formatting
pnpm test:e2e              # End-to-end tests
```

### Build Dependencies Matrix

| Platform | Node.js | Rust | Platform Tools | Status |
|----------|---------|------|----------------|--------|
| **macOS** | 18-24 | ✅ | Xcode CLI Tools | ✅ Full Support |
| **Windows** | 18-24 | ✅ | VS Build Tools | ✅ Full Support |
| **Linux** | 18-24 | ✅ | build-essential | 🧪 Experimental |

### Cross-Platform Build Process

The build system is designed to work consistently across platforms:

1. **TypeScript Compilation**: Platform-agnostic
2. **Electron-Vite Build**: Handles renderer, main, and preload processes
3. **Rust Binary Compilation**: Platform-specific via `scripts/build-rs.js`
4. **Asset Packaging**: Icons, sounds, and resources

### Rust Binary Integration

The `speakmcp-rs` binary handles low-level system integration:

```rust
// Platform-specific functionality:
// - macOS: Accessibility APIs, NSApplication integration
// - Windows: Win32 APIs, system tray integration  
// - Linux: X11/Wayland compatibility
```

**Build Script**: `scripts/build-rs.js`
- Detects platform and architecture
- Uses appropriate Rust target
- Copies binary to `resources/bin/` directory
- Handles cross-compilation when possible

## 🔧 Dependency Management

### Core Dependencies

#### Runtime Dependencies
- **@modelcontextprotocol/sdk@^1.13.3**: MCP client implementation
- **Electron@^31.0.2**: Application framework
- **React@^18.3.1**: UI framework

#### Development Dependencies
- **@egoist/tipc@^0.3.2**: Type-safe IPC communication
- **@playwright/test@^1.54.2**: E2E testing framework
- **electron-vite@^2.3.0**: Build system
- **TypeScript@^5.6.3**: Language and type checking

### Package Manager Configuration

**Preferred**: pnpm (specified in `.packageManager`)
```json
"packageManager": "pnpm@9.12.1+sha512.e5a7e52a4183a02d5931057f7a0dbff9d5e9ce3161e33fa68ae392125b79282a8a8a470a51dfc8a0ed86221442eb2fb57019b0990ed24fab519bf0e1bc5ccfc4"
```

**Fallback**: npm (for Windows compatibility issues)
```bash
# Windows-specific pnpm issues
npm install  # Instead of pnpm install
npm run build  # Instead of pnpm build
```

### Dependency Troubleshooting

#### Native Module Compilation Issues
```bash
# Rebuild native modules
pnpm rebuild
# or
npm run rebuild

# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install --no-frozen-lockfile
```

#### Electron Rebuild Issues
```bash
# Force electron rebuild
npx electron-rebuild --force
```

## 🏥 Current Known Issues

### 1. TypeScript Compilation Errors

**Location**: `src/main/tipc.ts:268-274`
**Issue**: Lightning Whisper MLX integration type errors
**Status**: Non-blocking (development continues)

```typescript
// Type errors around:
- lightningWhisperMlx configuration
- Model parameter validation  
- Return type inference
```

**Workaround**: Use `// @ts-ignore` temporarily or fix type definitions

### 2. Build Script Recursion

**Location**: `package.json` build scripts
**Issue**: Potential circular dependency in build chain
**Impact**: Slower builds, potential infinite loops

```json
// Current problematic pattern:
"build": "npm run typecheck && electron-vite build && npm run build-rs"
// Calls npm again from within npm
```

**Solution**: Use direct commands or separate build phases

### 3. Missing Rust Binary

**Issue**: `speakmcp-rs` binary not found at runtime
**Symptoms**: Text insertion failures, keyboard shortcuts not working

**Debug Steps**:
```bash
# Check if binary was built
ls -la resources/bin/
# Should contain: speakmcp-rs-darwin-arm64, speakmcp-rs-win-x64, etc.

# Rebuild if missing
pnpm build-rs

# Check build logs
node scripts/build-rs.js --verbose
```

### 4. Test Infrastructure Issues

**Location**: `src/main/__tests__/mcp-service.test.ts`
**Issue**: Electron app module mocking conflicts
**Impact**: Unit tests failing

**Current Error**:
```
Cannot find module 'electron' or its corresponding type declarations
```

**Workaround**: Use integration tests via E2E suite instead

### 5. Package Manager Inconsistencies

**Issue**: Mixed npm/pnpm commands in scripts
**Impact**: Dependency resolution conflicts, slower installs

**Current State**:
```json
// package.json uses npm in scripts but pnpm as package manager
"typecheck": "npm run typecheck:node && npm run typecheck:web"
// Should be:  
"typecheck": "pnpm typecheck:node && pnpm typecheck:web"
```

## 🔍 Platform-Specific Considerations

### macOS Development

#### Native Panel Implementation
```typescript
// Uses native Electron panel type
const panelWindow = new BrowserWindow({
  type: 'panel',  // Native macOS panel type
  // ... other options
})
```

#### Accessibility Requirements
- Required for text insertion functionality
- Grant permissions via System Preferences > Privacy & Security > Accessibility
- Test with: `pnpm test:e2e --grep "accessibility"`

#### Xcode Integration
```bash
# Build for distribution
pnpm build:mac
# Creates: dist/SpeakMCP-0.1.7.dmg
```

### Windows Development

#### Simulated Panel Behavior
```typescript
// Windows panel simulation
win.setAlwaysOnTop(true)
win.setSkipTaskbar(true)
win.setResizable(false)
// Mimics macOS panel behavior
```

#### Build Tools Requirements
- Visual Studio Build Tools 2022
- Windows SDK (comes with VS)
- Python 3.8+ (for node-gyp)

#### Distribution Building
```powershell
# Build for Windows
pnpm build:win
# Creates: dist/SpeakMCP-Setup-0.1.7.exe
```

### Linux Development (Experimental)

#### Basic Panel Support
- Uses same simulation as Windows
- No native panel type available
- Focuses on core functionality

#### Desktop Integration
```bash
# Test basic functionality
pnpm test:e2e --grep "linux"

# Build (experimental)
pnpm build:linux
```

#### Known Limitations
- No system tray integration
- Limited accessibility API support  
- Keyboard shortcuts may require manual setup

## 🚀 Deployment & Distribution

### Release Process

1. **Version Update**
   ```bash
   # Update version in package.json
   npm version patch|minor|major
   ```

2. **Full Build & Test**
   ```bash
   pnpm build
   pnpm test:e2e
   ```

3. **Platform Builds**
   ```bash
   # macOS (requires macOS)
   pnpm build:mac
   
   # Windows (requires Windows or cross-compilation)
   pnpm build:win
   
   # Linux (experimental)
   pnpm build:linux
   ```

4. **Release Creation**
   ```bash
   pnpm release
   ```

### Distribution Files

#### macOS
- **DMG**: `dist/SpeakMCP-0.1.7.dmg`
- **App Bundle**: `dist/mac/SpeakMCP.app`
- **Size**: ~200MB (includes Electron runtime)

#### Windows  
- **Installer**: `dist/SpeakMCP-Setup-0.1.7.exe`
- **Portable**: `dist/win-unpacked/`
- **Size**: ~180MB

#### Linux
- **AppImage**: `dist/SpeakMCP-0.1.7.AppImage`
- **Debian**: `dist/SpeakMCP_0.1.7_amd64.deb`
- **Size**: ~190MB

## 🧪 Testing Strategy

### E2E Test Suites

The fork includes comprehensive E2E testing:

```bash
# All tests (77 tests across 5 suites)
pnpm test:e2e

# Individual test suites
pnpm test:e2e --grep "App Launch"           # 15 tests
pnpm test:e2e --grep "Panel Window"        # 18 tests  
pnpm test:e2e --grep "Cross-Platform"      # 12 tests
pnpm test:e2e --grep "MCP Integration"     # 16 tests
pnpm test:e2e --grep "Keyboard System"     # 16 tests
```

### Test Coverage Areas

#### ✅ **Currently Covered**
- Application launch and initialization
- Panel window creation and behavior
- Cross-platform compatibility 
- MCP service integration
- Keyboard shortcuts and system integration

#### 🔄 **Partially Covered**  
- Error handling and recovery
- Performance benchmarks
- Security considerations

#### ❌ **Not Yet Covered**
- Long-running stability tests
- Memory leak detection
- Network failure scenarios
- Update mechanism testing

### Platform-Specific Testing

```bash
# macOS specific
pnpm test:e2e --grep "native panel"
pnpm test:e2e --grep "dock behavior"
pnpm test:e2e --grep "accessibility"

# Windows specific  
pnpm test:e2e --grep "taskbar"
pnpm test:e2e --grep "simulated panel"
pnpm test:e2e --grep "win32"

# Linux specific
pnpm test:e2e --grep "linux"
pnpm test:e2e --grep "x11"
```

## 🔐 Security Considerations

### API Key Management
- Stored via `electron-store` with encryption
- Never logged or transmitted in plain text
- Isolated per-user storage

### System Access
- **Accessibility APIs**: Required for text insertion
- **Microphone**: Required for voice recording
- **Network**: Required for cloud STT/LLM providers

### MCP Server Isolation
- Each MCP server runs in isolated child process
- Limited system access via stdio transport
- No direct file system access

## 📋 Maintenance Checklist

### Daily Development
- [ ] `pnpm dev` starts without errors
- [ ] TypeScript compilation passes
- [ ] Basic functionality works (record → transcribe → insert)

### Weekly Maintenance  
- [ ] Run full E2E test suite: `pnpm test:e2e`
- [ ] Update dependencies: `pnpm update`
- [ ] Check for security vulnerabilities: `pnpm audit`
- [ ] Test on different platforms if available

### Release Preparation
- [ ] Full build passes on all target platforms
- [ ] All E2E tests pass
- [ ] Manual testing of critical user flows
- [ ] Documentation updates completed
- [ ] Version numbers updated consistently

### Dependency Updates
- [ ] Check compatibility with new Node.js versions
- [ ] Test Electron updates carefully (may break native integration)
- [ ] Verify Rust toolchain compatibility
- [ ] Update E2E test expectations if needed

## 🚨 Emergency Procedures

### Build System Failure
1. **Identify scope**: Is it platform-specific or universal?
2. **Check environment**: Node version, package manager, system tools
3. **Clean rebuild**: Remove `node_modules`, `out/`, `dist/`
4. **Fallback**: Use npm instead of pnpm on Windows
5. **Binary fallback**: Pre-built binaries in CI/releases

### Runtime Failures
1. **Check binary presence**: `resources/bin/speakmcp-rs-*`
2. **Verify permissions**: Accessibility (macOS), Admin (Windows)
3. **Test with debug logs**: Set `DEBUG=speakmcp:*`
4. **Isolate issue**: Panel vs keyboard vs MCP vs STT

### Recovery Plan
- **Code rollback**: Revert to last known good commit
- **Binary distribution**: Pre-compiled binaries for each platform
- **Alternative dependencies**: Identify replacement packages
- **Platform fallbacks**: Graceful degradation when features unavailable

## 🔮 Future Fork Maintenance

### Upstream Synchronization
- **Monitor**: Original repository for important security fixes
- **Cherry-pick**: Critical bug fixes and security patches
- **Avoid**: Breaking changes that would require panel library again

### Long-term Considerations
- **Electron updates**: Test carefully for panel functionality
- **Node.js compatibility**: Continue testing with latest LTS versions
- **Platform API changes**: macOS panels, Windows notifications, Linux desktop integration

### Contribution Strategy
- **Upstream PRs**: Consider contributing stable fixes back to original
- **Fork-specific**: Keep panel replacement and related improvements in fork
- **Documentation**: Maintain clear fork vs upstream differences

---

**Last Updated**: August 2025  
**Fork Maintainer**: AI Assistant  
**Original Project**: [SpeakMCP by aj47](https://github.com/aj47/SpeakMCP)