package com.example

import spock.lang.Specification

class NestedClassSpec extends Specification {

    def "outer test method"() {
        expect:
        true
    }

    def "inner test method"(int value) {
        expect:
        value > 0

        where:
        value << [1, 2, 3]
    }

    def "another inner test"(String name, int age) {
        expect:
        name.length() > 0 && age > 0

        where:
        name | age
        "Alice" | 25
        "Bob" | 30
    }
}
