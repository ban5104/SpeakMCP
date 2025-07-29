# Windows Setup Guide

This guide provides detailed instructions for setting up SpeakMCP on Windows systems.

## Prerequisites

### Required Software

1. **Node.js 18+**
   - Download from [nodejs.org](https://nodejs.org/)
   - Choose the LTS version
   - Ensure npm is included in the installation

2. **pnpm Package Manager**
   ```cmd
   npm install -g pnpm
   ```

3. **Rust Toolchain**
   - Download and install from [rustup.rs](https://rustup.rs/)
   - This will install Rust, Cargo, and rustc
   - Restart your terminal after installation

4. **Visual Studio Build Tools**
   - Download [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
   - Or install Visual Studio Community
   - **Important**: Select "C++ build tools" workload during installation

5. **Python 3.8+**
   - Download from [python.org](https://python.org/downloads/)
   - **Important**: Check "Add Python to PATH" during installation
   - Required for node-gyp native compilation

6. **Git for Windows**
   - Download from [git-scm.com](https://git-scm.com/download/win)
   - **Important**: Choose "Use Git and optional Unix tools from the Command Prompt"
   - This ensures bash commands work properly

## Installation Steps

### 1. Clone the Repository
```cmd
git clone https://github.com/aj47/SpeakMCP.git
cd SpeakMCP
```

### 2. Install Dependencies
```cmd
pnpm install
```

**If you encounter pnpm .cjs execution errors:**
```cmd
npm install
```

### 3. Build Rust Binary
```cmd
pnpm build-rs
```

This will:
- Create the `resources/bin` directory
- Build the Rust binary in release mode
- Copy `speakmcp-rs.exe` to the correct location

### 4. Start Development Server
```cmd
pnpm dev
```

## Common Issues and Solutions

### Native Dependency Compilation Errors

**Error**: `gyp ERR! configure error`
**Solution**: 
- Install Visual Studio Build Tools with C++ workload
- Ensure Python is in your PATH
- Try rebuilding: `npm run rebuild`

**Error**: `cannot execute pnpm.cjs`
**Solution**:
- Use npm instead: `npm install` and `npm run dev`
- The electron-builder config is set to use npm for native rebuilds

### Rust Build Issues

**Error**: `cargo: command not found`
**Solution**:
- Install Rust from rustup.rs
- Restart your terminal
- Verify with: `cargo --version`

**Error**: `sh: command not found`
**Solution**:
- The build script now uses Node.js instead of bash
- Ensure you're using: `pnpm build-rs` (not the old bash script)

### Shell/Path Issues

**Error**: `/usr/bin/bash: Files\Git\bin\bash.exe: No such file or directory`
**Solution**:
- Install Git for Windows properly
- Add Git to your PATH: `C:\Program Files\Git\bin`
- Use PowerShell or Command Prompt as alternative

## Build Commands

```cmd
# Development
pnpm dev                    # Start development server
pnpm build                  # Build for production

# Rust binary
pnpm build-rs               # Build Rust binary (cross-platform)

# Windows-specific build
pnpm build:win              # Build Electron app for Windows

# Utilities
pnpm typecheck              # TypeScript checking
pnpm lint                   # Code linting
pnpm rebuild                # Rebuild native dependencies
```

## Environment Variables

If you encounter persistent issues, you may need to set these environment variables:

```cmd
# For npm/node-gyp
set npm_config_msvs_version=2022
set npm_config_node_gyp=C:\Users\%USERNAME%\AppData\npm-global\lib\node_modules\npm\node_modules\node-gyp\bin\node-gyp.js

# For Python (if multiple versions installed)
set PYTHON=C:\Python39\python.exe
```

## Architecture Notes

On Windows, SpeakMCP uses:
- **Electron** for the main application
- **Rust binary** (`speakmcp-rs.exe`) for keyboard monitoring and text injection
- **Windows APIs** for accessibility and input simulation
- **npm** for native dependency compilation (configured in electron-builder)

## Support

If you continue to have issues:

1. Check that all prerequisites are properly installed
2. Verify your PATH includes all required tools
3. Try the alternative npm commands instead of pnpm
4. Open an issue on GitHub with your error details and system information

## System Requirements

- **Windows 10** or later (64-bit)
- **8GB RAM** minimum (16GB recommended)
- **2GB free disk space**
- **Internet connection** (for cloud AI providers)
- **Microphone** (for voice input)