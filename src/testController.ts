import * as vscode from 'vscode';
import * as path from 'path';
import { TestDiscoveryService } from './services/TestDiscoveryService';
import { TestExecutionService } from './services/TestExecutionService';
import { BuildToolService } from './services/BuildToolService';

export class SpockTestController {
  private controller: vscode.TestController;
  private logger: vscode.OutputChannel;
  private testData = new WeakMap<vscode.TestItem, TestData>();
  private testExecutionService: TestExecutionService;

  constructor(context: vscode.ExtensionContext) {
    this.logger = vscode.window.createOutputChannel('Spock Test Runner');
    this.logger.appendLine('SpockTestController: Initializing...');
    
    this.controller = vscode.tests.createTestController(
      'spock-test-runner-vscode',
      'Spock Tests'
    );
    
    this.testExecutionService = new TestExecutionService(this.logger);
    this.logger.appendLine('SpockTestController: TestController created');

    this.setupTestController();
    this.setupFileWatchers();
    this.createRunProfiles();

    context.subscriptions.push(this.controller, this.logger);
  }

  private setupTestController(): void {
    this.controller.resolveHandler = async (test) => {
      this.logger.appendLine(`SpockTestController: resolveHandler called with test: ${test ? test.id : 'null'}`);
      if (!test) {
        this.logger.appendLine('SpockTestController: Discovering all tests...');
        await this.discoverAllTests();
      } else {
        this.logger.appendLine(`SpockTestController: Discovering tests in file: ${test.uri?.fsPath}`);
        await this.discoverTestsInFile(test);
      }
    };
  }

  private setupFileWatchers(): void {
    if (!vscode.workspace.workspaceFolders) {
      return;
    }

    vscode.workspace.workspaceFolders.forEach(workspaceFolder => {
      const pattern = new vscode.RelativePattern(workspaceFolder, '**/*.groovy');
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);

      watcher.onDidCreate(uri => this.discoverTestsInFile(this.getOrCreateFile(uri)));
      watcher.onDidChange(uri => this.discoverTestsInFile(this.getOrCreateFile(uri)));
      watcher.onDidDelete(uri => this.controller.items.delete(uri.toString()));
    });
  }

  private createRunProfiles(): void {
    const runProfile = this.controller.createRunProfile(
      'Run',
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runHandler(false, request, token)
    );

    const debugProfile = this.controller.createRunProfile(
      'Debug',
      vscode.TestRunProfileKind.Debug,
      (request, token) => this.runHandler(true, request, token)
    );
  }

  private async discoverAllTests(): Promise<void> {
    this.logger.appendLine('SpockTestController: discoverAllTests called');
    if (!vscode.workspace.workspaceFolders) {
      this.logger.appendLine('SpockTestController: No workspace folders found');
      return;
    }

    this.logger.appendLine(`SpockTestController: Found ${vscode.workspace.workspaceFolders.length} workspace folders`);
    
    for (const workspaceFolder of vscode.workspace.workspaceFolders) {
      this.logger.appendLine(`SpockTestController: Searching in workspace: ${workspaceFolder.uri.fsPath}`);
      const pattern = new vscode.RelativePattern(workspaceFolder, '**/*.groovy');
      const files = await vscode.workspace.findFiles(pattern);
      
      this.logger.appendLine(`SpockTestController: Found ${files.length} .groovy files`);
      
      for (const file of files) {
        this.logger.appendLine(`SpockTestController: Processing file: ${file.fsPath}`);
        this.getOrCreateFile(file);
      }
    }
  }

  private async discoverTestsInFile(file: vscode.TestItem): Promise<void> {
    if (!file.uri) {
      return;
    }

    try {
      const document = await vscode.workspace.openTextDocument(file.uri);
      const content = document.getText();
      this.parseTestsInFile(file, content);
    } catch (error) {
      this.logger.appendLine(`Error discovering tests in ${file.uri.fsPath}: ${error}`);
    }
  }

  private getOrCreateFile(uri: vscode.Uri): vscode.TestItem {
    const existing = this.controller.items.get(uri.toString());
    if (existing) {
      return existing;
    }

    const file = this.controller.createTestItem(uri.toString(), path.basename(uri.fsPath), uri);
    file.canResolveChildren = true;
    this.testData.set(file, { type: 'file' });
    this.controller.items.add(file);
    return file;
  }

  private parseTestsInFile(file: vscode.TestItem, content: string): void {
    if (!file.uri) {
      return;
    }

    this.logger.appendLine(`SpockTestController: Parsing tests in file: ${file.uri.fsPath}`);

    // Clear existing children
    file.children.replace([]);

    const testClasses = TestDiscoveryService.parseTestsInFile(content);
    let testCount = 0;

    for (const testClass of testClasses) {
      this.logger.appendLine(`SpockTestController: Found test class: ${testClass.name}`);
      
      const classItem = this.controller.createTestItem(
        `${file.uri.toString()}#${testClass.name}`,
        testClass.name,
        file.uri
      );
      classItem.range = testClass.range;
      this.testData.set(classItem, { type: 'class', className: testClass.name });
      file.children.add(classItem);

      for (const testMethod of testClass.methods) {
        this.logger.appendLine(`SpockTestController: Found test method: ${testMethod.name}`);
        testCount++;
        
        const testItem = this.controller.createTestItem(
          `${file.uri.toString()}#${testClass.name}#${testMethod.name}`,
          testMethod.name,
          file.uri
        );
        testItem.range = testMethod.range;
        this.testData.set(testItem, {
          type: 'test',
          className: testClass.name,
          testName: testMethod.name
        });
        classItem.children.add(testItem);
      }
    }
    
    this.logger.appendLine(`SpockTestController: Parsed ${testCount} tests in file: ${file.uri.fsPath}`);
  }

  private async runHandler(debug: boolean, request: vscode.TestRunRequest, token: vscode.CancellationToken): Promise<void> {
    const run = this.controller.createTestRun(request);
    const queue: vscode.TestItem[] = [];

    // Add tests to queue
    if (request.include) {
      request.include.forEach(test => queue.push(test));
    } else {
      this.controller.items.forEach(test => queue.push(test));
    }

    // Process tests
    while (queue.length > 0 && !token.isCancellationRequested) {
      const test = queue.pop()!;

      if (request.exclude?.includes(test)) {
        continue;
      }

      const data = this.testData.get(test);
      if (!data) {
        continue;
      }

      switch (data.type) {
        case 'file':
          if (test.children.size === 0) {
            await this.discoverTestsInFile(test);
          }
          test.children.forEach(child => queue.push(child));
          break;
        case 'class':
          test.children.forEach(child => queue.push(child));
          break;
        case 'test':
          await this.runTest(test, data, run, debug);
          break;
      }
    }

    run.end();
  }

  private async runTest(test: vscode.TestItem, data: TestData, run: vscode.TestRun, debug: boolean): Promise<void> {
    if (data.type !== 'test' || !test.uri) {
      return;
    }

    const start = Date.now();
    run.started(test);

    try {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(test.uri);
      if (!workspaceFolder) {
        throw new Error('No workspace folder found');
      }

      const buildTool = BuildToolService.detectBuildTool(workspaceFolder.uri.fsPath);
      if (!buildTool) {
        throw new Error('No build tool detected (Gradle)');
      }

      const result = await this.testExecutionService.executeTest({
        className: data.className!,
        testName: data.testName!,
        workspacePath: workspaceFolder.uri.fsPath,
        buildTool,
        debug
      }, run, test);
      
      if (result.success) {
        run.passed(test, Date.now() - start);
      } else {
        const errorInfo = result.errorInfo;
        const message = new vscode.TestMessage(errorInfo?.error || 'Test failed');
        if (errorInfo?.location) {
          message.location = errorInfo.location;
        }
        run.failed(test, message, Date.now() - start);
      }
    } catch (error) {
      const message = new vscode.TestMessage(error instanceof Error ? error.message : 'Unknown error');
      run.failed(test, message, Date.now() - start);
    }
  }
}

interface TestData {
  type: 'file' | 'class' | 'test';
  className?: string;
  testName?: string;
}
