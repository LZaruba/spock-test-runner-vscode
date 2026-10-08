import * as vscode from 'vscode';
import { ParsedGroovyFile, SpockTestClass, SpockTestMethod } from '../types';
import { SpecClassIndex } from './SpecClassIndex';

interface ClassDeclaration {
  name: string;
  superClass: string;
  isAbstract: boolean;
}

export class TestDiscoveryService {
  private static readonly LIFECYCLE_METHODS = new Set(['setup', 'setupSpec', 'cleanup', 'cleanupSpec']);
  // Annotations and modifiers may precede the class keyword, e.g. "@Stepwise abstract class" or "public class"
  private static readonly CLASS_HEADER_REGEX = /^(?:@[\w.]+(?:\([^()]*\))?\s+)*((?:(?:public|protected|private|abstract|final|static|strictfp)\s+)*)class\s+(\w+)(.*)$/;
  private static readonly EXTENDS_REGEX = /^extends\s+([\w.]+)/;
  private static readonly MAX_CLASS_DECLARATION_LINES = 5;
  private static readonly PACKAGE_REGEX = /^package\s+([\w.]+)/;
  private static readonly IMPORT_REGEX = /^import\s+(?!static\b)([\w.]+)(?:\s+as\s+(\w+))?\s*;?\s*$/;
  private static readonly METHOD_HEADER_REGEX = /^(?:def|void)\s+(['"]([^'"]+)['"]|([a-zA-Z_][a-zA-Z0-9_]*))\s*(?:\([^)]*\))?\s*(\{)?\s*$/;
  // Spock block label, optionally followed by a description or a comment, e.g. `given: "a user"`
  private static readonly BLOCK_LABEL_REGEX = /^(setup|given|when|then|expect|cleanup|where|and)\s*:\s*(?:["'].*|\/\/.*)?$/;

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
      const classDeclaration = this.parseClassDeclaration(lines, i);

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
      else if (classDeclaration && this.isClassDeclaration(line, classDeclaration)) {
        currentClass = {
          name: classDeclaration.name,
          line: i,
          range: new vscode.Range(i, 0, i, line.length),
          methods: [],
          isAbstract: classDeclaration.isAbstract,
          superClass: classDeclaration.superClass,
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

  private static isClassDeclaration(line: string, classDeclaration: ClassDeclaration): boolean {
    // Classes extending anything other than Specification are only picked up when declared at the
    // top level (not indented), so that helper classes nested inside a specification do not take
    // over its remaining feature methods
    return SpecClassIndex.isSpecification(classDeclaration.superClass) || !/^\s/.test(line);
  }

  /**
   * Parses the declaration of a class extending another class starting at the given line. The superclass
   * may follow on one of the next lines, e.g. when a long class name is followed by a line break.
   */
  private static parseClassDeclaration(lines: string[], startIndex: number): ClassDeclaration | undefined {
    const match = lines[startIndex].trim().match(this.CLASS_HEADER_REGEX);
    if (!match) {
      return undefined;
    }

    let declaration = match[3].trim();
    for (let j = startIndex + 1; !declaration.includes('{') && j < Math.min(lines.length, startIndex + this.MAX_CLASS_DECLARATION_LINES); j++) {
      declaration = `${declaration} ${lines[j].trim()}`.trim();
    }

    const extendsMatch = this.skipTypeParameters(declaration).match(this.EXTENDS_REGEX);
    if (!extendsMatch) {
      return undefined;
    }
    return { name: match[2], superClass: extendsMatch[1], isAbstract: /\babstract\b/.test(match[1]) };
  }

  /**
   * Strips the type parameters, which may be nested (e.g. <T extends Comparable<T>>), from the start of the text.
   */
  private static skipTypeParameters(text: string): string {
    if (!text.startsWith('<')) {
      return text;
    }
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '<') {
        depth++;
      } else if (text[i] === '>' && --depth === 0) {
        return text.substring(i + 1).trim();
      }
    }
    return text;
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
      if (trimmedLine.match(this.BLOCK_LABEL_REGEX)?.[1] === 'where') {
        return true;
      }
    }
    
    return false;
  }
}
