import * as vscode from 'vscode';

export interface TestData {
  type: 'file' | 'class' | 'test';
  className?: string;
  testName?: string;
  isDataDriven?: boolean;
  iterationResults?: TestIterationResult[];
}

export interface TestIterationResult {
  index: number;
  displayName: string;
  parameters: Record<string, any>;
  success: boolean;
  duration: number;
  errorInfo?: { error: string; location?: vscode.Location };
  output?: string;
}

export interface TestResult {
  success: boolean;
  errorInfo?: { error: string; location?: vscode.Location };
  output?: string;
  testOutput?: string;
  iterationResults?: TestIterationResult[];
}

export type BuildTool = 'gradle' | 'maven';

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
  isDataDriven?: boolean;
  dataIterations?: SpockDataIteration[];
  whereBlockRange?: vscode.Range;
}

export interface SpockDataIteration {
  index: number;
  dataValues: Record<string, any>;
  displayName: string;
  range: vscode.Range;
  originalMethodName: string;
}

export interface SpockTestClass {
  name: string;
  line: number;
  range: vscode.Range;
  methods: SpockTestMethod[];
  isAbstract?: boolean;
}
