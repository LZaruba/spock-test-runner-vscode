import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BuildToolService } from './services/BuildToolService';
import { TestDiscoveryService } from './services/TestDiscoveryService';
import { TestExecutionService } from './services/TestExecutionService';
import { TestResultParser } from './services/TestResultParser';
import { TestIterationResult } from './types';

export class SpockTestController {
  private controller: vscode.TestController;
  private logger: vscode.OutputChannel;
  private testData = new WeakMap<vscode.TestItem, TestData>();
  private testExecutionService: TestExecutionService;
  private testResultParser: TestResultParser;
  private iterationItems = new Map<string, vscode.TestItem[]>(); // Track iteration items by file URI

  constructor(context: vscode.ExtensionContext, logger: vscode.OutputChannel) {
    this.logger = logger;
    this.logger.appendLine('SpockTestController: Initializing...');
    
    this.controller = vscode.tests.createTestController(
      'spock-test-runner-vscode',
      'Spock Tests'
    );
    
    this.testExecutionService = new TestExecutionService(this.logger);
    this.testResultParser = new TestResultParser(this.logger);
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
    
    // Clean up old iteration items for this file
    this.cleanupIterationItems(file.uri.toString());
    
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
        
        if (testMethod.isDataDriven) {
          this.logger.appendLine(`[DEBUG] Found data-driven method: ${testMethod.name} in class ${testClass.name}`);
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
            testName: testMethod.name,
            isDataDriven: true
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
      
      // Handle data-driven test results
      if (data.isDataDriven && result.output) {
        await this.handleDataDrivenTestResults(test, data, result, run, workspaceFolder.uri.fsPath);
      } else {
        // Regular test result
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
      }
    } catch (error) {
      const message = new vscode.TestMessage(error instanceof Error ? error.message : 'Unknown error');
      run.failed(test, message, Date.now() - start);
    }
  }

  /**
   * Handle results for data-driven tests by creating iteration test items
   */
  private async handleDataDrivenTestResults(
    test: vscode.TestItem, 
    data: TestData, 
    result: any, 
    run: vscode.TestRun, 
    workspacePath: string
  ): Promise<void> {
    this.logger.appendLine(`SpockTestController: Handling data-driven test results for ${data.className}.${data.testName}`);
    
    try {
      // Parse iteration results
      const iterationResults = await this.testResultParser.parseTestResults(
        result.output || '',
        data.testName!,
        data.className!,
        workspacePath
      );

      if (iterationResults.length > 0) {
        this.logger.appendLine(`SpockTestController: Found ${iterationResults.length} iteration results`);
        
        // Update test data with iteration results
        data.iterationResults = iterationResults;
        this.testData.set(test, data);
        
        // Create flat test items for each iteration with test name prepended
        this.createFlatIterationItems(test, iterationResults, run);
      } else {
        // No iteration results found, treat as regular test
        this.logger.appendLine(`SpockTestController: No iteration results found, treating as regular test`);
        if (result.success) {
          run.passed(test, Date.now() - Date.now());
        } else {
          const errorInfo = result.errorInfo;
          const message = new vscode.TestMessage(errorInfo?.error || 'Test failed');
          if (errorInfo?.location) {
            message.location = errorInfo.location;
          }
          run.failed(test, message, Date.now() - Date.now());
        }
      }
    } catch (error) {
      this.logger.appendLine(`SpockTestController: Error handling data-driven test results: ${error}`);
      // Fallback to regular test result
      if (result.success) {
        run.passed(test, Date.now() - Date.now());
      } else {
        const errorInfo = result.errorInfo;
        const message = new vscode.TestMessage(errorInfo?.error || 'Test failed');
        if (errorInfo?.location) {
          message.location = errorInfo.location;
        }
        run.failed(test, message, Date.now() - Date.now());
      }
    }
  }



  /**
   * Clean up old iteration items for a file
   */
  private cleanupIterationItems(fileUri: string): void {
    const items = this.iterationItems.get(fileUri);
    if (items) {
      this.logger.appendLine(`SpockTestController: Cleaning up ${items.length} old iteration items for ${fileUri}`);
      for (const item of items) {
        this.controller.items.delete(item.id);
        this.testData.delete(item);
      }
      this.iterationItems.delete(fileUri);
    }
  }

  /**
   * Create flat test items for parameterized test iterations
   */
  private createFlatIterationItems(
    parentTest: vscode.TestItem, 
    iterationResults: TestIterationResult[], 
    run: vscode.TestRun
  ): void {
    this.logger.appendLine(`SpockTestController: Creating ${iterationResults.length} flat iteration items`);
    
    // Get the test name from the parent test
    const testName = parentTest.label;
    const className = this.testData.get(parentTest)?.className || 'Unknown';
    const fileUri = parentTest.uri?.toString() || '';
    
    // Sort iterations by index, with fallback to parameter-based sorting
    const sortedResults = iterationResults.sort((a, b) => {
      // First try to sort by index
      if (a.index !== b.index) {
        return a.index - b.index;
      }
      
      // Fallback: sort by parameter values for consistent ordering
      const aParams = Object.values(a.parameters).join(',');
      const bParams = Object.values(b.parameters).join(',');
      return aParams.localeCompare(bParams);
    });
    
    // Track iteration items for cleanup
    const newIterationItems: vscode.TestItem[] = [];
    
    for (const iteration of sortedResults) {
      // Create a flat test item with test name prepended
      const iterationId = `${parentTest.id}#iteration-${iteration.index}`;
      const iterationLabel = `${testName} [#${iteration.index}] ${this.formatParameters(iteration.parameters)}`;
      
      const iterationItem = this.controller.createTestItem(
        iterationId,
        iterationLabel,
        parentTest.uri
      );
      
      // Set the range to the specific line in the where block for this iteration
      const iterationRange = this.calculateIterationRange(parentTest, iteration);
      iterationItem.range = iterationRange;
      
      // Set iteration data
      this.testData.set(iterationItem, {
        type: 'test',
        className: className,
        testName: testName,
        isDataDriven: false // Individual iterations are not data-driven themselves
      });
      
      // Add to the controller (not as a child, but as a sibling)
      this.controller.items.add(iterationItem);
      
      // Track this iteration item for cleanup
      newIterationItems.push(iterationItem);
      
      // Set result status for the iteration
      if (iteration.success) {
        run.passed(iterationItem, iteration.duration * 1000);
      } else {
        const message = new vscode.TestMessage(iteration.errorInfo?.error || 'Iteration failed');
        if (iteration.errorInfo?.location) {
          message.location = iteration.errorInfo.location;
        }
        run.failed(iterationItem, message, iteration.duration * 1000);
      }
      
      this.logger.appendLine(`SpockTestController: Created flat iteration item: ${iterationLabel}`);
    }
    
    // Store the new iteration items for this file
    this.iterationItems.set(fileUri, newIterationItems);
    
    // Mark the parent test as passed/failed based on all iterations
    const allPassed = iterationResults.every(iter => iter.success);
    if (allPassed) {
      run.passed(parentTest, Date.now() - Date.now());
    } else {
      const failedCount = iterationResults.filter(iter => !iter.success).length;
      const message = new vscode.TestMessage(`${failedCount} of ${iterationResults.length} iterations failed`);
      run.failed(parentTest, message, Date.now() - Date.now());
    }
  }

  /**
   * Calculate the range for a specific iteration in the where block
   */
  private calculateIterationRange(parentTest: vscode.TestItem, iteration: TestIterationResult): vscode.Range {
    if (!parentTest.uri) {
      return parentTest.range || new vscode.Range(0, 0, 0, 0);
    }

    try {
      // Read the file content to find the where block
      const content = fs.readFileSync(parentTest.uri.fsPath, 'utf8');
      const lines = content.split('\n');
      
      // Find the test method and where block
      const testName = parentTest.label;
      let testMethodLine = -1;
      let whereBlockLine = -1;
      
      // Find the test method line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(`def "${testName}"`) || line.includes(`def ${testName}`)) {
          testMethodLine = i;
          break;
        }
      }
      
      if (testMethodLine === -1) {
        return parentTest.range || new vscode.Range(0, 0, 0, 0);
      }
      
      // Find the where block after the test method
      for (let i = testMethodLine; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === 'where:') {
          whereBlockLine = i;
          break;
        }
      }
      
      if (whereBlockLine === -1) {
        return parentTest.range || new vscode.Range(0, 0, 0, 0);
      }
      
      // Calculate the line for this iteration
      // Skip the header line (e.g., "a | b | c") and go to the data line
      const dataStartLine = whereBlockLine + 2; // Skip "where:" and header
      const iterationLine = dataStartLine + iteration.index;
      
      // Make sure we don't go beyond the file
      if (iterationLine >= lines.length) {
        return parentTest.range || new vscode.Range(0, 0, 0, 0);
      }
      
      // Return the range for the specific iteration line
      return new vscode.Range(iterationLine, 0, iterationLine, lines[iterationLine].length);
      
    } catch (error) {
      this.logger.appendLine(`Error calculating iteration range: ${error}`);
      return parentTest.range || new vscode.Range(0, 0, 0, 0);
    }
  }

  /**
   * Format parameters for display in test item label
   */
  private formatParameters(parameters: Record<string, any>): string {
    const entries = Object.entries(parameters);
    if (entries.length === 0) {
      return '';
    }
    
    return entries
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }
}

interface TestData {
  type: 'file' | 'class' | 'test';
  className?: string;
  testName?: string;
  isDataDriven?: boolean;
  iterationResults?: TestIterationResult[];
}
