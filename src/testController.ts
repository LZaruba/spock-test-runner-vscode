import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import { spawn } from 'child_process';

export class SpockTestController {
  private controller: vscode.TestController;
  private logger: vscode.OutputChannel;
  private testData = new WeakMap<vscode.TestItem, TestData>();

  constructor(context: vscode.ExtensionContext) {
    this.logger = vscode.window.createOutputChannel('Spock Test Runner');
    this.logger.appendLine('SpockTestController: Initializing...');
    
    // Create the test controller
    this.controller = vscode.tests.createTestController(
      'spock-test-runner-vscode',
      'Spock Tests'
    );
    
    this.logger.appendLine('SpockTestController: TestController created');

    // Set up test discovery
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

    // Set up file watchers
    this.setupFileWatchers();

    // Create run profiles
    this.createRunProfiles();

    context.subscriptions.push(this.controller, this.logger);
  }

  private setupFileWatchers() {
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

  private createRunProfiles() {
    // Run profile
    const runProfile = this.controller.createRunProfile(
      'Run',
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runHandler(false, request, token)
    );

    // Debug profile
    const debugProfile = this.controller.createRunProfile(
      'Debug',
      vscode.TestRunProfileKind.Debug,
      (request, token) => this.runHandler(true, request, token)
    );
  }

  private async discoverAllTests() {
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

  private async discoverTestsInFile(file: vscode.TestItem) {
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

  private parseTestsInFile(file: vscode.TestItem, content: string) {
    if (!file.uri) {
      return;
    }

    this.logger.appendLine(`SpockTestController: Parsing tests in file: ${file.uri.fsPath}`);

    // Clear existing children
    file.children.replace([]);

    const lines = content.split('\n');
    let currentClass: vscode.TestItem | null = null;
    let inClass = false;
    let classBraceBalance = 0; // Tracks braces within the current class body
    let seenClassOpeningBrace = false;
    let testCount = 0;

    // Lifecycle methods that should NOT be considered as tests
    const lifecycleMethods = new Set(["setup", "setupSpec", "cleanup", "cleanupSpec"]);

    // Regex for class declaration extending Specification (supports fully-qualified name)
    const classRegex = /^(?:abstract\s+)?class\s+(\w+)\s+extends\s+(?:[\w.]*\.)?Specification\b/;

    // Regex for feature method headers (Spock)
    // Supports: def/void "name"(...)? {, def/void name(...)? {, with optional brace on next line
    const methodHeaderRegex = /^(?:def|void)\s+(['"]([^'"]+)['"]|([a-zA-Z_][a-zA-Z0-9_]*))\s*(?:\([^)]*\))?\s*(\{)?\s*$/;

    const hasOpeningBraceOnOrNextLine = (startIndex: number): boolean => {
      // Same line handled by (\{)? capture; this checks next non-empty line for a leading '{'
      for (let j = startIndex + 1; j < Math.min(lines.length, startIndex + 5); j++) {
        const t = lines[j].trim();
        if (!t) {
          continue;
        }
        // Allow comments before '{'
        if (t.startsWith('//')) {
          continue;
        }
        return t.startsWith('{');
      }
      return false;
    };

    const lineHasSpockBlockLabelNearby = (startIndex: number): boolean => {
      // Look ahead a limited window for Spock block labels to confirm feature methods with unquoted names
      const blockLabelRegex = /^(given|when|then|expect|where)\s*:\s*$/;
      for (let j = startIndex + 1; j < Math.min(lines.length, startIndex + 50); j++) {
        const t = lines[j].trim();
        if (!t) {
          continue;
        }
        if (blockLabelRegex.test(t)) {
          return true;
        }
        // Stop early if we likely left the method (very rough)
        if (t === '}') {
          return false;
        }
      }
      return false;
    };

    const countBraceDelta = (text: string): number => {
      const open = (text.match(/\{/g) || []).length;
      const close = (text.match(/\}/g) || []).length;
      return open - close;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      this.logger.appendLine(`SpockTestController: Processing line ${i + 1}: "${trimmedLine}"`);

      // Look for class definition
      if (classRegex.test(trimmedLine)) {
        const className = trimmedLine.match(classRegex)?.[1];
        if (className) {
          this.logger.appendLine(`SpockTestController: Found test class: ${className}`);
          currentClass = this.controller.createTestItem(
            `${file.uri.toString()}#${className}`,
            className,
            file.uri
          );
          currentClass.range = new vscode.Range(i, 0, i, line.length);
          this.testData.set(currentClass, { type: 'class', className });
          file.children.add(currentClass);
          inClass = true;
          // Initialize class brace tracking on this line
          const delta = countBraceDelta(line);
          if (delta > 0) {
            seenClassOpeningBrace = true;
          }
          classBraceBalance += delta;
        }
      }
      // Look for test methods - handle various Spock patterns and avoid lifecycle methods
      else if (inClass && currentClass && methodHeaderRegex.test(trimmedLine)) {
        const match = trimmedLine.match(methodHeaderRegex);
        const rawName = (match?.[2] || match?.[3] || '').trim();
        const hasBraceSameLine = !!match?.[4];

        if (rawName && !lifecycleMethods.has(rawName)) {
          // If unquoted name, confirm presence of Spock block labels to reduce false positives
          const isQuoted = !!match?.[2];
          const shouldAccept = isQuoted || lineHasSpockBlockLabelNearby(i);

          // Ensure there's an opening brace either on same line or next line
          const braceOk = hasBraceSameLine || hasOpeningBraceOnOrNextLine(i);

          if (shouldAccept && braceOk) {
            const testName = rawName;
            this.logger.appendLine(`SpockTestController: Found test method: ${testName}`);
            testCount++;
            const testItem = this.controller.createTestItem(
              `${file.uri.toString()}#${currentClass.id}#${testName}`,
              testName,
              file.uri
            );
            testItem.range = new vscode.Range(i, 0, i, line.length);
            this.testData.set(testItem, {
              type: 'test',
              className: this.testData.get(currentClass)?.className || '',
              testName
            });
            currentClass.children.add(testItem);
          }
        }
      }

      // Update class brace balance and determine end of class
      if (inClass) {
        const delta = countBraceDelta(line);
        if (delta > 0) {
          seenClassOpeningBrace = true;
        }
        classBraceBalance += delta;
        if (seenClassOpeningBrace && classBraceBalance <= 0) {
          // We've closed the class body
          inClass = false;
          currentClass = null;
          seenClassOpeningBrace = false;
          classBraceBalance = 0;
        }
      }
    }
    
    this.logger.appendLine(`SpockTestController: Parsed ${testCount} tests in file: ${file.uri.fsPath}`);
  }

  private async runHandler(debug: boolean, request: vscode.TestRunRequest, token: vscode.CancellationToken) {
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
          // Add children to queue
          test.children.forEach(child => queue.push(child));
          break;
        case 'class':
          // Add children to queue
          test.children.forEach(child => queue.push(child));
          break;
        case 'test':
          await this.runTest(test, data, run, debug);
          break;
      }
    }

    run.end();
  }

  private async runTest(test: vscode.TestItem, data: TestData, run: vscode.TestRun, debug: boolean) {
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

      const buildTool = this.detectBuildTool(workspaceFolder.uri.fsPath);
      if (!buildTool) {
        throw new Error('No build tool detected (Gradle/Maven)');
      }

      const result = await this.executeTest(data.className!, data.testName!, workspaceFolder.uri.fsPath, buildTool, debug, run, test);
      
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

  private detectBuildTool(workspacePath: string): 'gradle' | 'maven' | null {
    if (fs.existsSync(path.join(workspacePath, 'build.gradle'))) {
      this.logger.appendLine(`SpockTestController: Found build.gradle in ${workspacePath}`);
      return 'gradle';
    }
    if (fs.existsSync(path.join(workspacePath, 'pom.xml'))) {
      this.logger.appendLine(`SpockTestController: Found pom.xml in ${workspacePath}`);
      return 'maven';
    }
    this.logger.appendLine(`SpockTestController: No build tool detected in ${workspacePath}`);
    return null;
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.listen(port, () => {
        server.once('close', () => {
          resolve(true);
        });
        server.close();
      });
      
      server.on('error', () => {
        resolve(false);
      });
    });
  }

  private async generateAvailableDebugPort(): Promise<number> {
    const maxAttempts = 10;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate a random port between 5000 and 65535
      const port = Math.floor(Math.random() * (65535 - 5000 + 1)) + 5000;
      
      const isAvailable = await this.isPortAvailable(port);
      if (isAvailable) {
        this.logger.appendLine(`SpockTestController: Found available debug port: ${port}`);
        return port;
      }
      
      this.logger.appendLine(`SpockTestController: Port ${port} is in use, trying another...`);
    }
    
    // Fallback: try sequential ports starting from 5000
    for (let port = 5000; port <= 65535; port++) {
      const isAvailable = await this.isPortAvailable(port);
      if (isAvailable) {
        this.logger.appendLine(`SpockTestController: Found available debug port (sequential): ${port}`);
        return port;
      }
    }
    
    throw new Error('No available debug ports found');
  }

  private async waitForJvmDebugPort(debugPort: number, maxWaitTime: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 1000; // Check every 1 second for more stability
    let consecutiveSuccesses = 0;
    const requiredSuccesses = 2; // Require 2 consecutive successful connections
    
    this.logger.appendLine(`SpockTestController: Waiting for JVM debug port ${debugPort} to be ready...`);
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Try to connect to the debug port to see if JVM is ready
        const isReady = await this.checkJvmDebugPort(debugPort);
        if (isReady) {
          consecutiveSuccesses++;
          this.logger.appendLine(`SpockTestController: JVM debug port ${debugPort} connection successful (${consecutiveSuccesses}/${requiredSuccesses})`);
          
          if (consecutiveSuccesses >= requiredSuccesses) {
            this.logger.appendLine(`SpockTestController: JVM debug port ${debugPort} is fully ready`);
            return true;
          }
        } else {
          consecutiveSuccesses = 0; // Reset counter on failure
        }
      } catch (error) {
        consecutiveSuccesses = 0; // Reset counter on error
        this.logger.appendLine(`SpockTestController: JVM debug port ${debugPort} not ready yet: ${error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    this.logger.appendLine(`SpockTestController: JVM debug port ${debugPort} not ready after ${maxWaitTime}ms`);
    return false;
  }

  private async checkJvmDebugPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.setTimeout(5000); // Increased timeout to 5 seconds
      
      socket.connect(port, 'localhost', () => {
        // JVM debug port is ready - we can connect
        this.logger.appendLine(`SpockTestController: Successfully connected to debug port ${port}`);
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', (error) => {
        // Connection failed - JVM not ready yet
        this.logger.appendLine(`SpockTestController: Connection failed to port ${port}: ${error.message}`);
        socket.destroy();
        resolve(false);
      });
      
      socket.on('timeout', () => {
        // Connection timed out - JVM not ready yet
        this.logger.appendLine(`SpockTestController: Connection timeout to port ${port}`);
        socket.destroy();
        resolve(false);
      });
    });
  }

  private async startDebugSession(workspacePath: string, className: string, testName: string, debugPort: number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      this.logger.appendLine(`SpockTestController: Starting debug session for ${className}.${testName} on port ${debugPort}`);

      // Wait for the JVM to be ready on the debug port
      this.logger.appendLine(`SpockTestController: Waiting for JVM to be ready on port ${debugPort}...`);
      const jvmReady = await this.waitForJvmDebugPort(debugPort, 60000); // Wait up to 60 seconds for Gradle
      
      if (!jvmReady) {
        this.logger.appendLine(`SpockTestController: JVM not ready on port ${debugPort} after 60 seconds`);
        reject(new Error(`JVM not ready on port ${debugPort}`));
        return;
      }

      this.logger.appendLine(`SpockTestController: JVM is ready on port ${debugPort}, starting debug session...`);

      // Ensure launch configuration exists for Groovy debugging
      await this.ensureLaunchConfiguration(workspacePath);

      // Add additional delay and retry logic to ensure the debug port is fully ready
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try to start debug session with retry logic
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          await this.attemptDebugConnection(workspacePath, className, testName, debugPort);
          this.logger.appendLine(`SpockTestController: Debug session started successfully on port ${debugPort}`);
          resolve();
          return;
        } catch (error) {
          retryCount++;
          this.logger.appendLine(`SpockTestController: Debug connection attempt ${retryCount} failed: ${error}`);
          
          if (retryCount < maxRetries) {
            this.logger.appendLine(`SpockTestController: Retrying debug connection in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      reject(new Error(`Failed to start debug session after ${maxRetries} attempts`));
    });
  }

  private async attemptDebugConnection(workspacePath: string, className: string, testName: string, debugPort: number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // Log source paths for debugging - include all possible source directories
      const sourcePaths = [
        workspacePath,
        path.join(workspacePath, 'src', 'test', 'groovy'),
        path.join(workspacePath, 'src', 'main', 'groovy'),
        path.join(workspacePath, 'src', 'test', 'java'),
        path.join(workspacePath, 'src', 'main', 'java'),
        path.join(workspacePath, 'src', 'test', 'kotlin'),
        path.join(workspacePath, 'src', 'main', 'kotlin'),
        path.join(workspacePath, 'build', 'generated', 'sources'),
        path.join(workspacePath, 'build', 'generated', 'test-sources')
      ];
      
      this.logger.appendLine(`SpockTestController: Debug source paths:`);
      sourcePaths.forEach((sourcePath, index) => {
        const exists = fs.existsSync(sourcePath);
        this.logger.appendLine(`SpockTestController:   ${index + 1}. ${sourcePath} (exists: ${exists})`);
      });

      // Create a debug configuration for attaching to the Java process
      const debugConfig: vscode.DebugConfiguration = {
        type: 'java',
        name: `Debug Spock Test: ${className}.${testName}`,
        request: 'attach',
        hostName: 'localhost',
        port: debugPort,
        projectName: this.getProjectName(workspacePath),
        sourcePaths: sourcePaths,
        // Ensure we can debug Groovy code
        stepFilters: {
          skipClasses: false,
          skipSynthetics: false,
          skipStaticInitializers: false,
          skipConstructors: false
        },
        // Enable debugging for all source files
        includeMain: true,
        includeTest: true
      };

      try {
        const success = await vscode.debug.startDebugging(undefined, debugConfig);
        if (success) {
          this.logger.appendLine(`SpockTestController: Debug session started successfully on port ${debugPort}`);
          resolve();
        } else {
          this.logger.appendLine(`SpockTestController: Failed to start debug session on port ${debugPort}`);
          reject(new Error('Failed to start debug session'));
        }
      } catch (error) {
        this.logger.appendLine(`SpockTestController: Error starting debug session: ${error}`);
        reject(error);
      }
    });
  }

  private getProjectName(workspacePath: string): string {
    // Try to extract project name from build.gradle or pom.xml
    try {
      const gradlePath = path.join(workspacePath, 'build.gradle');
      const mavenPath = path.join(workspacePath, 'pom.xml');
      
      if (fs.existsSync(gradlePath)) {
        const gradleContent = fs.readFileSync(gradlePath, 'utf8');
        const nameMatch = gradleContent.match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/) || 
                         gradleContent.match(/name\s*=\s*['"]([^'"]+)['"]/);
        if (nameMatch) {
          return nameMatch[1];
        }
      }
      
      if (fs.existsSync(mavenPath)) {
        const mavenContent = fs.readFileSync(mavenPath, 'utf8');
        const nameMatch = mavenContent.match(/<artifactId>([^<]+)<\/artifactId>/);
        if (nameMatch) {
          return nameMatch[1];
        }
      }
    } catch (error) {
      this.logger.appendLine(`SpockTestController: Error extracting project name: ${error}`);
    }
    
    // Fallback to workspace folder name
    return path.basename(workspacePath);
  }

  private async ensureLaunchConfiguration(workspacePath: string): Promise<void> {
    const vscodeDir = path.join(workspacePath, '.vscode');
    const launchJsonPath = path.join(vscodeDir, 'launch.json');
    
    // Create .vscode directory if it doesn't exist
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }
    
    // Create or update launch.json with Groovy debugging support
    let launchConfig: any = {};
    if (fs.existsSync(launchJsonPath)) {
      try {
        const content = fs.readFileSync(launchJsonPath, 'utf8');
        launchConfig = JSON.parse(content);
      } catch (error) {
        this.logger.appendLine(`SpockTestController: Error reading launch.json: ${error}`);
      }
    }
    
    if (!launchConfig.version) {
      launchConfig.version = '0.2.0';
    }
    
    if (!launchConfig.configurations) {
      launchConfig.configurations = [];
    }
    
    // Add Groovy debugging configuration if it doesn't exist
    const groovyDebugConfig = {
      type: 'java',
      name: 'Debug Spock Tests (Groovy)',
      request: 'attach',
      hostName: 'localhost',
      port: 5005,
      projectName: this.getProjectName(workspacePath),
      sourcePaths: [
        '${workspaceFolder}',
        '${workspaceFolder}/src/test/groovy',
        '${workspaceFolder}/src/main/groovy',
        '${workspaceFolder}/src/test/java',
        '${workspaceFolder}/src/main/java'
      ],
      stepFilters: {
        skipClasses: false,
        skipSynthetics: false,
        skipStaticInitializers: false,
        skipConstructors: false
      }
    };
    
    // Check if Groovy debug config already exists
    const existingConfig = launchConfig.configurations.find((config: any) => config.name === 'Debug Spock Tests (Groovy)');
    if (!existingConfig) {
      launchConfig.configurations.push(groovyDebugConfig);
      
      try {
        fs.writeFileSync(launchJsonPath, JSON.stringify(launchConfig, null, 2));
        this.logger.appendLine(`SpockTestController: Created launch.json with Groovy debugging support`);
      } catch (error) {
        this.logger.appendLine(`SpockTestController: Error writing launch.json: ${error}`);
      }
    }
  }

  private async executeTest(className: string, testName: string, workspacePath: string, buildTool: 'gradle' | 'maven', debug: boolean, run: vscode.TestRun, testItem?: vscode.TestItem): Promise<TestResult> {
    return new Promise(async (resolve) => {
      let timeoutId: NodeJS.Timeout | undefined;
      let processKilled = false;
      // Properly escape the test name for command line
      const escapedTestName = `${className}.${testName}`;
      
      // Generate an available debug port if debugging
      let debugPort = 0;
      if (debug) {
        try {
          debugPort = await this.generateAvailableDebugPort();
        } catch (error) {
          this.logger.appendLine(`SpockTestController: Failed to find available debug port: ${error}`);
          // Continue without debugging
          debug = false;
        }
      }
      
      let commandArgs: string[];
      if (buildTool === 'gradle') {
        // Try gradlew first, then gradle
        if (fs.existsSync(path.join(workspacePath, 'gradlew'))) {
          if (debug) {
            // Use --debug-jvm for debug port and -Dorg.gradle.jvmargs for timestamp to test JVM
            commandArgs = ['./gradlew', 'test', '--tests', escapedTestName, '--debug-jvm', `-Dorg.gradle.jvmargs=-Dtest.timestamp=${Date.now()}`];
          } else {
            commandArgs = ['./gradlew', 'test', '--tests', escapedTestName, `-Dorg.gradle.jvmargs=-Dtest.timestamp=${Date.now()}`];
          }
        } else {
          if (debug) {
            // Use --debug-jvm for debug port and -Dorg.gradle.jvmargs for timestamp to test JVM
            commandArgs = ['gradle', 'test', '--tests', escapedTestName, '--debug-jvm', `-Dorg.gradle.jvmargs=-Dtest.timestamp=${Date.now()}`];
          } else {
            commandArgs = ['gradle', 'test', '--tests', escapedTestName, `-Dorg.gradle.jvmargs=-Dtest.timestamp=${Date.now()}`];
          }
        }
      } else {
        // Maven debug syntax
        commandArgs = ['mvn', 'test', `-Dtest=${escapedTestName}`, `-Dtest.timestamp=${Date.now()}`].concat(debug ? [`-Dmaven.surefire.debug=-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=${debugPort}`] : []);
      }

      // If debugging, start the debug session in the background
      if (debug) {
        // Use default Gradle debug port (5005) when using --debug-jvm
        const gradleDebugPort = 5005;
        this.logger.appendLine(`SpockTestController: Using Gradle debug port ${gradleDebugPort} for ${className}.${testName}`);
        // Start the debug session after a longer delay to let the JVM fully start
        setTimeout(() => {
          this.startDebugSession(workspacePath, className, testName, gradleDebugPort).catch(error => {
            this.logger.appendLine(`SpockTestController: Failed to start debug session: ${error}`);
          });
        }, 12000); // Increased delay to 12 seconds to let JVM fully start and be ready for debug connections
      }

      this.logger.appendLine(`SpockTestController: Executing test: ${className}.${testName}`);
      this.logger.appendLine(`SpockTestController: Command: ${commandArgs.join(' ')}`);
      this.logger.appendLine(`SpockTestController: Command args: [${commandArgs.map(arg => `"${arg}"`).join(', ')}]`);
      this.logger.appendLine(`SpockTestController: Working directory: ${workspacePath}`);
      if (debug) {
        this.logger.appendLine(`SpockTestController: Debug mode enabled - JVM will listen on port ${debugPort}`);
      }

      // Set up environment variables for debugging
      const env = { ...process.env };

      const childProcess = spawn(commandArgs[0], commandArgs.slice(1), {
        cwd: workspacePath,
        stdio: 'pipe',
        env: env
      });

      // Set up timeout to kill process if it runs too long (5 minutes)
      timeoutId = setTimeout(() => {
        if (!childProcess.killed && !processKilled) {
          this.logger.appendLine(`SpockTestController: Test timeout - killing process after 5 minutes`);
          processKilled = true;
          childProcess.kill('SIGTERM');
          
          // Force kill after 10 seconds if SIGTERM doesn't work
          setTimeout(() => {
            if (!childProcess.killed) {
              this.logger.appendLine(`SpockTestController: Force killing process with SIGKILL`);
              childProcess.kill('SIGKILL');
            }
          }, 10000);
          
          resolve({ 
            success: false, 
            errorInfo: { error: 'Test execution timed out after 5 minutes' },
            output: 'Test execution timed out after 5 minutes'
          });
        }
      }, 5 * 60 * 1000); // 5 minutes timeout

      // Log process output for debugging
      if (debug) {
        childProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString();
          this.logger.appendLine(`SpockTestController: Gradle stdout: ${output.trim()}`);
          // Look for debug port messages
          if (output.includes('Listening for transport') || output.includes('Debugger listening')) {
            this.logger.appendLine(`SpockTestController: JVM debug port detected in output`);
          }
        });

        childProcess.stderr.on('data', (data: Buffer) => {
          const output = data.toString();
          this.logger.appendLine(`SpockTestController: Gradle stderr: ${output.trim()}`);
          // Look for debug port messages
          if (output.includes('Listening for transport') || output.includes('Debugger listening')) {
            this.logger.appendLine(`SpockTestController: JVM debug port detected in stderr`);
          }
        });
      }

      let output = '';
      let errorOutput = '';
      let testOutput = '';

      childProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        
        // Convert LF to CRLF for VS Code Test Results view (terminal rendering)
        const crlfText = text.replace(/\n/g, '\r\n');
        
        // If we have a specific test item, append to that test's output
        if (testItem) {
          run.appendOutput(crlfText, undefined, testItem);
        } else {
          // Otherwise append to general output
          run.appendOutput(crlfText);
        }
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        errorOutput += text;
        
        // Convert LF to CRLF for VS Code Test Results view (terminal rendering)
        const crlfText = text.replace(/\n/g, '\r\n');
        
        // If we have a specific test item, append to that test's output
        if (testItem) {
          run.appendOutput(crlfText, undefined, testItem);
        } else {
          // Otherwise append to general output
          run.appendOutput(crlfText);
        }
      });

      childProcess.on('close', (code: number | null) => {
        // Clear timeout since process finished
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        this.logger.appendLine(`SpockTestController: Process closed with code: ${code}`);
        this.logger.appendLine(`SpockTestController: Output length: ${output.length}, Error length: ${errorOutput.length}, Test output length: ${testOutput.length}`);
        const success = code === 0;
        const fullOutput = output + errorOutput;
        const errorInfo = success ? undefined : this.parseTestError(fullOutput);
        this.logger.appendLine(`SpockTestController: Test result - Success: ${success}`);
        
        // Ensure process is killed if it's still running
        if (!childProcess.killed && !processKilled) {
          this.logger.appendLine(`SpockTestController: Killing remaining process...`);
          processKilled = true;
          childProcess.kill('SIGTERM');
        }
        
        resolve({ success, errorInfo, output: fullOutput, testOutput });
      });

      childProcess.on('error', (error: Error) => {
        // Clear timeout since process errored
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        this.logger.appendLine(`SpockTestController: Process error: ${error.message}`);
        const errorMessage = `Process error: ${error.message}`;
        if (testItem) {
          run.appendOutput(errorMessage, undefined, testItem);
        } else {
          run.appendOutput(errorMessage);
        }
        
        // Ensure process is killed on error
        if (!childProcess.killed && !processKilled) {
          this.logger.appendLine(`SpockTestController: Killing process due to error...`);
          processKilled = true;
          childProcess.kill('SIGTERM');
        }
        
        resolve({ 
          success: false, 
          errorInfo: { error: error.message },
          output: errorMessage
        });
      });
    });
  }

  private parseTestError(output: string): { error: string; location?: vscode.Location } | undefined {
    const lines = output.split('\n');
    let errorMessage = 'Test execution failed';
    let location: vscode.Location | undefined;

    // Look for specific test failure patterns
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for FAILED status
      if (line.includes('FAILED') && (line.includes('Test') || line.includes('Spec'))) {
        errorMessage = line.trim();
      }
      
      // Look for assertion errors
      if (line.includes('Condition not satisfied:') || line.includes('Assertion failed:')) {
        errorMessage = line.trim();
      }
      
      // Look for Spock-specific errors
      if (line.includes('spock.lang.Specification') || line.includes('groovy.lang.MissingMethodException')) {
        errorMessage = line.trim();
      }
      
      // Look for stack trace with file location
      if (line.includes('.groovy:') && line.includes('at ')) {
        const match = line.match(/at\s+.*\((.+\.groovy):(\d+)\)/);
        if (match) {
          const filePath = match[1];
          const lineNumber = parseInt(match[2]) - 1; // Convert to 0-based
          
          try {
            const uri = vscode.Uri.file(path.resolve(filePath));
            location = new vscode.Location(uri, new vscode.Position(lineNumber, 0));
          } catch (e) {
            // Ignore if file path is invalid
          }
        }
      }
    }

    // If no specific error found, look for any error-like patterns
    if (errorMessage === 'Test execution failed') {
      for (const line of lines) {
        if (line.includes('Exception') || line.includes('Error') || line.includes('failed')) {
          errorMessage = line.trim();
          break;
        }
      }
    }

    return { error: errorMessage, location };
  }
}

interface TestData {
  type: 'file' | 'class' | 'test';
  className?: string;
  testName?: string;
}

interface TestResult {
  success: boolean;
  errorInfo?: { error: string; location?: vscode.Location };
  output?: string;
  testOutput?: string;
}
