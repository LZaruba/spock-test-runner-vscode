# Spock Test Runner for VS Code

A VS Code extension that provides comprehensive test support for the Spock testing framework in Java projects. This extension integrates with VS Code's Test API to provide seamless test discovery, execution, and debugging capabilities for Spock tests.

**Version**: 0.0.4 
**Author**: Lukas Zaruba

> **Inspiration**: This extension was inspired by [Daniel Micah's spock-test-runner](https://github.com/donnffd/spock-test-runner) but focuses exclusively on VS Code's Test API integration rather than CodeLens functionality.

## Features

- **Test Discovery**: Automatically discovers Spock test classes and methods in your workspace
- **Test Execution**: Run individual tests, test classes, or all tests through VS Code's Test Explorer
- **Debug Support**: Debug Spock tests with full breakpoint support and variable inspection
- **Build Tool Support**: Works with both Gradle and Maven projects
- **Real-time Updates**: Automatically updates test tree when files change
- **Error Reporting**: Detailed error messages with file locations for failed tests
- **Output Streaming**: Real-time test output in VS Code's Test Results panel

## Requirements

- VS Code 1.85.0 or higher
- Java 11 or higher
- Gradle or Maven build tool
- Spock framework in your project

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions view (Ctrl+Shift+X)
3. Search for "spock-test-runner-vscode"
4. Click Install

### From Source
1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press F5 to run the extension in a new Extension Development Host window

## Usage

### Test Discovery
The extension automatically discovers Spock tests in your workspace. Tests are organized in the Test Explorer panel under the following hierarchy:
- Workspace
  - File (.groovy files)
    - Test Class (classes extending Specification)
      - Test Methods (feature methods)

### Running Tests
You can run tests in several ways:
1. **Run All Tests**: Click the play button in the Test Explorer
2. **Run Specific Test**: Click the play button next to a specific test
3. **Run from Command Palette**: Use `Ctrl+Shift+P` and search for "spock-test-runner-vscode" commands
4. **Run from Context Menu**: Right-click on a test file and select "Run Spock Test"

### Debugging Tests
1. **Debug All Tests**: Click the debug button in the Test Explorer
2. **Debug Specific Test**: Click the debug button next to a specific test
3. **Set Breakpoints**: Click in the gutter next to line numbers in your test files
4. **Debug from Command Palette**: Use `Ctrl+Shift+P` and search for "spock-test-runner-vscode" commands

### Supported Test Patterns
The extension recognizes the following Spock test patterns:

```groovy
class MySpec extends Specification {
    
    def "should do something"() {
        given:
        // setup
        
        when:
        // action
        
        then:
        // verification
    }
    
    def "another test"() {
        expect:
        // simple assertion
    }
}
```

## Configuration

### Build Tool Detection
The extension automatically detects your build tool:
- **Gradle**: Looks for `build.gradle` file (preferred if both are present)
- **Maven**: Looks for `pom.xml` file

### Debug Configuration
The extension automatically creates debug configurations for your project. You can find them in `.vscode/launch.json`:

```json
{
    "type": "java",
    "name": "Debug Spock Tests (Groovy)",
    "request": "attach",
    "hostName": "localhost",
    "port": 5005,
    "projectName": "your-project-name",
    "sourcePaths": [
        "${workspaceFolder}",
        "${workspaceFolder}/src/test/groovy",
        "${workspaceFolder}/src/main/groovy"
    ]
}
```

## Sample Projects

A sample Gradle project with Spock tests is included in the `sample-projects/gradle-sample` directory. This project demonstrates:
- Basic arithmetic operations testing
- User service testing with CRUD operations
- Error handling and exception testing
- Multiple test scenarios

To test the extension:
1. Open the `sample-projects/gradle-sample` folder in VS Code
2. Install the Spock Test Runner extension
3. Open the Test Explorer to see discovered tests
4. Run or debug the tests

## Troubleshooting

### Tests Not Discovered
- Ensure your test classes extend `Specification`
- Check that your Gradle build tool is properly configured
- Verify that Spock dependencies are included in your project
- Check the Output panel for "Spock Test Runner" logs

### Debug Not Working
- Ensure Java Extension Pack is installed
- Check that debug port 5005 is available
- Verify that your project has proper source paths configured
- Check the Output panel for debug-related error messages

### Build Tool Issues
- For Gradle: Ensure `gradlew` (wrapper) or `gradle` is available in your PATH
- For Maven: Ensure `mvnw` (wrapper) or `mvn` is available in your PATH
- Check that your build files are valid and properly configured
- If both `build.gradle` and `pom.xml` exist, Gradle will be used (configure one build tool per project)

## Development

### Building from Source
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Run tests
npm test
```

### Project Structure
```
├── src/
│   ├── extension.ts          # Main extension entry point
│   └── testController.ts     # Test controller implementation
├── sample-project/           # Sample Gradle project
├── .vscode/                  # VS Code configuration
├── package.json              # Extension manifest
└── README.md                 # This file
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Spock Framework](https://spockframework.org/) - The testing framework this extension supports
- [VS Code Test API](https://code.visualstudio.com/api/extension-guides/testing) - The testing API this extension uses
- [Gradle](https://gradle.org/) - Build tool supported by this extension
- [Maven](https://maven.apache.org/) - Build tool supported by this extension
