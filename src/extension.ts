import * as vscode from 'vscode';
import * as path from 'path';
import { SpockTestController } from './testController';
import { BuildToolService } from './services/BuildToolService';
import { TestExecutionService } from './services/TestExecutionService';
import { BuildTool } from './types';

export function activate(context: vscode.ExtensionContext) {
  const logger = vscode.window.createOutputChannel('Spock Test Runner');
  const diagnostic = vscode.languages.createDiagnosticCollection('spock-test-runner');
  const testExecutionService = new TestExecutionService(logger);

  // Initialize the Test Controller
  // Note: testController is never explicitly used after creation because it's self-contained
  // and automatically registers with VS Code's Test API. VS Code will call its methods
  // when users interact with the Test Explorer UI.
  new SpockTestController(context);

  // Command to run all tests in a file
  context.subscriptions.push(
    vscode.commands.registerCommand('spock-test-runner-vscode.runTest', async (uri: vscode.Uri) => {
      const filePath = uri.fsPath;
      if (!filePath.endsWith('.groovy')) {
        vscode.window.showErrorMessage('Please select a .groovy file.');
        return;
      }
      
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      const buildTool = workspaceFolder ? BuildToolService.detectBuildTool(workspaceFolder.uri.fsPath) : null;
      const testClassName = extractTestName(filePath);

      if (!workspaceFolder || !buildTool || !testClassName) {
        vscode.window.showErrorMessage('Invalid setup: Check workspace, build tool, or file name.');
        logger.appendLine(`[ERROR] ${filePath}: Invalid setup - Workspace: ${!!workspaceFolder}, Build Tool: ${buildTool}, Class: ${testClassName}`);
        return;
      }

      await runSpockTest(testClassName, null, workspaceFolder.uri.fsPath, buildTool, testExecutionService, logger, false);
    })
  );

  // Command to run a specific test
  context.subscriptions.push(
    vscode.commands.registerCommand('spock-test-runner-vscode.runSpecificTest', async (testClassName: string, testMethod: string, workspacePath: string, buildTool: BuildTool) => {
      logger.appendLine(`[INFO] Running test ${testClassName}.${testMethod}`);
      await runSpockTest(testClassName, testMethod, workspacePath, buildTool, testExecutionService, logger, false);
    })
  );

  // Command to debug a specific test
  context.subscriptions.push(
    vscode.commands.registerCommand('spock-test-runner-vscode.debugSpecificTest', async (testClassName: string, testMethod: string, workspacePath: string, buildTool: BuildTool) => {
      logger.appendLine(`[INFO] Debugging test ${testClassName}.${testMethod}`);
      await runSpockTest(testClassName, testMethod, workspacePath, buildTool, testExecutionService, logger, true);
    })
  );

  context.subscriptions.push(logger, diagnostic);
}

// Utility functions
function extractTestName(filePath: string): string | null {
  const fileName = path.basename(filePath, '.groovy');
  return fileName.endsWith('Spec') || fileName.endsWith('Test') ? fileName : null;
}

async function runSpockTest(
  testClassName: string, 
  testMethod: string | null, 
  workspacePath: string, 
  buildTool: BuildTool, 
  testExecutionService: TestExecutionService, 
  logger: vscode.OutputChannel,
  debug: boolean = false
) {
  const terminal = vscode.window.createTerminal('Spock Test Runner');
  terminal.show();

  // Use the service to get proper command args
  const escapedTestName = testMethod 
    ? `${testClassName}.${testMethod}` 
    : `${testClassName}`;
  
  const commandArgs = BuildToolService.buildCommandArgs(buildTool, escapedTestName, debug, undefined, workspacePath, logger);

  try {
    terminal.sendText(`cd ${workspacePath}`);
    const fullCommand = commandArgs.join(' ');
    terminal.sendText(fullCommand);

    if (debug) {
      const debugPort = buildTool === 'gradle' ? '5005' : 'custom port';
      vscode.window.showInformationMessage(`Debugger is ready to attach. The test will wait for debugger connection on ${debugPort}.`);
    }

  } catch (error: unknown) {
    const errorMessage = `Failed to run ${testClassName}.${testMethod || ''}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    terminal.sendText(errorMessage);
    vscode.window.showErrorMessage(errorMessage);
  }
}

export function deactivate() {}
