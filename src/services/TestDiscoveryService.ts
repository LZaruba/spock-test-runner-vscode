import * as vscode from 'vscode';
import { SpockDataIteration, SpockTestClass, SpockTestMethod } from '../types';

export class TestDiscoveryService {
  private static readonly LIFECYCLE_METHODS = new Set(['setup', 'setupSpec', 'cleanup', 'cleanupSpec']);
  private static readonly CLASS_REGEX = /^(?:abstract\s+)?class\s+(\w+)\s+extends\s+(?:[\w.]*\.)?Specification\b/;
  private static readonly METHOD_HEADER_REGEX = /^(?:def|void)\s+(['"]([^'"]+)['"]|([a-zA-Z_][a-zA-Z0-9_]*))\s*(?:\([^)]*\))?\s*(\{)?\s*$/;
  private static readonly BLOCK_LABEL_REGEX = /^(given|when|then|expect|where)\s*:\s*$/;
  private static readonly WHERE_BLOCK_REGEX = /^where\s*:\s*$/;
  private static readonly DATA_TABLE_REGEX = /^(\s*)([^|;\n]+(?:\s*[|;]\s*[^|;\n]+)*)\s*$/;
  private static readonly DATA_PIPE_REGEX = /^(\s*)(\w+)\s*<<\s*(.+)$/;
  private static readonly PLACEHOLDER_REGEX = /#([a-zA-Z_][a-zA-Z0-9_.]*)/g;

  static parseTestsInFile(content: string): SpockTestClass[] {
    const lines = content.split('\n');
    const testClasses: SpockTestClass[] = [];
    let currentClass: SpockTestClass | null = null;
    let inClass = false;
    let classBraceBalance = 0;
    let seenClassOpeningBrace = false;
    let classNestingLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Look for class definition
      if (this.CLASS_REGEX.test(trimmedLine)) {
        const className = trimmedLine.match(this.CLASS_REGEX)?.[1];
        if (className) {
          // Only parse top-level classes (not nested ones)
          if (classNestingLevel === 0 && !inClass) {
            currentClass = {
              name: className,
              line: i,
              range: new vscode.Range(i, 0, i, line.length),
              methods: []
            };
            testClasses.push(currentClass);
            inClass = true;
            
            const delta = this.countBraceDelta(line);
            if (delta > 0) {
              seenClassOpeningBrace = true;
            }
            classBraceBalance += delta;
          }
          // If we're inside a class, increment nesting level
          else if (inClass) {
            classNestingLevel++;
          }
        }
      }
      // Look for test methods
      else if (inClass && currentClass && classNestingLevel === 0 && this.METHOD_HEADER_REGEX.test(trimmedLine)) {
        const match = trimmedLine.match(this.METHOD_HEADER_REGEX);
        const rawName = (match?.[2] || match?.[3] || '').trim();
        const hasBraceSameLine = !!match?.[4];

        if (rawName && !this.LIFECYCLE_METHODS.has(rawName)) {
          const isQuoted = !!match?.[2];
          const shouldAccept = isQuoted || this.lineHasSpockBlockLabelNearby(lines, i);
          const braceOk = hasBraceSameLine || this.hasOpeningBraceOnOrNextLine(lines, i);

          if (shouldAccept && braceOk) {
            // Parse the method and check for data-driven testing
            const methodInfo = this.parseTestMethod(lines, i, rawName);
            if (methodInfo) {
              currentClass.methods.push(methodInfo);
            }
          }
        }
      }

      // Update class brace balance and nesting level
      if (inClass) {
        const delta = this.countBraceDelta(line);
        if (delta > 0) {
          seenClassOpeningBrace = true;
        }
        classBraceBalance += delta;
        
        // If we're inside a nested class, track its closing
        if (classNestingLevel > 0) {
          if (delta < 0) {
            classNestingLevel--;
          }
        }
        // If we're in the main class and it's closing
        else if (seenClassOpeningBrace && classBraceBalance <= 0) {
          inClass = false;
          currentClass = null;
          seenClassOpeningBrace = false;
          classBraceBalance = 0;
          classNestingLevel = 0;
        }
      }
    }

    return testClasses;
  }

  private static hasOpeningBraceOnOrNextLine(lines: string[], startIndex: number): boolean {
    // Check the current line first
    const currentLine = lines[startIndex].trim();
    if (currentLine.includes('{')) {
      return true;
    }
    
    // Check next few lines
    for (let j = startIndex + 1; j < Math.min(lines.length, startIndex + 5); j++) {
      const t = lines[j].trim();
      if (!t) {
        continue;
      }
      if (t.startsWith('//')) {
        continue;
      }
      return t.startsWith('{');
    }
    return false;
  }

  private static lineHasSpockBlockLabelNearby(lines: string[], startIndex: number): boolean {
    for (let j = startIndex + 1; j < Math.min(lines.length, startIndex + 50); j++) {
      const t = lines[j].trim();
      if (!t) {
        continue;
      }
      if (this.BLOCK_LABEL_REGEX.test(t)) {
        return true;
      }
      if (t === '}') {
        return false;
      }
    }
    return false;
  }

  private static countBraceDelta(text: string): number {
    const open = (text.match(/\{/g) || []).length;
    const close = (text.match(/\}/g) || []).length;
    return open - close;
  }

  private static parseTestMethod(lines: string[], startLine: number, methodName: string): SpockTestMethod | null {
    const methodLine = lines[startLine];
    const methodRange = new vscode.Range(startLine, 0, startLine, methodLine.length);
    
    // Find the method body and check for where block
    const whereBlockInfo = this.findWhereBlock(lines, startLine);
    
    if (whereBlockInfo) {
      // This is a data-driven test
      const dataIterations = this.parseDataTable(lines, whereBlockInfo.startLine, whereBlockInfo.endLine, methodName);
      
      return {
        name: methodName,
        line: startLine,
        range: methodRange,
        isDataDriven: true,
        dataIterations: dataIterations,
        whereBlockRange: new vscode.Range(whereBlockInfo.startLine, 0, whereBlockInfo.endLine, lines[whereBlockInfo.endLine].length)
      };
    } else {
      // Regular test method
      return {
        name: methodName,
        line: startLine,
        range: methodRange,
        isDataDriven: false
      };
    }
  }

  private static findWhereBlock(lines: string[], methodStartLine: number): { startLine: number; endLine: number } | null {
    let braceBalance = 0;
    let inMethod = false;
    let whereBlockStart = -1;
    
    for (let i = methodStartLine; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Track brace balance to know when we're inside the method
      const delta = this.countBraceDelta(line);
      braceBalance += delta;
      
      if (delta > 0) {
        inMethod = true;
      }
      
      if (inMethod && braceBalance <= 0) {
        // Method ended, no where block found
        break;
      }
      
      // Look for where block
      if (inMethod && this.WHERE_BLOCK_REGEX.test(trimmedLine)) {
        whereBlockStart = i;
        // Find the end of the where block (next closing brace or end of method)
        for (let j = i + 1; j < lines.length; j++) {
          const whereLine = lines[j];
          const whereTrimmed = whereLine.trim();
          
          if (whereTrimmed === '}' || (whereTrimmed === '' && j === lines.length - 1)) {
            return { startLine: whereBlockStart, endLine: j - 1 };
          }
        }
        break;
      }
    }
    
    return null;
  }

  private static parseDataTable(lines: string[], startLine: number, endLine: number, methodName: string): SpockDataIteration[] {
    const iterations: SpockDataIteration[] = [];
    let dataTable: string[][] = [];
    let variables: string[] = [];
    let isFirstRow = true;
    
    for (let i = startLine + 1; i <= endLine; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      if (!trimmedLine || trimmedLine.startsWith('//')) {
        continue;
      }
      
      // Check for data pipe (<<)
      const pipeMatch = line.match(this.DATA_PIPE_REGEX);
      if (pipeMatch) {
        // Handle data pipes - parse the data source to create multiple iterations
        const variableName = pipeMatch[2];
        let dataSource = pipeMatch[3].trim();
        
        // If the data source starts with [, we need to collect the full array
        if (dataSource.startsWith('[')) {
          // Collect the full array across multiple lines
          let arrayContent = dataSource;
          let j = i + 1;
          while (j <= endLine && !arrayContent.includes(']')) {
            arrayContent += ' ' + lines[j].trim();
            j++;
          }
          dataSource = arrayContent;
        }
        
        // Parse data source (e.g., [1, 2, 3] or [new Person(name: 'John'), ...])
        const dataValues = this.parseDataPipeSource(dataSource);
        
        dataValues.forEach((value, index) => {
          iterations.push({
            index: iterations.length,
            dataValues: { [variableName]: value },
            displayName: this.generateDisplayName(methodName, { [variableName]: value }),
            range: new vscode.Range(i, 0, i, line.length),
            originalMethodName: methodName
          });
        });
        continue;
      }
      
      // Parse data table rows
      const row = this.parseDataTableRow(line);
      if (row.length > 0) {
        if (isFirstRow) {
          variables = row;
          isFirstRow = false;
        } else {
          dataTable.push(row);
        }
      }
    }
    
    // Create iterations from data table
    dataTable.forEach((row, index) => {
      const dataValues: Record<string, any> = {};
      variables.forEach((variable, colIndex) => {
        if (colIndex < row.length) {
          const trimmedVar = variable.trim();
          // Skip underscore columns (used for visual alignment)
          if (trimmedVar !== '_') {
            dataValues[trimmedVar] = this.parseValue(row[colIndex].trim());
          }
        }
      });
      
      iterations.push({
        index: iterations.length,
        dataValues,
        displayName: this.generateDisplayName(methodName, dataValues),
        range: new vscode.Range(startLine + 1 + index, 0, startLine + 1 + index, lines[startLine + 1 + index].length),
        originalMethodName: methodName
      });
    });
    
    return iterations;
  }

  private static parseDataTableRow(line: string): string[] {
    // Handle different separators: ||, ;;, |, ;
    // We need to handle mixed separators like "x ; y ;; result"
    
    // First, try to find the primary separator (the one that appears most frequently)
    const separators = ['||', ';;', '|', ';'];
    let bestSeparator = '';
    let maxCount = 0;
    
    for (const sep of separators) {
      const count = (line.match(new RegExp(sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestSeparator = sep;
      }
    }
    
    if (bestSeparator) {
      // Split by the best separator
      const parts = line.split(bestSeparator);
      return parts.map(cell => cell.trim()).filter(cell => cell.length > 0);
    }
    
    return [];
  }

  private static parseValue(value: string): any {
    // Try to parse as number (including negative numbers)
    if (/^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^-?\d+\.\d+$/.test(value)) {
      return parseFloat(value);
    }
    
    // Try to parse as boolean
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    
    // Try to parse as null
    if (value === 'null') {
      return null;
    }
    
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    
    return value;
  }

  private static generateDisplayName(methodName: string, dataValues: Record<string, any>): string {
    // Check if method name has placeholders
    if (methodName.includes('#')) {
      let displayName = methodName;
      
      // Replace placeholders with actual values
      displayName = displayName.replace(this.PLACEHOLDER_REGEX, (match, placeholder) => {
        const value = dataValues[placeholder];
        return value !== undefined ? String(value) : match;
      });
      
      return displayName;
    } else {
      // Generate display name from data values
      const valuePairs = Object.entries(dataValues)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      return `${methodName} [${valuePairs}]`;
    }
  }

  private static parseDataPipeSource(dataSource: string): any[] {
    // Simple parsing for data pipe sources like [1, 2, 3] or [new Person(...), ...]
    // This is a basic implementation - in reality, you'd need a proper Groovy parser
    
    // Handle array literals like [1, 2, 3] or [new Person(...), ...]
    if (dataSource.startsWith('[') && dataSource.endsWith(']')) {
      const content = dataSource.slice(1, -1).trim();
      if (!content) {
        return [];
      }
      
      // For complex objects like Person, we need to parse them differently
      if (content.includes('new Person')) {
        // Parse Person objects: new Person(name: "Alice", age: 25)
        const personMatches = content.match(/new Person\([^)]+\)/g);
        if (personMatches) {
          return personMatches.map(personStr => {
            // Extract name and age from Person constructor
            const nameMatch = personStr.match(/name:\s*"([^"]+)"/);
            const ageMatch = personStr.match(/age:\s*(\d+)/);
            return {
              name: nameMatch ? nameMatch[1] : 'Unknown',
              age: ageMatch ? parseInt(ageMatch[1], 10) : 0
            };
          });
        }
      }
      
      // For simple arrays, split by comma and parse each element
      const elements = content.split(',').map(el => el.trim());
      return elements.map(el => this.parseValue(el));
    }
    
    // Handle other data sources (ranges, etc.)
    // For now, return the source as a single element
    return [dataSource];
  }
}
