import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SpockTestController } from './testController';

export function activate(context: vscode.ExtensionContext) {
  const logger = vscode.window.createOutputChannel('Spock Test Runner');
  const diagnostic = vscode.languages.createDiagnosticCollection('spock-test-runner');

  // Initialize the Test Controller
  const testController = new SpockTestController(context);

  // Command to run all tests in a file
  context.subscriptions.push(
    vscode.commands.registerCommand('spock-test-runner-vscode.runTest', async (uri: vscode.Uri) => {
      const filePath = uri.fsPath;
      if (!filePath.endsWith('.groovy')) {
        vscode.window.showErrorMessage('Please select a .groovy file.');
        return;
      }
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      const buildTool = workspaceFolder ? detectBuildTool(workspaceFolder.uri.fsPath) : null;
      const testClassName = extractTestName(filePath);

      if (!workspaceFolder || !buildTool || !testClassName) {
        vscode.window.showErrorMessage('Invalid setup: Check workspace, build tool, or file name.');
        logger.appendLine(`[ERROR] ${filePath}: Invalid setup - Workspace: ${!!workspaceFolder}, Build Tool: ${buildTool}, Class: ${testClassName}`);
        return;
      }

      await runSpockTest(testClassName, null, workspaceFolder.uri.fsPath, buildTool, logger);
    })
  );

  // Command to run a specific test
  context.subscriptions.push(
    vscode.commands.registerCommand('spock-test-runner-vscode.runSpecificTest', async (testClassName: string, testMethod: string, workspacePath: string, buildTool: 'gradle' | 'maven') => {
      logger.appendLine(`[INFO] Running test ${testClassName}.${testMethod}`);
      await runSpockTest(testClassName, testMethod, workspacePath, buildTool, logger);
    })
  );

  // Command to debug a specific test
  context.subscriptions.push(
    vscode.commands.registerCommand('spock-test-runner-vscode.debugSpecificTest', async (testClassName: string, testMethod: string, workspacePath: string, buildTool: 'gradle' | 'maven') => {
      logger.appendLine(`[INFO] Debugging test ${testClassName}.${testMethod}`);
      await runSpockTest(testClassName, testMethod, workspacePath, buildTool, logger, true);
    })
  );

  context.subscriptions.push(logger, diagnostic);
}

// Utility functions
function detectBuildTool(workspacePath: string): 'gradle' | 'maven' | null {
  if (fs.existsSync(path.join(workspacePath, 'build.gradle'))) return 'gradle';
  if (fs.existsSync(path.join(workspacePath, 'pom.xml'))) return 'maven';
  return null;
}

function extractTestName(filePath: string): string | null {
  const fileName = path.basename(filePath, '.groovy');
  return fileName.endsWith('Spec') || fileName.endsWith('Test') ? fileName : null;
}

async function runSpockTest(testClassName: string, testMethod: string | null, workspacePath: string, buildTool: 'gradle' | 'maven', logger: vscode.OutputChannel, debug: boolean = false) {
  const terminal = vscode.window.createTerminal('Spock Test Runner');
  terminal.show();

  // Escape spaces in test method name and wrap in quotes
  const escapedTestName = testMethod 
    ? `"${testClassName}.${testMethod}"` 
    : `"${testClassName}"`;
  
  const commandArgs = buildTool === 'gradle'
    ? ['./gradlew', 'test', `--tests ${escapedTestName}`].concat(debug ? ['--debug-jvm'] : [])
    : ['mvn', 'test', `-Dtest=${escapedTestName}`].concat(debug ? ['-Dmaven.surefire.debug'] : []);

  try {
    logger.appendLine(`[INFO] Starting ${debug ? 'debug' : 'test'}: ${testClassName}.${testMethod || ''} in ${workspacePath}`);
    terminal.sendText(`cd ${workspacePath}`);
    
    // Join the command arguments properly for the terminal
    const fullCommand = commandArgs.join(' ');
    terminal.sendText(fullCommand);

    if (debug) {
      vscode.window.showInformationMessage('Debugger is ready to attach. The test will wait for debugger connection on port 5005.');
    }

  } catch (error: unknown) {
    const errorMessage = `Failed to run ${testClassName}.${testMethod || ''}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    terminal.sendText(errorMessage);
    logger.appendLine(`[ERROR] ${errorMessage}`);
    vscode.window.showErrorMessage(errorMessage);
  }
}

export function deactivate() {}
