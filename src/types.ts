import * as vscode from 'vscode';

export interface TestData {
  type: 'file' | 'class' | 'test';
  className?: string;
  testName?: string;
}

export interface TestResult {
  success: boolean;
  errorInfo?: { error: string; location?: vscode.Location };
  output?: string;
  testOutput?: string;
}

export type BuildTool = 'gradle';

export interface TestExecutionOptions {
  className: string;
  testName: string;
  workspacePath: string;
  buildTool: BuildTool;
  debug: boolean;
}

export interface DebugSessionOptions {
  workspacePath: string;
  className: string;
  testName: string;
  debugPort: number;
}

export interface SpockTestMethod {
  name: string;
  line: number;
  range: vscode.Range;
}

export interface SpockTestClass {
  name: string;
  line: number;
  range: vscode.Range;
  methods: SpockTestMethod[];
}
