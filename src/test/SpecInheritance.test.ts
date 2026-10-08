import * as fs from 'fs';
import * as path from 'path';
import { SpecClassIndex } from '../services/SpecClassIndex';
import { TestDiscoveryService } from '../services/TestDiscoveryService';

const ABSTRACT_BASE_SPEC = `
package com.example

import spock.lang.Specification

abstract class BaseSpec extends Specification {

    def "base feature"() {
        expect:
        true
    }

    def "base data feature"(int value) {
        expect:
        value > 0

        where:
        value << [1, 2]
    }
}`;

const CHILD_SPEC = `
package com.example

class ChildSpec extends BaseSpec {

    def "child feature"() {
        expect:
        true
    }
}`;

const GRAND_CHILD_SPEC = `
package com.example

class GrandChildSpec extends ChildSpec {

    def "grand child feature"() {
        expect:
        true
    }
}`;

function indexOf(files: Record<string, string>): SpecClassIndex {
  const index = new SpecClassIndex();
  for (const [fileKey, content] of Object.entries(files)) {
    index.update(fileKey, TestDiscoveryService.parseFile(content));
  }
  return index;
}

describe('Spec inheritance', () => {
  describe('TestDiscoveryService.parseFile', () => {
    it('should capture package, imports and superclasses', () => {
      const parsed = TestDiscoveryService.parseFile(`
package com.example.specs;

import spock.lang.Specification
import com.example.base.IntegrationSpec;
import com.example.base.DatabaseSpec as DbSpec
import static org.junit.Assert.assertTrue
import com.example.util.*

class ServiceSpec extends IntegrationSpec {
    def "feature"() {
        expect:
        true
    }
}`);

      expect(parsed.packageName).toBe('com.example.specs');
      expect(parsed.imports).toEqual({
        Specification: 'spock.lang.Specification',
        IntegrationSpec: 'com.example.base.IntegrationSpec',
        DbSpec: 'com.example.base.DatabaseSpec'
      });
      expect(parsed.classes).toHaveLength(1);
      expect(parsed.classes[0].name).toBe('ServiceSpec');
      expect(parsed.classes[0].superClass).toBe('IntegrationSpec');
      expect(parsed.classes[0].hasSpockBlocks).toBe(true);
    });

    it('should capture qualified and generic superclasses', () => {
      const parsed = TestDiscoveryService.parseFile(`
class QualifiedSpec extends com.example.BaseSpec {
}

class GenericSpec<T> extends TypedSpec<T> implements Serializable {
}`);

      expect(parsed.classes.map(c => [c.name, c.superClass])).toEqual([
        ['QualifiedSpec', 'com.example.BaseSpec'],
        ['GenericSpec', 'TypedSpec']
      ]);
    });

    it('should not treat quoted methods without Spock blocks as Spock blocks', () => {
      const parsed = TestDiscoveryService.parseFile(`
class SomeTest extends BaseTest {
    void "should work"() {
        assert true
    }
}`);

      expect(parsed.classes[0].methods).toHaveLength(1);
      expect(parsed.classes[0].hasSpockBlocks).toBe(false);
    });

    it('should keep features following a nested helper class in the enclosing spec', () => {
      const parsed = TestDiscoveryService.parseFile(`
class OuterSpec extends BaseSpec {
    def "first feature"() {
        expect:
        true
    }

    class Helper extends Object {
    }

    def "second feature"() {
        expect:
        true
    }
}`);

      expect(parsed.classes).toHaveLength(1);
      expect(parsed.classes[0].methods.map(m => m.name)).toEqual(['first feature', 'second feature']);
    });

    it('should capture classes declared with annotations and modifiers', () => {
      const parsed = TestDiscoveryService.parseFile(`
@Stepwise abstract class AnnotatedBaseSpec extends Specification {
}

public abstract class PublicBaseSpec extends Specification {
}

@SpringBootTest(classes = Application) public class PublicSpec extends PublicBaseSpec {
}

final class FinalSpec extends AnnotatedBaseSpec {
}`);

      expect(parsed.classes.map(c => [c.name, c.superClass, c.isAbstract])).toEqual([
        ['AnnotatedBaseSpec', 'Specification', true],
        ['PublicBaseSpec', 'Specification', true],
        ['PublicSpec', 'PublicBaseSpec', false],
        ['FinalSpec', 'AnnotatedBaseSpec', false]
      ]);
    });

    it('should capture nested type parameters and superclasses declared on the next line', () => {
      const parsed = TestDiscoveryService.parseFile(`
abstract class RepositorySpec<T extends Comparable<T>> extends Specification {
}

class VeryLongNameRepositorySpec
        extends RepositorySpec<String> {
}

class AnotherRepositorySpec
{
}`);

      expect(parsed.classes.map(c => [c.name, c.superClass])).toEqual([
        ['RepositorySpec', 'Specification'],
        ['VeryLongNameRepositorySpec', 'RepositorySpec']
      ]);
      expect(parsed.classes[1].line).toBe(4);
    });

    it('should recognize Spock blocks with descriptions', () => {
      const parsed = TestDiscoveryService.parseFile(`
class DescribedSpec extends IntegrationSpec {
    def "described feature"() {
        given: "a value from somewhere"
        def value = 1

        when: 'the value is incremented'
        value++

        then: "it is incremented" // with a comment
        value == 2

        and:
        value > 0
    }

    def unquotedFeature() {
        setup: "a value"
        def value = 1

        expect: "it is positive"
        value > 0

        cleanup: "nothing to do"
    }
}`);

      const [describedSpec] = parsed.classes;
      expect(describedSpec.hasSpockBlocks).toBe(true);
      expect(describedSpec.methods.map(m => [m.name, m.isDataDriven])).toEqual([
        ['described feature', false],
        ['unquotedFeature', false]
      ]);
    });

    it('should recognize where blocks with descriptions as data-driven', () => {
      const parsed = TestDiscoveryService.parseFile(`
class DataSpec extends Specification {
    def "data feature"() {
        expect:
        value > 0

        where: "the values are positive"
        value << [1, 2]
    }
}`);

      expect(parsed.classes[0].methods[0].isDataDriven).toBe(true);
    });
  });

  describe('TestDiscoveryService.parseTestsInFile', () => {
    it('should keep returning direct Specification subclasses without inherited methods', () => {
      const result = TestDiscoveryService.parseTestsInFile(ABSTRACT_BASE_SPEC);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('BaseSpec');
      expect(result[0].isAbstract).toBe(true);
      expect(result[0].methods.map(m => m.name)).toEqual(['base feature', 'base data feature']);
      expect(result[0].inheritedMethods).toEqual([]);
    });

    it('should recognize a spec extending a base spec declared in the same file', () => {
      const result = TestDiscoveryService.parseTestsInFile(`
import spock.lang.Specification

abstract class BaseSpec extends Specification {
    def "base feature"() {
        expect:
        true
    }
}

class ChildSpec extends BaseSpec {
    def "child feature"() {
        expect:
        true
    }
}`);

      expect(result.map(c => c.name)).toEqual(['BaseSpec', 'ChildSpec']);
      const childSpec = result[1];
      expect(childSpec.isAbstract).toBe(false);
      expect(childSpec.methods.map(m => m.name)).toEqual(['child feature']);
      expect(childSpec.inheritedMethods!.map(m => [m.method.name, m.declaringClass])).toEqual([
        ['base feature', 'BaseSpec']
      ]);
    });

    it('should recognize a spec extending a base class that is not in the workspace by its Spock blocks', () => {
      const result = TestDiscoveryService.parseTestsInFile(`
import geb.spock.GebSpec

class LoginSpec extends GebSpec {
    def "user can log in"() {
        when:
        to LoginPage

        then:
        at LoginPage
    }
}`);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('LoginSpec');
      expect(result[0].methods.map(m => m.name)).toEqual(['user can log in']);
    });

    it('should recognize a spec extending a base class that is not in the workspace by its described Spock blocks', () => {
      const result = TestDiscoveryService.parseTestsInFile(`
import geb.spock.GebSpec

class LoginSpec extends GebSpec {
    def "user can log in"() {
        when: "the user logs in"
        to LoginPage

        then: "the login page is shown"
        at LoginPage
    }
}`);

      expect(result.map(c => c.name)).toEqual(['LoginSpec']);
      expect(result[0].methods.map(m => m.name)).toEqual(['user can log in']);
    });

    it('should not recognize classes extending a non-Spock base class', () => {
      const result = TestDiscoveryService.parseTestsInFile(`
class Dog extends Animal {
    def bark() {
        return "woof"
    }
}

class SomeTest extends GroovyTestCase {
    void "should work"() {
        assert true
    }
}`);

      expect(result).toHaveLength(0);
    });
  });

  describe('SpecClassIndex', () => {
    it('should resolve specs extending Specification through base classes in other files', () => {
      const index = indexOf({
        'child': CHILD_SPEC,
        'grandChild': GRAND_CHILD_SPEC,
        'base': ABSTRACT_BASE_SPEC
      });

      const [childSpec] = index.getSpecClasses('child');
      expect(childSpec.name).toBe('ChildSpec');
      expect(childSpec.methods.map(m => m.name)).toEqual(['child feature']);
      expect(childSpec.inheritedMethods!.map(m => [m.method.name, m.declaringClass, m.fileKey])).toEqual([
        ['base feature', 'BaseSpec', 'base'],
        ['base data feature', 'BaseSpec', 'base']
      ]);
      expect(childSpec.inheritedMethods![1].method.isDataDriven).toBe(true);

      const [grandChildSpec] = index.getSpecClasses('grandChild');
      expect(grandChildSpec.name).toBe('GrandChildSpec');
      // Features of the base-most class come first, like Spock runs them
      expect(grandChildSpec.inheritedMethods!.map(m => [m.method.name, m.declaringClass, m.fileKey])).toEqual([
        ['base feature', 'BaseSpec', 'base'],
        ['base data feature', 'BaseSpec', 'base'],
        ['child feature', 'ChildSpec', 'child']
      ]);
    });

    it('should resolve base specs declared with annotations, modifiers and nested type parameters', () => {
      const index = indexOf({
        'base': `
package com.example

import spock.lang.Specification

@Stepwise public abstract class RepositorySpec<T extends Comparable<T>> extends Specification {
    def "base feature"() {
        expect:
        true
    }
}`,
        'child': `
package com.example

class StringRepositorySpec
        extends RepositorySpec<String> {
    def "child feature"() {
        given: "a repository"
        def repository = []

        expect: "it is empty"
        repository.isEmpty()
    }
}`
      });

      expect(index.getSpecClasses('base').map(c => [c.name, c.isAbstract])).toEqual([['RepositorySpec', true]]);
      const [childSpec] = index.getSpecClasses('child');
      expect(childSpec.name).toBe('StringRepositorySpec');
      expect(childSpec.methods.map(m => m.name)).toEqual(['child feature']);
      expect(childSpec.inheritedMethods!.map(m => [m.method.name, m.declaringClass])).toEqual([
        ['base feature', 'RepositorySpec']
      ]);
    });

    it('should not list an inherited feature twice when the spec declares a feature with the same name', () => {
      const index = indexOf({
        'base': ABSTRACT_BASE_SPEC,
        'child': `
package com.example

class OverridingSpec extends BaseSpec {
    def "base feature"() {
        expect:
        true
    }
}`
      });

      const [spec] = index.getSpecClasses('child');
      expect(spec.methods.map(m => m.name)).toEqual(['base feature']);
      expect(spec.inheritedMethods!.map(m => m.method.name)).toEqual(['base data feature']);
    });

    it('should resolve base classes using imports, aliases, qualified names and packages', () => {
      const index = indexOf({
        'specBase': `
package com.example.spec

import spock.lang.Specification

abstract class BaseSpec extends Specification {
    def "spec base feature"() {
        expect:
        true
    }
}`,
        'otherBase': `
package com.example.other

abstract class BaseSpec extends SomeLibraryClass {
}`,
        'imported': `
package com.example.feature

import com.example.spec.BaseSpec

class ImportedSpec extends BaseSpec {
}`,
        'aliased': `
package com.example.feature

import com.example.spec.BaseSpec as SpockBase

class AliasedSpec extends SpockBase {
}`,
        'qualified': `
package com.example.feature

class QualifiedSpec extends com.example.spec.BaseSpec {
}`,
        'samePackage': `
package com.example.other

class SamePackageSpec extends BaseSpec {
}`
      });

      for (const fileKey of ['imported', 'aliased', 'qualified']) {
        const [spec] = index.getSpecClasses(fileKey);
        expect(spec.inheritedMethods!.map(m => m.method.name)).toEqual(['spec base feature']);
      }
      // Resolves to com.example.other.BaseSpec, which is not a Spock specification
      expect(index.getSpecClasses('samePackage')).toEqual([]);
    });

    it('should report the files depending on a file through inheritance', () => {
      const index = indexOf({
        'base': ABSTRACT_BASE_SPEC,
        'child': CHILD_SPEC,
        'grandChild': GRAND_CHILD_SPEC,
        'unrelated': `
package com.example

import spock.lang.Specification

class UnrelatedSpec extends Specification {
}`
      });

      expect(index.getDependentFiles('base').sort()).toEqual(['child', 'grandChild']);
      expect(index.getDependentFiles('child')).toEqual(['grandChild']);
      expect(index.getDependentFiles('grandChild')).toEqual([]);
      expect(index.getDependentFiles('unrelated')).toEqual([]);
    });

    it('should reflect updated and removed base classes', () => {
      const index = indexOf({
        'base': ABSTRACT_BASE_SPEC,
        'child': `
package com.example

class OnlyInheritingSpec extends BaseSpec {
}`
      });
      expect(index.getSpecClasses('child')[0].inheritedMethods).toHaveLength(2);

      index.update('base', TestDiscoveryService.parseFile(ABSTRACT_BASE_SPEC.replace('"base feature"', '"renamed feature"')));
      expect(index.getSpecClasses('child')[0].inheritedMethods!.map(m => m.method.name))
        .toEqual(['renamed feature', 'base data feature']);

      index.remove('base');
      expect(index.getSpecClasses('child')).toEqual([]);
    });

    it('should not loop forever on inheritance cycles', () => {
      const index = indexOf({
        'a': `
class A extends B {
    def "feature"() {
        expect:
        true
    }
}`,
        'b': `
class B extends A {
}`
      });

      expect(index.getSpecClasses('a')).toEqual([]);
      expect(index.getDependentFiles('a')).toEqual(['b']);
    });

    it('should resolve the inheriting specs of the Gradle sample project', () => {
      const sampleDir = path.join(__dirname, '../../sample-projects/gradle-project/src/test/groovy/com/example');
      const index = new SpecClassIndex();
      for (const fileName of fs.readdirSync(sampleDir).filter(name => name.endsWith('.groovy'))) {
        index.update(fileName, TestDiscoveryService.parseFile(fs.readFileSync(path.join(sampleDir, fileName), 'utf8')));
      }

      const [childSpec] = index.getSpecClasses('ChildSpec.groovy');
      expect(childSpec.name).toBe('ChildSpec');
      expect(childSpec.inheritedMethods!.map(m => [m.method.name, m.fileKey])).toEqual([
        ['abstract test method', 'AbstractSpec.groovy'],
        ['another abstract test', 'AbstractSpec.groovy']
      ]);

      const [grandChildSpec] = index.getSpecClasses('GrandChildSpec.groovy');
      expect(grandChildSpec.name).toBe('GrandChildSpec');
      expect(grandChildSpec.inheritedMethods!.map(m => m.declaringClass)).toEqual(
        ['AbstractSpec', 'AbstractSpec', ...childSpec.methods.map(() => 'ChildSpec')]
      );

      const [describedChildSpec] = index.getSpecClasses('DescribedChildSpec.groovy');
      expect(describedChildSpec.name).toBe('DescribedChildSpec');
      expect(describedChildSpec.methods.map(m => m.name)).toEqual(['adds numbers']);
      expect(describedChildSpec.inheritedMethods!.map(m => [m.method.name, m.fileKey])).toEqual([
        ['values are ordered', 'AnnotatedBaseSpec.groovy']
      ]);
    });
  });
});
