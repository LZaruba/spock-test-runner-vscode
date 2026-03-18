import * as path from 'path';
import * as fs from 'fs';
import { BuildToolService } from '../services/BuildToolService';

// Get project root directory (parent of src/test)
const projectRoot = path.resolve(__dirname, '../..');

describe('BuildToolService', () => {
  describe('findMavenModuleDirectory', () => {
    const workspaceRoot = path.join(projectRoot, 'sample-projects', 'maven-project');

    it('should return workspace root when test is in root project (no submodule)', () => {
      // Test file in root project
      const testFilePath = path.join(workspaceRoot, 'src', 'test', 'groovy', 'com', 'example', 'CalculatorSpec.groovy');
      
      const result = BuildToolService.findMavenModuleDirectory(testFilePath, workspaceRoot);
      
      // Root project pom.xml doesn't have <parent> tag, so it should return workspace root
      expect(result).toBe(workspaceRoot);
    });

    it('should return module directory when test is in submodule', () => {
      // Test file in module-a submodule
      const testFilePath = path.join(workspaceRoot, 'module-a', 'src', 'test', 'groovy', 'com', 'example', 'ModuleASpec.groovy');
      const expectedModuleDir = path.join(workspaceRoot, 'module-a');
      
      const result = BuildToolService.findMavenModuleDirectory(testFilePath, workspaceRoot);
      
      expect(result).toBe(expectedModuleDir);
    });

    it('should return workspace root when no pom.xml is found', () => {
      // Test file in non-maven directory
      const testFilePath = '/some/other/path/src/test/groovy/Test.groovy';
      
      const result = BuildToolService.findMavenModuleDirectory(testFilePath, workspaceRoot);
      
      // Should return workspace root as fallback
      expect(result).toBe(workspaceRoot);
    });

    it('should handle test file at root of submodule', () => {
      // Even if test is directly in module src/test
      const testFilePath = path.join(workspaceRoot, 'module-a', 'src', 'test', 'groovy', 'Test.groovy');
      const expectedModuleDir = path.join(workspaceRoot, 'module-a');
      
      const result = BuildToolService.findMavenModuleDirectory(testFilePath, workspaceRoot);
      
      expect(result).toBe(expectedModuleDir);
    });
  });

  describe('buildMavenCommandArgs with submodule support', () => {
    it('should use -f flag with module pom.xml for submodule tests', () => {
      const workspaceRoot = path.join(projectRoot, 'sample-projects', 'maven-project');
      const testFilePath = path.join(workspaceRoot, 'module-a', 'src', 'test', 'groovy', 'com', 'example', 'ModuleASpec.groovy');
      
      const args = BuildToolService.buildMavenCommandArgs(
        'com.example.ModuleASpec.module A test should pass',
        false,
        workspaceRoot,
        testFilePath,
        undefined
      );
      
      // Should include -f flag pointing to module-a/pom.xml
      expect(args).toContain('-f');
      expect(args).toContain(path.join(workspaceRoot, 'module-a', 'pom.xml'));
      // Should include test parameter
      expect(args).toContain('-Dtest=com.example.ModuleASpec#module A test should pass');
    });

    it('should use root pom.xml when test is in root project', () => {
      const workspaceRoot = path.join(projectRoot, 'sample-projects', 'maven-project');
      const testFilePath = path.join(workspaceRoot, 'src', 'test', 'groovy', 'com', 'example', 'CalculatorSpec.groovy');
      
      const args = BuildToolService.buildMavenCommandArgs(
        'com.example.CalculatorSpec.should add numbers',
        false,
        workspaceRoot,
        testFilePath,
        undefined
      );
      
      // Should include -f flag pointing to root pom.xml
      expect(args).toContain('-f');
      expect(args).toContain(path.join(workspaceRoot, 'pom.xml'));
    });

    it('should work without testFilePath (backward compatibility)', () => {
      const workspaceRoot = path.join(projectRoot, 'sample-projects', 'maven-project');
      
      const args = BuildToolService.buildMavenCommandArgs(
        'com.example.CalculatorSpec.should add numbers',
        false,
        workspaceRoot,
        undefined,
        undefined
      );
      
      // Should still work, using root pom.xml
      expect(args).toContain('-f');
      expect(args).toContain(path.join(workspaceRoot, 'pom.xml'));
    });
  });

  describe('detectBuildTool', () => {
    it('should detect maven when pom.xml exists', () => {
      const mavenProjectPath = path.join(projectRoot, 'sample-projects', 'maven-project');
      const result = BuildToolService.detectBuildTool(mavenProjectPath);
      expect(result).toBe('maven');
    });

    it('should detect gradle when build.gradle exists', () => {
      const gradleProjectPath = path.join(projectRoot, 'sample-projects', 'gradle-project');
      const result = BuildToolService.detectBuildTool(gradleProjectPath);
      expect(result).toBe('gradle');
    });

    it('should return null when no build tool is found', () => {
      const result = BuildToolService.detectBuildTool('/tmp/nonexistent');
      expect(result).toBeNull();
    });

    it('should prefer gradle over maven when both exist', () => {
      // Create a temp directory with both build files
      const testDir = '/tmp/test-build-tool';
      try {
        fs.mkdirSync(testDir, { recursive: true });
        fs.writeFileSync(path.join(testDir, 'build.gradle'), 'rootProject.name = "test"');
        fs.writeFileSync(path.join(testDir, 'pom.xml'), '<project></project>');
        
        const result = BuildToolService.detectBuildTool(testDir);
        expect(result).toBe('gradle');
      } finally {
        // Cleanup
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });
  });
});
