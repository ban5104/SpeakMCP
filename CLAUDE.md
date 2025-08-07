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
- `pnpm lint` - Run ESLint and auto-fix issues
- `pnpm format` - Format code with Prettier
- `vitest` - Run tests (configured with jsdom environment)
- `vitest --coverage` - Run tests with coverage report

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

### Known Dependency Issues
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

## Build Dependencies

**Native Dependencies:**
- Rust toolchain for `speakmcp-rs` binary
- Node.js 18+ and pnpm package manager
- Platform-specific build tools (Xcode on macOS, Visual Studio Build Tools on Windows)

**Key NPM Scripts Interdependencies:**
- `build` command runs `typecheck` → `electron-vite build` → `build-rs`
- `build-rs` compiles Rust binary and copies to `resources/bin/`
- Platform builds (`build:mac`, `build:win`) use `electron-builder` with specific configurations