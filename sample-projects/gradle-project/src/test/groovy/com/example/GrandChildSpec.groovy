package com.example

// Extends Specification through two levels of inheritance (ChildSpec -> AbstractSpec)
class GrandChildSpec extends ChildSpec {

    def "grand child test method"() {
        expect:
        new Calculator().multiply(2, 3) == 6
    }
}
