import { TestResultParser } from '../services/TestResultParser';
import { TestDataFactory } from './TestDataFactory';

describe('Parameterized Test Performance', () => {
  let parser: TestResultParser;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      appendLine: jest.fn()
    };
    parser = new TestResultParser(mockLogger);
  });

  describe('Large Dataset Handling', () => {
    it('should handle 1000 iterations efficiently', () => {
      const iterations = TestDataFactory.createIterationResults(1000);
      const consoleOutput = TestDataFactory.createConsoleOutput(iterations);
      
      const startTime = Date.now();
      const results = parser.parseConsoleOutput(consoleOutput, 'test method');
      const endTime = Date.now();
      
      expect(results).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle 10000 iterations without memory issues', () => {
      const iterations = TestDataFactory.createIterationResults(10000);
      const consoleOutput = TestDataFactory.createConsoleOutput(iterations);
      
      const startTime = Date.now();
      const results = parser.parseConsoleOutput(consoleOutput, 'test method');
      const endTime = Date.now();
      
      expect(results).toHaveLength(10000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory with repeated parsing', () => {
      const iterations = TestDataFactory.createIterationResults(100);
      const consoleOutput = TestDataFactory.createConsoleOutput(iterations);
      
      // Parse multiple times to check for memory leaks
      for (let i = 0; i < 100; i++) {
        const results = parser.parseConsoleOutput(consoleOutput, 'test method');
        expect(results).toHaveLength(100);
      }
    });
  });

  describe('Complex Parameter Types', () => {
    it('should handle complex parameter parsing efficiently', () => {
      const complexOutput = `
        com.example.TestClass > complex test [string: "very long string with special chars !@#$%^&*()", number: 12345.6789, boolean: true, null: null, #0] PASSED
        com.example.TestClass > complex test [string: "another very long string with special chars !@#$%^&*()", number: 98765.4321, boolean: false, null: null, #1] FAILED
      `;
      
      const startTime = Date.now();
      const results = parser.parseConsoleOutput(complexOutput, 'complex test');
      const endTime = Date.now();
      
      expect(results).toHaveLength(2);
      expect(results[0].parameters).toEqual({
        string: "very long string with special chars !@#$%^&*()",
        number: 12345.6789,
        boolean: true,
        null: "null" // null is parsed as string "null"
      });
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});
