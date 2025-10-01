import * as fs from 'fs';
import * as vscode from 'vscode';
import { SpockTestController } from '../testController';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}));

// Mock vscode module
jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn().mockReturnValue({
      appendLine: jest.fn()
    })
  },
  workspace: {
    workspaceFolders: [
      {
        uri: {
          fsPath: '/test/workspace'
        }
      }
    ],
    findFiles: jest.fn(),
    createFileSystemWatcher: jest.fn().mockReturnValue({
      onDidCreate: jest.fn(),
      onDidChange: jest.fn(),
      onDidDelete: jest.fn()
    }),
    openTextDocument: jest.fn(),
    getWorkspaceFolder: jest.fn().mockReturnValue({
      uri: { fsPath: '/test/workspace' }
    })
  },
  tests: {
    createTestController: jest.fn().mockReturnValue({
      createTestItem: jest.fn().mockImplementation((id: string, label: string, uri: any) => ({
        id,
        label,
        uri,
        range: undefined,
        canResolveChildren: false,
        tags: [],
        parent: undefined,
        busy: false,
        error: undefined,
        children: {
          add: jest.fn(),
          delete: jest.fn(),
          replace: jest.fn(),
          size: 0,
          forEach: jest.fn(),
          get: jest.fn(),
          [Symbol.iterator]: jest.fn()
        }
      })),
      createRunProfile: jest.fn().mockReturnValue({
        dispose: jest.fn()
      }),
      createTestRun: jest.fn().mockReturnValue({
        started: jest.fn(),
        passed: jest.fn(),
        failed: jest.fn(),
        skipped: jest.fn(),
        appendOutput: jest.fn(),
        end: jest.fn()
      }),
      items: {
        get: jest.fn(),
        add: jest.fn(),
        delete: jest.fn(),
        forEach: jest.fn()
      }
    })
  },
  TestTag: jest.fn().mockImplementation((id) => ({ id })),
  TestRunProfileKind: {
    Run: 'run',
    Debug: 'debug'
  },
  TestMessage: jest.fn().mockImplementation((message) => ({ message })),
  Range: jest.fn().mockImplementation((startLine, startChar, endLine, endChar) => ({
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar }
  })),
  Uri: {
    file: jest.fn().mockImplementation((path) => ({ fsPath: path }))
  },
  RelativePattern: jest.fn().mockImplementation((workspaceFolder, pattern) => ({
    baseUri: workspaceFolder,
    base: workspaceFolder,
    pattern: pattern
  })),
  commands: {
    registerCommand: jest.fn().mockReturnValue({
      dispose: jest.fn()
    })
  }
}));

describe('Parameterized Test Results Integration', () => {
  let controller: SpockTestController;
  let mockContext: vscode.ExtensionContext;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockContext = {
      subscriptions: []
    } as any;

    mockLogger = {
      appendLine: jest.fn()
    };

    controller = new SpockTestController(mockContext, mockLogger);
  });

  describe('End-to-End Parameterized Test Flow', () => {
    it('should discover, execute, and display parameterized test results', async () => {
      // 1. Mock a data-driven test file
      const testFileContent = `
        class DataDrivenSpec extends Specification {
          def "should calculate score for regular frames"(int roll1, int roll2, int expectedScore) {
            expect:
            Math.max(roll1, roll2) == expectedScore

            where:
            roll1 | roll2 | expectedScore
            3     | 4     | 4
            5     | 2     | 5
            0     | 0     | 0
          }
        }
      `;

      const mockDocument = {
        getText: () => testFileContent
      };
      (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);

      // 2. Mock test execution output with iteration results
      const mockExecutionOutput = `
        > Task :test
        com.example.DataDrivenSpec > should calculate score for regular frames [roll1: 3, roll2: 4, expectedScore: 4, #0] PASSED
        com.example.DataDrivenSpec > should calculate score for regular frames [roll1: 5, roll2: 2, expectedScore: 5, #1] PASSED
        com.example.DataDrivenSpec > should calculate score for regular frames [roll1: 0, roll2: 0, expectedScore: 0, #2] FAILED
      `;

      // 3. Mock XML test report
      const mockXmlContent = `
        <?xml version="1.0" encoding="UTF-8"?>
        <testsuite name="com.example.DataDrivenSpec" tests="3" skipped="0" failures="1" errors="0">
          <testcase name="should calculate score for regular frames [roll1: 3, roll2: 4, expectedScore: 4, #0]" classname="com.example.DataDrivenSpec" time="0.009"/>
          <testcase name="should calculate score for regular frames [roll1: 5, roll2: 2, expectedScore: 5, #1]" classname="com.example.DataDrivenSpec" time="0.001"/>
          <testcase name="should calculate score for regular frames [roll1: 0, roll2: 0, expectedScore: 0, #2]" classname="com.example.DataDrivenSpec" time="0.002">
            <failure message="Expected 0 but was 1">Assertion failed</failure>
          </testcase>
        </testsuite>
      `;

      // Mock file system for XML report
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockXmlContent);

      // 4. Mock test execution service
      const executeTestSpy = jest.spyOn(controller['testExecutionService'], 'executeTest')
        .mockResolvedValue({
          success: false, // Overall test failed due to one iteration
          output: mockExecutionOutput,
          errorInfo: undefined
        });

      // 5. Mock build tool detection
      const detectBuildToolSpy = jest.spyOn(require('../services/BuildToolService').BuildToolService, 'detectBuildTool')
        .mockReturnValue('gradle');

      // 6. Create a mock test item for the data-driven test
      const mockTestItem = {
        id: 'file://test/DataDrivenSpec.groovy#DataDrivenSpec#should calculate score for regular frames',
        label: 'should calculate score for regular frames',
        uri: vscode.Uri.file('/test/DataDrivenSpec.groovy'),
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
        }
      };

      // 7. Set up test data
      const testDataMap = new Map();
      testDataMap.set(mockTestItem, { 
        type: 'test', 
        className: 'DataDrivenSpec', 
        testName: 'should calculate score for regular frames',
        isDataDriven: true
      });
      controller['testData'] = testDataMap as any;

      // 8. Mock test run
      const mockRun = {
        started: jest.fn(),
        passed: jest.fn(),
        failed: jest.fn(),
        skipped: jest.fn(),
        appendOutput: jest.fn(),
        end: jest.fn()
      };

      // 9. Execute the test
      await controller['runTest'](mockTestItem, testDataMap.get(mockTestItem), mockRun as any, false);

      // 10. Verify the complete flow
      expect(executeTestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          className: 'DataDrivenSpec',
          testName: 'should calculate score for regular frames',
          workspacePath: '/test/workspace',
          buildTool: 'gradle',
          debug: false
        }),
        expect.any(Object),
        mockTestItem
      );

      // 11. Verify iteration test items were created
      expect(mockTestItem.children.replace).toHaveBeenCalled();
      expect(mockTestItem.children.add).toHaveBeenCalledTimes(3);

      // 12. Verify individual iteration results
      expect(mockRun.passed).toHaveBeenCalledTimes(2); // 2 passed iterations
      expect(mockRun.failed).toHaveBeenCalledTimes(2); // 1 failed iteration + parent test

      // 13. Verify parent test result
      expect(mockRun.failed).toHaveBeenCalledWith(
        mockTestItem,
        expect.objectContaining({ message: '1 of 3 iterations failed' }),
        expect.any(Number)
      );

      // 14. Verify XML report was read
      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('build/test-results/test/TEST-DataDrivenSpec.xml')
      );
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('build/test-results/test/TEST-DataDrivenSpec.xml'),
        'utf8'
      );
    });

    it('should handle console-only parsing when XML is not available', async () => {
      // Mock file system to return false for XML existence
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const mockExecutionOutput = `
        com.example.DataDrivenSpec > should calculate score [roll1: 3, roll2: 4, expectedScore: 4, #0] PASSED
        com.example.DataDrivenSpec > should calculate score [roll1: 5, roll2: 2, expectedScore: 5, #1] PASSED
      `;

      const executeTestSpy = jest.spyOn(controller['testExecutionService'], 'executeTest')
        .mockResolvedValue({
          success: true,
          output: mockExecutionOutput,
          errorInfo: undefined
        });

      const detectBuildToolSpy = jest.spyOn(require('../services/BuildToolService').BuildToolService, 'detectBuildTool')
        .mockReturnValue('gradle');

      const mockTestItem = {
        id: 'file://test/DataDrivenSpec.groovy#DataDrivenSpec#should calculate score',
        label: 'should calculate score',
        uri: vscode.Uri.file('/test/DataDrivenSpec.groovy'),
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
        }
      };

      const testDataMap = new Map();
      testDataMap.set(mockTestItem, { 
        type: 'test', 
        className: 'DataDrivenSpec', 
        testName: 'should calculate score',
        isDataDriven: true
      });
      controller['testData'] = testDataMap as any;

      const mockRun = {
        started: jest.fn(),
        passed: jest.fn(),
        failed: jest.fn(),
        skipped: jest.fn(),
        appendOutput: jest.fn(),
        end: jest.fn()
      };

      await controller['runTest'](mockTestItem, testDataMap.get(mockTestItem), mockRun as any, false);

      // Verify console parsing was used (no XML file access)
      expect(fs.readFileSync).not.toHaveBeenCalled();
      
      // Verify iteration items were still created
      expect(mockTestItem.children.add).toHaveBeenCalledTimes(2);
      expect(mockRun.passed).toHaveBeenCalledTimes(3); // 2 iterations + 1 parent
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed console output gracefully', async () => {
      const mockExecutionOutput = 'Some malformed output without iteration patterns';
      
      const executeTestSpy = jest.spyOn(controller['testExecutionService'], 'executeTest')
        .mockResolvedValue({
          success: true,
          output: mockExecutionOutput,
          errorInfo: undefined
        });

      const detectBuildToolSpy = jest.spyOn(require('../services/BuildToolService').BuildToolService, 'detectBuildTool')
        .mockReturnValue('gradle');

      const mockTestItem = {
        id: 'file://test/DataDrivenSpec.groovy#DataDrivenSpec#should calculate score',
        label: 'should calculate score',
        uri: vscode.Uri.file('/test/DataDrivenSpec.groovy'),
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
        }
      };

      const testDataMap = new Map();
      testDataMap.set(mockTestItem, { 
        type: 'test', 
        className: 'DataDrivenSpec', 
        testName: 'should calculate score',
        isDataDriven: true
      });
      controller['testData'] = testDataMap as any;

      const mockRun = {
        started: jest.fn(),
        passed: jest.fn(),
        failed: jest.fn(),
        skipped: jest.fn(),
        appendOutput: jest.fn(),
        end: jest.fn()
      };

      await controller['runTest'](mockTestItem, testDataMap.get(mockTestItem), mockRun as any, false);

      // Should fall back to regular test behavior
      expect(mockTestItem.children.add).not.toHaveBeenCalled();
      expect(mockRun.passed).toHaveBeenCalledWith(mockTestItem, expect.any(Number));
    });

    it('should handle XML parsing errors gracefully', async () => {
      // Mock XML file exists but is malformed
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('malformed xml content');

      const mockExecutionOutput = `
        com.example.DataDrivenSpec > should calculate score [roll1: 3, roll2: 4, expectedScore: 4, #0] PASSED
      `;

      const executeTestSpy = jest.spyOn(controller['testExecutionService'], 'executeTest')
        .mockResolvedValue({
          success: true,
          output: mockExecutionOutput,
          errorInfo: undefined
        });

      const detectBuildToolSpy = jest.spyOn(require('../services/BuildToolService').BuildToolService, 'detectBuildTool')
        .mockReturnValue('gradle');

      const mockTestItem = {
        id: 'file://test/DataDrivenSpec.groovy#DataDrivenSpec#should calculate score',
        label: 'should calculate score',
        uri: vscode.Uri.file('/test/DataDrivenSpec.groovy'),
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
        }
      };

      const testDataMap = new Map();
      testDataMap.set(mockTestItem, { 
        type: 'test', 
        className: 'DataDrivenSpec', 
        testName: 'should calculate score',
        isDataDriven: true
      });
      controller['testData'] = testDataMap as any;

      const mockRun = {
        started: jest.fn(),
        passed: jest.fn(),
        failed: jest.fn(),
        skipped: jest.fn(),
        appendOutput: jest.fn(),
        end: jest.fn()
      };

      await controller['runTest'](mockTestItem, testDataMap.get(mockTestItem), mockRun as any, false);

      // Should fall back to console parsing
      expect(mockTestItem.children.add).toHaveBeenCalledTimes(1);
      expect(mockRun.passed).toHaveBeenCalledTimes(2); // 1 iteration + 1 parent
    });
  });
});
