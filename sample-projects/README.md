# Bowling Game Sample Project

This sample project demonstrates the Spock Test Runner VS Code extension with a complete bowling game implementation and comprehensive test suite.

## 🎯 Project Structure

```
sample-project/
├── src/main/java/com/example/
│   ├── BowlingGame.java          # Main bowling game logic
│   ├── Frame.java                # Frame representation
│   └── BowlingException.java     # Custom exceptions
├── src/test/groovy/com/example/
│   ├── BowlingGameSpec.groovy    # Comprehensive Spock tests
│   ├── FrameSpec.groovy          # Frame-specific tests
│   ├── ComplexDataSpec.groovy    # Complex data-driven tests
│   ├── EmptySpec.groovy          # Empty test class (edge case)
│   ├── NestedClassSpec.groovy    # Nested classes (edge case)
│   ├── AbstractSpec.groovy       # Abstract test class (edge case)
│   ├── ChildSpec.groovy          # Extends AbstractSpec (indirect Specification subclass)
│   ├── GrandChildSpec.groovy     # Extends ChildSpec (two levels of inheritance)
│   ├── MalformedSpec.groovy      # Malformed syntax (edge case)
│   ├── CalculatorSpec.groovy     # Original calculator tests
│   ├── UserServiceSpec.groovy    # Original user service tests
│   ├── DataDrivenSpec.groovy     # All where block variations
│   └── Person.groovy             # Person data class
└── README.md
```

## 🎮 Bowling Game Features

### Core Classes
- **BowlingGame**: Main game logic with scoring, frame management, and validation
- **Frame**: Individual frame representation with strike/spare detection
- **BowlingException**: Custom exception for bowling-specific errors

### Game Rules Implemented
- ✅ Standard 10-pin bowling rules
- ✅ Strike detection and bonus scoring
- ✅ Spare detection and bonus scoring
- ✅ Last frame special handling (3 rolls for strike/spare)
- ✅ Input validation (0-10 pins per roll)
- ✅ Game state tracking (current frame, roll, completion)

## 🧪 Test Coverage

### Comprehensive Test Classes

#### 1. **BowlingGameSpec.groovy** - Main Test Suite
- **15 test methods** showcasing all `where:` block variations:
  - Pipe separators (`|`)
  - Double pipe separators (`||`)
  - Semicolon separators (`;`, `;;`)
  - Mixed separators
  - Single column tables
  - Placeholders in method names (`#frame`, `#expectedScore`)
  - Complex placeholders (`#gameState`, `#expectedScore`)
  - Data pipes (`<<`)
  - Multiple data pipes
  - @Unroll annotations
  - Complex data structures

#### 2. **FrameSpec.groovy** - Frame-Specific Tests
- Frame creation and initialization
- Roll validation and constraints
- Strike/spare detection
- Last frame special handling
- Frame equality and display

#### 3. **ComplexDataSpec.groovy** - Advanced Data Testing
- Complex data structures (Lists, Maps)
- Nested data validation
- Range and step range testing
- Multiple data source combinations

#### 4. **Edge Case Test Classes**
- **EmptySpec.groovy**: Empty test class
- **NestedClassSpec.groovy**: Nested test classes
- **AbstractSpec.groovy**: Abstract test classes
- **ChildSpec.groovy** / **GrandChildSpec.groovy**: Specs extending `Specification` indirectly, running the features inherited from their base classes
- **MalformedSpec.groovy**: Malformed Groovy syntax

## 🚀 Running the Tests

### Using VS Code Extension
1. Run the launcher script:
   ```bash
   ./run-vscode.sh
   ```
2. Open Test Explorer (Ctrl+Shift+P → "Test: Focus on Test Explorer View")
3. Run individual tests or test classes
4. Debug tests by setting breakpoints

### Using Gradle
```bash
./gradlew test
```

### Using Maven
```bash
mvn test
```

## 🎯 Where Block Variations Demonstrated

### 1. **Basic Data Tables**
```groovy
where:
roll1 | roll2 | expectedScore
3     | 4     | 7
5     | 2     | 7
```

### 2. **Double Pipe Separators**
```groovy
where:
pins || expectedScore
10   || 10
5    || 5
```

### 3. **Semicolon Separators**
```groovy
where:
roll1 ; roll2 ; nextRoll ;; expectedScore
5     ; 5     ; 3        ;; 18
7     ; 3     ; 4        ;; 18
```

### 4. **Placeholders in Method Names**
```groovy
def "strike in frame #frame should give bonus points"(int frame, int expectedBonus)
```

### 5. **Data Pipes**
```groovy
where:
pins << [10, 5, 0, 11]
shouldThrow << [false, false, false, true]
```

### 6. **Complex Data Structures**
```groovy
where:
scenario << ["perfect game", "gutter game", "spare game"]
rolls << [
    [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]
]
expectedScore << [300, 0, 150]
```

### 7. **@Unroll Annotations**
```groovy
@Unroll("#featureName[#iterationIndex] - Frame #frame: #roll1, #roll2 = #expectedScore")
def "frame scoring test"()
```

## 🔧 Extension Testing

This sample project is designed to test all aspects of the Spock Test Runner extension:

- **Test Discovery**: All test classes and methods are discovered
- **Data-Driven Tests**: All `where:` block variations are parsed
- **Test Execution**: Individual tests and iterations can be run
- **Test Debugging**: Breakpoints can be set in Java and Groovy code
- **Edge Cases**: Empty files, nested classes, malformed syntax
- **Real Scenarios**: Actual business logic testing

## 📊 Test Statistics

- **Total Test Classes**: 10
- **Total Test Methods**: 50+
- **Data-Driven Tests**: 30+
- **Where Block Variations**: 15+
- **Edge Cases**: 5+
- **Real Java Classes**: 3

This comprehensive test suite ensures the Spock Test Runner extension works correctly with real-world Spock test scenarios!
