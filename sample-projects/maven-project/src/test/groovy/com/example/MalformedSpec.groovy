package com.example

import spock.lang.Specification

class MalformedSpec extends Specification {

    def "test with minimal where block"() {
        expect:
        value >= 0

        where:
        value | _
        0     | _
        1     | _
        2     | _
    }

    def "test with complex syntax"() {
        expect:
        // Complex Groovy syntax that might cause parsing issues
        def complex = {
            return "complex string with variable"
        }
        true
    }

    def "test with nested structures"() {
        expect:
        def nested = [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9]
        ]
        nested.size() == 3
    }

    def "test with edge case data"() {
        expect:
        value > 0

        where:
        value << [1, 2, 3]
    }
}
