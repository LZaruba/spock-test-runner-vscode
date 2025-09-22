import * as path from 'path';
import * as fs from 'fs';
import { BuildTool } from '../types';

export class BuildToolService {
  static detectBuildTool(workspacePath: string): BuildTool | null {
    if (fs.existsSync(path.join(workspacePath, 'build.gradle'))) {
      return 'gradle';
    }
    if (fs.existsSync(path.join(workspacePath, 'pom.xml'))) {
      return 'maven';
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
        
      const mavenPath = path.join(workspacePath, 'pom.xml');
      if (fs.existsSync(mavenPath)) {
        const mavenContent = fs.readFileSync(mavenPath, 'utf8');
        const nameMatch = mavenContent.match(/<artifactId>([^<]+)<\/artifactId>/);
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
    buildTool: BuildTool, 
    testName: string, 
    debug: boolean, 
    debugPort?: number,
    workspacePath?: string
  ): string[] {
    const escapedTestName = testName;
    
    if (buildTool === 'gradle') {
      const gradleCommand = (workspacePath && this.hasGradleWrapper(workspacePath)) ? './gradlew' : 'gradle';
      const baseArgs = [gradleCommand, 'test', '--tests', escapedTestName];
      const timestampArg = `-Dorg.gradle.jvmargs=-Dtest.timestamp=${Date.now()}`;
      
      if (debug) {
        return [...baseArgs, '--debug-jvm', timestampArg];
      } else {
        return [...baseArgs, timestampArg];
      }
    } else {
      // Maven
      const baseArgs = ['mvn', 'test', `-Dtest=${escapedTestName}`, `-Dtest.timestamp=${Date.now()}`];
      
      if (debug && debugPort) {
        const debugArg = `-Dmaven.surefire.debug=-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=${debugPort}`;
        return [...baseArgs, debugArg];
      } else {
        return baseArgs;
      }
    }
  }

  static hasGradleWrapper(workspacePath: string): boolean {
    return fs.existsSync(path.join(workspacePath, 'gradlew'));
  }
}
