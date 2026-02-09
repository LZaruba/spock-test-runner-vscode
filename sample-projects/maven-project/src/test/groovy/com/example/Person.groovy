package com.example

class Person {
    String name
    int age
    
    Person() {}
    
    Person(Map properties) {
        this.name = properties.name
        this.age = properties.age
    }
}
