import { InheritedSpockTestMethod, ParsedGroovyFile, SpockTestClass } from '../types';

interface IndexedClass {
  fileKey: string;
  file: ParsedGroovyFile;
  testClass: SpockTestClass;
}

interface AncestorChain {
  ancestors: IndexedClass[];  // Nearest base class first
  extendsSpecification: boolean;
  unresolvedBase: boolean;  // The chain ends with a base class that is not declared in the indexed files
}

/**
 * Keeps track of the classes declared in the indexed Groovy files, so that specifications extending
 * Specification only indirectly (through base classes, possibly declared in other files) are
 * recognized together with the feature methods they inherit.
 */
export class SpecClassIndex {
  private static readonly SPECIFICATION_CLASS = 'Specification';

  private files = new Map<string, ParsedGroovyFile>();
  private classesByFile = new Map<string, IndexedClass[]>();
  private classesByQualifiedName = new Map<string, IndexedClass[]>();
  private classesBySimpleName = new Map<string, IndexedClass[]>();
  private lookupsDirty = false;

  static isSpecification(className: string | undefined): boolean {
    return !!className && this.simpleName(className) === this.SPECIFICATION_CLASS;
  }

  update(fileKey: string, file: ParsedGroovyFile): void {
    this.files.set(fileKey, file);
    this.lookupsDirty = true;
  }

  remove(fileKey: string): void {
    if (this.files.delete(fileKey)) {
      this.lookupsDirty = true;
    }
  }

  clear(): void {
    this.files.clear();
    this.lookupsDirty = true;
  }

  /**
   * Returns the specifications declared in the given file - classes extending Specification directly
   * or through base classes - together with the feature methods inherited from those base classes.
   */
  getSpecClasses(fileKey: string): SpockTestClass[] {
    this.ensureLookups();
    const specClasses: SpockTestClass[] = [];

    for (const indexedClass of this.classesByFile.get(fileKey) || []) {
      const chain = this.resolveAncestors(indexedClass);
      if (!this.isSpecChain(indexedClass, chain)) {
        continue;
      }
      specClasses.push({
        ...indexedClass.testClass,
        inheritedMethods: this.collectInheritedMethods(indexedClass.testClass, chain.ancestors)
      });
    }

    return specClasses;
  }

  /**
   * Returns the keys of the other files declaring classes that inherit from a class declared in the
   * given file, i.e. the files whose test items depend on its content.
   */
  getDependentFiles(fileKey: string): string[] {
    this.ensureLookups();
    const dependentFiles: string[] = [];

    for (const [otherFileKey, indexedClasses] of this.classesByFile) {
      if (otherFileKey === fileKey) {
        continue;
      }
      const dependsOnFile = indexedClasses.some(indexedClass =>
        this.resolveAncestors(indexedClass).ancestors.some(ancestor => ancestor.fileKey === fileKey)
      );
      if (dependsOnFile) {
        dependentFiles.push(otherFileKey);
      }
    }

    return dependentFiles;
  }

  private isSpecChain(indexedClass: IndexedClass, chain: AncestorChain): boolean {
    if (chain.extendsSpecification) {
      return true;
    }
    // The base class is not part of the workspace (e.g. it comes from a library, like geb.spock.GebSpec),
    // so recognize the class by its feature methods using Spock blocks (given:, when:, expect:, ...)
    return chain.unresolvedBase && [indexedClass, ...chain.ancestors].some(c => c.testClass.hasSpockBlocks);
  }

  private resolveAncestors(indexedClass: IndexedClass): AncestorChain {
    const ancestors: IndexedClass[] = [];
    const visited = new Set<SpockTestClass>([indexedClass.testClass]);
    let current = indexedClass;

    while (!SpecClassIndex.isSpecification(current.testClass.superClass)) {
      const superClass = this.resolveSuperClass(current);
      if (!superClass) {
        return { ancestors, extendsSpecification: false, unresolvedBase: true };
      }
      if (visited.has(superClass.testClass)) {
        // Inheritance cycle, which cannot compile anyway
        return { ancestors, extendsSpecification: false, unresolvedBase: false };
      }
      visited.add(superClass.testClass);
      ancestors.push(superClass);
      current = superClass;
    }

    return { ancestors, extendsSpecification: true, unresolvedBase: false };
  }

  /**
   * Finds the indexed class referenced by the superclass of the given class, following Groovy name
   * resolution: qualified name, explicit import (including aliases), same package, then any class
   * with that name (star imports).
   */
  private resolveSuperClass(indexedClass: IndexedClass): IndexedClass | undefined {
    const superClass = indexedClass.testClass.superClass;
    if (!superClass) {
      return undefined;
    }

    const { file } = indexedClass;
    let candidates: IndexedClass[] | undefined;
    if (superClass.includes('.')) {
      candidates = this.classesByQualifiedName.get(superClass);
    } else if (file.imports[superClass]) {
      candidates = this.classesByQualifiedName.get(file.imports[superClass]);
    } else {
      candidates = this.classesByQualifiedName.get(SpecClassIndex.qualify(file.packageName, superClass))
        || this.classesBySimpleName.get(superClass);
    }

    candidates = candidates?.filter(candidate => candidate.testClass !== indexedClass.testClass);
    if (!candidates || candidates.length === 0) {
      return undefined;
    }
    // Prefer a class declared in the same file when the name is ambiguous
    return candidates.find(candidate => candidate.fileKey === indexedClass.fileKey) || candidates[0];
  }

  private collectInheritedMethods(testClass: SpockTestClass, ancestors: IndexedClass[]): InheritedSpockTestMethod[] {
    const knownNames = new Set(testClass.methods.map(method => method.name));
    const methodsPerAncestor: InheritedSpockTestMethod[][] = [];

    // Walk from the nearest base class, so that the nearest declaration of a feature name wins
    for (const ancestor of ancestors) {
      const ancestorMethods: InheritedSpockTestMethod[] = [];
      for (const method of ancestor.testClass.methods) {
        if (!knownNames.has(method.name)) {
          knownNames.add(method.name);
          ancestorMethods.push({ method, declaringClass: ancestor.testClass.name, fileKey: ancestor.fileKey });
        }
      }
      methodsPerAncestor.push(ancestorMethods);
    }

    // Spock runs the features of base classes first
    return methodsPerAncestor.reverse().flat();
  }

  private ensureLookups(): void {
    if (!this.lookupsDirty) {
      return;
    }

    this.classesByFile.clear();
    this.classesByQualifiedName.clear();
    this.classesBySimpleName.clear();

    for (const [fileKey, file] of this.files) {
      const indexedClasses = file.classes.map(testClass => ({ fileKey, file, testClass }));
      this.classesByFile.set(fileKey, indexedClasses);
      for (const indexedClass of indexedClasses) {
        const name = indexedClass.testClass.name;
        SpecClassIndex.addToLookup(this.classesByQualifiedName, SpecClassIndex.qualify(file.packageName, name), indexedClass);
        SpecClassIndex.addToLookup(this.classesBySimpleName, name, indexedClass);
      }
    }

    this.lookupsDirty = false;
  }

  private static addToLookup(lookup: Map<string, IndexedClass[]>, key: string, indexedClass: IndexedClass): void {
    const existing = lookup.get(key);
    if (existing) {
      existing.push(indexedClass);
    } else {
      lookup.set(key, [indexedClass]);
    }
  }

  private static qualify(packageName: string | undefined, className: string): string {
    return packageName ? `${packageName}.${className}` : className;
  }

  private static simpleName(className: string): string {
    return className.substring(className.lastIndexOf('.') + 1);
  }
}
