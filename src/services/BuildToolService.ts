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
    logger?: vscode.OutputChannel
  ): string[] {
    const buildTool = workspacePath ? this.detectBuildTool(workspacePath) : null;
    const escapedTestName = testName;

    if (buildTool === 'maven') {
      return this.buildMavenCommandArgs(escapedTestName, debug, workspacePath, logger);
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
    const baseArgs = [gradleCommand, 'test', '--tests', testName];

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

  private static buildMavenCommandArgs(
    testName: string,
    debug: boolean,
    workspacePath?: string,
    logger?: vscode.OutputChannel
  ): string[] {
    const wrapperName = process.platform === 'win32' ? 'mvnw.cmd' : './mvnw';
    const mavenCommand = (workspacePath && this.hasMavenWrapper(workspacePath)) ? wrapperName : 'mvn';

    // Maven test parameter format: -Dtest=ClassName#methodName
    // Convert from "com.example.FrameSpec.should handle last frame"
    // to "com.example.FrameSpec#should handle last frame" (last dot becomes #)
    const lastDotIndex = testName.lastIndexOf('.');
    const testParam = lastDotIndex > 0
      ? testName.substring(0, lastDotIndex) + '#' + testName.substring(lastDotIndex + 1)
      : testName;

    const baseArgs = [mavenCommand, 'test', `-Dtest=${testParam}`];

    if (logger) {
      logger.appendLine(`BuildToolService: Using Maven to execute test: ${testParam}`);
    }

    if (debug) {
      return [...baseArgs, '-Dmaven.surefire.debug'];
    } else {
      return baseArgs;
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
}
