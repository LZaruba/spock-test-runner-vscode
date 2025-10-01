import * as vscode from 'vscode';
import { TestIterationResult } from '../types';

export class TestDataFactory {
  static createMockTestItem(overrides: Partial<any> = {}): any {
    return {
      id: 'file://test/file.groovy#TestClass#testMethod',
      label: 'testMethod',
      uri: vscode.Uri.file('/test/file.groovy'),
      canResolveChildren: false,
      tags: [{ id: 'runnable' }],
      parent: undefined,
      busy: false,
      error: undefined,
      range: undefined,
      children: {
        add: jest.fn(),
        delete: jest.fn(),
        replace: jest.fn(),
        size: 0,
        forEach: jest.fn(),
        get: jest.fn(),
        [Symbol.iterator]: jest.fn()
      },
      ...overrides
    };
  }

  static createMockTestRun(): any {
    return {
      started: jest.fn(),
      passed: jest.fn(),
      failed: jest.fn(),
      skipped: jest.fn(),
      appendOutput: jest.fn(),
      end: jest.fn()
    };
  }

  static createMockTestController(): any {
    return {
      createTestItem: jest.fn().mockImplementation((id: string, label: string, uri: any) => 
        this.createMockTestItem({ id, label, uri })
      ),
      createRunProfile: jest.fn().mockReturnValue({
        dispose: jest.fn()
      }),
      createTestRun: jest.fn().mockReturnValue(this.createMockTestRun()),
      items: {
        get: jest.fn(),
        add: jest.fn(),
        delete: jest.fn(),
        forEach: jest.fn()
      }
    };
  }

  static createIterationResults(count: number = 3): TestIterationResult[] {
    return Array.from({ length: count }, (_, index) => ({
      index,
      displayName: `test method [param1: ${index}, param2: ${index * 2}, #${index}]`,
      parameters: { param1: index, param2: index * 2 },
      success: index !== 1, // Make second iteration fail
      duration: 0.001 * (index + 1),
      output: index !== 1 ? 'PASSED' : 'FAILED',
      errorInfo: index === 1 ? { error: 'Test failed' } : undefined
    }));
  }

  static createConsoleOutput(iterations: TestIterationResult[]): string {
    return iterations.map(iter => 
      `com.example.TestClass > ${iter.displayName} ${iter.success ? 'PASSED' : 'FAILED'}`
    ).join('\n');
  }

  static createXmlReport(iterations: TestIterationResult[], className: string): string {
    const testcases = iterations.map(iter => {
      const failure = iter.success ? '' : 
        `<failure message="${iter.errorInfo?.error || 'Test failed'}">Assertion failed</failure>`;
      return `  <testcase name="${iter.displayName}" classname="${className}" time="${iter.duration}">${failure}</testcase>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="${className}" tests="${iterations.length}" skipped="0" failures="${iterations.filter(i => !i.success).length}" errors="0">
${testcases}
</testsuite>`;
  }

  static createDataDrivenTestData(className: string = 'DataDrivenSpec', testName: string = 'should calculate score'): any {
    return {
      type: 'test',
      className,
      testName,
      isDataDriven: true
    };
  }

  static createRegularTestData(className: string = 'TestSpec', testName: string = 'should work'): any {
    return {
      type: 'test',
      className,
      testName,
      isDataDriven: false
    };
  }
}
