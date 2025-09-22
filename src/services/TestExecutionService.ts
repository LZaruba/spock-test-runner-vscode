import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { TestExecutionOptions, TestResult, BuildTool } from '../types';
import { BuildToolService } from './BuildToolService';
import { DebugService } from './DebugService';

export class TestExecutionService {
  private logger: vscode.OutputChannel;
  private debugService: DebugService;

  constructor(logger: vscode.OutputChannel) {
    this.logger = logger;
    this.debugService = new DebugService(logger);
  }

  async executeTest(options: TestExecutionOptions, run: vscode.TestRun, testItem?: vscode.TestItem): Promise<TestResult> {
    return new Promise(async (resolve) => {
      let timeoutId: NodeJS.Timeout | undefined;
      let processKilled = false;
      
      const escapedTestName = `${options.className}.${options.testName}`;
      
      // Determine debug port based on build tool
      let debugPort = 0;
      if (options.debug) {
        if (options.buildTool === 'gradle') {
          // Gradle always uses port 5005 for --debug-jvm
          debugPort = 5005;
          this.logger.appendLine(`TestExecutionService: Using Gradle default debug port ${debugPort} for ${options.className}.${options.testName}`);
        } else {
          // Maven needs a custom available port
          try {
            debugPort = await this.generateAvailableDebugPort();
            this.logger.appendLine(`TestExecutionService: Using custom debug port ${debugPort} for Maven ${options.className}.${options.testName}`);
          } catch (error) {
            this.logger.appendLine(`TestExecutionService: Failed to find available debug port: ${error}`);
            options.debug = false;
          }
        }
      }
      
      const commandArgs = BuildToolService.buildCommandArgs(
        options.buildTool, 
        escapedTestName, 
        options.debug, 
        debugPort,
        options.workspacePath,
        this.logger
      );

      // Start debug session if debugging
      if (options.debug) {
        setTimeout(() => {
          this.debugService.startDebugSession({
            workspacePath: options.workspacePath,
            className: options.className,
            testName: options.testName,
            debugPort: debugPort
          }).catch(error => {
            this.logger.appendLine(`TestExecutionService: Failed to start debug session: ${error}`);
          });
        }, 12000);
      }

      this.logger.appendLine(`TestExecutionService: Executing test: ${options.className}.${options.testName}`);
      this.logger.appendLine(`TestExecutionService: Command: ${commandArgs.join(' ')}`);
      this.logger.appendLine(`TestExecutionService: Working directory: ${options.workspacePath}`);

      const childProcess = spawn(commandArgs[0], commandArgs.slice(1), {
        cwd: options.workspacePath,
        stdio: 'pipe',
        env: { ...process.env }
      });

      // Set up timeout
      timeoutId = setTimeout(() => {
        if (!childProcess.killed && !processKilled) {
          this.logger.appendLine(`TestExecutionService: Test timeout - killing process after 5 minutes`);
          processKilled = true;
          childProcess.kill('SIGTERM');
          
          setTimeout(() => {
            if (!childProcess.killed) {
              this.logger.appendLine(`TestExecutionService: Force killing process with SIGKILL`);
              childProcess.kill('SIGKILL');
            }
          }, 10000);
          
          resolve({ 
            success: false, 
            errorInfo: { error: 'Test execution timed out after 5 minutes' },
            output: 'Test execution timed out after 5 minutes'
          });
        }
      }, 5 * 60 * 1000);

      let output = '';
      let errorOutput = '';

      childProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        const crlfText = text.replace(/\n/g, '\r\n');
        
        if (testItem) {
          run.appendOutput(crlfText, undefined, testItem);
        } else {
          run.appendOutput(crlfText);
        }
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        errorOutput += text;
        const crlfText = text.replace(/\n/g, '\r\n');
        
        if (testItem) {
          run.appendOutput(crlfText, undefined, testItem);
        } else {
          run.appendOutput(crlfText);
        }
      });

      childProcess.on('close', (code: number | null) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        this.logger.appendLine(`TestExecutionService: Process closed with code: ${code}`);
        const success = code === 0;
        const fullOutput = output + errorOutput;
        const errorInfo = success ? undefined : this.parseTestError(fullOutput);
        
        if (!childProcess.killed && !processKilled) {
          this.logger.appendLine(`TestExecutionService: Killing remaining process...`);
          processKilled = true;
          childProcess.kill('SIGTERM');
        }
        
        resolve({ success, errorInfo, output: fullOutput });
      });

      childProcess.on('error', (error: Error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        this.logger.appendLine(`TestExecutionService: Process error: ${error.message}`);
        const errorMessage = `Process error: ${error.message}`;
        
        if (testItem) {
          run.appendOutput(errorMessage, undefined, testItem);
        } else {
          run.appendOutput(errorMessage);
        }
        
        if (!childProcess.killed && !processKilled) {
          this.logger.appendLine(`TestExecutionService: Killing process due to error...`);
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

  private async generateAvailableDebugPort(): Promise<number> {
    const maxAttempts = 10;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const port = Math.floor(Math.random() * (65535 - 5000 + 1)) + 5000;
      const isAvailable = await this.isPortAvailable(port);
      if (isAvailable) {
        this.logger.appendLine(`TestExecutionService: Found available debug port: ${port}`);
        return port;
      }
    }
    
    // Fallback: try sequential ports
    for (let port = 5000; port <= 65535; port++) {
      const isAvailable = await this.isPortAvailable(port);
      if (isAvailable) {
        this.logger.appendLine(`TestExecutionService: Found available debug port (sequential): ${port}`);
        return port;
      }
    }
    
    throw new Error('No available debug ports found');
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const net = require('net');
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

  private parseTestError(output: string): { error: string; location?: vscode.Location } | undefined {
    const lines = output.split('\n');
    let errorMessage = 'Test execution failed';
    let location: vscode.Location | undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('FAILED') && (line.includes('Test') || line.includes('Spec'))) {
        errorMessage = line.trim();
      }
      
      if (line.includes('Condition not satisfied:') || line.includes('Assertion failed:')) {
        errorMessage = line.trim();
      }
      
      if (line.includes('spock.lang.Specification') || line.includes('groovy.lang.MissingMethodException')) {
        errorMessage = line.trim();
      }
      
      if (line.includes('.groovy:') && line.includes('at ')) {
        const match = line.match(/at\s+.*\((.+\.groovy):(\d+)\)/);
        if (match) {
          const filePath = match[1];
          const lineNumber = parseInt(match[2]) - 1;
          
          try {
            const uri = vscode.Uri.file(path.resolve(filePath));
            location = new vscode.Location(uri, new vscode.Position(lineNumber, 0));
          } catch (e) {
            // Ignore if file path is invalid
          }
        }
      }
    }

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
