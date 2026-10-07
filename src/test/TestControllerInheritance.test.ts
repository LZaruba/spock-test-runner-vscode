import * as vscode from 'vscode';
import { BuildToolService } from '../services/BuildToolService';
import { SpockTestController } from '../testController';

// In-memory workspace files, keyed by path
const mockFiles = new Map<string, string>();

jest.mock('vscode', () => {
  class MockTestItemCollection {
    private items = new Map<string, any>();
    get size() {
      return this.items.size;
    }
    add(item: any) {
      this.items.set(item.id, item);
    }
    get(id: string) {
      return this.items.get(id);
    }
    delete(id: string) {
      this.items.delete(id);
    }
    replace(items: any[]) {
      this.items.clear();
      items.forEach(item => this.add(item));
    }
    forEach(callback: (item: any) => void) {
      this.items.forEach(item => callback(item));
    }
    [Symbol.iterator]() {
      return this.items.entries();
    }
  }

  const mockUri = (fsPath: string) => ({ fsPath, toString: () => `file://${fsPath}` });

  return {
    tests: {
      createTestController: jest.fn().mockImplementation(() => ({
        items: new MockTestItemCollection(),
        createTestItem: jest.fn().mockImplementation((id: string, label: string, uri: any) => ({
          id,
          label,
          uri,
          range: undefined,
          description: undefined,
          canResolveChildren: false,
          tags: [],
          children: new MockTestItemCollection()
        })),
        createRunProfile: jest.fn(),
        createTestRun: jest.fn()
      }))
    },
    workspace: {
      workspaceFolders: [{ uri: mockUri('/workspace') }],
      findFiles: jest.fn().mockImplementation(async () => [...mockFiles.keys()].map(mockUri)),
      openTextDocument: jest.fn().mockImplementation(async (uri: any) => {
        if (!mockFiles.has(uri.fsPath)) {
          throw new Error(`File not found: ${uri.fsPath}`);
        }
        return { getText: () => mockFiles.get(uri.fsPath) };
      }),
      createFileSystemWatcher: jest.fn().mockImplementation(() => ({
        onDidCreate: jest.fn(),
        onDidChange: jest.fn(),
        onDidDelete: jest.fn()
      })),
      getWorkspaceFolder: jest.fn().mockReturnValue({ uri: mockUri('/workspace') })
    },
    commands: {
      registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() })
    },
    Uri: {
      file: jest.fn().mockImplementation(mockUri)
    },
    Range: jest.fn().mockImplementation((startLine, startChar, endLine, endChar) => ({
      start: { line: startLine, character: startChar },
      end: { line: endLine, character: endChar }
    })),
    RelativePattern: jest.fn().mockImplementation((base, pattern) => ({ base, pattern })),
    TestTag: jest.fn().mockImplementation((id) => ({ id })),
    TestMessage: jest.fn().mockImplementation((message) => ({ message })),
    TestRunProfileKind: { Run: 1, Debug: 2 }
  };
});

const BASE_SPEC_PATH = '/workspace/src/test/groovy/com/example/base/BaseSpec.groovy';
const CHILD_SPEC_PATH = '/workspace/src/test/groovy/com/example/ChildSpec.groovy';
const GRAND_CHILD_SPEC_PATH = '/workspace/src/test/groovy/com/example/GrandChildSpec.groovy';

const BASE_SPEC = `
package com.example.base

import spock.lang.Specification

abstract class BaseSpec extends Specification {

    def "base feature"() {
        expect:
        true
    }

    def "base data feature"(int value) {
        expect:
        value > 0

        where:
        value << [1, 2]
    }
}`;

const CHILD_SPEC = `
package com.example

import com.example.base.BaseSpec

class ChildSpec extends BaseSpec {

    def "child feature"() {
        expect:
        true
    }
}`;

const GRAND_CHILD_SPEC = `
package com.example

class GrandChildSpec extends ChildSpec {

    def "grand child feature"() {
        expect:
        true
    }
}`;

describe('SpockTestController with inherited specs', () => {
  let controller: SpockTestController;
  let testController: any;

  const fileItem = (filePath: string) => testController.items.get(`file://${filePath}`);
  const classItem = (filePath: string, className: string) =>
    fileItem(filePath)?.children.get(`file://${filePath}#${className}`);
  const childLabels = (item: any) => {
    const labels: string[] = [];
    item.children.forEach((child: any) => labels.push(child.label));
    return labels;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFiles.clear();
    // The subclasses are listed before their base classes on purpose
    mockFiles.set(GRAND_CHILD_SPEC_PATH, GRAND_CHILD_SPEC);
    mockFiles.set(CHILD_SPEC_PATH, CHILD_SPEC);
    mockFiles.set(BASE_SPEC_PATH, BASE_SPEC);

    controller = new SpockTestController({ subscriptions: [] } as any, { appendLine: jest.fn() } as any);
    testController = (vscode.tests.createTestController as jest.Mock).mock.results[0].value;
    // Let the discovery started by the constructor finish before discovering again
    await new Promise(resolve => setImmediate(resolve));
    await controller['discoverAllTests']();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should list specs extending Specification indirectly together with their inherited features', () => {
    // The abstract base class itself is not runnable
    expect(fileItem(BASE_SPEC_PATH).children.size).toBe(0);

    const childSpec = classItem(CHILD_SPEC_PATH, 'ChildSpec');
    expect(childSpec).toBeDefined();
    expect(childLabels(childSpec)).toEqual(['base feature', 'base data feature', 'child feature']);
    expect(fileItem(CHILD_SPEC_PATH).tags).toEqual([{ id: 'runnable' }]);

    const grandChildSpec = classItem(GRAND_CHILD_SPEC_PATH, 'GrandChildSpec');
    expect(childLabels(grandChildSpec)).toEqual(['base feature', 'base data feature', 'child feature', 'grand child feature']);
  });

  it('should point inherited features to their declaration in the base class', () => {
    const childSpec = classItem(CHILD_SPEC_PATH, 'ChildSpec');
    const inheritedItem = childSpec.children.get(`file://${CHILD_SPEC_PATH}#ChildSpec#base data feature`);
    const ownItem = childSpec.children.get(`file://${CHILD_SPEC_PATH}#ChildSpec#child feature`);

    expect(inheritedItem.uri.fsPath).toBe(BASE_SPEC_PATH);
    expect(inheritedItem.range.start.line).toBe(12);
    expect(inheritedItem.description).toBe('inherited from BaseSpec');
    expect(inheritedItem.tags).toEqual([{ id: 'runnable' }]);
    expect(controller['testData'].get(inheritedItem)).toEqual(expect.objectContaining({
      type: 'test',
      className: 'ChildSpec',
      testName: 'base data feature',
      isDataDriven: true,
      specFileUri: expect.objectContaining({ fsPath: CHILD_SPEC_PATH })
    }));

    expect(ownItem.uri.fsPath).toBe(CHILD_SPEC_PATH);
    expect(ownItem.description).toBeUndefined();
    // Own features keep the same test data as before
    expect(controller['testData'].get(ownItem)).toEqual({ type: 'test', className: 'ChildSpec', testName: 'child feature' });
  });

  it('should run inherited features in the context of the inheriting spec', async () => {
    jest.spyOn(BuildToolService, 'detectBuildTool').mockReturnValue('gradle');
    const executeTest = jest.spyOn(controller['testExecutionService'], 'executeTest')
      .mockResolvedValue({ success: true, output: '' });
    const run = { started: jest.fn(), passed: jest.fn(), failed: jest.fn(), appendOutput: jest.fn() };

    const grandChildSpec = classItem(GRAND_CHILD_SPEC_PATH, 'GrandChildSpec');
    const inheritedItem = grandChildSpec.children.get(`file://${GRAND_CHILD_SPEC_PATH}#GrandChildSpec#base feature`);
    await controller['runTest'](inheritedItem, controller['testData'].get(inheritedItem)!, run as any, false);

    expect(vscode.workspace.getWorkspaceFolder).toHaveBeenCalledWith(expect.objectContaining({ fsPath: GRAND_CHILD_SPEC_PATH }));
    expect(executeTest).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'GrandChildSpec',
        testName: 'base feature',
        testFilePath: GRAND_CHILD_SPEC_PATH
      }),
      run,
      inheritedItem
    );
    expect(run.passed).toHaveBeenCalledWith(inheritedItem, expect.any(Number));
  });

  it('should refresh inheriting specs when a base class changes', async () => {
    mockFiles.set(BASE_SPEC_PATH, BASE_SPEC.replace('"base feature"', '"renamed base feature"'));
    await controller['discoverTestsInFile'](fileItem(BASE_SPEC_PATH));

    expect(childLabels(classItem(CHILD_SPEC_PATH, 'ChildSpec')))
      .toEqual(['renamed base feature', 'base data feature', 'child feature']);
    expect(childLabels(classItem(GRAND_CHILD_SPEC_PATH, 'GrandChildSpec')))
      .toEqual(['renamed base feature', 'base data feature', 'child feature', 'grand child feature']);
  });

  it('should refresh specs that stop inheriting from a changed class', async () => {
    mockFiles.set(CHILD_SPEC_PATH, CHILD_SPEC.replace('class ChildSpec extends BaseSpec', 'class RenamedSpec extends BaseSpec'));
    await controller['discoverTestsInFile'](fileItem(CHILD_SPEC_PATH));

    expect(classItem(CHILD_SPEC_PATH, 'RenamedSpec')).toBeDefined();
    // GrandChildSpec extends a class that no longer exists, and it has Spock features, so it is kept
    // as a spec of an unknown base class without inherited features
    expect(childLabels(classItem(GRAND_CHILD_SPEC_PATH, 'GrandChildSpec'))).toEqual(['grand child feature']);
  });

  it('should refresh inheriting specs when a base class file is deleted', () => {
    const watcher = (vscode.workspace.createFileSystemWatcher as jest.Mock).mock.results[0].value;
    const onDidDelete = watcher.onDidDelete.mock.calls[0][0];

    mockFiles.delete(BASE_SPEC_PATH);
    onDidDelete(vscode.Uri.file(BASE_SPEC_PATH));

    expect(fileItem(BASE_SPEC_PATH)).toBeUndefined();
    expect(childLabels(classItem(CHILD_SPEC_PATH, 'ChildSpec'))).toEqual(['child feature']);
    expect(childLabels(classItem(GRAND_CHILD_SPEC_PATH, 'GrandChildSpec'))).toEqual(['child feature', 'grand child feature']);
  });
});
