package com.example

import spock.lang.Specification
import spock.lang.Unroll

class BowlingGameSpec extends Specification {

    // 1. Basic data table with pipe separators
    def "should calculate score for regular frames"(int roll1, int roll2, int expectedScore) {
        given:
        BowlingGame game = new BowlingGame()

        when:
        game.roll(roll1)
        game.roll(roll2)

        then:
        game.score() == expectedScore

        where:
        roll1 | roll2 | expectedScore
        3     | 4     | 7
        5     | 2     | 7
        0     | 0     | 0
        9     | 1     | 10
    }

    // 2. Data table with double pipe separator (input vs output)
    def "should handle strikes correctly"(int pins, int expectedScore) {
        given:
        BowlingGame game = new BowlingGame()

        when:
        game.roll(pins)

        then:
        game.score() == expectedScore

        where:
        pins || expectedScore
        10   || 10
        5    || 5
        0    || 0
    }

    // 3. Data table with semicolon separators
    def "should handle spares correctly"(int roll1, int roll2, int nextRoll, int expectedScore) {
        given:
        BowlingGame game = new BowlingGame()

        when:
        game.roll(roll1)
        game.roll(roll2)
        game.roll(nextRoll)

        then:
        game.score() == expectedScore

        where:
        roll1 ; roll2 ; nextRoll ;; expectedScore
        5     ; 5     ; 3        ;; 18
        7     ; 3     ; 4        ;; 18
        9     ; 1     ; 2        ;; 18
    }

    // 4. Mixed separators (multiple tables)
    def "should handle mixed frame types"(int roll1, int roll2, int expectedScore) {
        given:
        BowlingGame game = new BowlingGame()

        when:
        game.roll(roll1)
        game.roll(roll2)

        then:
        game.score() == expectedScore

        where:
        roll1 | roll2 || expectedScore
        3     | 4     || 7
        5     | 5     || 10
        10    | 0     || 10
        0     | 10    || 10
    }

    // 5. Single column data table
    def "should handle gutter game"(int pins) {
        given:
        BowlingGame game = new BowlingGame()

        when:
        game.roll(pins)

        then:
        game.score() == pins

        where:
        pins | _
        0    | _
        0    | _
        0    | _
    }

    // 6. Test with placeholders in method name
    def "strike in frame #frame should give bonus points"(int frame, int expectedBonus) {
        given:
        BowlingGame game = new BowlingGame()

        when:
        // Roll strikes in previous frames
        for (int i = 0; i < frame - 1; i++) {
            game.roll(10)
        }
        game.roll(10) // Strike in target frame
        game.roll(3)  // First bonus roll
        game.roll(4)  // Second bonus roll

        then:
        game.score() == 10 + expectedBonus

        where:
        frame | expectedBonus
        1     | 7
        2     | 7
        3     | 7
    }

    // 7. Test with complex placeholders
    def "#gameState should have score #expectedScore"() {
        given:
        BowlingGame game = new BowlingGame()

        when:
        rolls.each { game.roll(it) }

        then:
        game.score() == expectedScore

        where:
        gameState << [
            "perfect game",
            "gutter game", 
            "spare game"
        ]
        rolls << [
            [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]
        ]
        expectedScore << [300, 0, 150]
    }

    // 8. Data pipe with list
    def "should validate roll constraints - valid pins"(int pins) {
        when:
        BowlingGame game = new BowlingGame()
        game.roll(pins)

        then:
        noExceptionThrown()

        where:
        pins << [0, 5, 10]
    }

    def "should validate roll constraints - invalid pins"(int pins) {
        when:
        BowlingGame game = new BowlingGame()
        game.roll(pins)

        then:
        IllegalArgumentException e = thrown()

        where:
        pins << [-1, 11, 15]
    }

    // 9. Data pipe with map
    def "should handle frame completion"(String frameType, int roll1, int roll2, boolean isComplete) {
        given:
        BowlingGame game = new BowlingGame()

        when:
        game.roll(roll1)
        if (roll2 >= 0) {
            game.roll(roll2)
        }

        then:
        game.getFrames().get(0).isComplete() == isComplete

        where:
        [frameType, roll1, roll2, isComplete] << [
            ["strike", 10, -1, true],
            ["spare", 5, 5, true],
            ["regular", 3, 4, true],
            ["incomplete", 5, -1, false]
        ]
    }

    // 10. Data pipe with range
    def "should handle consecutive strikes"(int strikeCount) {
        given:
        BowlingGame game = new BowlingGame()

        when:
        for (int i = 0; i < strikeCount; i++) {
            game.roll(10)
        }

        then:
        game.getCurrentFrame() == Math.min(strikeCount + 1, 10)

        where:
        strikeCount << (1..12)
    }

    // 11. Multiple data pipes
    def "should calculate complex scoring"(String scenario, int expectedScore) {
        given:
        BowlingGame game = new BowlingGame()

        when:
        rolls.each { game.roll(it) }

        then:
        game.score() == expectedScore

        where:
        scenario << ["perfect", "gutter", "mixed", "spares"]
        rolls << [
            [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [3, 4, 10, 5, 5, 2, 3, 0, 0, 0, 0, 0],
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]
        ]
        expectedScore << [300, 0, 42, 150]
    }

    // 12. Data table with underscore separators
    def "should handle last frame scenarios"(int roll1, int roll2, int roll3, int expectedScore) {
        given:
        BowlingGame game = new BowlingGame()

        when:
        // Complete 9 frames first
        for (int i = 0; i < 9; i++) {
            game.roll(3)
            game.roll(4)
        }
        
        // Last frame
        game.roll(roll1)
        if (roll2 >= 0) game.roll(roll2)
        if (roll3 >= 0) game.roll(roll3)

        then:
        game.score() == expectedScore

        where:
        roll1 | roll2 || roll3 | expectedScore
        10    | 5     || 5     | 87
        5     | 5     || 5     | 87
        3     | 4     || -1    | 85
    }

    // 13. Test with @Unroll annotation and custom pattern
    @Unroll("#featureName[#iterationIndex] - Frame #frame: #roll1, #roll2 = #expectedScore")
    def "frame scoring test"() {
        given:
        BowlingGame game = new BowlingGame()

        when:
        game.roll(roll1)
        game.roll(roll2)

        then:
        game.getFrames().get(0).getScore() == expectedScore

        where:
        frame | roll1 | roll2 | expectedScore
        1     | 3     | 4     | 7
        2     | 5     | 5     | 10
        3     | 10    | 0     | 10
    }

    // 14. Test with method parameters and where block
    def "should validate game state transitions"(int currentFrame, int currentRoll, boolean gameOver) {
        given:
        BowlingGame game = new BowlingGame()

        when:
        // Roll to reach desired state
        for (int i = 0; i < currentFrame - 1; i++) {
            game.roll(3)
            game.roll(4)
        }
        
        for (int i = 0; i < currentRoll - 1; i++) {
            game.roll(3)
        }

        then:
        game.getCurrentFrame() == currentFrame
        game.getCurrentRoll() == currentRoll
        game.isGameOver() == gameOver

        where:
        currentFrame | currentRoll | gameOver
        1            | 1           | false
        1            | 2           | false
        5            | 1           | false
        10           | 2           | true
    }

    // 15. Test with complex data table structure
    def "should handle edge cases - valid rolls"(int pins) {
        when:
        BowlingGame game = new BowlingGame()
        game.roll(pins)

        then:
        noExceptionThrown()

        where:
        pins << [5, 0, 10]
    }

    def "should handle edge cases - invalid rolls"(int pins, String expectedMessage) {
        when:
        BowlingGame game = new BowlingGame()
        game.roll(pins)

        then:
        IllegalArgumentException e = thrown()
        e.message == expectedMessage

        where:
        pins | expectedMessage
        -1   | "Pins must be between 0 and 10"
        11   | "Pins must be between 0 and 10"
    }
}
