package com.example

import spock.lang.Specification

class ModuleASpec extends Specification {

    def "module A test should pass"() {
        expect:
        true
    }

    def "module A should handle string operations"(String input, int expectedLength) {
        expect:
        input.length() == expectedLength

        where:
        input       | expectedLength
        "hello"     | 5
        "world"     | 5
        "test"      | 4
    }

    def "module A should perform calculations"() {
        expect:
        1 + 1 == 2
        5 * 5 == 25
        10 - 3 == 7
    }

    void "module A should perform calculations - void method"() {
        expect:
        1 + 1 == 2
        5 * 5 == 25
        10 - 3 == 7
    }
}
