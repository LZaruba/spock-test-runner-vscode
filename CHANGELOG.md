# Change Log

All notable changes to the "spock-test-runner-vscode" extension will be documented in this file.

**Author**: Lukas Zaruba

## [0.0.4] - 2025-10-01

### Added
- **Maven Support**: Initial support for Maven build tool alongside Gradle
- **Maven Sample Project**: Added a sample Maven project in the `samples/maven-sample` directory
- **Build Tool Detection**: Automatic detection of build tool (Gradle or Maven) based on project files
- **Maven Test Execution**: Ability to run and debug Spock tests using Maven commands

## [0.0.3] - 2025-10-01

### Added
- **Parameterized Test Support**: Full support for Spock data-driven tests with `where` blocks
- **Individual Iteration Results**: Each test iteration is displayed as a separate test item in the Test Explorer
- **Smart Test Result Parsing**: Automatic parsing of console output and XML reports to extract iteration-specific results
- **Test Result Parser Service**: Dedicated service for parsing Gradle test output and extracting detailed iteration information
- **Iteration Navigation**: Clicking on individual iterations navigates to the specific line in the `where` block
- **Comprehensive E2E Testing**: Real Gradle execution tests to validate functionality with actual test output

### Enhanced
- **Test Discovery**: Improved detection of data-driven tests with `where` blocks
- **Test Execution**: Better handling of Spock test names with placeholders (e.g., `#person.name is #person.age years old`)
- **Result Ordering**: Parameterized test iterations are displayed in the correct order matching the `where` block
- **File Change Handling**: Proper cleanup of old iteration items when test structure changes
- **Test Reload**: Automatic refresh of test structure when files are modified

### Fixed
- **Abstract Class Handling**: Abstract test classes are no longer displayed in the Test Explorer
- **Duplicate Test Listings**: Eliminated duplicate test class entries in the Test Explorer
- **Test Name Escaping**: Proper handling of Spock test names with special characters and placeholders
- **Iteration Cleanup**: Old iteration items are properly cleaned up when files change
- **Test Execution**: Fixed "No tests found" errors for tests with placeholder names

### Technical Improvements
- **TestResultParser**: New service for parsing Gradle console output and XML reports
- **Iteration Tracking**: Proper tracking and cleanup of dynamically created test iteration items
- **Enhanced Logging**: Better debugging information for test discovery and execution
- **Robust Error Handling**: Improved error handling for test parsing and execution failures

### Supported Test Patterns
- **Data Tables**: `where:` blocks with pipe (`|`) and semicolon (`;`) separators
- **Data Pipes**: `where:` blocks with `<<` operators for lists and maps
- **Placeholder Names**: Test methods with `#` placeholders in names (e.g., `def "#person.name is #person.age years old"()`)
- **Mixed Separators**: Complex `where:` blocks with multiple data sources
- **Custom Unroll Patterns**: Tests with `@Unroll` annotations and custom naming patterns

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
