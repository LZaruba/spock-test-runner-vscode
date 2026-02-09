package com.example;

public class BowlingException extends RuntimeException {
    public BowlingException(String message) {
        super(message);
    }
    
    public BowlingException(String message, Throwable cause) {
        super(message, cause);
    }
}
