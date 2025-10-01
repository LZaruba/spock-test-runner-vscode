import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { TestIterationResult } from '../types';

export class TestResultParser {
  private logger: vscode.OutputChannel;

  constructor(logger: vscode.OutputChannel) {
    this.logger = logger;
  }

  /**
   * Parse console output to extract individual iteration results
   */
  parseConsoleOutput(output: string, testName: string): TestIterationResult[] {
    const results: TestIterationResult[] = [];
    const lines = output.split('\n');

    this.logger.appendLine(`TestResultParser: Parsing console output for test: ${testName}`);

    for (const line of lines) {
      // Look for Gradle test iteration patterns like:
      // "DataDrivenSpec > maximum of two numbers > maximum of two numbers [a: 1, b: 3, c: 3, #0] PASSED"
      // "DataDrivenSpec > should calculate square of number > should calculate square of number [input: 2, expected: 4, #0] PASSED"
      const iterationMatch = line.match(new RegExp(`^.*>\\s*${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\[([^\\]]+),\\s*#(\\d+)\\]\\s*(PASSED|FAILED|SKIPPED)`));
      
      if (iterationMatch) {
        const parametersString = iterationMatch[1];
        const index = parseInt(iterationMatch[2]);
        const status = iterationMatch[3];
        
        // Parse parameters from the string like "a: 1, b: 3, c: 3"
        const parameters = this.parseParameters(parametersString);
        
        // Determine success based on status
        const success = status === 'PASSED';
        
        // Extract duration if available (not present in this format)
        const duration = 0;

        const result: TestIterationResult = {
          index,
          displayName: `${testName} [${parametersString}, #${index}]`,
          parameters,
          success,
          duration,
          output: line.trim(),
          errorInfo: success ? undefined : { error: `Iteration ${index} ${status}` }
        };

        results.push(result);
        this.logger.appendLine(`TestResultParser: Found iteration #${index}: ${success ? 'PASSED' : 'FAILED'}`);
      }
    }

    this.logger.appendLine(`TestResultParser: Parsed ${results.length} iterations from console output`);
    return results;
  }

  /**
   * Parse XML test report to extract iteration results
   */
  async parseXmlReport(workspacePath: string, className: string): Promise<TestIterationResult[]> {
    const results: TestIterationResult[] = [];
    const xmlPath = path.join(workspacePath, 'build', 'test-results', 'test', `TEST-${className}.xml`);

    try {
      if (!fs.existsSync(xmlPath)) {
        this.logger.appendLine(`TestResultParser: XML report not found at ${xmlPath}`);
        return results;
      }

      const xmlContent = fs.readFileSync(xmlPath, 'utf8');
      this.logger.appendLine(`TestResultParser: Parsing XML report: ${xmlPath}`);

      // Parse XML to extract testcase elements
      const testcaseRegex = /<testcase\s+name="([^"]+)"[^>]*classname="([^"]+)"[^>]*time="([^"]*)"[^>]*>/g;
      let match;

      while ((match = testcaseRegex.exec(xmlContent)) !== null) {
        const fullName = match[1];
        const testClassName = match[2];
        const time = parseFloat(match[3] || '0');

        // Check if this is an iteration (contains parameter values and index)
        const iterationMatch = fullName.match(/^(.+?)\s*\[([^\]]+),\s*#(\d+)\]$/);
        
        if (iterationMatch) {
          const baseTestName = iterationMatch[1];
          const parametersString = iterationMatch[2];
          const index = parseInt(iterationMatch[3]);
          
          const parameters = this.parseParameters(parametersString);
          
          // Check for failure/error in the XML
          const failureMatch = xmlContent.match(new RegExp(`<testcase[^>]*name="${fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>\\s*<failure[^>]*>([^<]*)</failure>`));
          const errorMatch = xmlContent.match(new RegExp(`<testcase[^>]*name="${fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>\\s*<error[^>]*>([^<]*)</error>`));
          
          const success = !failureMatch && !errorMatch;
          const errorInfo = failureMatch ? { error: failureMatch[1] } : 
                           errorMatch ? { error: errorMatch[1] } : undefined;

          const result: TestIterationResult = {
            index,
            displayName: fullName,
            parameters,
            success,
            duration: time,
            errorInfo,
            output: fullName
          };

          results.push(result);
          this.logger.appendLine(`TestResultParser: Found XML iteration #${index}: ${success ? 'PASSED' : 'FAILED'}`);
        }
      }

      this.logger.appendLine(`TestResultParser: Parsed ${results.length} iterations from XML report`);
    } catch (error) {
      this.logger.appendLine(`TestResultParser: Error parsing XML report: ${error}`);
    }

    return results;
  }

  /**
   * Parse parameter string like "roll1: 3, roll2: 4, expectedScore: 7" into object
   */
  private parseParameters(parametersString: string): Record<string, any> {
    const parameters: Record<string, any> = {};
    
    // Split by comma and parse key-value pairs
    const pairs = parametersString.split(',').map(pair => pair.trim());
    
    for (const pair of pairs) {
      const colonIndex = pair.indexOf(':');
      if (colonIndex > 0) {
        const key = pair.substring(0, colonIndex).trim();
        const value = pair.substring(colonIndex + 1).trim();
        
        // Try to parse as number, boolean, or keep as string
        let parsedValue: any = value;
        if (value === 'true') {
          parsedValue = true;
        } else if (value === 'false') {
          parsedValue = false;
        } else if (!isNaN(Number(value)) && value !== '') {
          parsedValue = Number(value);
        } else if (value.startsWith('"') && value.endsWith('"')) {
          // Remove surrounding quotes from strings
          parsedValue = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          // Remove surrounding single quotes from strings
          parsedValue = value.slice(1, -1);
        }
        
        parameters[key] = parsedValue;
      }
    }
    
    return parameters;
  }

  /**
   * Extract iteration information from test name
   */
  extractIterationInfo(testName: string): { index: number; parameters: Record<string, any> } | null {
    const match = testName.match(/^(.+?)\s*\[([^\]]+),\s*#(\d+)\]$/);
    if (match) {
      const parametersString = match[2];
      const index = parseInt(match[3]);
      const parameters = this.parseParameters(parametersString);
      
      return { index, parameters };
    }
    return null;
  }

  /**
   * Combine console and XML results, preferring XML for accuracy
   */
  async parseTestResults(
    consoleOutput: string, 
    testName: string, 
    className: string, 
    workspacePath: string
  ): Promise<TestIterationResult[]> {
    this.logger.appendLine(`TestResultParser: Parsing results for ${className}.${testName}`);
    
    // Try XML first (more accurate)
    const xmlResults = await this.parseXmlReport(workspacePath, className);
    
    if (xmlResults.length > 0) {
      this.logger.appendLine(`TestResultParser: Using ${xmlResults.length} results from XML report`);
      return xmlResults;
    }
    
    // Fallback to console output
    const consoleResults = this.parseConsoleOutput(consoleOutput, testName);
    this.logger.appendLine(`TestResultParser: Using ${consoleResults.length} results from console output`);
    return consoleResults;
  }
}
