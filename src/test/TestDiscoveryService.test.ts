import * as fs from 'fs';
import * as path from 'path';
import { TestDiscoveryService } from '../services/TestDiscoveryService';

describe('TestDiscoveryService', () => {
  const sampleProjectPath = path.join(__dirname, '../../sample-project/src/test/groovy/com/example');
  
  describe('parseTestsInFile', () => {
    it('should parse regular test methods from CalculatorSpec', () => {
      const filePath = path.join(sampleProjectPath, 'CalculatorSpec.groovy');
      const content = fs.readFileSync(filePath, 'utf8');
      const result = TestDiscoveryService.parseTestsInFile(content);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('CalculatorSpec');
      expect(result[0].methods).toHaveLength(6);
      expect(result[0].methods[0].name).toBe('should add two numbers correctly');
      expect(result[0].methods[0].isDataDriven).toBeFalsy();
      expect(result[0].methods[1].name).toBe('should subtract two numbers correctly');
      expect(result[0].methods[1].isDataDriven).toBeFalsy();
    });

    it('should parse data-driven test with pipe separators from DataDrivenSpec', () => {
      const filePath = path.join(sampleProjectPath, 'DataDrivenSpec.groovy');
      const content = fs.readFileSync(filePath, 'utf8');
      const result = TestDiscoveryService.parseTestsInFile(content);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('DataDrivenSpec');
      expect(result[0].methods.length).toBeGreaterThan(0);
      
      // Find the "maximum of two numbers" test method
      const maxTest = result[0].methods.find(m => m.name === 'maximum of two numbers');
      expect(maxTest).toBeDefined();
      expect(maxTest!.isDataDriven).toBeTruthy();
      expect(maxTest!.dataIterations).toHaveLength(3);
      
      expect(maxTest!.dataIterations![0].dataValues).toEqual({ a: 1, b: 3, c: 3 });
      expect(maxTest!.dataIterations![0].displayName).toBe('maximum of two numbers [a: 1, b: 3, c: 3]');
      expect(maxTest!.dataIterations![1].dataValues).toEqual({ a: 7, b: 4, c: 7 });
      expect(maxTest!.dataIterations![2].dataValues).toEqual({ a: 0, b: 0, c: 0 });
    });

    it('should parse data-driven test with double pipe separators from DataDrivenSpec', () => {
      const filePath = path.join(sampleProjectPath, 'DataDrivenSpec.groovy');
      const content = fs.readFileSync(filePath, 'utf8');
      const result = TestDiscoveryService.parseTestsInFile(content);
      
      expect(result).toHaveLength(1);
      
      // Find the "should calculate square of number" test method
      const squareTest = result[0].methods.find(m => m.name === 'should calculate square of number');
      expect(squareTest).toBeDefined();
      expect(squareTest!.isDataDriven).toBeTruthy();
      expect(squareTest!.dataIterations).toHaveLength(4);
      
      expect(squareTest!.dataIterations![0].dataValues).toEqual({ input: 2, expected: 4 });
      expect(squareTest!.dataIterations![1].dataValues).toEqual({ input: 3, expected: 9 });
      expect(squareTest!.dataIterations![2].dataValues).toEqual({ input: 4, expected: 16 });
      expect(squareTest!.dataIterations![3].dataValues).toEqual({ input: 5, expected: 25 });
    });

    it('should parse data-driven test with semicolon separators from DataDrivenSpec', () => {
      const filePath = path.join(sampleProjectPath, 'DataDrivenSpec.groovy');
      const content = fs.readFileSync(filePath, 'utf8');
      const result = TestDiscoveryService.parseTestsInFile(content);
      
      expect(result).toHaveLength(1);
      
      // Find the "should add numbers correctly" test method
      const addTest = result[0].methods.find(m => m.name === 'should add numbers correctly');
      expect(addTest).toBeDefined();
      expect(addTest!.isDataDriven).toBeTruthy();
      expect(addTest!.dataIterations).toHaveLength(3);
      
      expect(addTest!.dataIterations![0].dataValues).toEqual({ x: 1, y: 2, result: 3 });
      expect(addTest!.dataIterations![1].dataValues).toEqual({ x: 5, y: 3, result: 8 });
      expect(addTest!.dataIterations![2].dataValues).toEqual({ x: 10, y: 15, result: 25 });
    });

    it('should parse data-driven test with placeholders in method name from DataDrivenSpec', () => {
      const filePath = path.join(sampleProjectPath, 'DataDrivenSpec.groovy');
      const content = fs.readFileSync(filePath, 'utf8');
      const result = TestDiscoveryService.parseTestsInFile(content);
      
      expect(result).toHaveLength(1);
      
      // Find the "maximum of #a and #b is #c" test method
      const placeholderTest = result[0].methods.find(m => m.name === 'maximum of #a and #b is #c');
      expect(placeholderTest).toBeDefined();
      expect(placeholderTest!.isDataDriven).toBeTruthy();
      expect(placeholderTest!.dataIterations).toHaveLength(3);
      
      expect(placeholderTest!.dataIterations![0].displayName).toBe('maximum of 1 and 3 is 3');
      expect(placeholderTest!.dataIterations![1].displayName).toBe('maximum of 7 and 4 is 7');
      expect(placeholderTest!.dataIterations![2].displayName).toBe('maximum of 0 and 0 is 0');
    });

    it('should parse data-driven test with complex placeholders from DataDrivenSpec', () => {
      const filePath = path.join(sampleProjectPath, 'DataDrivenSpec.groovy');
      const content = fs.readFileSync(filePath, 'utf8');
      const result = TestDiscoveryService.parseTestsInFile(content);
      
      expect(result).toHaveLength(1);
      
      // Find the "#person.name is #person.age years old" test method
      const complexPlaceholderTest = result[0].methods.find(m => m.name === '#person.name is #person.age years old');
      expect(complexPlaceholderTest).toBeDefined();
      expect(complexPlaceholderTest!.isDataDriven).toBeTruthy();
      expect(complexPlaceholderTest!.dataIterations).toHaveLength(3);
      
      // For data pipes, we create iterations with the parsed data
      expect(complexPlaceholderTest!.dataIterations![0].dataValues).toEqual({ 
        person: { name: "Alice", age: 25 }
      });
      expect(complexPlaceholderTest!.dataIterations![1].dataValues).toEqual({ 
        person: { name: "Bob", age: 30 }
      });
      expect(complexPlaceholderTest!.dataIterations![2].dataValues).toEqual({ 
        person: { name: "Charlie", age: 35 }
      });
    });

    it('should parse single column data table from DataDrivenSpec', () => {
      const filePath = path.join(sampleProjectPath, 'DataDrivenSpec.groovy');
      const content = fs.readFileSync(filePath, 'utf8');
      const result = TestDiscoveryService.parseTestsInFile(content);
      
      expect(result).toHaveLength(1);
      
      // Find the "should validate positive numbers" test method
      const singleColumnTest = result[0].methods.find(m => m.name === 'should validate positive numbers');
      expect(singleColumnTest).toBeDefined();
      expect(singleColumnTest!.isDataDriven).toBeTruthy();
      expect(singleColumnTest!.dataIterations).toHaveLength(3);
      
      expect(singleColumnTest!.dataIterations![0].dataValues).toEqual({ number: 1 });
      expect(singleColumnTest!.dataIterations![1].dataValues).toEqual({ number: 5 });
      expect(singleColumnTest!.dataIterations![2].dataValues).toEqual({ number: 10 });
    });

    it('should parse UserServiceSpec with regular test methods', () => {
      const filePath = path.join(sampleProjectPath, 'UserServiceSpec.groovy');
      const content = fs.readFileSync(filePath, 'utf8');
      const result = TestDiscoveryService.parseTestsInFile(content);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('UserServiceSpec');
      expect(result[0].methods).toHaveLength(5);
      
      // All methods should be regular (not data-driven)
      result[0].methods.forEach(method => {
        expect(method.isDataDriven).toBeFalsy();
      });
      
      expect(result[0].methods[0].name).toBe('should create user with valid data');
      expect(result[0].methods[1].name).toBe('should throw exception for invalid email');
      expect(result[0].methods[2].name).toBe('should throw exception for empty name');
      expect(result[0].methods[3].name).toBe('should find user by id');
      expect(result[0].methods[4].name).toBe('should return null for non-existent user');
    });

    it('should comprehensively parse DataDrivenSpec with all test variants', () => {
      const filePath = path.join(sampleProjectPath, 'DataDrivenSpec.groovy');
      const content = fs.readFileSync(filePath, 'utf8');
      const result = TestDiscoveryService.parseTestsInFile(content);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('DataDrivenSpec');
      
      // Should have 15 test methods as defined in the file
      expect(result[0].methods).toHaveLength(15);
      
      // Count data-driven vs regular tests
      const dataDrivenTests = result[0].methods.filter(m => m.isDataDriven);
      const regularTests = result[0].methods.filter(m => !m.isDataDriven);
      
      expect(dataDrivenTests).toHaveLength(15); // All tests in DataDrivenSpec are data-driven
      expect(regularTests).toHaveLength(0);
      
      // Verify specific test methods exist
      const testNames = result[0].methods.map(m => m.name);
      expect(testNames).toContain('maximum of two numbers');
      expect(testNames).toContain('should calculate square of number');
      expect(testNames).toContain('should add numbers correctly');
      expect(testNames).toContain('should handle multiple operations');
      expect(testNames).toContain('should validate positive numbers');
      expect(testNames).toContain('maximum of #a and #b is #c');
      expect(testNames).toContain('#person.name is #person.age years old');
      expect(testNames).toContain('should validate email format');
      expect(testNames).toContain('should calculate area');
      expect(testNames).toContain('should validate even numbers');
      expect(testNames).toContain('should combine data from multiple sources');
      expect(testNames).toContain('should validate ranges');
      expect(testNames).toContain('addition test');
      expect(testNames).toContain('should multiply numbers');
      expect(testNames).toContain('should validate user data');
    });

    it('should parse mixed separators from DataDrivenSpec', () => {
      const filePath = path.join(sampleProjectPath, 'DataDrivenSpec.groovy');
      const content = fs.readFileSync(filePath, 'utf8');
      const result = TestDiscoveryService.parseTestsInFile(content);
      
      expect(result).toHaveLength(1);
      
      // Find the "should handle multiple operations" test method
      const mixedTest = result[0].methods.find(m => m.name === 'should handle multiple operations');
      expect(mixedTest).toBeDefined();
      expect(mixedTest!.isDataDriven).toBeTruthy();
      expect(mixedTest!.dataIterations!.length).toBeGreaterThan(0);
      
      // This test has mixed separators and should have multiple iterations
      expect(mixedTest!.dataIterations!.length).toBeGreaterThan(2);
    });

    it('should parse data table with different value types from DataDrivenSpec', () => {
      const filePath = path.join(sampleProjectPath, 'DataDrivenSpec.groovy');
      const content = fs.readFileSync(filePath, 'utf8');
      const result = TestDiscoveryService.parseTestsInFile(content);
      
      expect(result).toHaveLength(1);
      
      // Find the "should validate user data" test method which has different value types
      const typeTest = result[0].methods.find(m => m.name === 'should validate user data');
      expect(typeTest).toBeDefined();
      expect(typeTest!.isDataDriven).toBeTruthy();
      expect(typeTest!.dataIterations).toHaveLength(4);
      
      // Check that it has different value types (strings, numbers, booleans)
      const firstIteration = typeTest!.dataIterations![0];
      expect(firstIteration.dataValues).toHaveProperty('name');
      expect(firstIteration.dataValues).toHaveProperty('email');
      expect(firstIteration.dataValues).toHaveProperty('age');
      expect(firstIteration.dataValues).toHaveProperty('isValid');
    });

    it('should handle mixed regular and data-driven tests from sample files', () => {
      // Test CalculatorSpec (all regular tests)
      const calculatorPath = path.join(sampleProjectPath, 'CalculatorSpec.groovy');
      const calculatorContent = fs.readFileSync(calculatorPath, 'utf8');
      const calculatorResult = TestDiscoveryService.parseTestsInFile(calculatorContent);
      
      expect(calculatorResult).toHaveLength(1);
      expect(calculatorResult[0].methods).toHaveLength(6);
      
      // All CalculatorSpec methods should be regular (not data-driven)
      calculatorResult[0].methods.forEach(method => {
        expect(method.isDataDriven).toBeFalsy();
      });
      
      // Test DataDrivenSpec (all data-driven tests)
      const dataDrivenPath = path.join(sampleProjectPath, 'DataDrivenSpec.groovy');
      const dataDrivenContent = fs.readFileSync(dataDrivenPath, 'utf8');
      const dataDrivenResult = TestDiscoveryService.parseTestsInFile(dataDrivenContent);
      
      expect(dataDrivenResult).toHaveLength(1);
      expect(dataDrivenResult[0].methods).toHaveLength(15);
      
      // All DataDrivenSpec methods should be data-driven
      dataDrivenResult[0].methods.forEach(method => {
        expect(method.isDataDriven).toBeTruthy();
      });
    });

    it('should handle empty files', () => {
      const result = TestDiscoveryService.parseTestsInFile('');
      expect(result).toHaveLength(0);
    });

    it('should handle files with no test classes', () => {
      const content = `
package com.example

class RegularClass {
    def method() {
        return "hello"
    }
}`;
      const result = TestDiscoveryService.parseTestsInFile(content);
      expect(result).toHaveLength(0);
    });

    it('should handle files with only comments', () => {
      const content = `
// This is a comment
/* 
 * Multi-line comment
 */
package com.example
`;
      const result = TestDiscoveryService.parseTestsInFile(content);
      expect(result).toHaveLength(0);
    });

    it('should handle abstract classes', () => {
      const content = `
package com.example

import spock.lang.Specification

abstract class AbstractSpec extends Specification {
    def "abstract test"() {
        expect:
        true
    }
}`;
      const result = TestDiscoveryService.parseTestsInFile(content);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('AbstractSpec');
      expect(result[0].methods).toHaveLength(1);
      expect(result[0].methods[0].name).toBe('abstract test');
    });

    it('should handle nested classes (only parse top-level)', () => {
      const content = `
package com.example

import spock.lang.Specification

class OuterSpec extends Specification {
    def "outer test"() {
        expect:
        true
    }
    
    class InnerSpec extends Specification {
        def "inner test"(int x) {
            expect:
            x > 0

            where:
            x
            1
            2
        }
    }
}`;
      const result = TestDiscoveryService.parseTestsInFile(content);
      
      // Should only parse the outer class, not nested classes
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('OuterSpec');
      expect(result[0].methods).toHaveLength(1);
      expect(result[0].methods[0].name).toBe('outer test');
    });

    it('should handle malformed Groovy syntax gracefully', () => {
      const content = `
package com.example

import spock.lang.Specification

class MalformedSpec extends Specification {
    def "test with unclosed brace"() {
        expect:
        true
        // Missing closing brace
}`;
      const result = TestDiscoveryService.parseTestsInFile(content);
      
      // Should still parse what it can
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('MalformedSpec');
    });

    it('should handle test methods with complex signatures', () => {
      const content = `
package com.example

import spock.lang.Specification

class ComplexSpec extends Specification {
    def "test with complex signature"(String name, int age, boolean active) {
        expect:
        name.length() > 0 && age > 0

        where:
        name | age | active
        "John" | 25 | true
        "Jane" | 30 | false
    }
    
    def "test with no parameters"() {
        expect:
        true
    }
}`;
      const result = TestDiscoveryService.parseTestsInFile(content);
      
      expect(result).toHaveLength(1);
      expect(result[0].methods).toHaveLength(2);
      
      const dataDrivenTest = result[0].methods.find(m => m.name === 'test with complex signature');
      expect(dataDrivenTest).toBeDefined();
      expect(dataDrivenTest!.isDataDriven).toBeTruthy();
      
      const regularTest = result[0].methods.find(m => m.name === 'test with no parameters');
      expect(regularTest).toBeDefined();
      expect(regularTest!.isDataDriven).toBeFalsy();
    });

    it('should handle @Unroll annotations', () => {
      const content = `
package com.example

import spock.lang.Specification
import spock.lang.Unroll

class UnrollSpec extends Specification {
    @Unroll("#featureName[#iterationIndex] (#a + #b = #c)")
    def "addition test"() {
        expect:
        a + b == c

        where:
        a | b | c
        1 | 2 | 3
        4 | 5 | 9
    }
}`;
      const result = TestDiscoveryService.parseTestsInFile(content);
      
      expect(result).toHaveLength(1);
      const testMethod = result[0].methods[0];
      expect(testMethod.name).toBe('addition test');
      expect(testMethod.isDataDriven).toBeTruthy();
      expect(testMethod.dataIterations).toHaveLength(2);
    });

  });

  describe('Utility Functions', () => {
    describe('parseValue', () => {
      it('should parse integers', () => {
        const service = TestDiscoveryService as any;
        expect(service.parseValue('123')).toBe(123);
        expect(service.parseValue('0')).toBe(0);
        expect(service.parseValue('-456')).toBe(-456);
      });

      it('should parse floats', () => {
        const service = TestDiscoveryService as any;
        expect(service.parseValue('123.45')).toBe(123.45);
        expect(service.parseValue('0.0')).toBe(0.0);
        expect(service.parseValue('-78.9')).toBe(-78.9);
      });

      it('should parse booleans', () => {
        const service = TestDiscoveryService as any;
        expect(service.parseValue('true')).toBe(true);
        expect(service.parseValue('false')).toBe(false);
      });

      it('should parse null', () => {
        const service = TestDiscoveryService as any;
        expect(service.parseValue('null')).toBe(null);
      });

      it('should remove quotes from strings', () => {
        const service = TestDiscoveryService as any;
        expect(service.parseValue('"hello"')).toBe('hello');
        expect(service.parseValue("'world'")).toBe('world');
      });

      it('should return string as-is for unquoted text', () => {
        const service = TestDiscoveryService as any;
        expect(service.parseValue('hello')).toBe('hello');
        expect(service.parseValue('test123')).toBe('test123');
      });
    });

    describe('generateDisplayName', () => {
      it('should replace placeholders in method name', () => {
        const service = TestDiscoveryService as any;
        const methodName = 'maximum of #a and #b is #c';
        const dataValues = { a: 1, b: 3, c: 3 };
        
        const result = service.generateDisplayName(methodName, dataValues);
        expect(result).toBe('maximum of 1 and 3 is 3');
      });

      it('should generate display name from data values when no placeholders', () => {
        const service = TestDiscoveryService as any;
        const methodName = 'test method';
        const dataValues = { x: 1, y: 2, z: 3 };
        
        const result = service.generateDisplayName(methodName, dataValues);
        expect(result).toBe('test method [x: 1, y: 2, z: 3]');
      });
    });

    describe('parseDataTableRow', () => {
      it('should parse pipe-separated rows', () => {
        const service = TestDiscoveryService as any;
        const result = service.parseDataTableRow('a | b | c');
        expect(result).toEqual(['a', 'b', 'c']);
      });

      it('should parse semicolon-separated rows', () => {
        const service = TestDiscoveryService as any;
        const result = service.parseDataTableRow('a ; b ; c');
        expect(result).toEqual(['a', 'b', 'c']);
      });

      it('should handle empty rows', () => {
        const service = TestDiscoveryService as any;
        const result = service.parseDataTableRow('');
        expect(result).toEqual([]);
      });

      it('should handle rows with extra whitespace', () => {
        const service = TestDiscoveryService as any;
        const result = service.parseDataTableRow('  a  |  b  |  c  ');
        expect(result).toEqual(['a', 'b', 'c']);
      });
    });

    describe('countBraceDelta', () => {
      it('should count opening braces', () => {
        const service = TestDiscoveryService as any;
        expect(service.countBraceDelta('{')).toBe(1);
        expect(service.countBraceDelta('class Test {')).toBe(1);
        expect(service.countBraceDelta('def method() {')).toBe(1);
      });

      it('should count closing braces', () => {
        const service = TestDiscoveryService as any;
        expect(service.countBraceDelta('}')).toBe(-1);
        expect(service.countBraceDelta('    }')).toBe(-1);
        expect(service.countBraceDelta('} // comment')).toBe(-1);
      });

      it('should handle balanced braces', () => {
        const service = TestDiscoveryService as any;
        expect(service.countBraceDelta('{}')).toBe(0);
        expect(service.countBraceDelta('class Test {}')).toBe(0);
      });

      it('should handle no braces', () => {
        const service = TestDiscoveryService as any;
        expect(service.countBraceDelta('def method()')).toBe(0);
        expect(service.countBraceDelta('// comment')).toBe(0);
        expect(service.countBraceDelta('')).toBe(0);
      });
    });

    describe('hasOpeningBraceOnOrNextLine', () => {
      it('should detect opening brace on same line', () => {
        const service = TestDiscoveryService as any;
        const lines = ['def method() {', '    expect:', '        true', '}'];
        expect(service.hasOpeningBraceOnOrNextLine(lines, 0)).toBe(true);
      });

      it('should detect opening brace on next line', () => {
        const service = TestDiscoveryService as any;
        const lines = ['def method()', '{', '    expect:', '        true', '}'];
        expect(service.hasOpeningBraceOnOrNextLine(lines, 0)).toBe(true);
      });

      it('should not detect opening brace when not present', () => {
        const service = TestDiscoveryService as any;
        const lines = ['def method()', '    expect:', '        true'];
        expect(service.hasOpeningBraceOnOrNextLine(lines, 0)).toBe(false);
      });

      it('should handle comments on same line', () => {
        const service = TestDiscoveryService as any;
        const lines = ['def method() { // comment', '    expect:', '        true', '}'];
        expect(service.hasOpeningBraceOnOrNextLine(lines, 0)).toBe(true);
      });
    });

    describe('lineHasSpockBlockLabelNearby', () => {
      it('should detect Spock block labels', () => {
        const service = TestDiscoveryService as any;
        const lines = ['def method() {', '    given:', '        setup', '    when:', '        action', '    then:', '        result', '}'];
        expect(service.lineHasSpockBlockLabelNearby(lines, 0)).toBe(true);
      });

      it('should detect expect blocks', () => {
        const service = TestDiscoveryService as any;
        const lines = ['def method() {', '    expect:', '        true', '}'];
        expect(service.lineHasSpockBlockLabelNearby(lines, 0)).toBe(true);
      });

      it('should not detect non-Spock content', () => {
        const service = TestDiscoveryService as any;
        const lines = ['def method() {', '    regular code', '    more code', '}'];
        expect(service.lineHasSpockBlockLabelNearby(lines, 0)).toBe(false);
      });

      it('should handle where blocks', () => {
        const service = TestDiscoveryService as any;
        const lines = ['def method() {', '    where:', '        x | y', '        1 | 2', '}'];
        expect(service.lineHasSpockBlockLabelNearby(lines, 0)).toBe(true);
      });
    });
  });
});
