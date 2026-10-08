package com.example

// Extends Specification indirectly (through AnnotatedBaseSpec), with the superclass
// declared on the next line and block labels with descriptions
class DescribedChildSpec
        extends AnnotatedBaseSpec<Integer> {

    @Override
    Integer smallerValue() {
        1
    }

    @Override
    Integer biggerValue() {
        2
    }

    def "adds numbers"() {
        given: "a calculator"
        def calculator = new Calculator()

        when: "two numbers are added"
        def result = calculator.add(smallerValue(), biggerValue())

        then: "the result is their sum"
        result == 3
    }
}
