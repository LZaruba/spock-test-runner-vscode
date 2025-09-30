import * as path from 'path';
import * as vscode from 'vscode';
import { BuildToolService } from './services/BuildToolService';
import { TestDiscoveryService } from './services/TestDiscoveryService';
import { TestExecutionService } from './services/TestExecutionService';

export class SpockTestController {
  private controller: vscode.TestController;
  private logger: vscode.OutputChannel;
  private testData = new WeakMap<vscode.TestItem, TestData>();
  private testExecutionService: TestExecutionService;

  constructor(context: vscode.ExtensionContext, logger: vscode.OutputChannel) {
    this.logger = logger;
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
    this.registerCommands(context);

    // Add debugging to see if VS Code calls any methods on our controller
    this.logger.appendLine('SpockTestController: Setting up controller debugging...');
    
    // Override the controller's items property to track when it's accessed
    const originalItems = this.controller.items;
    Object.defineProperty(this.controller, 'items', {
      get: () => {
        this.logger.appendLine('SpockTestController: controller.items accessed');
        return originalItems;
      },
      enumerable: true,
      configurable: true
    });

    // Automatically discover tests on startup
    this.logger.appendLine('SpockTestController: Starting automatic test discovery...');
    this.discoverAllTests().catch(error => {
      this.logger.appendLine(`SpockTestController: Error during automatic discovery: ${error}`);
    });

    context.subscriptions.push(this.controller);
  }

  private setupTestController(): void {
    this.controller.resolveHandler = async (test) => {
      this.logger.appendLine(`SpockTestController: resolveHandler called with test: ${test ? test.id : 'null'}`);
      this.logger.appendLine(`SpockTestController: resolveHandler test type: ${test ? typeof test : 'null'}`);
      this.logger.appendLine(`SpockTestController: resolveHandler test label: ${test ? test.label : 'null'}`);
      this.logger.appendLine(`SpockTestController: resolveHandler test uri: ${test ? test.uri?.fsPath : 'null'}`);
      
      if (!test) {
        this.logger.appendLine('SpockTestController: Discovering all tests (reload triggered)...');
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

      watcher.onDidCreate(uri => {
        // Only process files that are NOT in the bin directory
        if (!uri.fsPath.includes('/bin/')) {
          this.logger.appendLine(`SpockTestController: File created: ${uri.fsPath}`);
          this.discoverTestsInFile(this.getOrCreateFile(uri));
        }
      });
      watcher.onDidChange(uri => {
        // Only process files that are NOT in the bin directory
        if (!uri.fsPath.includes('/bin/')) {
          this.logger.appendLine(`SpockTestController: File changed: ${uri.fsPath}`);
          this.discoverTestsInFile(this.getOrCreateFile(uri));
        }
      });
      watcher.onDidDelete(uri => {
        this.logger.appendLine(`SpockTestController: File deleted: ${uri.fsPath}`);
        this.controller.items.delete(uri.toString());
      });
    });
  }

  private createRunProfiles(): void {
    const runnableTag = new vscode.TestTag('runnable');
    
    const runProfile = this.controller.createRunProfile(
      'Run',
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runHandler(false, request, token),
      true,
      runnableTag
    );

    const debugProfile = this.controller.createRunProfile(
      'Debug',
      vscode.TestRunProfileKind.Debug,
      (request, token) => this.runHandler(true, request, token),
      true,
      runnableTag
    );
  }

  private registerCommands(context: vscode.ExtensionContext): void {
    // Register a manual reload command for debugging
    const reloadCommand = vscode.commands.registerCommand('spock-test-runner.reloadTests', async () => {
      this.logger.appendLine('SpockTestController: Manual reload command triggered');
      await this.discoverAllTests();
      this.logger.appendLine('SpockTestController: Manual reload completed');
    });

    // Try to hook into VS Code's test refresh mechanism
    const refreshCommand = vscode.commands.registerCommand('testing.refreshTests', async () => {
      this.logger.appendLine('SpockTestController: VS Code refresh command intercepted');
      await this.discoverAllTests();
      this.logger.appendLine('SpockTestController: VS Code refresh completed');
    });

    context.subscriptions.push(reloadCommand, refreshCommand);
  }

  private async discoverAllTests(): Promise<void> {
    this.logger.appendLine('SpockTestController: discoverAllTests called');
    
    // Clear all existing test items to avoid caching issues
    this.logger.appendLine('SpockTestController: Clearing existing test items...');
    this.controller.items.replace([]);
    
    if (!vscode.workspace.workspaceFolders) {
      this.logger.appendLine('SpockTestController: No workspace folders found');
      return;
    }

    this.logger.appendLine(`SpockTestController: Found ${vscode.workspace.workspaceFolders.length} workspace folders`);
    
    for (const workspaceFolder of vscode.workspace.workspaceFolders) {
      this.logger.appendLine(`SpockTestController: Searching in workspace: ${workspaceFolder.uri.fsPath}`);
      const pattern = new vscode.RelativePattern(workspaceFolder, '**/*.groovy');
      const excludePattern = new vscode.RelativePattern(workspaceFolder, '**/bin/**');
      const files = await vscode.workspace.findFiles(pattern, excludePattern);
      
      this.logger.appendLine(`SpockTestController: Found ${files.length} .groovy files`);
      
      for (const file of files) {
        this.logger.appendLine(`SpockTestController: Processing file: ${file.fsPath}`);
        const fileItem = this.getOrCreateFile(file);
        await this.discoverTestsInFile(fileItem);
      }
    }
  }

  private async discoverTestsInFile(file: vscode.TestItem): Promise<void> {
    if (!file.uri) {
      return;
    }

    this.logger.appendLine(`SpockTestController: discoverTestsInFile called for: ${file.uri.fsPath}`);
    
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
    file.tags = []; // Will be set properly in parseTestsInFile based on content
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
    let hasRunnableClasses = false;

    for (const testClass of testClasses) {
      this.logger.appendLine(`SpockTestController: Found test class: ${testClass.name}`);
      
      // ADD DEBUG HERE - shows class details
      this.logger.appendLine(`[DEBUG] Class ${testClass.name} - isAbstract: ${testClass.isAbstract}`);
      
      // Skip abstract classes entirely - they shouldn't appear in the test tree
      if (testClass.isAbstract) {
        this.logger.appendLine(`[DEBUG] Class ${testClass.name} - SKIPPED (abstract class)`);
        continue;
      }
      
      const classItem = this.controller.createTestItem(
        `${file.uri.toString()}#${testClass.name}`,
        testClass.name,
        file.uri
      );
      classItem.range = testClass.range;
      classItem.tags = [new vscode.TestTag('runnable')];
      hasRunnableClasses = true;
      this.logger.appendLine(`[DEBUG] Class ${testClass.name} - ASSIGNED runnable tag`);
      this.testData.set(classItem, { type: 'class', className: testClass.name });
      file.children.add(classItem);

      for (const testMethod of testClass.methods) {
        this.logger.appendLine(`SpockTestController: Found test method: ${testMethod.name}`);
        
        // ADD DEBUG HERE - shows method details
        this.logger.appendLine(`[DEBUG] Method ${testMethod.name} in class ${testClass.name}`);
        
        testCount++;
        
        if (testMethod.isDataDriven && testMethod.dataIterations) {
          // Create parent test item for data-driven test
          const parentTestItem = this.controller.createTestItem(
            `${file.uri.toString()}#${testClass.name}#${testMethod.name}`,
            testMethod.name,
            file.uri
          );
          parentTestItem.range = testMethod.range;
          parentTestItem.canResolveChildren = false;
          parentTestItem.tags = [new vscode.TestTag('runnable')];
          this.logger.appendLine(`[DEBUG] Data-driven method ${testMethod.name} - ASSIGNED runnable tag`);
          this.testData.set(parentTestItem, {
            type: 'test',
            className: testClass.name,
            testName: testMethod.name
          });
          classItem.children.add(parentTestItem);
          
          // Don't create individual test items for data iterations
          // They will be shown in test results when the parent test runs
          // but won't have individual run actions
        } else {
          // Regular test method
          const testItem = this.controller.createTestItem(
            `${file.uri.toString()}#${testClass.name}#${testMethod.name}`,
            testMethod.name,
            file.uri
          );
          testItem.range = testMethod.range;
          testItem.tags = [new vscode.TestTag('runnable')];
          this.logger.appendLine(`[DEBUG] Regular method ${testMethod.name} - ASSIGNED runnable tag`);
          this.testData.set(testItem, {
            type: 'test',
            className: testClass.name,
            testName: testMethod.name
          });
          classItem.children.add(testItem);
        }
      }
    }
    
    // Set file-level runnable tag based on whether it contains any runnable classes
    if (hasRunnableClasses) {
      file.tags = [new vscode.TestTag('runnable')];
      this.logger.appendLine(`[DEBUG] File ${file.uri.fsPath} - ASSIGNED runnable tag (has runnable classes)`);
    } else {
      file.tags = [];
      this.logger.appendLine(`[DEBUG] File ${file.uri.fsPath} - NO runnable tag (only abstract classes)`);
    }
    
    // Debug: Log the actual tags on the file
    this.logger.appendLine(`[DEBUG] File ${file.uri.fsPath} - Final tags: ${JSON.stringify(file.tags.map(t => t.id))}`);
    
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
