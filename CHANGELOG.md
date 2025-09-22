# Change Log

All notable changes to the "spock-test-runner-vscode" extension will be documented in this file.

**Author**: Lukas Zaruba

## [0.0.2] - 2025-09-22

### Changed
- **Refactored codebase** for better maintainability and separation of concerns
- **Forces test execution** to always run even if code is up-to-date using Gradle init scripts
- **Improved logging** with proper service-level responsibility separation
- **Enhanced architecture** with dedicated services for build tools, test discovery, execution, and debugging

### Technical Improvements
- **BuildToolService**: Centralized command building and force execution logic
- **TestExecutionService**: Focused on process management and output handling
- **DebugService**: Streamlined debug session management
- **TestDiscoveryService**: Dedicated test parsing and discovery
- **Gradle Integration**: Uses init script (`force-tests.init.gradle`) to force test execution
- **Simplified Architecture**: Removed untested Maven support, focusing on Gradle-only implementation

### Fixed
- **Test Execution**: Tests now run every time, not just when Gradle thinks they're needed
- **Logging Consistency**: Proper logging across all services and extension commands
- **Code Organization**: Clean separation of concerns between services

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
