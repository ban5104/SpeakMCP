# SpeakMCP Troubleshooting Guide

This guide covers common issues and solutions for the SpeakMCP fork, including build failures, runtime errors, and platform-specific problems.

## 🚨 Quick Diagnostic Checklist

Before diving into specific issues, run this quick diagnostic:

```bash
# Check Node.js version (should be 18-24)
node --version

# Check if built successfully
ls -la out/main/index.js
ls -la resources/bin/

# Check dependencies
pnpm list --depth=0

# Test basic functionality
pnpm dev
```

## 🏗️ Build Issues

### Issue: `pnpm install` Fails on Windows

**Symptoms:**
```
Error: Cannot read properties of undefined (reading 'isFile')
Command failed with exit code 1
```

**Root Cause:** pnpm Windows compatibility issues with .cjs execution

**Solutions:**

1. **Use npm instead** (Recommended for Windows):
   ```powershell
   npm install
   npm run build
   ```

2. **Fix pnpm Windows compatibility**:
   ```powershell
   pnpm run fix-pnpm-windows
   pnpm install
   ```

3. **Use pnpm with --ignore-scripts**:
   ```powershell
   pnpm install --ignore-scripts
   pnpm run postinstall
   ```

### Issue: Rust Binary Build Fails

**Symptoms:**
```
Error: Failed to build speakmcp-rs binary
cargo: command not found
```

**Root Cause:** Missing Rust toolchain or incorrect PATH

**Solutions:**

1. **Install Rust** (all platforms):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source ~/.cargo/env
   ```

2. **Windows-specific Rust setup**:
   ```powershell
   # Download and run: https://rustup.rs/
   # Ensure Visual Studio Build Tools are installed
   rustup toolchain install stable-x86_64-pc-windows-msvc
   ```

3. **Verify Rust installation**:
   ```bash
   rustc --version
   cargo --version
   ```

4. **Force rebuild**:
   ```bash
   rm -rf resources/bin/
   pnpm build-rs
   ```

### Issue: TypeScript Compilation Errors

**Symptoms:**
```
src/main/tipc.ts(268,5): error TS2322: Type 'X' is not assignable to type 'Y'
```

**Current Known Issues:**
- Lightning Whisper MLX integration (lines 268-274 in tipc.ts)
- Type inference issues with MCP tool definitions

**Workarounds:**

1. **Skip type checking temporarily**:
   ```bash
   # Build without type checking
   electron-vite build --skip-type-check
   pnpm build-rs
   ```

2. **Fix specific type errors**:
   ```typescript
   // Add explicit type assertions
   const result = await lightningWhisperMlx.transcribe(audio) as TranscriptResult;
   
   // Or use ts-ignore for known issues
   // @ts-ignore - Known type issue with Lightning Whisper MLX
   const model = config.lightningWhisperMlx;
   ```

3. **Update type definitions**:
   ```bash
   pnpm add -D @types/node@latest
   pnpm typecheck
   ```

### Issue: Build Script Recursion

**Symptoms:**
```
npm ERR! Maximum call stack size exceeded
npm ERR! This is likely caused by npm trying to call a lifecycle script
```

**Root Cause:** Circular dependency in package.json scripts

**Solution:**
```bash
# Use direct commands instead of npm run
pnpm typecheck:node && pnpm typecheck:web
electron-vite build
node scripts/build-rs.js
```

### Issue: Native Module Compilation Fails

**Symptoms:**
```
gyp: name 'node_engine' is not defined while evaluating condition
```

**Platform-Specific Solutions:**

#### macOS:
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Rebuild native modules
pnpm rebuild
```

#### Windows:
```powershell
# Install Visual Studio Build Tools
# Download: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022

# Set environment variables
npm config set msvs_version 2022
npm config set python python3

# Rebuild
npm run rebuild
```

#### Linux:
```bash
# Install build essentials
sudo apt update
sudo apt install build-essential python3-dev

# Rebuild
pnpm rebuild
```

## 🖥️ Runtime Issues

### Issue: Application Won't Start

**Symptoms:**
- App launches but immediately closes
- No window appears
- Electron process exits with code 1

**Debugging Steps:**

1. **Check for missing binary**:
   ```bash
   ls -la resources/bin/speakmcp-rs*
   ```

2. **Run with debug output**:
   ```bash
   DEBUG=speakmcp:* pnpm dev
   ```

3. **Check Electron logs**:
   ```bash
   # macOS
   ~/Library/Logs/SpeakMCP/main.log
   
   # Windows  
   %APPDATA%\SpeakMCP\logs\main.log
   
   # Linux
   ~/.config/SpeakMCP/logs/main.log
   ```

4. **Test minimal launch**:
   ```bash
   npx electron out/main/index.js
   ```

### Issue: Panel Window Not Appearing

**Symptoms:**
- Recording works but no visual feedback
- Panel window missing on screen
- Always-on-top behavior not working

**Debugging:**

1. **Check panel window creation**:
   ```javascript
   // In main process console
   console.log('Panel window created:', panelWindow.getBounds())
   ```

2. **Verify platform-specific behavior**:
   ```bash
   # macOS: Check if native panel type is working
   # Should show 'panel' type in Activity Monitor
   
   # Windows: Check if window is hidden behind other windows
   # Alt+Tab should show SpeakMCP panel
   ```

3. **Test panel manager directly**:
   ```bash
   node scripts/test-panel-api.js
   ```

**Solutions:**

1. **Reset panel position**:
   ```javascript
   // Reset panel to center screen
   panelWindow.center()
   panelWindow.show()
   ```

2. **Force panel behavior**:
   ```javascript
   // macOS
   panelWindow.setAlwaysOnTop(true, 'floating')
   
   // Windows/Linux
   panelWindow.setAlwaysOnTop(true)
   panelWindow.focus()
   ```

### Issue: Keyboard Shortcuts Not Working

**Symptoms:**
- Ctrl key press not detected
- No recording starts
- Global shortcuts don't respond

**Common Causes:**

1. **Missing accessibility permissions** (macOS)
2. **Rust binary not running** (all platforms)
3. **Conflicting shortcuts** (all platforms)

**Solutions:**

#### macOS Accessibility Fix:
```bash
# Check current permissions
sqlite3 ~/Library/Application\ Support/com.apple.TCC/TCC.db \
  "SELECT service, client, auth_value FROM access WHERE service = 'kTCCServiceAccessibility';"

# Manual: System Preferences > Privacy & Security > Accessibility
# Add SpeakMCP or Terminal/IDE if running in development
```

#### Windows Admin Rights:
```powershell
# Run as Administrator or adjust UAC settings
# Right-click SpeakMCP.exe > Run as administrator
```

#### Debug Keyboard System:
```bash
# Test keyboard detection
DEBUG=keyboard:* pnpm dev

# Check if Rust binary is running
ps aux | grep speakmcp-rs  # macOS/Linux
tasklist | findstr speakmcp-rs  # Windows
```

### Issue: Text Insertion Fails

**Symptoms:**
- Recording and transcription work
- No text appears in target application
- Text appears in wrong application

**Debugging:**

1. **Verify text output**:
   ```javascript
   // Check what text is being generated
   console.log('Inserting text:', transcribedText)
   ```

2. **Test with simple application**:
   - Try TextEdit (macOS), Notepad (Windows), gedit (Linux)
   - Verify text insertion works with basic apps

3. **Check accessibility API**:
   ```bash
   # macOS: Test accessibility
   osascript -e 'tell application "System Events" to keystroke "test"'
   
   # Windows: Check if SendInput API works
   # This is handled by the Rust binary
   ```

**Solutions:**

1. **Focus target application**:
   - Click in text field before recording
   - Ensure cursor is visible and active

2. **Adjust timing**:
   ```javascript
   // Add delay before text insertion
   setTimeout(() => insertText(text), 500)
   ```

3. **Test with clipboard fallback**:
   ```javascript
   // Fallback to clipboard if direct insertion fails
   clipboard.writeText(transcribedText)
   // User can manually paste with Ctrl+V
   ```

## 🎤 Audio & STT Issues

### Issue: Microphone Not Accessible

**Symptoms:**
```
NotAllowedError: Permission denied
MediaDeviceNotFoundError: No audio input devices found
```

**Solutions:**

#### macOS:
```bash
# System Preferences > Privacy & Security > Microphone
# Add SpeakMCP or Terminal/IDE for development
```

#### Windows:
```powershell
# Settings > Privacy > Microphone
# Enable "Allow apps to access your microphone"
# Enable for SpeakMCP specifically
```

#### Linux:
```bash
# Check audio devices
arecord -l
pactl list sources short

# Test microphone
arecord -d 5 -f cd test.wav
```

### Issue: STT Provider Failures

**Symptoms:**
- Recording works but no transcription
- API errors in console
- Empty transcript returned

**Common Issues:**

1. **API Key Problems**:
   ```bash
   # Check API key is set
   DEBUG=stt:* pnpm dev
   
   # Test API key manually
   curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.openai.com/v1/models
   ```

2. **Audio Format Issues**:
   ```javascript
   // Check audio format being sent
   console.log('Audio format:', audioBlob.type)
   console.log('Audio size:', audioBlob.size)
   ```

3. **Network Connectivity**:
   ```bash
   # Test provider connectivity
   ping api.openai.com
   ping api.groq.com
   ```

**Provider-Specific Debugging:**

#### OpenAI Whisper:
```bash
# Test API endpoint
curl -X POST "https://api.openai.com/v1/audio/transcriptions" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F file="@test.wav" \
  -F model="whisper-1"
```

#### Groq:
```bash
# Test Groq API
curl -X POST "https://api.groq.com/openai/v1/audio/transcriptions" \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F file="@test.wav" \
  -F model="whisper-large-v3"
```

## 🔧 MCP Integration Issues

### Issue: MCP Servers Won't Connect

**Symptoms:**
```
[MCP-DEBUG] Failed to connect to server: spawn ENOENT
[MCP-DEBUG] Server process exited with code 1
```

**Debugging:**

1. **Check MCP server configuration**:
   ```bash
   # Verify MCP config file exists
   cat ~/.config/SpeakMCP/mcp-config.json
   ```

2. **Test MCP server manually**:
   ```bash
   # Test mock MCP server
   node scripts/mock-mcp-server.mjs
   ```

3. **Check server executable**:
   ```bash
   # Verify server path exists
   which python3  # For Python-based MCP servers
   ls -la /path/to/mcp/server/executable
   ```

**Solutions:**

1. **Fix server paths**:
   ```json
   {
     "servers": {
       "filesystem": {
         "command": "/usr/bin/python3",
         "args": ["-m", "mcp_server_filesystem", "/path/to/safe/directory"]
       }
     }
   }
   ```

2. **Use built-in fallback tools**:
   ```javascript
   // If MCP servers fail, fallback tools are available
   // File operations, notifications, etc.
   ```

### Issue: MCP Tool Execution Fails

**Symptoms:**
- Tools are discovered but execution times out
- Error responses from tool calls
- Partial or malformed tool results

**Debugging:**

1. **Check tool arguments**:
   ```javascript
   console.log('Calling tool:', toolName, 'with args:', args)
   ```

2. **Test tool directly**:
   ```bash
   # Use MCP inspector if available
   npx @modelcontextprotocol/inspector
   ```

3. **Check server logs**:
   ```bash
   DEBUG=mcp:* pnpm dev
   ```

## 🖼️ UI & Renderer Issues

### Issue: React Components Not Loading

**Symptoms:**
- White screen instead of UI
- Console errors about missing components
- Hot reload not working

**Debugging:**

1. **Check renderer process**:
   ```bash
   # Open DevTools in app
   # Or check renderer logs
   DEBUG=renderer:* pnpm dev
   ```

2. **Verify component imports**:
   ```javascript
   // Check for missing imports
   import { Button } from '@/components/ui/button'
   ```

3. **Test in isolation**:
   ```bash
   # Start only renderer
   pnpm dev --renderer-only
   ```

### Issue: Settings Not Persisting

**Symptoms:**
- Configuration resets on app restart
- API keys not saving
- UI preferences lost

**Solutions:**

1. **Check config file location**:
   ```bash
   # macOS
   ~/Library/Application Support/SpeakMCP/
   
   # Windows
   %APPDATA%\SpeakMCP\
   
   # Linux
   ~/.config/SpeakMCP/
   ```

2. **Verify write permissions**:
   ```bash
   ls -la ~/Library/Application\ Support/SpeakMCP/
   ```

3. **Reset configuration**:
   ```bash
   # Backup and reset
   mv ~/.config/SpeakMCP ~/.config/SpeakMCP.backup
   # Restart app to recreate defaults
   ```

## 🔍 Platform-Specific Issues

### macOS Issues

#### Issue: "SpeakMCP is damaged" Error
```bash
# Remove quarantine attribute
xattr -dr com.apple.quarantine /Applications/SpeakMCP.app
```

#### Issue: Dock Icon Behavior
```javascript
// Control dock visibility
app.dock.hide()  // Hide from dock
app.dock.show()  // Show in dock
```

#### Issue: Native Panel Not Working
```javascript
// Verify panel type at creation
const panelWindow = new BrowserWindow({
  type: 'panel',  // This must be set at creation
  // Cannot be changed after window creation
})
```

### Windows Issues

#### Issue: Windows Defender Blocking
```powershell
# Add exclusion for SpeakMCP
Add-MpPreference -ExclusionPath "C:\Program Files\SpeakMCP"
```

#### Issue: PowerShell Execution Policy
```powershell
# Allow script execution for development
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Issue: Path Length Limitations
```powershell
# Enable long paths (Windows 10+)
# Computer Configuration > Administrative Templates > System > Filesystem
# Enable "Enable Win32 long paths"
```

### Linux Issues

#### Issue: AppImage Won't Run
```bash
# Make executable
chmod +x SpeakMCP-0.1.7.AppImage

# Install FUSE if needed
sudo apt install fuse libfuse2
```

#### Issue: Audio System Conflicts
```bash
# Check audio system
pactl info | grep "Server Name"

# PulseAudio issues
pulseaudio --kill
pulseaudio --start

# ALSA issues
sudo alsamixer  # Check if microphone is muted
```

## 🧪 Test-Related Issues

### Issue: E2E Tests Failing

**Symptoms:**
```
Error: Page closed
TimeoutError: Waiting for selector '.panel-window' failed
```

**Solutions:**

1. **Run with debug output**:
   ```bash
   DEBUG=pw:test pnpm test:e2e
   ```

2. **Run in headed mode**:
   ```bash
   pnpm test:e2e:headed
   ```

3. **Check test artifacts**:
   ```bash
   ls test-results/
   # Screenshots and videos of failed tests
   ```

### Issue: Test App Won't Launch

**Common Causes:**
- Missing build artifacts
- Wrong Electron version
- Permission issues

**Solutions:**
```bash
# Ensure app is built
pnpm build

# Check Electron version matches
npx electron --version

# Run specific test
npx playwright test --grep "App Launch"
```

## 📊 Performance Issues

### Issue: Slow Startup

**Debugging:**
```bash
# Profile startup time
TIME=1 pnpm dev

# Check what's loading slowly
DEBUG=electron:* pnpm dev
```

**Optimizations:**
- Lazy load heavy dependencies
- Cache API responses
- Reduce initial UI complexity

### Issue: Memory Leaks

**Debugging:**
```javascript
// Monitor memory usage
setInterval(() => {
  console.log('Memory:', process.memoryUsage())
}, 5000)
```

**Common Causes:**
- Event listeners not being removed
- Circular references in MCP service
- Audio buffers not being cleared

## 🆘 Emergency Recovery

### Complete Reset
```bash
# Nuclear option: reset everything
rm -rf node_modules out dist resources/bin
rm pnpm-lock.yaml package-lock.json
pnpm install
pnpm build
```

### Fallback Binary
```bash
# If Rust build fails, use pre-compiled binary
# Download from GitHub releases
curl -L "https://github.com/aj47/SpeakMCP/releases/download/v0.1.7/speakmcp-rs-darwin-arm64" \
  -o resources/bin/speakmcp-rs-darwin-arm64
chmod +x resources/bin/speakmcp-rs-darwin-arm64
```

### Development Mode Recovery
```bash
# Minimal development setup
npm install electron -g
electron src/main/index.ts  # TypeScript direct execution
```

## 📞 Getting Help

### Debug Information to Collect

Before reporting issues, collect:

```bash
# System information
uname -a  # macOS/Linux
systeminfo  # Windows

# Node and package manager versions
node --version
npm --version
pnpm --version

# Application versions
cat package.json | grep version
electron --version

# Build status
ls -la out/
ls -la resources/bin/

# Recent logs
tail -50 ~/.config/SpeakMCP/logs/main.log
```

### Log Files Locations

#### macOS:
- **Main Process**: `~/Library/Logs/SpeakMCP/main.log`
- **Renderer**: `~/Library/Logs/SpeakMCP/renderer.log`
- **Config**: `~/Library/Application Support/SpeakMCP/`

#### Windows:
- **Main Process**: `%APPDATA%\SpeakMCP\logs\main.log`
- **Renderer**: `%APPDATA%\SpeakMCP\logs\renderer.log`
- **Config**: `%APPDATA%\SpeakMCP\config.json`

#### Linux:
- **Main Process**: `~/.config/SpeakMCP/logs/main.log`
- **Config**: `~/.config/SpeakMCP/config.json`

### Useful Debug Commands

```bash
# Enable all debug output
DEBUG=* pnpm dev

# Specific debug categories
DEBUG=speakmcp:*,mcp:*,stt:* pnpm dev

# Electron debug
ELECTRON_ENABLE_LOGGING=1 pnpm dev

# Network debugging
DEBUG=axios:* pnpm dev
```

---

**Need more help?** Check the [Fork Maintenance Guide](FORK_MAINTENANCE.md) for detailed setup instructions and known issues.