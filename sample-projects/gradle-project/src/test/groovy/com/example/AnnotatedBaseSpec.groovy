package com.example

import spock.lang.Specification
import spock.lang.Stepwise

// Base spec declared with an annotation and modifiers on the same line as the class keyword
@Stepwise public abstract class AnnotatedBaseSpec<T extends Comparable<T>> extends Specification {

    abstract T smallerValue()

    abstract T biggerValue()

    def "values are ordered"() {
        expect:
        smallerValue() < biggerValue()
    }
}
