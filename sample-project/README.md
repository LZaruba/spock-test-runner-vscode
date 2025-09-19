# Spock Sample Project

This is a sample Gradle project with Spock tests to demonstrate the spock-test-runner-vscode VS Code extension by Lukas Zaruba.

## Project Structure

```
sample-project/
├── build.gradle              # Gradle build configuration
├── settings.gradle           # Gradle settings
├── gradle.properties         # Gradle properties
├── README.md                 # This file
└── src/
    └── test/
        └── groovy/
            └── com/
                └── example/
                    ├── CalculatorSpec.groovy    # Calculator tests
                    ├── Calculator.java          # Calculator implementation
                    ├── UserServiceSpec.groovy   # UserService tests
                    ├── UserService.java         # UserService implementation
                    └── User.java                # User model
```

## Test Classes

### CalculatorSpec
Tests for a simple calculator with basic arithmetic operations:
- Addition
- Subtraction
- Multiplication
- Division
- Division by zero error handling
- Multiple operations

### UserServiceSpec
Tests for a user service with CRUD operations:
- User creation with valid data
- User creation with invalid email
- User creation with empty name
- Finding user by ID
- Handling non-existent users

## Running Tests

You can run these tests using:

```bash
# Run all tests
./gradlew test

# Run specific test class
./gradlew test --tests "com.example.CalculatorSpec"

# Run specific test method
./gradlew test --tests "com.example.CalculatorSpec.should add two numbers correctly"
```

## VS Code Extension

This project is designed to work with the spock-test-runner-vscode VS Code extension, which provides:
- Test discovery and execution through VS Code's Test API
- Debug support for Spock tests
- Integration with VS Code's testing UI
- Support for both Gradle and Maven projects
