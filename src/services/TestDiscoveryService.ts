import * as vscode from 'vscode';
import { ParsedGroovyFile, SpockTestClass, SpockTestMethod } from '../types';
import { SpecClassIndex } from './SpecClassIndex';

export class TestDiscoveryService {
  private static readonly LIFECYCLE_METHODS = new Set(['setup', 'setupSpec', 'cleanup', 'cleanupSpec']);
  private static readonly CLASS_REGEX = /^(?:abstract\s+)?class\s+(\w+)(?:\s*<[^>]*>)?\s+extends\s+([\w.]+)/;
  private static readonly PACKAGE_REGEX = /^package\s+([\w.]+)/;
  private static readonly IMPORT_REGEX = /^import\s+(?!static\b)([\w.]+)(?:\s+as\s+(\w+))?\s*;?\s*$/;
  private static readonly METHOD_HEADER_REGEX = /^(?:def|void)\s+(['"]([^'"]+)['"]|([a-zA-Z_][a-zA-Z0-9_]*))\s*(?:\([^)]*\))?\s*(\{)?\s*$/;
  private static readonly BLOCK_LABEL_REGEX = /^(given|when|then|expect|where)\s*:\s*$/;

  /**
   * Parses the Spock specifications declared in a single file. Specifications extending a base class
   * declared in the same file are recognized as well; use SpecClassIndex to resolve base classes
   * declared in other files.
   */
  static parseTestsInFile(content: string): SpockTestClass[] {
    const fileKey = 'file';
    const index = new SpecClassIndex();
    index.update(fileKey, this.parseFile(content));
    return index.getSpecClasses(fileKey);
  }

  /**
   * Parses the package, imports and the classes extending another class declared in a Groovy file,
   * including classes that do not extend Specification directly, so that inheritance can be
   * resolved across files.
   */
  static parseFile(content: string): ParsedGroovyFile {
    const lines = content.split('\n');
    const parsedFile: ParsedGroovyFile = { imports: {}, classes: [] };
    let currentClass: SpockTestClass | null = null;
    let inClass = false;
    let classBraceBalance = 0;
    let seenClassOpeningBrace = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Look for package and import declarations
      if (!inClass && this.PACKAGE_REGEX.test(trimmedLine)) {
        parsedFile.packageName = trimmedLine.match(this.PACKAGE_REGEX)![1];
      }
      else if (!inClass && this.IMPORT_REGEX.test(trimmedLine)) {
        const match = trimmedLine.match(this.IMPORT_REGEX)!;
        const qualifiedName = match[1];
        parsedFile.imports[match[2] || qualifiedName.split('.').pop()!] = qualifiedName;
      }
      // Look for class definition
      else if (this.isClassDeclaration(line, trimmedLine)) {
        const match = trimmedLine.match(this.CLASS_REGEX);
        const className = match?.[1];
        const isAbstract = trimmedLine.startsWith('abstract');
        if (className) {
          currentClass = {
            name: className,
            line: i,
            range: new vscode.Range(i, 0, i, line.length),
            methods: [],
            isAbstract: isAbstract,
            superClass: match?.[2],
            hasSpockBlocks: false
          };
          parsedFile.classes.push(currentClass);
          inClass = true;
          const delta = this.countBraceDelta(line);
          if (delta > 0) {
            seenClassOpeningBrace = true;
          }
          classBraceBalance += delta;
        }
      }
      // Look for test methods
      else if (inClass && currentClass && this.METHOD_HEADER_REGEX.test(trimmedLine)) {
        const match = trimmedLine.match(this.METHOD_HEADER_REGEX);
        const rawName = (match?.[2] || match?.[3] || '').trim();
        const hasBraceSameLine = !!match?.[4];

        if (rawName && !this.LIFECYCLE_METHODS.has(rawName)) {
          const isQuoted = !!match?.[2];
          const hasBlockLabel = this.lineHasSpockBlockLabelNearby(lines, i);
          const shouldAccept = isQuoted || hasBlockLabel;
          const braceOk = hasBraceSameLine || this.hasOpeningBraceOnOrNextLine(lines, i);

          if (shouldAccept && braceOk) {
            // Check if this is a data-driven test by looking for 'where' block
            const isDataDriven = this.hasWhereBlock(lines, i);
            
            const testMethod: SpockTestMethod = {
              name: rawName,
              line: i,
              range: new vscode.Range(i, 0, i, line.length),
              isDataDriven: isDataDriven
            };
            currentClass.methods.push(testMethod);
            currentClass.hasSpockBlocks = currentClass.hasSpockBlocks || hasBlockLabel;
          }
        }
      }

      // Update class brace balance
      if (inClass) {
        const delta = this.countBraceDelta(line);
        if (delta > 0) {
          seenClassOpeningBrace = true;
        }
        classBraceBalance += delta;
        if (seenClassOpeningBrace && classBraceBalance <= 0) {
          inClass = false;
          currentClass = null;
          seenClassOpeningBrace = false;
          classBraceBalance = 0;
        }
      }
    }

    return parsedFile;
  }

  private static isClassDeclaration(line: string, trimmedLine: string): boolean {
    const match = trimmedLine.match(this.CLASS_REGEX);
    if (!match) {
      return false;
    }
    // Classes extending anything other than Specification are only picked up when declared at the
    // top level (not indented), so that helper classes nested inside a specification do not take
    // over its remaining feature methods
    return SpecClassIndex.isSpecification(match[2]) || !/^\s/.test(line);
  }

  private static hasOpeningBraceOnOrNextLine(lines: string[], startIndex: number): boolean {
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

  private static hasWhereBlock(lines: string[], startIndex: number): boolean {
    let braceBalance = 0;
    let foundOpeningBrace = false;
    
    for (let j = startIndex; j < lines.length; j++) {
      const line = lines[j];
      const trimmedLine = line.trim();
      
      // Count braces to track method boundaries
      const delta = this.countBraceDelta(line);
      braceBalance += delta;
      
      if (delta > 0) {
        foundOpeningBrace = true;
      }
      
      // If we've found the opening brace and now we're back to 0, we've reached the end of the method
      if (foundOpeningBrace && braceBalance <= 0) {
        break;
      }
      
      // Look for 'where:' block
      if (this.BLOCK_LABEL_REGEX.test(trimmedLine) && trimmedLine.includes('where')) {
        return true;
      }
    }
    
    return false;
  }
}
