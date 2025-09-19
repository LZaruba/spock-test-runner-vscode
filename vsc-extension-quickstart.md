# Spock Test Runner Extension Quickstart

This guide will help you get started with developing and testing the spock-test-runner-vscode VS Code extension.

**Author**: Lukas Zaruba

## Prerequisites

- Node.js (version 16 or higher)
- npm
- VS Code
- Java 11 or higher
- Gradle or Maven

## Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd spock-test-runner-vscode
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Compile the extension**
   ```bash
   npm run compile
   ```

4. **Run the extension in development mode**
   - Press `F5` in VS Code
   - This will open a new Extension Development Host window
   - The extension will be loaded in this new window

## Testing the Extension

1. **Open the sample project**
   - In the Extension Development Host window, open the `sample-project` folder
   - File → Open Folder → Select `sample-project`

2. **Verify test discovery**
   - Open the Test Explorer (Test tube icon in the Activity Bar)
   - You should see the Spock tests organized by file and class under "spock-test-runner-vscode"

3. **Run tests**
   - Click the play button next to any test
   - Check the Test Results panel for output

4. **Debug tests**
   - Set breakpoints in your test files
   - Click the debug button next to any test
   - The debugger should attach and stop at your breakpoints

## Building for Production

1. **Compile the extension**
   ```bash
   npm run compile
   ```

2. **Package the extension**
   ```bash
   npx vsce package
   ```

3. **Install the packaged extension**
   ```bash
   code --install-extension spock-test-runner-0.0.1.vsix
   ```

## Project Structure

```
├── src/
│   ├── extension.ts          # Main extension entry point
│   └── testController.ts     # Test controller implementation
├── sample-project/           # Sample Gradle project for testing
│   ├── build.gradle         # Gradle build configuration
│   └── src/test/groovy/     # Spock test files
├── .vscode/                  # VS Code configuration
│   ├── launch.json          # Debug configuration
│   ├── tasks.json           # Build tasks
│   └── extensions.json      # Recommended extensions
├── package.json              # Extension manifest
├── tsconfig.json            # TypeScript configuration
└── README.md                # Documentation
```

## Debugging

### Extension Development
- Use the "Run Extension" configuration in `.vscode/launch.json`
- Set breakpoints in your TypeScript code
- Use the Debug Console to inspect variables

### Spock Tests
- Set breakpoints in your Groovy test files
- Use the "Debug" button in the Test Explorer
- The debugger will attach to the running test process

## Common Issues

### Tests Not Discovered
- Check that test classes extend `Specification`
- Verify build tool detection (Gradle/Maven)
- Check the Output panel for error messages

### Debug Not Working
- Ensure Java Extension Pack is installed
- Check that port 5005 is available
- Verify source paths in launch configuration

### Build Issues
- Run `npm run compile` to check for TypeScript errors
- Check that all dependencies are installed
- Verify VS Code API compatibility

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Test API](https://code.visualstudio.com/api/extension-guides/testing)
- [Spock Framework](https://spockframework.org/)
- [Gradle](https://gradle.org/)
- [Maven](https://maven.apache.org/)
