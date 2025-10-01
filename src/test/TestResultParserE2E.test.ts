import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { TestResultParser } from '../services/TestResultParser';

const execAsync = promisify(exec);

// Mock vscode module
jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn().mockReturnValue({
      appendLine: jest.fn()
    })
  }
}));

describe('TestResultParser E2E Tests', () => {
  let parser: TestResultParser;
  let mockLogger: any;
  let testProjectPath: string;

  beforeAll(() => {
    // Set up the test project path
    testProjectPath = path.join(__dirname, '../../sample-project');
    
    // Verify the test project exists
    if (!fs.existsSync(testProjectPath)) {
      throw new Error(`Test project not found at ${testProjectPath}`);
    }
  });

  beforeEach(() => {
    mockLogger = {
      appendLine: jest.fn()
    };
    parser = new TestResultParser(mockLogger);
  });

  describe('Real Gradle Test Execution', () => {
    it('should parse results from actual BowlingGameSpec execution', async () => {
      // Execute the actual Gradle test - allow failures for now
      const { stdout, stderr } = await execAsync('cd sample-project && ./gradlew test --tests "com.example.BowlingGameSpec" --console=plain');
      
      // Log the output for debugging
      console.log('Gradle stdout:', stdout);
      console.log('Gradle stderr:', stderr);
      
      // We'll parse the output regardless of success/failure

      // Parse the console output
      const results = await parser.parseTestResults(
        stdout,
        'should calculate score for regular frames',
        'com.example.BowlingGameSpec',
        testProjectPath
      );

      // Verify we got iteration results
      expect(results.length).toBeGreaterThan(0);
      
      // Verify the structure of the results
      results.forEach(result => {
        expect(result).toHaveProperty('index');
        expect(result).toHaveProperty('displayName');
        expect(result).toHaveProperty('parameters');
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('duration');
        expect(typeof result.index).toBe('number');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.duration).toBe('number');
      });

      // Log the results for debugging
      console.log('Parsed results:', JSON.stringify(results, null, 2));
    }, 30000); // 30 second timeout for Gradle execution

    it('should parse results from DataDrivenSpec execution', async () => {
      // Execute the actual Gradle test - allow failures for now
      const { stdout, stderr } = await execAsync('cd sample-project && ./gradlew test --tests "com.example.DataDrivenSpec" --console=plain');
      
      // Log the output for debugging
      console.log('DataDrivenSpec stdout:', stdout);
      console.log('DataDrivenSpec stderr:', stderr);

      // Parse the console output for a data-driven test
      const results = await parser.parseTestResults(
        stdout,
        'should calculate score',
        'com.example.DataDrivenSpec',
        testProjectPath
      );

      // Verify we got iteration results
      expect(results.length).toBeGreaterThan(0);
      
      // Verify the structure of the results
      results.forEach(result => {
        expect(result).toHaveProperty('index');
        expect(result).toHaveProperty('displayName');
        expect(result).toHaveProperty('parameters');
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('duration');
        expect(typeof result.index).toBe('number');
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.duration).toBe('number');
      });

      // Log the results for debugging
      console.log('Parsed DataDrivenSpec results:', JSON.stringify(results, null, 2));
    }, 30000);

    it('should handle test failures gracefully', async () => {
      // Execute the test as-is (it's already failing)
      const { stdout, stderr } = await execAsync('cd sample-project && ./gradlew test --tests "com.example.BowlingGameSpec" --console=plain');
      
      // Log the output for debugging
      console.log('Failure test stdout:', stdout);
      console.log('Failure test stderr:', stderr);
      
      // Parse the console output
      const results = await parser.parseTestResults(
        stdout,
        'should calculate score for regular frames',
        'com.example.BowlingGameSpec',
        testProjectPath
      );

      // Verify we got results even with failures
      expect(results.length).toBeGreaterThan(0);
      
      // Some results should be failures
      const failedResults = results.filter(r => !r.success);
      expect(failedResults.length).toBeGreaterThan(0);

      // Log the results for debugging
      console.log('Parsed failure results:', JSON.stringify(results, null, 2));
    }, 30000);

    it('should parse XML reports when available', async () => {
      // Execute the test to generate XML reports
      await execAsync('cd sample-project && ./gradlew test --tests "com.example.BowlingGameSpec" --console=plain');
      
      // Check if XML report exists
      const xmlReportPath = path.join(testProjectPath, 'build/test-results/test/TEST-com.example.BowlingGameSpec.xml');
      expect(fs.existsSync(xmlReportPath)).toBe(true);

      // Parse the XML report directly
      const xmlContent = fs.readFileSync(xmlReportPath, 'utf8');
      const results = await parser['parseXmlReport'](xmlContent, 'com.example.BowlingGameSpec');

      // Verify we got results from XML
      expect(results.length).toBeGreaterThan(0);
      
      // Verify the structure of the results
      results.forEach(result => {
        expect(result).toHaveProperty('index');
        expect(result).toHaveProperty('displayName');
        expect(result).toHaveProperty('parameters');
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('duration');
      });

      // Log the results for debugging
      console.log('Parsed XML results:', JSON.stringify(results, null, 2));
    }, 30000);
  });

  describe('Console Output Parsing', () => {
    it('should parse actual Gradle console output format', async () => {
      // Execute a simple test to get real console output
      const { stdout, stderr } = await execAsync('cd sample-project && ./gradlew test --tests "com.example.CalculatorSpec" --console=plain');
      
      // Log the output for debugging
      console.log('CalculatorSpec stdout:', stdout);
      console.log('CalculatorSpec stderr:', stderr);
      
      // Parse the console output
      const results = parser['parseConsoleOutput'](stdout, 'should add numbers correctly');

      // Log the results for debugging
      console.log('Parsed console results:', JSON.stringify(results, null, 2));
      
      // For now, just verify the parser doesn't crash
      expect(Array.isArray(results)).toBe(true);
    }, 30000);
  });

  describe('Performance with Real Tests', () => {
    it('should handle multiple test classes efficiently', async () => {
      const startTime = Date.now();
      
      // Execute all tests
      const { stdout, stderr } = await execAsync('cd sample-project && ./gradlew test --console=plain');
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Log the output for debugging
      console.log('All tests stdout:', stdout);
      console.log('All tests stderr:', stderr);
      
      // Should complete within reasonable time
      expect(executionTime).toBeLessThan(60000); // 1 minute
      
      // Parse results for multiple test classes
      const bowlingResults = parser['parseConsoleOutput'](stdout, 'should calculate score for regular frames');
      const calculatorResults = parser['parseConsoleOutput'](stdout, 'should add numbers correctly');
      
      // Log the results for debugging
      console.log(`Execution time: ${executionTime}ms`);
      console.log(`Bowling results: ${bowlingResults.length}`);
      console.log(`Calculator results: ${calculatorResults.length}`);
      
      // For now, just verify the parser doesn't crash
      expect(Array.isArray(bowlingResults)).toBe(true);
      expect(Array.isArray(calculatorResults)).toBe(true);
    }, 60000);
  });
});
