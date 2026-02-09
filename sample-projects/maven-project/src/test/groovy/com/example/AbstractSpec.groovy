package com.example

import spock.lang.Specification

abstract class AbstractSpec extends Specification {

    def "abstract test method"() {
        expect:
        true
    }

    def "another abstract test"(int value) {
        expect:
        value > 0

        where:
        value << [1, 2, 3]
    }
}
