import * as fs from 'fs';
import { TestResultParser } from '../services/TestResultParser';

// Mock vscode module
jest.mock('vscode', () => ({
  OutputChannel: jest.fn().mockImplementation(() => ({
    appendLine: jest.fn()
  })),
  window: {
    createOutputChannel: jest.fn().mockReturnValue({
      appendLine: jest.fn()
    })
  }
}));

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}));

describe('TestResultParser', () => {
  let parser: TestResultParser;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      appendLine: jest.fn()
    };
    parser = new TestResultParser(mockLogger);
  });

  describe('parseConsoleOutput', () => {
    it('should parse console output with iteration results', () => {
      const output = `
        > Task :test
        com.example.DataDrivenSpec > should calculate score for regular frames [roll1: 3, roll2: 4, expectedScore: 7, #0] PASSED
        com.example.DataDrivenSpec > should calculate score for regular frames [roll1: 5, roll2: 2, expectedScore: 7, #1] PASSED
        com.example.DataDrivenSpec > should calculate score for regular frames [roll1: 0, roll2: 0, expectedScore: 0, #2] FAILED
        com.example.DataDrivenSpec > should calculate score for regular frames [roll1: 9, roll2: 1, expectedScore: 10, #3] PASSED
      `;

      const results = parser.parseConsoleOutput(output, 'should calculate score for regular frames');

      expect(results).toHaveLength(4);
      expect(results[0]).toEqual({
        index: 0,
        displayName: 'should calculate score for regular frames [roll1: 3, roll2: 4, expectedScore: 7, #0]',
        parameters: { roll1: 3, roll2: 4, expectedScore: 7 },
        success: true,
        duration: 0,
        output: 'com.example.DataDrivenSpec > should calculate score for regular frames [roll1: 3, roll2: 4, expectedScore: 7, #0] PASSED'
      });
      expect(results[2]).toEqual({
        index: 2,
        displayName: 'should calculate score for regular frames [roll1: 0, roll2: 0, expectedScore: 0, #2]',
        parameters: { roll1: 0, roll2: 0, expectedScore: 0 },
        success: false,
        duration: 0,
        output: 'com.example.DataDrivenSpec > should calculate score for regular frames [roll1: 0, roll2: 0, expectedScore: 0, #2] FAILED',
        errorInfo: { error: 'Iteration 2 FAILED' }
      });
    });

    it('should handle different parameter types', () => {
      const output = `
        com.example.DataDrivenSpec > should validate user data [name: "John", email: "john@test.com", age: 25, isValid: true, #0] PASSED
        com.example.DataDrivenSpec > should validate user data [name: "", email: "invalid@test.com", age: 25, isValid: false, #1] PASSED
      `;

      const results = parser.parseConsoleOutput(output, 'should validate user data');

      expect(results).toHaveLength(2);
      expect(results[0].parameters).toEqual({
        name: 'John',
        email: 'john@test.com',
        age: 25,
        isValid: true
      });
      expect(results[1].parameters).toEqual({
        name: '',
        email: 'invalid@test.com',
        age: 25,
        isValid: false
      });
    });

    it('should return empty array for no iteration results', () => {
      const output = 'Some regular test output without iterations';
      const results = parser.parseConsoleOutput(output, 'some test');
      expect(results).toHaveLength(0);
    });
  });

  describe('parseParameters', () => {
    it('should parse simple parameters', () => {
      const parameters = parser['parseParameters']('a: 1, b: 2, c: 3');
      expect(parameters).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('should parse string parameters', () => {
      const parameters = parser['parseParameters']('name: "John", email: "john@test.com"');
      expect(parameters).toEqual({ name: 'John', email: 'john@test.com' });
    });

    it('should parse boolean parameters', () => {
      const parameters = parser['parseParameters']('isValid: true, isActive: false');
      expect(parameters).toEqual({ isValid: true, isActive: false });
    });

    it('should handle empty parameter string', () => {
      const parameters = parser['parseParameters']('');
      expect(parameters).toEqual({});
    });
  });

  describe('extractIterationInfo', () => {
    it('should extract iteration info from test name', () => {
      const info = parser.extractIterationInfo('should calculate score [roll1: 3, roll2: 4, expectedScore: 7, #0]');
      
      expect(info).toEqual({
        index: 0,
        parameters: { roll1: 3, roll2: 4, expectedScore: 7 }
      });
    });

    it('should return null for non-iteration test names', () => {
      const info = parser.extractIterationInfo('should calculate score');
      expect(info).toBeNull();
    });
  });

  describe('parseXmlReport', () => {
    beforeEach(() => {
      // Mock fs module
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(`
        <?xml version="1.0" encoding="UTF-8"?>
        <testsuite name="com.example.DataDrivenSpec" tests="3" skipped="0" failures="1" errors="0">
          <testcase name="should calculate score [roll1: 3, roll2: 4, expectedScore: 4, #0]" classname="com.example.DataDrivenSpec" time="0.009"/>
          <testcase name="should calculate score [roll1: 5, roll2: 2, expectedScore: 5, #1]" classname="com.example.DataDrivenSpec" time="0.001"/>
          <testcase name="should calculate score [roll1: 0, roll2: 0, expectedScore: 0, #2]" classname="com.example.DataDrivenSpec" time="0.002">
            <failure message="Expected 0 but was 1">Assertion failed</failure>
          </testcase>
        </testsuite>
      `);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should parse XML report with iteration results', async () => {
      const results = await parser.parseXmlReport('/test/workspace', 'com.example.DataDrivenSpec');

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        index: 0,
        displayName: 'should calculate score [roll1: 3, roll2: 4, expectedScore: 4, #0]',
        parameters: { roll1: 3, roll2: 4, expectedScore: 4 },
        success: true,
        duration: 0.009,
        output: 'should calculate score [roll1: 3, roll2: 4, expectedScore: 4, #0]'
      });
      expect(results[2]).toEqual({
        index: 2,
        displayName: 'should calculate score [roll1: 0, roll2: 0, expectedScore: 0, #2]',
        parameters: { roll1: 0, roll2: 0, expectedScore: 0 },
        success: false,
        duration: 0.002,
        errorInfo: { error: 'Assertion failed' },
        output: 'should calculate score [roll1: 0, roll2: 0, expectedScore: 0, #2]'
      });
    });

    it('should return empty array when XML file does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const results = await parser.parseXmlReport('/test/workspace', 'com.example.DataDrivenSpec');

      expect(results).toHaveLength(0);
    });

    it('should handle XML parsing errors gracefully', async () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid XML');
      });

      const results = await parser.parseXmlReport('/test/workspace', 'com.example.DataDrivenSpec');

      expect(results).toHaveLength(0);
    });
  });

  describe('parseTestResults', () => {
    beforeEach(() => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(`
        <?xml version="1.0" encoding="UTF-8"?>
        <testsuite name="com.example.DataDrivenSpec" tests="2">
          <testcase name="should calculate score [roll1: 3, roll2: 4, expectedScore: 4, #0]" classname="com.example.DataDrivenSpec" time="0.009"/>
          <testcase name="should calculate score [roll1: 5, roll2: 2, expectedScore: 5, #1]" classname="com.example.DataDrivenSpec" time="0.001"/>
        </testsuite>
      `);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should prefer XML results over console output', async () => {
      const consoleOutput = 'Some console output';
      const results = await parser.parseTestResults(
        consoleOutput,
        'should calculate score',
        'com.example.DataDrivenSpec',
        '/test/workspace'
      );

      expect(results).toHaveLength(2);
      expect(results[0].parameters).toEqual({ roll1: 3, roll2: 4, expectedScore: 4 });
      expect(results[1].parameters).toEqual({ roll1: 5, roll2: 2, expectedScore: 5 });
    });

    it('should fall back to console parsing when XML is not available', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const consoleOutput = `
        com.example.DataDrivenSpec > should calculate score [roll1: 3, roll2: 4, expectedScore: 4, #0] PASSED
        com.example.DataDrivenSpec > should calculate score [roll1: 5, roll2: 2, expectedScore: 5, #1] PASSED
      `;

      const results = await parser.parseTestResults(
        consoleOutput,
        'should calculate score',
        'com.example.DataDrivenSpec',
        '/test/workspace'
      );

      expect(results).toHaveLength(2);
      expect(results[0].parameters).toEqual({ roll1: 3, roll2: 4, expectedScore: 4 });
      expect(results[1].parameters).toEqual({ roll1: 5, roll2: 2, expectedScore: 5 });
    });
  });
});
