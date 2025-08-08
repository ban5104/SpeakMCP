# SpeakMCP (Fork)

🎤 **AI-powered dictation tool with MCP integration** - Transform your voice into text with advanced speech recognition, intelligent post-processing, and Model Context Protocol (MCP) tool integration.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](./LICENSE)
[![Electron](https://img.shields.io/badge/Electron-31.0.2-47848f.svg)](https://electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3.1-61dafb.svg)](https://reactjs.org/)
[![Node.js Support](https://img.shields.io/badge/Node.js-18--24-green.svg)](https://nodejs.org/)

## 🔄 Fork Status

This is a **stabilized fork** of the original SpeakMCP project with critical dependency fixes:

- ✅ **Node.js 24+ Compatibility**: Removed problematic `@egoist/electron-panel-window` dependency
- ✅ **Native Panel Implementation**: Cross-platform panel window manager with platform-specific optimizations
- ✅ **Comprehensive Testing**: 77 E2E tests across 5 test suites ensuring stability
- ✅ **Build System Improvements**: Enhanced cross-platform build process
- 📚 **Documentation**: Complete fork maintenance and troubleshooting guides

**Key Changes:**
- Replaced `@egoist/electron-panel-window` with native `PanelWindowManager`
- Added platform-specific panel behavior (native macOS panels, simulated Windows/Linux)
- Maintained full API compatibility with existing code
- Enhanced build scripts for better cross-platform support

## 🚀 Quick Start

### Download

Currently building for **macOS (Apple Silicon)** and **Windows x64**.

**[📥 Download Latest Release](https://github.com/aj47/SpeakMCP/releases/latest)**

### Usage

1. **Hold `Ctrl`** key to start recording your voice
2. **Release `Ctrl`** to stop recording and transcribe
3. Text is automatically inserted into your active application
4. Configure providers and settings in the app preferences

## 🎬 Preview

https://github.com/user-attachments/assets/2344a817-f36c-42b0-9ebc-cdd6e926b7a0

## ✨ Features

### 🎯 Core Functionality
- **Voice-to-Text**: Hold `Ctrl` key to record, release to transcribe
- **Universal Integration**: Works with any application that supports text input
- **Local Storage**: All data stored securely on your machine
- **Real-time Feedback**: Visual audio waveform during recording
- **Smart Shortcuts**: Configurable keyboard shortcuts (`Ctrl+Hold` or `Ctrl+/`)

### 🤖 AI-Powered Transcription
- **Multiple Providers**: OpenAI Whisper and Groq
- **Cloud APIs**: OpenAI and Groq for high-accuracy transcription
- **Custom Endpoints**: Support for self-hosted APIs
- **Fallback System**: Automatic fallback between providers

### 🧠 Intelligent Post-Processing
- **LLM Enhancement**: Improve transcripts with OpenAI, Groq, or Gemini
- **Custom Prompts**: Configurable post-processing instructions
- **Grammar Correction**: Fix punctuation, capitalization, and formatting
- **Context Awareness**: Maintain conversation context and terminology

### 🔧 Advanced Configuration
- **Provider Selection**: Choose between multiple STT and LLM providers
- **Model Customization**: Select specific models for each provider
- **Performance Tuning**: Batch size and quantization options for local models
- **API Management**: Secure storage of API keys and custom base URLs

## 🏗️ Architecture

SpeakMCP is built with a modern, multi-process architecture designed for performance and reliability:

### System Overview
```
┌─────────────────┐    ┌──────────────────┐
│   Electron      │    │   Rust Binary    │
│   Main Process  │◄──►│   speakmcp-rs    │
│                 │    │   (Keyboard &    │
│   PanelWindow   │    │   Text Input)    │
│   Manager ⭐    │    │                  │
└─────────────────┘    └──────────────────┘
         │
         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React UI      │    │   External APIs  │    │   System APIs   │
│   (Renderer)    │    │   OpenAI, Groq   │    │   Accessibility │
│                 │    │   Gemini         │    │   Microphone    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌──────────────────┐
│   MCP Service   │    │   E2E Test       │
│   Integration   │    │   Framework      │
└─────────────────┘    └──────────────────┘
```

### Key Components

- **Main Process**: Handles system integration, keyboard events, and API communication
- **PanelWindowManager** ⭐: Native cross-platform panel window implementation (fork enhancement)
- **Renderer Process**: React-based UI for settings and recording interface
- **Rust Binary**: Low-level keyboard monitoring and text injection
- **MCP Integration**: Model Context Protocol server management and tool execution
- **TIPC Communication**: Type-safe IPC between Electron processes

### Fork Enhancements ⭐

This fork includes several architectural improvements:

- **Native Panel System**: Replaced external dependency with platform-optimized native implementation
- **Cross-Platform Compatibility**: Unified behavior across macOS (native panels), Windows/Linux (simulated)
- **Enhanced Testing**: Comprehensive E2E test suite with platform-specific test coverage
- **Improved Build System**: Better cross-platform build process with enhanced error handling

## 🛠️ Development

### Prerequisites

- **Node.js** 18+ with **pnpm** package manager
- **Rust** toolchain for building the native binary
- **Xcode Command Line Tools** (macOS) or **Visual Studio Build Tools** (Windows)

#### Windows-Specific Requirements

- **Visual Studio 2022 Build Tools** or **Visual Studio Community** with C++ build tools
- **Python 3.8+** (for node-gyp native compilation)
- **Git** with bash support (Git for Windows recommended)

### Setup

> **Fork Installation**: This fork includes dependency fixes for Node.js 18-24 compatibility.

1. **Clone the repository**
   ```bash
   git clone https://github.com/aj47/SpeakMCP.git
   cd SpeakMCP
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```
   
   > **Windows users**: If you encounter pnpm .cjs execution errors, use `npm install` instead. This is a known issue with the Windows environment. See [Troubleshooting Guide](TROUBLESHOOTING.md) for complete Windows setup instructions.

3. **Build Rust binary**
   ```bash
   pnpm build-rs
   ```
   
   > **Note**: The Rust binary handles low-level keyboard monitoring and text injection. If this fails, check the [Fork Maintenance Guide](FORK_MAINTENANCE.md) for platform-specific build requirements.

4. **Start development server**
   ```bash
   pnpm dev
   ```

### Quick Verification

After setup, verify the fork is working correctly:

```bash
# Check that panel window manager is available
ls -la src/main/panel-window-manager.ts

# Verify Rust binary was built
ls -la resources/bin/speakmcp-rs*

# Run basic functionality test
pnpm test:e2e --grep "App Launch"
```

### Build Commands

```bash
# Development
pnpm dev                    # Start development server
pnpm build                  # Build for production

# Platform-specific builds
pnpm build:mac             # Build for macOS
pnpm build:win             # Build for Windows
pnpm build:linux           # Build for Linux

# Testing
pnpm typecheck             # Type checking
pnpm lint                  # ESLint
```

### Project Structure

```
SpeakMCP/
├── src/
│   ├── main/              # Electron main process
│   │   ├── tipc.ts        # IPC router and API handlers
│   │   ├── keyboard.ts    # Keyboard event handling
│   │   └── llm.ts         # LLM post-processing
│   ├── renderer/src/      # React UI
│   │   ├── pages/         # Application pages
│   │   ├── components/    # Reusable components
│   │   └── lib/           # Utilities and services
│   ├── preload/           # Electron preload scripts
│   └── shared/            # Shared types and constants
├── speakmcp-rs/           # Rust binary for system integration
├── resources/             # Static resources and Python scripts
└── docs/                  # Documentation
```

## ⚙️ Configuration

### Speech-to-Text Providers

| Provider | Platform | Speed | Quality | Privacy | Cost |
|----------|----------|-------|---------|---------|------|
| **OpenAI Whisper** | All | 🐌 Moderate | 🎯 High | ☁️ Cloud | 💰 Paid |
| **Groq** | All | ⚡ Fast | 🎯 High | ☁️ Cloud | 💰 Paid |

### LLM Post-Processing

Configure intelligent transcript enhancement:

```typescript
// Example post-processing prompt
"Fix grammar, punctuation, and capitalization in this transcript: {transcript}"
```

**Supported LLM Providers:**
- **OpenAI**: GPT-4o, GPT-4o-mini, GPT-3.5-turbo
- **Groq**: Gemma2-9b-it, Llama-3.1-70b, Mixtral-8x7b
- **Google Gemini**: Gemini-1.5-flash, Gemini-1.5-pro

### Keyboard Shortcuts

- **Hold Ctrl**: Press and hold to record, release to transcribe
- **Ctrl + /**: Press once to start, press again to stop
- **Escape**: Cancel current recording



## 🔧 API Configuration

### OpenAI Setup

1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Add to Whispo settings under "Providers" → "OpenAI"
3. Optional: Configure custom base URL for self-hosted endpoints

### Groq Setup

1. Get API key from [Groq Console](https://console.groq.com/keys)
2. Add to Whispo settings under "Providers" → "Groq"
3. Configure STT prompt for better accuracy (optional)

### Google Gemini Setup

1. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add to SpeakMCP settings under "Providers" → "Gemini"
3. Select appropriate model for post-processing

## 🚨 Troubleshooting

> **Fork-Specific**: This fork includes enhanced troubleshooting documentation and diagnostic tools. For complete troubleshooting, see the [Troubleshooting Guide](TROUBLESHOOTING.md).

### Quick Diagnostic

If you encounter issues, run this diagnostic first:

```bash
# Check Node.js version compatibility (should be 18-24)
node --version

# Verify fork-specific files are present
ls -la src/main/panel-window-manager.ts  # Native panel implementation
ls -la resources/bin/speakmcp-rs*        # Rust binary

# Test basic app launch
pnpm test:e2e --grep "App Launch" --timeout=30000
```

### Fork-Specific Issues

**🔄 Panel Window Issues**
- **Native panels (macOS)**: Uses Electron's native `panel` window type
- **Simulated panels (Windows/Linux)**: Uses always-on-top + skip taskbar
- **Debug**: Check logs for `[PanelWindowManager]` messages

**📦 Dependency Issues**
- **Node 24+ compatibility**: This fork removes the problematic `@egoist/electron-panel-window`
- **Build failures**: Use `npm install` instead of `pnpm install` on Windows if needed
- **Missing binary**: Run `pnpm build-rs` to rebuild the Rust component

### Common Issues

**🎤 Microphone not working**
- Grant microphone permissions in system settings
- Check microphone access in SpeakMCP settings
- Restart application after granting permissions

**⌨️ Text not inserting**
- Enable accessibility permissions (macOS)
- Run as administrator (Windows)
- Check target application supports text input

**🪟 Windows-Specific Issues**

*Package manager errors:*
- Use `npm install` instead of `pnpm install` for better Windows compatibility
- Run `pnpm run fix-pnpm-windows` if using pnpm
- Ensure Git for Windows is installed with bash support

*Native dependency compilation errors:*
- Install Visual Studio Build Tools with C++ workload
- Ensure Python 3.8+ is installed and in PATH
- Try using npm instead of pnpm for native rebuilds: `npm run rebuild`

*Rust binary build failures:*
- Install Rust from [rustup.rs](https://rustup.rs/)
- Ensure Git bash is properly installed
- Use the cross-platform build script: `pnpm build-rs`

**🌐 API errors**
- Verify API keys are correct
- Check internet connection for cloud providers
- Validate custom base URLs if configured

### Getting Help

For detailed troubleshooting steps, platform-specific issues, and recovery procedures:

- **[📋 Troubleshooting Guide](TROUBLESHOOTING.md)**: Comprehensive issue resolution
- **[🔧 Fork Maintenance Guide](FORK_MAINTENANCE.md)**: Development and build setup
- **[🧪 E2E Testing](tests/e2e/README.md)**: Test-driven debugging

### Performance Optimization

**For Cloud APIs:**
- Use Groq for fastest cloud transcription
- Configure custom prompts for better accuracy
- Enable post-processing for grammar correction

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit with conventional commits: `git commit -m "feat: add amazing feature"`
5. Push to your fork: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Areas for Contribution

- 🐛 Bug fixes and stability improvements
- ✨ New features and enhancements
- 📚 Documentation improvements
- 🧪 Test coverage expansion
- 🌍 Internationalization support
- 🎨 UI/UX improvements

## 📄 License

This project is licensed under the [AGPL-3.0 License](./LICENSE).

## 🙏 Acknowledgments

- [OpenAI](https://openai.com/) for Whisper speech recognition
- [Electron](https://electronjs.org/) for cross-platform desktop framework
- [React](https://reactjs.org/) for the user interface
- [Rust](https://rust-lang.org/) for system-level integration
- Original [SpeakMCP project](https://github.com/aj47/SpeakMCP) by aj47

## 📚 Fork Documentation

This fork includes comprehensive documentation for maintaining and developing the stabilized version:

### 📖 **Documentation Links**
- **[🔧 Fork Maintenance Guide](FORK_MAINTENANCE.md)**: Complete setup, build process, and maintenance procedures
- **[🚨 Troubleshooting Guide](TROUBLESHOOTING.md)**: Comprehensive issue resolution and debugging
- **[🧪 E2E Testing](tests/e2e/README.md)**: Test framework documentation and platform-specific testing
- **[📋 Project Instructions](CLAUDE.md)**: Development commands and architecture overview

### 🔄 **Fork Status Summary**

| Aspect | Status | Notes |
|--------|--------|-------|
| **Node.js 24+ Support** | ✅ Complete | Removed blocking dependency |
| **Panel Implementation** | ✅ Native | Cross-platform PanelWindowManager |
| **Build System** | ✅ Enhanced | Better cross-platform support |
| **Testing Coverage** | ✅ Comprehensive | 77 E2E tests across 5 suites |
| **Documentation** | ✅ Complete | Fork-specific guides included |
| **TypeScript Issues** | 🔄 Partial | Some Lightning Whisper MLX type issues remain |
| **Package Manager** | ⚠️ Mixed | Windows users may need npm fallback |

### 🚀 **Getting Started with the Fork**

```bash
# Quick setup verification
node --version  # Should be 18-24
git clone https://github.com/aj47/SpeakMCP.git
cd SpeakMCP
pnpm install || npm install  # Fallback for Windows
pnpm build-rs
pnpm test:e2e --grep "App Launch"  # Verify fork works
```

---

**Made with ❤️ by the original SpeakMCP team and fork contributors**  
**Fork maintained with focus on stability and Node.js compatibility**
