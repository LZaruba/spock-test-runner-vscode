import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { BuildTool } from '../types';

export class BuildToolService {
  static detectBuildTool(workspacePath: string): BuildTool | null {
    if (fs.existsSync(path.join(workspacePath, 'build.gradle'))) {
      return 'gradle';
    }
    return null;
  }

  static getProjectName(workspacePath: string): string {
    try {
      const gradlePath = path.join(workspacePath, 'build.gradle');
      
      if (fs.existsSync(gradlePath)) {
          const gradleContent = fs.readFileSync(gradlePath, 'utf8');
          const nameMatch = gradleContent.match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/) || 
          gradleContent.match(/name\s*=\s*['"]([^'"]+)['"]/);
          if (nameMatch) {
              return nameMatch[1];
            }
        }
        
    } catch (error) {
      // Fallback to workspace folder name
    }
    
    return path.basename(workspacePath);
  }

  static buildCommandArgs(
    testName: string, 
    debug: boolean, 
    workspacePath?: string,
    logger?: vscode.OutputChannel
  ): string[] {
    const escapedTestName = testName;
    
    const gradleCommand = (workspacePath && this.hasGradleWrapper(workspacePath)) ? './gradlew' : 'gradle';
    const baseArgs = [gradleCommand, 'test', '--tests', escapedTestName];
    
    // Use init script to force test execution
    const initScriptPath = this.getInitScriptPath();
    const initScriptArgs = ['--init-script', initScriptPath];
    
    // Log the force execution approach
    if (logger) {
      logger.appendLine(`BuildToolService: Using Gradle init script to force test execution (--init-script)`);
    }
    
    if (debug) {
      return [...baseArgs, '--debug-jvm', ...initScriptArgs];
    } else {
      return [...baseArgs, ...initScriptArgs];
    }
  }

  private static getInitScriptPath(): string {
    // Get the path to the init script relative to the extension
    const initScriptPath = path.join(__dirname, '..', '..', 'resources', 'force-tests.init.gradle');
    
    // Verify the init script exists
    if (!fs.existsSync(initScriptPath)) {
      throw new Error(`Init script not found at: ${initScriptPath}`);
    }           
    
    return initScriptPath;
  }

  static hasGradleWrapper(workspacePath: string): boolean {
    return fs.existsSync(path.join(workspacePath, 'gradlew'));
  }
}
