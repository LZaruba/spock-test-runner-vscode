package com.example

// Extends Specification indirectly (through AbstractSpec), so the features
// inherited from AbstractSpec run as part of this spec as well
class ChildSpec extends AbstractSpec {

    def "child test method"() {
        expect:
        new Calculator().add(2, 3) == 5
    }

    def "child data driven test"(int a, int b, int sum) {
        expect:
        new Calculator().add(a, b) == sum

        where:
        a | b | sum
        1 | 2 | 3
        4 | 5 | 9
    }
}
