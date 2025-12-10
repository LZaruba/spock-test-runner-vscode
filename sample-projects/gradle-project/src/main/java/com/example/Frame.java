package com.example;

import java.util.ArrayList;
import java.util.List;

public class Frame {
    private List<Integer> rolls;
    private boolean isLastFrame;
    
    public Frame() {
        this.rolls = new ArrayList<>();
        this.isLastFrame = false;
    }
    
    public Frame(boolean isLastFrame) {
        this.rolls = new ArrayList<>();
        this.isLastFrame = isLastFrame;
    }
    
    public void addRoll(int pins) {
        if (pins < 0 || pins > 10) {
            throw new IllegalArgumentException("Pins must be between 0 and 10");
        }
        
        if (pins > getPinsRemaining()) {
            throw new IllegalArgumentException("Cannot knock down more pins than available");
        }
        
        rolls.add(pins);
    }
    
    public int getPinsRemaining() {
        if (rolls.isEmpty()) {
            return 10;
        }
        
        int totalPins = rolls.stream().mapToInt(Integer::intValue).sum();
        return 10 - totalPins;
    }
    
    public boolean isStrike() {
        return !rolls.isEmpty() && rolls.get(0) == 10;
    }
    
    public boolean isSpare() {
        return rolls.size() >= 2 && 
               rolls.get(0) + rolls.get(1) == 10 && 
               !isStrike();
    }
    
    public boolean isComplete() {
        if (isLastFrame) {
            if (isStrike() || isSpare()) {
                return rolls.size() >= 3;
            } else {
                return rolls.size() >= 2;
            }
        } else {
            return isStrike() || rolls.size() >= 2;
        }
    }
    
    public int getScore() {
        return rolls.stream().mapToInt(Integer::intValue).sum();
    }
    
    public List<Integer> getRolls() {
        return new ArrayList<>(rolls);
    }
    
    public void setLastFrame(boolean isLastFrame) {
        this.isLastFrame = isLastFrame;
    }
    
    public boolean isLastFrame() {
        return isLastFrame;
    }
    
    @Override
    public String toString() {
        if (rolls.isEmpty()) {
            return "[]";
        }
        
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        
        for (int i = 0; i < rolls.size(); i++) {
            if (i > 0) {
                sb.append(", ");
            }
            
            int roll = rolls.get(i);
            if (roll == 10) {
                sb.append("X");
            } else if (i == 1 && rolls.get(0) + roll == 10) {
                sb.append("/");
            } else {
                sb.append(roll);
            }
        }
        
        sb.append("]");
        return sb.toString();
    }
    
    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null || getClass() != obj.getClass()) return false;
        
        Frame frame = (Frame) obj;
        return isLastFrame == frame.isLastFrame && 
               rolls.equals(frame.rolls);
    }
    
    @Override
    public int hashCode() {
        return rolls.hashCode() + (isLastFrame ? 1 : 0);
    }
}
