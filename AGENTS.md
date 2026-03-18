# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Build/Test Commands

- `npm run compile` - Build TypeScript to `out/`
- `npm run lint` - Lint with ESLint
- `npm run test` - Run all tests (Jest)
- `npm run test:unit` - Run unit tests only (`TestResultParser|TestController`)
- `npm run test:integration` - Run integration tests (`ParameterizedTestIntegration`)
- `npm run test:e2e` - Run E2E tests with 60s timeout
- `npm run test:all` - Run all test suites sequentially
- `npm run package` - Package extension with vsce
- `./run-vscode.sh [gradle|maven]` - Build, package, and launch VSCode with extension

## Project-Specific Patterns

- **Gradle init script**: Test execution requires `resources/force-tests.init.gradle` - it forces Gradle to run tests even when up-to-date
- **Abstract classes skipped**: [`TestDiscoveryService.ts`](src/services/TestDiscoveryService.ts:6) automatically skips `abstract class ... extends Specification`
- **Lifecycle methods ignored**: Methods named `setup`, `setupSpec`, `cleanup`, `cleanupSpec` are not treated as tests
- **Data-driven test detection**: Tests with `where:` blocks are marked as data-driven and parsed differently
- **Test timeout**: 5 minutes hardcoded in [`TestExecutionService.ts`](src/services/TestExecutionService.ts:76)
- **Debug port**: 5005 with 12-second startup delay before debugger attaches ([`TestExecutionService.ts`](src/services/TestExecutionService.ts:42)
- **Output channel**: Logs go to "Spock Test Runner" channel (created in [`extension.ts`](src/extension.ts:9))

## VS Code Extension Architecture

- Entry point: [`extension.ts`](src/extension.ts) - registers commands and creates TestController
- TestController: [`testController.ts`](src/testController.ts) - implements VS Code Test API
- Test discovery: [`TestDiscoveryService.ts`](src/services/TestDiscoveryService.ts) - parses Spock Groovy files
- Test execution: [`TestExecutionService.ts`](src/services/TestExecutionService.ts) - spawns Gradle/Maven
- Result parsing: [`TestResultParser.ts`](src/services/TestResultParser.ts) - parses console output and XML reports

## Code Style (from ESLint config)

- Imports: camelCase or PascalCase
- Curly braces required: `eqeqeq` and `curly` rules are `warn`
- Semicolons: disabled
- Explicit `any`: allowed
- VSCode mock: [`src/test/mocks/vscode.ts`](src/test/mocks/vscode.ts) - required for Jest tests
