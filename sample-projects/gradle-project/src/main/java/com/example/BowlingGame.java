package com.example;

import java.util.ArrayList;
import java.util.List;

public class BowlingGame {
    private List<Frame> frames;
    private int currentFrame;
    private int currentRoll;
    
    public BowlingGame() {
        this.frames = new ArrayList<>();
        this.currentFrame = 0;
        this.currentRoll = 0;
        
        // Initialize 10 frames
        for (int i = 0; i < 10; i++) {
            frames.add(new Frame());
        }
    }
    
    public void roll(int pins) {
        if (pins < 0 || pins > 10) {
            throw new IllegalArgumentException("Pins must be between 0 and 10");
        }
        
        if (isGameOver()) {
            throw new IllegalStateException("Cannot roll after game is over");
        }
        
        Frame frame = frames.get(currentFrame);
        frame.addRoll(pins);
        
        // Check for invalid roll (more pins than remaining)
        if (frame.getPinsRemaining() < 0) {
            throw new IllegalArgumentException("Cannot knock down more pins than available");
        }
        
        currentRoll++;
        
        // Move to next frame if current frame is complete
        if (frame.isComplete() && currentFrame < 9) {
            currentFrame++;
            currentRoll = 0;
        }
    }
    
    public int score() {
        int totalScore = 0;
        
        for (int i = 0; i < frames.size(); i++) {
            Frame frame = frames.get(i);
            totalScore += frame.getScore();
            
            // Add bonus for strikes and spares
            if (frame.isStrike()) {
                totalScore += getStrikeBonus(i);
            } else if (frame.isSpare()) {
                totalScore += getSpareBonus(i);
            }
        }
        
        return totalScore;
    }
    
    public boolean isGameOver() {
        if (currentFrame < 9) {
            return false;
        }
        
        Frame lastFrame = frames.get(9);
        if (lastFrame.isStrike() || lastFrame.isSpare()) {
            return lastFrame.getRolls().size() >= 3;
        } else {
            return lastFrame.getRolls().size() >= 2;
        }
    }
    
    public int getCurrentFrame() {
        return currentFrame + 1;
    }
    
    public int getCurrentRoll() {
        return currentRoll + 1;
    }
    
    public List<Frame> getFrames() {
        return new ArrayList<>(frames);
    }
    
    private int getStrikeBonus(int frameIndex) {
        int bonus = 0;
        
        // Next two rolls
        if (frameIndex < 9) {
            Frame nextFrame = frames.get(frameIndex + 1);
            bonus += nextFrame.getRolls().get(0);
            
            if (nextFrame.isStrike() && frameIndex < 8) {
                // Strike in next frame, need first roll of frame after that
                Frame frameAfterNext = frames.get(frameIndex + 2);
                if (frameAfterNext.getRolls().size() > 0) {
                    bonus += frameAfterNext.getRolls().get(0);
                }
            } else {
                // Next frame is not a strike, get second roll
                if (nextFrame.getRolls().size() > 1) {
                    bonus += nextFrame.getRolls().get(1);
                }
            }
        } else {
            // Last frame strike bonus
            Frame lastFrame = frames.get(9);
            if (lastFrame.getRolls().size() > 1) {
                bonus += lastFrame.getRolls().get(1);
            }
            if (lastFrame.getRolls().size() > 2) {
                bonus += lastFrame.getRolls().get(2);
            }
        }
        
        return bonus;
    }
    
    private int getSpareBonus(int frameIndex) {
        int bonus = 0;
        
        if (frameIndex < 9) {
            Frame nextFrame = frames.get(frameIndex + 1);
            if (nextFrame.getRolls().size() > 0) {
                bonus += nextFrame.getRolls().get(0);
            }
        } else {
            // Last frame spare bonus
            Frame lastFrame = frames.get(9);
            if (lastFrame.getRolls().size() > 2) {
                bonus += lastFrame.getRolls().get(2);
            }
        }
        
        return bonus;
    }
    
    public String getGameState() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < frames.size(); i++) {
            sb.append("Frame ").append(i + 1).append(": ");
            sb.append(frames.get(i).toString());
            if (i < frames.size() - 1) {
                sb.append(" | ");
            }
        }
        return sb.toString();
    }
}
