// Mock vscode module for testing
export const Range = jest.fn().mockImplementation((startLine: number, startChar: number, endLine: number, endChar: number) => ({
  startLine,
  startChar,
  endLine,
  endChar
}));

export const Position = jest.fn().mockImplementation((line: number, character: number) => ({
  line,
  character
}));

export const Uri = {
  file: jest.fn().mockImplementation((path: string) => ({ fsPath: path }))
};

export const window = {
  createOutputChannel: jest.fn().mockReturnValue({
    appendLine: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn()
  }),
  showErrorMessage: jest.fn(),
  showInformationMessage: jest.fn(),
  createTerminal: jest.fn().mockReturnValue({
    show: jest.fn(),
    sendText: jest.fn(),
    dispose: jest.fn()
  })
};

export const workspace = {
  getWorkspaceFolder: jest.fn(),
  findFiles: jest.fn().mockResolvedValue([]),
  openTextDocument: jest.fn().mockResolvedValue({
    getText: jest.fn().mockReturnValue('')
  }),
  createFileSystemWatcher: jest.fn().mockReturnValue({
    onDidCreate: jest.fn(),
    onDidChange: jest.fn(),
    onDidDelete: jest.fn(),
    dispose: jest.fn()
  }),
  workspaceFolders: []
};

export const languages = {
  createDiagnosticCollection: jest.fn().mockReturnValue({
    set: jest.fn(),
    clear: jest.fn(),
    delete: jest.fn(),
    dispose: jest.fn()
  })
};

export const commands = {
  registerCommand: jest.fn().mockReturnValue({
    dispose: jest.fn()
  })
};

export const tests = {
  createTestController: jest.fn().mockReturnValue({
    createTestItem: jest.fn().mockReturnValue({
      id: 'test-item',
      label: 'Test Item',
      uri: undefined,
      range: undefined,
      canResolveChildren: false,
      children: {
        add: jest.fn(),
        delete: jest.fn(),
        replace: jest.fn(),
        size: 0,
        forEach: jest.fn()
      }
    }),
    createRunProfile: jest.fn().mockReturnValue({
      dispose: jest.fn()
    }),
    createTestRun: jest.fn().mockReturnValue({
      started: jest.fn(),
      passed: jest.fn(),
      failed: jest.fn(),
      skipped: jest.fn(),
      appendOutput: jest.fn(),
      end: jest.fn()
    }),
    items: {
      get: jest.fn(),
      add: jest.fn(),
      delete: jest.fn(),
      forEach: jest.fn()
    }
  })
};

export const TestMessage = jest.fn().mockImplementation((message: string) => ({
  message,
  location: undefined
}));

export const TestRunProfileKind = {
  Run: 1,
  Debug: 2
};

export const RelativePattern = jest.fn().mockImplementation((workspaceFolder: any, pattern: string) => ({
  workspaceFolder,
  pattern
}));

export const CancellationToken = {
  None: {
    isCancellationRequested: false
  }
};
