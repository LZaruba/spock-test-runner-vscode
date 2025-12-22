package com.example

import spock.lang.Specification

class UserServiceSpec extends Specification {

    def "should create user with valid data"() {
        given:
        UserService userService = new UserService()
        String name = "John Doe"
        String email = "john@example.com"
        
        when:
        User user = userService.createUser(name, email)
        
        then:
        user != null
        user.name == name
        user.email == email
        user.id != null
    }

    def "should throw exception for invalid email"() {
        given:
        UserService userService = new UserService()
        String name = "John Doe"
        String invalidEmail = "invalid-email"
        
        when:
        userService.createUser(name, invalidEmail)
        
        then:
        IllegalArgumentException e = thrown()
        e.message == "Invalid email format"
    }

    def "should throw exception for empty name"() {
        given:
        UserService userService = new UserService()
        String emptyName = ""
        String email = "john@example.com"
        
        when:
        userService.createUser(emptyName, email)
        
        then:
        IllegalArgumentException e = thrown()
        e.message == "Name cannot be empty"
    }

    def "should find user by id"() {
        given:
        UserService userService = new UserService()
        User createdUser = userService.createUser("Jane Doe", "jane@example.com")
        
        when:
        User foundUser = userService.findById(createdUser.id)
        
        then:
        foundUser != null
        foundUser.id == createdUser.id
        foundUser.name == "Jane Doe"
        foundUser.email == "jane@example.com"
    }

    def "should return null for non-existent user"() {
        given:
        UserService userService = new UserService()
        String nonExistentId = "non-existent-id"
        
        when:
        User foundUser = userService.findById(nonExistentId)
        
        then:
        foundUser == null
    }
}
