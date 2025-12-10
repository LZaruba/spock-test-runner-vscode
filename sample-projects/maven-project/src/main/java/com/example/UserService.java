package com.example;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class UserService {
    private Map<String, User> users = new HashMap<>();
    
    public User createUser(String name, String email) {
        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Name cannot be empty");
        }
        
        if (email == null || !email.contains("@")) {
            throw new IllegalArgumentException("Invalid email format");
        }
        
        String id = UUID.randomUUID().toString();
        User user = new User(id, name, email);
        users.put(id, user);
        return user;
    }
    
    public User findById(String id) {
        return users.get(id);
    }
}
