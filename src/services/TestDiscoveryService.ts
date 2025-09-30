import * as vscode from 'vscode';
import { SpockTestClass, SpockTestMethod } from '../types';

export class TestDiscoveryService {
  private static readonly LIFECYCLE_METHODS = new Set(['setup', 'setupSpec', 'cleanup', 'cleanupSpec']);
  private static readonly CLASS_REGEX = /^(?:abstract\s+)?class\s+(\w+)\s+extends\s+(?:[\w.]*\.)?Specification\b/;
  private static readonly METHOD_HEADER_REGEX = /^(?:def|void)\s+(['"]([^'"]+)['"]|([a-zA-Z_][a-zA-Z0-9_]*))\s*(?:\([^)]*\))?\s*(\{)?\s*$/;
  private static readonly BLOCK_LABEL_REGEX = /^(given|when|then|expect|where)\s*:\s*$/;

  static parseTestsInFile(content: string): SpockTestClass[] {
    const lines = content.split('\n');
    const testClasses: SpockTestClass[] = [];
    let currentClass: SpockTestClass | null = null;
    let inClass = false;
    let classBraceBalance = 0;
    let seenClassOpeningBrace = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Look for class definition
      if (this.CLASS_REGEX.test(trimmedLine)) {
        const match = trimmedLine.match(this.CLASS_REGEX);
        const className = match?.[1];
        const isAbstract = trimmedLine.startsWith('abstract');
        if (className) {
          currentClass = {
            name: className,
            line: i,
            range: new vscode.Range(i, 0, i, line.length),
            methods: [],
            isAbstract: isAbstract
          };
          testClasses.push(currentClass);
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
          const shouldAccept = isQuoted || this.lineHasSpockBlockLabelNearby(lines, i);
          const braceOk = hasBraceSameLine || this.hasOpeningBraceOnOrNextLine(lines, i);

          if (shouldAccept && braceOk) {
            const testMethod: SpockTestMethod = {
              name: rawName,
              line: i,
              range: new vscode.Range(i, 0, i, line.length)
            };
            currentClass.methods.push(testMethod);
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

    return testClasses;
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
}
