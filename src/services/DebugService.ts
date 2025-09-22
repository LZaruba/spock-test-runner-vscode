import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import { DebugSessionOptions } from '../types';
import { BuildToolService } from './BuildToolService';

export class DebugService {
  private logger: vscode.OutputChannel;

  constructor(logger: vscode.OutputChannel) {
    this.logger = logger;
  }

  async startDebugSession(options: DebugSessionOptions): Promise<void> {
    this.logger.appendLine(`DebugService: Starting debug session for ${options.className}.${options.testName} on port ${options.debugPort}`);

    // Wait for JVM to be ready
    const jvmReady = await this.waitForJvmDebugPort(options.debugPort, 60000);
    if (!jvmReady) {
      throw new Error(`JVM not ready on port ${options.debugPort} after 60 seconds`);
    }

    this.logger.appendLine(`DebugService: JVM is ready on port ${options.debugPort}, starting debug session...`);

    // Add delay and retry logic
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        await this.attemptDebugConnection(options);
        this.logger.appendLine(`DebugService: Debug session started successfully on port ${options.debugPort}`);
        return;
      } catch (error) {
        retryCount++;
        this.logger.appendLine(`DebugService: Debug connection attempt ${retryCount} failed: ${error}`);
        
        if (retryCount < maxRetries) {
          this.logger.appendLine(`DebugService: Retrying debug connection in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    throw new Error(`Failed to start debug session after ${maxRetries} attempts`);
  }

  private async waitForJvmDebugPort(debugPort: number, maxWaitTime: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 1000;
    let consecutiveSuccesses = 0;
    const requiredSuccesses = 2;
    
    this.logger.appendLine(`DebugService: Waiting for JVM debug port ${debugPort} to be ready...`);
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const isReady = await this.checkJvmDebugPort(debugPort);
        if (isReady) {
          consecutiveSuccesses++;
          this.logger.appendLine(`DebugService: JVM debug port ${debugPort} connection successful (${consecutiveSuccesses}/${requiredSuccesses})`);
          
          if (consecutiveSuccesses >= requiredSuccesses) {
            this.logger.appendLine(`DebugService: JVM debug port ${debugPort} is fully ready`);
            return true;
          }
        } else {
          consecutiveSuccesses = 0;
        }
      } catch (error) {
        consecutiveSuccesses = 0;
        this.logger.appendLine(`DebugService: JVM debug port ${debugPort} not ready yet: ${error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    this.logger.appendLine(`DebugService: JVM debug port ${debugPort} not ready after ${maxWaitTime}ms`);
    return false;
  }

  private async checkJvmDebugPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(5000);
      
      socket.connect(port, 'localhost', () => {
        this.logger.appendLine(`DebugService: Successfully connected to debug port ${port}`);
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', (error) => {
        this.logger.appendLine(`DebugService: Connection failed to port ${port}: ${error.message}`);
        socket.destroy();
        resolve(false);
      });
      
      socket.on('timeout', () => {
        this.logger.appendLine(`DebugService: Connection timeout to port ${port}`);
        socket.destroy();
        resolve(false);
      });
    });
  }

  private async attemptDebugConnection(options: DebugSessionOptions): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const sourcePaths = this.getSourcePaths(options.workspacePath);
      
      this.logger.appendLine(`DebugService: Debug source paths:`);
      sourcePaths.forEach((sourcePath, index) => {
        const exists = fs.existsSync(sourcePath);
        this.logger.appendLine(`DebugService:   ${index + 1}. ${sourcePath} (exists: ${exists})`);
      });

      const debugConfig: vscode.DebugConfiguration = {
        type: 'java',
        name: `Debug Spock Test: ${options.className}.${options.testName}`,
        request: 'attach',
        hostName: 'localhost',
        port: options.debugPort,
        projectName: BuildToolService.getProjectName(options.workspacePath),
        sourcePaths: sourcePaths,
        stepFilters: {
          skipClasses: false,
          skipSynthetics: false,
          skipStaticInitializers: false,
          skipConstructors: false
        },
        includeMain: true,
        includeTest: true
      };

      try {
        const success = await vscode.debug.startDebugging(undefined, debugConfig);
        if (success) {
          resolve();
        } else {
          reject(new Error('Failed to start debug session'));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  private getSourcePaths(workspacePath: string): string[] {
    return [
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
  }

}
