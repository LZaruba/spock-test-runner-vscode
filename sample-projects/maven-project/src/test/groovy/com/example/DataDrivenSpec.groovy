package com.example

import spock.lang.Specification
import spock.lang.Unroll

class DataDrivenSpec extends Specification {

    // 1. Basic data table with pipe separators
    def "maximum of two numbers"(int a, int b, int c) {
        expect:
        Math.max(a, b) == c

        where:
        a | b | c
        1 | 3 | 3
        7 | 4 | 7
        0 | 0 | 0
    }

    // 2. Data table with double pipe separator (input vs output)
    def "should calculate square of number"(int input, int expected) {
        expect:
        input * input == expected

        where:
        input || expected
        2     || 4
        3     || 9
        4     || 16
        5     || 25
    }

    // 3. Data table with semicolon separators
    def "should add numbers correctly"(int x, int y, int result) {
        expect:
        x + y == result

        where:
        x ; y ;; result
        1 ; 2 ;; 3
        5 ; 3 ;; 8
        10; 15;; 25
    }

    // 4. Mixed separators (multiple tables)
    def "should handle multiple operations"(int a, int b, int c) {
        expect:
        (a + b) * c == a * c + b * c

        where:
        a | b || c
        1 | 2 || 3
        4 | 5 || 6

        d ; e ;; f
        7 ; 8 ;; 9
        10; 11;; 12
    }

    // 5. Single column data table
    def "should validate positive numbers"(int number) {
        expect:
        number > 0

        where:
        number | _
        1      | _
        5      | _
        10     | _
    }

    // 6. Test with placeholders in method name
    def "maximum of #a and #b is #c"() {
        expect:
        Math.max(a, b) == c

        where:
        a | b | c
        1 | 3 | 3
        7 | 4 | 7
        0 | 0 | 0
    }

    // 7. Test with complex placeholders
    // not supported by the plugin due to issues running gradle tests with . in the name
    /*def "test #person is #person years old"() {
        expect:
        person.age > 0
        person.name.length() > 0

        where:
        person << [
            new Person(name: "Alice", age: 25),
            new Person(name: "Bob", age: 30),
            new Person(name: "Charlie", age: 35)
        ]
    }*/

    // 8. Data pipe with list
    def "should validate email format"(String email, boolean isValid) {
        expect:
        email.contains("@") == isValid

        where:
        email << ["test@example.com", "invalid-email", "user@domain.org", "not-an-email"]
        isValid << [true, false, true, false]
    }

    // 9. Data pipe with map
    def "should calculate area"(String shape, int width, int height, int expectedArea) {
        expect:
        calculateArea(shape, width, height) == expectedArea

        where:
        [shape, width, height, expectedArea] << [
            ["rectangle", 5, 3, 15],
            ["square", 4, 4, 16],
            ["rectangle", 10, 2, 20]
        ]
    }

    // 10. Data pipe with range
    def "should validate even numbers"(int number) {
        expect:
        number % 2 == 0

        where:
        number << (2..10).step(2)
    }

    // 11. Multiple data pipes
    def "should combine data from multiple sources"(String name, int age, String expected) {
        expect:
        "${name} is ${age} years old" == expected

        where:
        name << ["Alice", "Bob", "Charlie"]
        age << [25, 30, 35]
        expected << ["Alice is 25 years old", "Bob is 30 years old", "Charlie is 35 years old"]
    }

    // 12. Data table with underscore separators
    def "should validate ranges"(int min, int max, int value, boolean inRange) {
        expect:
        (value >= min && value <= max) == inRange

        where:
        min | max || value | inRange
        1   | 10  || 5     | true
        1   | 10  || 15    | false
        1   | 10  || 1     | true
        1   | 10  || 10    | true
    }

    // 13. Test with @Unroll annotation and custom pattern
    @Unroll("#featureName[#iterationIndex] (#a + #b = #c)")
    def "addition test"() {
        expect:
        a + b == c

        where:
        a | b | c
        1 | 2 | 3
        4 | 5 | 9
        7 | 8 | 15
    }

    // 14. Test with method parameters and where block
    def "should multiply numbers"(int x, int y, int expected) {
        expect:
        x * y == expected

        where:
        x | y | expected
        2 | 3 | 6
        4 | 5 | 20
        6 | 7 | 42
    }

    // 15. Test with complex data table structure
    def "should validate user data"(String name, String email, int age, boolean isValid) {
        expect:
        validateUser(name, email, age) == isValid

        where:
        name  | email              | age | isValid
        "John"| "john@test.com"    | 25  | true
        ""    | "invalid@test.com" | 25  | false
        "Jane"| "jane@test.com"    | -5  | false
        "Bob" | "bob@test.com"     | 30  | true
    }

    // Helper methods
    private int calculateArea(String shape, int width, int height) {
        if (shape == "rectangle" || shape == "square") {
            return width * height
        }
        return 0
    }

    private boolean validateUser(String name, String email, int age) {
        return name.length() > 0 && email.contains("@") && age > 0
    }
}
