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

describe('TestResultParser with Real Gradle Output', () => {
  let parser: TestResultParser;
  let mockLogger: any;
  let testProjectPath: string;

  beforeAll(() => {
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

  describe('Real Gradle Output Analysis', () => {
    it('should analyze actual Gradle test output format', async () => {
      // Execute a simple test to get real console output
      const { stdout, stderr } = await execAsync('cd sample-project && ./gradlew test --tests "com.example.CalculatorSpec" --console=plain --continue');
      
      console.log('=== REAL GRADLE OUTPUT ===');
      console.log('STDOUT:');
      console.log(stdout);
      console.log('\nSTDERR:');
      console.log(stderr);
      console.log('=== END OUTPUT ===');

      // Analyze the output format
      const lines = stdout.split('\n');
      const testLines = lines.filter(line => 
        line.includes('com.example.CalculatorSpec') && 
        (line.includes('PASSED') || line.includes('FAILED') || line.includes('SKIPPED'))
      );

      console.log('\n=== TEST LINES ===');
      testLines.forEach((line, index) => {
        console.log(`${index}: ${line}`);
      });
      console.log('=== END TEST LINES ===');

      // Try to parse with different test method names
      const testMethods = [
        'should add numbers correctly',
        'should multiply numbers correctly',
        'should divide numbers correctly'
      ];

      for (const methodName of testMethods) {
        console.log(`\n=== PARSING METHOD: ${methodName} ===`);
        const results = parser['parseConsoleOutput'](stdout, methodName);
        console.log(`Results for ${methodName}:`, JSON.stringify(results, null, 2));
      }

      // This test is mainly for analysis, so we just verify it doesn't crash
      expect(Array.isArray(testLines)).toBe(true);
    }, 30000);

    it('should analyze data-driven test output format', async () => {
      // Execute a data-driven test
      const { stdout, stderr } = await execAsync('cd sample-project && ./gradlew test --tests "com.example.DataDrivenSpec" --console=plain --continue');
      
      console.log('=== DATA-DRIVEN TEST OUTPUT ===');
      console.log('STDOUT:');
      console.log(stdout);
      console.log('\nSTDERR:');
      console.log(stderr);
      console.log('=== END OUTPUT ===');

      // Look for data-driven test patterns
      const lines = stdout.split('\n');
      const dataDrivenLines = lines.filter(line => 
        line.includes('[') && line.includes(']') && 
        (line.includes('PASSED') || line.includes('FAILED') || line.includes('SKIPPED'))
      );

      console.log('\n=== DATA-DRIVEN LINES ===');
      dataDrivenLines.forEach((line, index) => {
        console.log(`${index}: ${line}`);
      });
      console.log('=== END DATA-DRIVEN LINES ===');

      // Try to parse with different data-driven method names
      const dataDrivenMethods = [
        'should calculate score',
        'should validate user data',
        'should handle multiple operations'
      ];

      for (const methodName of dataDrivenMethods) {
        console.log(`\n=== PARSING DATA-DRIVEN METHOD: ${methodName} ===`);
        const results = parser['parseConsoleOutput'](stdout, methodName);
        console.log(`Results for ${methodName}:`, JSON.stringify(results, null, 2));
      }

      // This test is mainly for analysis, so we just verify it doesn't crash
      expect(Array.isArray(dataDrivenLines)).toBe(true);
    }, 30000);

    it('should analyze XML report format', async () => {
      // Execute tests to generate XML reports (ignore failures)
      try {
        await execAsync('cd sample-project && ./gradlew test --console=plain --continue');
      } catch (error) {
        // Ignore build failures, we just want the XML reports
        console.log('Build failed but continuing to analyze XML reports...');
      }
      
      // Find XML report files
      const testResultsDir = path.join(testProjectPath, 'build/test-results/test');
      if (fs.existsSync(testResultsDir)) {
        const xmlFiles = fs.readdirSync(testResultsDir).filter(file => file.endsWith('.xml'));
        
        console.log('=== XML REPORT FILES ===');
        console.log('Found XML files:', xmlFiles);
        
        for (const xmlFile of xmlFiles.slice(0, 2)) { // Analyze first 2 files
          const xmlPath = path.join(testResultsDir, xmlFile);
          const xmlContent = fs.readFileSync(xmlPath, 'utf8');
          
          console.log(`\n=== XML CONTENT: ${xmlFile} ===`);
          console.log(xmlContent);
          console.log('=== END XML CONTENT ===');
          
          // Try to parse the XML
          const results = parser['parseXmlReport'](xmlContent, 'com.example.TestClass');
          console.log(`Parsed results from ${xmlFile}:`, JSON.stringify(results, null, 2));
        }
      }

      // This test is mainly for analysis, so we just verify it doesn't crash
      expect(true).toBe(true);
    }, 30000);
  });

  describe('Output Pattern Analysis', () => {
    it('should identify common Gradle output patterns', async () => {
      // Execute a test and analyze the output patterns
      const { stdout } = await execAsync('cd sample-project && ./gradlew test --tests "com.example.CalculatorSpec" --console=plain --continue');
      
      const lines = stdout.split('\n');
      
      // Look for different patterns
      const patterns = {
        taskStart: lines.filter(line => line.includes('> Task :test')),
        testResult: lines.filter(line => line.includes('PASSED') || line.includes('FAILED') || line.includes('SKIPPED')),
        testClass: lines.filter(line => line.includes('com.example.')),
        dataDriven: lines.filter(line => line.includes('[') && line.includes(']')),
        duration: lines.filter(line => line.includes('(') && line.includes('s)')),
        buildResult: lines.filter(line => line.includes('BUILD') || line.includes('FAILURE'))
      };

      console.log('=== OUTPUT PATTERNS ===');
      Object.entries(patterns).forEach(([name, matches]) => {
        console.log(`\n${name.toUpperCase()} (${matches.length} matches):`);
        matches.slice(0, 5).forEach((line, index) => {
          console.log(`  ${index + 1}: ${line}`);
        });
        if (matches.length > 5) {
          console.log(`  ... and ${matches.length - 5} more`);
        }
      });
      console.log('=== END PATTERNS ===');

      // Verify we found some patterns
      expect(patterns.taskStart.length).toBeGreaterThan(0);
      expect(patterns.testResult.length).toBeGreaterThan(0);
    }, 30000);
  });
});
