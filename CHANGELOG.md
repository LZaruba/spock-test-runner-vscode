# Change Log

All notable changes to the "spock-test-runner-vscode" extension will be documented in this file.

**Author**: Lukas Zaruba

## [0.0.1] - 2025-09-19

### Added
- Initial release of Spock Test Runner for VS Code by Lukas Zaruba
- Test discovery for Spock test classes and methods
- Test execution through VS Code Test API
- Debug support for Spock tests
- Support for Gradle and Maven build tools
- Real-time test output streaming
- Error reporting with file locations
- Automatic test tree updates on file changes
- Sample project with comprehensive test examples

### Features
- **Test Discovery**: Automatically finds Spock test classes extending `Specification`
- **Test Execution**: Run individual tests, test classes, or all tests
- **Debug Support**: Full debugging capabilities with breakpoints and variable inspection
- **Build Tool Support**: Works with both Gradle and Maven projects
- **VS Code Integration**: Seamless integration with VS Code's Test Explorer
- **Error Handling**: Detailed error messages and stack traces
- **Output Streaming**: Real-time test output in Test Results panel

### Supported Test Patterns
- Feature methods with `def "test name"()` syntax
- Feature methods with `def testName()` syntax
- Given-When-Then blocks
- Expect blocks
- Lifecycle methods (setup, cleanup, etc.)

### Requirements
- VS Code 1.85.0 or higher
- Java 11 or higher
- Gradle or Maven build tool
- Spock framework in project dependencies
