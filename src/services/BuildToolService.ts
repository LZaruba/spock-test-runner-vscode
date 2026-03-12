import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { BuildTool } from '../types';

export class BuildToolService {
  static detectBuildTool(workspacePath: string): BuildTool | null {
    const hasGradle = fs.existsSync(path.join(workspacePath, 'build.gradle'));
    const hasMaven = fs.existsSync(path.join(workspacePath, 'pom.xml'));

    // Default to Gradle if both are present
    if (hasGradle) {
      return 'gradle';
    }
    if (hasMaven) {
      return 'maven';
    }

    return null;
  }

  static getProjectName(workspacePath: string): string {
    try {
      // Try Gradle first
      const gradlePath = path.join(workspacePath, 'build.gradle');

      if (fs.existsSync(gradlePath)) {
        const gradleContent = fs.readFileSync(gradlePath, 'utf8');
        const nameMatch = gradleContent.match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/) ||
          gradleContent.match(/name\s*=\s*['"]([^'"]+)['"]/);
        if (nameMatch) {
          return nameMatch[1];
        }
      }

      // Try Maven
      const pomPath = path.join(workspacePath, 'pom.xml');
      if (fs.existsSync(pomPath)) {
        const pomContent = fs.readFileSync(pomPath, 'utf8');
        const artifactIdMatch = pomContent.match(/<artifactId>([^<]+)<\/artifactId>/);
        if (artifactIdMatch) {
          return artifactIdMatch[1];
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
    testFilePath?: string,
    logger?: vscode.OutputChannel
  ): string[] {
    const buildTool = workspacePath ? this.detectBuildTool(workspacePath) : null;
    const escapedTestName = testName;

    if (buildTool === 'maven') {
      return this.buildMavenCommandArgs(escapedTestName, debug, workspacePath, testFilePath, logger);
    } else {
      return this.buildGradleCommandArgs(escapedTestName, debug, workspacePath, logger);
    }
  }

  private static buildGradleCommandArgs(
    testName: string,
    debug: boolean,
    workspacePath?: string,
    logger?: vscode.OutputChannel
  ): string[] {
    // Use full path to gradle wrapper to avoid spawn issues on Windows
    // spawn() without shell:true doesn't resolve relative paths or .bat extensions
    const wrapperName = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
    const hasWrapper = workspacePath && this.hasGradleWrapper(workspacePath);
    const gradleCommand = hasWrapper ? path.join(workspacePath!, wrapperName) : 'gradle';
    // On Windows, shell:true is used for spawn, so arguments with spaces
    // must be quoted to prevent cmd.exe from splitting them.
    // On Linux, shell is false and each arg is passed directly, so no quoting needed.
    const quotedTestName = process.platform === 'win32' ? `"${testName}"` : testName;
    const baseArgs = [gradleCommand, 'test', '--tests', quotedTestName];

    // Use init script to force test execution
    const initScriptPath = this.getInitScriptPath();
    const initScriptArgs = ['--init-script', initScriptPath];

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
    const initScriptPath = path.join(__dirname, '..', '..', 'resources', 'force-tests.init.gradle');

    if (!fs.existsSync(initScriptPath)) {
      throw new Error(`Init script not found at: ${initScriptPath}`);
    }

    return initScriptPath;
  }

  static hasGradleWrapper(workspacePath: string): boolean {
    const wrapperName = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
    return fs.existsSync(path.join(workspacePath, wrapperName));
  }

  private static hasMavenWrapper(workspacePath: string): boolean {
    const wrapperName = process.platform === 'win32' ? 'mvnw.cmd' : 'mvnw';
    return fs.existsSync(path.join(workspacePath, wrapperName));
  }

  /**
   * Find the correct directory for running Maven tests for a given test file.
   * For Maven multi-module projects, this finds the module containing the test.
   * 
   * @param testFilePath - Full path to the test file (e.g., /workspace/project/module-a/src/test/groovy/...)
   * @param workspaceRoot - Root workspace folder path
   * @returns The directory where Maven should be executed (module directory or workspace root)
   */
  static findMavenModuleDirectory(testFilePath: string, workspaceRoot: string): string {
    // Walk up from the test file directory to find a pom.xml
    // This handles Maven multi-module projects where tests are in submodules
    let currentDir = path.dirname(testFilePath);
    const rootDir = workspaceRoot;

    // Limit the search to avoid infinite loops (max 20 levels)
    let levels = 0;
    const maxLevels = 20;

    while (currentDir && currentDir.length >= rootDir.length && levels < maxLevels) {
      const pomPath = path.join(currentDir, 'pom.xml');
      
      // Check if this directory has a pom.xml
      if (fs.existsSync(pomPath)) {
        // Check if this is NOT the root project (has parent reference)
        try {
          const pomContent = fs.readFileSync(pomPath, 'utf8');
          const hasParent = pomContent.includes('<parent>');
          
          // If this pom.xml has a parent, it's likely a submodule
          // Return this directory as the module directory
          if (hasParent) {
            return currentDir;
          }
        } catch (e) {
          // Ignore read errors
        }
      }

      // Move to parent directory
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        // Reached filesystem root
        break;
      }
      currentDir = parentDir;
      levels++;
    }

    // If no submodule found, return the workspace root
    return workspaceRoot;
  }

  /**
   * Build Maven command args with support for multi-module projects.
   * 
   * @param testName - Full test name (class.method)
   * @param debug - Whether debugging is enabled
   * @param workspacePath - Root workspace path
   * @param testFilePath - Optional full path to the test file (for module detection)
   * @param logger - Optional logger
   * @returns Command arguments array
   */
  static buildMavenCommandArgs(
    testName: string,
    debug: boolean,
    workspacePath?: string,
    testFilePath?: string,
    logger?: vscode.OutputChannel
  ): string[] {
    const wrapperName = process.platform === 'win32' ? 'mvnw.cmd' : './mvnw';
    const mavenCommand = (workspacePath && this.hasMavenWrapper(workspacePath)) ? wrapperName : 'mvn';

    // Determine the working directory for Maven
    // For multi-module projects, use the module directory containing the test
    let mavenWorkingDir = workspacePath;
    if (testFilePath && workspacePath) {
      const moduleDir = this.findMavenModuleDirectory(testFilePath, workspacePath);
      if (moduleDir !== workspacePath && logger) {
        logger.appendLine(`BuildToolService: Detected Maven submodule: ${moduleDir}`);
      }
      mavenWorkingDir = moduleDir;
    }

    // Maven test parameter format: -Dtest=ClassName#methodName
    // Convert from "com.example.FrameSpec.should handle last frame"
    // to "com.example.FrameSpec#should handle last frame" (last dot becomes #)
    const lastDotIndex = testName.lastIndexOf('.');
    const testParam = lastDotIndex > 0
      ? testName.substring(0, lastDotIndex) + '#' + testName.substring(lastDotIndex + 1)
      : testName;

    // On Windows, shell:true is used for spawn, so arguments with spaces
    // must be quoted to prevent cmd.exe from splitting them.
    // On Linux, shell is false and each arg is passed directly, so no quoting needed.
    const quotedParam = process.platform === 'win32' ? `"${testParam}"` : testParam;
    const testArg = `-Dtest=${quotedParam}`;
    const baseArgs = [mavenCommand, '-f', path.join(mavenWorkingDir!, 'pom.xml'), 'test', testArg];

    if (logger) {
      logger.appendLine(`BuildToolService: Using Maven to execute test: ${testParam} in directory: ${mavenWorkingDir}`);
    }

    if (debug) {
      return [...baseArgs, '-Dmaven.surefire.debug'];
    } else {
      return baseArgs;
    }
  }
}
