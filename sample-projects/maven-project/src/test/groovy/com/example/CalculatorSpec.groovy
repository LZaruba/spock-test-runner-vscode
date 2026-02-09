package com.example

import spock.lang.Specification

class CalculatorSpec extends Specification {

    def "should add two numbers correctly"() {
        given:
        Calculator calculator = new Calculator()
        
        when:
        int result = calculator.add(2, 3)
        
        then:
        result == 5
    }

    def "should subtract two numbers correctly"() {
        given:
        Calculator calculator = new Calculator()
        
        when:
        int result = calculator.subtract(5, 3)
        
        then:
        result == 2
    }

    def "should multiply two numbers correctly"() {
        given:
        Calculator calculator = new Calculator()
        
        when:
        int result = calculator.multiply(4, 3)
        
        then:
        result == 12
    }

    def "should divide two numbers correctly"() {
        given:
        Calculator calculator = new Calculator()
        
        when:
        double result = calculator.divide(10, 2)
        
        then:
        result == 5.0
    }

    def "should throw exception when dividing by zero"() {
        given:
        Calculator calculator = new Calculator()
        
        when:
        calculator.divide(10, 0)
        
        then:
        ArithmeticException e = thrown()
        e.message == "Cannot divide by zero"
    }

    def "should handle multiple operations"() {
        given:
        Calculator calculator = new Calculator()
        
        when:
        int result = calculator.add(calculator.multiply(2, 3), calculator.subtract(10, 5))
        
        then:
        result == 11
    }
}
