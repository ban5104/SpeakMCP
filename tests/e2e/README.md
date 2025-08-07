# SpeakMCP E2E Tests

This directory contains comprehensive end-to-end tests for the SpeakMCP Electron application using Playwright-electron.

## Test Structure

### Test Suites

1. **app-launch.e2e.spec.ts** - Application launch and initialization tests
   - App startup across platforms
   - Window creation based on accessibility permissions
   - Platform-specific initialization (dock, taskbar, etc.)
   - App lifecycle events

2. **panel-window.e2e.spec.ts** - Panel window functionality tests
   - Panel window creation and positioning
   - Platform-specific panel behavior (native vs simulated)
   - Always-on-top behavior
   - Multi-screen support

3. **cross-platform.e2e.spec.ts** - Cross-platform compatibility tests
   - Platform detection and handling
   - macOS dock behavior vs Windows taskbar
   - Accessibility permission requirements
   - Resource loading and performance

4. **mcp-integration.e2e.spec.ts** - MCP (Model Context Protocol) integration tests
   - MCP service initialization
   - Configuration loading and persistence
   - Recording workflow differences
   - Debug logging and error handling

5. **keyboard-system.e2e.spec.ts** - Keyboard shortcuts and system integration tests
   - Global shortcut registration
   - Platform-specific key handling
   - Text injection system
   - System tray integration

### Utilities

- **utils/electron-app.ts** - Main Electron app testing utilities
- **utils/platform-helpers.ts** - Platform-specific test helpers
- **utils/test-runner.ts** - Test runner and setup utilities
- **fixtures/app-fixture.ts** - Playwright test fixtures for app lifecycle

## Running Tests

### Prerequisites

1. Install dependencies:
```bash
pnpm install
```

2. Build the application:
```bash
pnpm run build
```

### Running All Tests

```bash
pnpm run test:e2e
```

### Running Specific Test Suites

```bash
# Run only panel window tests
npx playwright test --grep "Panel Window"

# Run only cross-platform tests
npx playwright test --grep "Cross-Platform"

# Run only MCP integration tests
npx playwright test --grep "MCP Integration"
```

### Running Tests in UI Mode

```bash
pnpm run test:e2e:ui
```

### Debugging Tests

```bash
pnpm run test:e2e:debug
```

### Running Tests in Headed Mode

```bash
pnpm run test:e2e:headed
```

## Platform-Specific Considerations

### macOS

- **Accessibility Permissions**: Some tests require accessibility permissions to be granted to the terminal/IDE running the tests
- **Dock Behavior**: Tests verify proper dock hiding/showing behavior
- **Native Panel Type**: Tests verify native panel window type and vibrancy effects
- **Mission Control**: Tests ensure panel doesn't appear in Mission Control

### Windows

- **Taskbar Integration**: Tests verify taskbar behavior and system tray integration
- **Simulated Panel**: Tests verify always-on-top panel simulation
- **Win32 APIs**: Tests verify proper integration with Windows-specific features

### Linux

- **Basic Functionality**: Tests focus on core functionality without platform-specific features
- **X11/Wayland**: Tests should work on both display servers
- **Desktop Environment**: Tests verify basic desktop integration

## Test Architecture

### App Lifecycle Management

The tests use a custom `ElectronTestApp` class that handles:
- Launching the Electron application
- Managing window references
- Platform-specific behavior testing
- Graceful shutdown and cleanup

### Fixtures

Playwright fixtures provide:
- Automatic app launch and cleanup
- Shared app context across tests
- Proper test isolation

### Platform Helpers

The `PlatformHelpers` class provides:
- Platform detection utilities
- Platform-specific test implementations
- Conditional test execution based on platform

## Test Coverage

The E2E tests cover:

✅ **Application Launch**
- Startup on all platforms
- Window creation logic
- Accessibility permission handling

✅ **Panel Window Functionality**
- Correct dimensions and positioning
- Always-on-top behavior
- Platform-specific implementation

✅ **Cross-Platform Compatibility**
- Platform detection
- Platform-specific features
- Resource loading

✅ **MCP Integration**
- Service initialization
- Configuration management
- Recording workflow

✅ **Keyboard & System Integration**
- Global shortcut registration
- Text injection system
- System tray/dock behavior

## Debugging Failed Tests

### Screenshots and Videos

Failed tests automatically capture:
- Screenshots at point of failure
- Video recordings of the test run
- Network traces (if applicable)

These are stored in `test-results/` directory.

### Console Output

The tests capture and filter console output, particularly:
- MCP debug messages
- Electron main process logs
- Renderer process errors

### Platform-Specific Issues

When tests fail on specific platforms:

1. Check if the test is correctly skipped for unsupported platforms
2. Verify accessibility permissions (macOS)
3. Check if required system features are available
4. Review platform-specific error messages

## Continuous Integration

For CI environments:

1. Set `CI=1` environment variable
2. Ensure proper build artifacts are available
3. Consider platform-specific CI runners for complete coverage
4. Use retries for potentially flaky tests

## Contributing

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Use appropriate platform detection and skipping
3. Include proper cleanup and error handling
4. Add descriptive test names and comments
5. Consider both positive and negative test scenarios