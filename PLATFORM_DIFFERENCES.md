# Platform Differences and Compatibility Matrix for SpeakMCP

## Platform Support Overview

| Platform | Support Status | Binary Name | Critical Requirements |
|----------|---------------|-------------|----------------------|
| Windows 10+ | ✅ Full Support | `speakmcp-rs.exe` | Visual Studio Build Tools |
| macOS 10.15+ | ✅ Full Support | `speakmcp-rs-mac` | **Accessibility API Permissions** |
| Linux (X11) | ⚠️ Limited | `speakmcp-rs` | X11 Display Server Only |
| Linux (Wayland) | ❌ Not Supported | N/A | Not compatible with rdev/enigo |

## Dependency Platform Compatibility

### rdev (v0.5.3) - Event Monitoring
| Platform | Implementation | Requirements | Known Issues |
|----------|---------------|--------------|--------------|
| Windows | WinAPI (user32.dll) | None | Works out of box |
| macOS | Core Graphics Events | Accessibility permissions | Silent failure without permissions |
| Linux | X11 (libxi) | X11 display server | No Wayland support |

### enigo (v0.3.0) - Input Simulation
| Platform | Implementation | Requirements | Known Issues |
|----------|---------------|--------------|--------------|
| Windows | SendInput API | None | Works reliably |
| macOS | CGEvent API | Accessibility permissions | Requires app to be trusted |
| Linux | XTest extension | X11 display server | No Wayland support |

## Build Requirements

### Windows
```bash
# Prerequisites
- Visual Studio 2019+ or Build Tools for Visual Studio
- Windows SDK (installed with VS)
- Rust toolchain: stable-x86_64-pc-windows-msvc

# Build command
cargo build --release
```

### macOS
```bash
# Prerequisites
- Xcode Command Line Tools: xcode-select --install
- Rust toolchain: stable-x86_64-apple-darwin
- Code signing certificate (optional but recommended)

# Build command
cargo build --release
./scripts/sign-binary.sh  # Optional: sign the binary
```

### Linux
```bash
# Prerequisites (Ubuntu/Debian)
sudo apt-get install libx11-dev libxi-dev libxtst-dev

# Prerequisites (Fedora/RHEL)
sudo dnf install libX11-devel libXi-devel libXtst-devel

# Build command
cargo build --release
```

## Runtime Requirements

### Windows
- **Permissions**: None required for standard operation
- **System APIs**: user32.dll, kernel32.dll (standard Windows libraries)
- **UAC**: Not required unless installed system-wide

### macOS
- **Critical Permission**: Accessibility API access
  - Navigate to: System Preferences → Security & Privacy → Privacy → Accessibility
  - Add the application and grant permission
  - Without this, keyboard events will be silently ignored
- **Code Signing**: Recommended for distribution to avoid Gatekeeper warnings
- **Notarization**: Required for distribution outside App Store

### Linux
- **Display Server**: X11 only (Wayland not supported)
- **Permissions**: May require membership in `input` group for some operations
- **Environment Variables**: 
  - `DISPLAY` must be set (usually `:0`)
  - May need `XAUTHORITY` for remote X11

## Platform-Specific Behaviors

### Keyboard Event Capture

| Platform | Method | Latency | Reliability |
|----------|--------|---------|-------------|
| Windows | Low-level keyboard hook | ~1ms | Very reliable |
| macOS | CGEventTap | ~2-5ms | Reliable with permissions |
| Linux X11 | XRecord extension | ~5-10ms | Varies by WM |

### Text Injection

| Platform | Method | Unicode Support | Speed |
|----------|--------|----------------|-------|
| Windows | SendInput | Full | Fast |
| macOS | CGEventPost | Full | Fast |
| Linux X11 | XTest | Limited | Moderate |

## Known Platform-Specific Bugs and Limitations

### Windows
- None currently identified in the codebase

### macOS
- **Silent Failure**: If Accessibility permissions are not granted, the application fails silently
- **First Run**: User must manually grant permissions; cannot be done programmatically
- **Sandboxing**: Will not work in sandboxed environments

### Linux
- **Critical**: No Wayland support - app will not work on modern distributions
- **X11 Dependency**: Requires X11 libraries even if not actively used
- **Remote X11**: May have issues with forwarded X11 sessions
- **Input Groups**: Some distributions require user to be in `input` group

## Platform Detection in Code

### Current Implementation (TypeScript)
```typescript
// src/services/process.ts
switch (process.platform) {
    case 'darwin':
        binaryName = 'speakmcp-rs-mac';
        break;
    case 'win32':
        binaryName = 'speakmcp-rs.exe';
        break;
    case 'linux':
        binaryName = 'speakmcp-rs';
        break;
}
```

### Missing in Rust Code
The Rust binary currently has no platform-specific compilation flags or runtime detection:
- No `#[cfg(target_os = "...")]` attributes
- No runtime capability checking
- No fallback mechanisms for unsupported features

## Recommended Platform-Specific Implementations

### Add Conditional Compilation
```rust
#[cfg(target_os = "windows")]
mod windows {
    pub fn init_platform() -> Result<(), Error> {
        // Windows-specific initialization
    }
}

#[cfg(target_os = "macos")]
mod macos {
    pub fn init_platform() -> Result<(), Error> {
        // Check for accessibility permissions
        // Prompt user if not granted
    }
}

#[cfg(target_os = "linux")]
mod linux {
    pub fn init_platform() -> Result<(), Error> {
        // Check for X11 vs Wayland
        // Fail gracefully on Wayland
    }
}
```

### Add Runtime Detection
```rust
fn detect_display_server() -> DisplayServer {
    #[cfg(target_os = "linux")]
    {
        if std::env::var("WAYLAND_DISPLAY").is_ok() {
            return DisplayServer::Wayland;
        }
        if std::env::var("DISPLAY").is_ok() {
            return DisplayServer::X11;
        }
        return DisplayServer::None;
    }
    
    #[cfg(not(target_os = "linux"))]
    DisplayServer::Native
}
```

## Testing Matrix

| Test Case | Windows | macOS | Linux X11 | Linux Wayland |
|-----------|---------|-------|-----------|---------------|
| Basic key capture | ✅ | ✅* | ✅ | ❌ |
| Text injection | ✅ | ✅* | ✅ | ❌ |
| Special keys | ✅ | ✅* | ⚠️ | ❌ |
| Unicode text | ✅ | ✅ | ⚠️ | ❌ |
| High-frequency events | ✅ | ✅ | ⚠️ | ❌ |

*Requires Accessibility API permissions

## Distribution Considerations

### Windows
- Distribute as single `.exe` file
- Consider code signing certificate to avoid SmartScreen warnings
- No additional runtime dependencies needed

### macOS
- Must be signed and notarized for distribution
- Consider distributing as `.app` bundle for better UX
- Include clear instructions for granting Accessibility permissions

### Linux
- Consider AppImage or Flatpak for broader compatibility
- Document X11 requirement prominently
- Consider shipping X11 libraries or using static linking

## Future Platform Support Recommendations

1. **High Priority**: Add Wayland support for Linux
   - Consider using `wayland-client` crate
   - Or provide alternative implementation using DBus

2. **Medium Priority**: Add BSD support
   - Similar to Linux but may need different dependencies

3. **Low Priority**: Consider WebAssembly target
   - For browser-based usage scenarios

## Security Considerations by Platform

### Windows
- No elevation required for normal use
- Antivirus may flag keyboard hooks as suspicious

### macOS
- Accessibility API is a privileged operation
- Users should be warned about granting permissions
- Consider implementing audit logging

### Linux
- X11 allows any client to monitor all input (security risk)
- Wayland explicitly prevents this for security (hence incompatibility)
- Consider implementing secure input methods via compositor protocols