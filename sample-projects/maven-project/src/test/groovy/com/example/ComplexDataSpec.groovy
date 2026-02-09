package com.example

import spock.lang.Specification
import spock.lang.Unroll

class ComplexDataSpec extends Specification {

    // Test with complex data structures
    def "should handle complex game scenarios"(String scenario, List<Integer> rolls, int expectedScore) {
        given:
        BowlingGame game = new BowlingGame()

        when:
        rolls.each { game.roll(it) }

        then:
        game.score() == expectedScore

        where:
        scenario << [
            "perfect game",
            "gutter game",
            "spare game",
            "mixed game"
        ]
        rolls << [
            [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
            [3, 4, 10, 5, 5, 2, 3, 0, 0, 0, 0, 0]
        ]
        expectedScore << [300, 0, 150, 42]
    }

    // Test with map data
    def "should handle game state transitions"(Map<String, Object> gameState) {
        given:
        BowlingGame game = new BowlingGame()

        when:
        gameState.rolls.each { game.roll(it) }

        then:
        game.getCurrentFrame() == gameState.expectedFrame
        game.getCurrentRoll() == gameState.expectedRoll
        game.isGameOver() == gameState.expectedGameOver

        where:
        gameState << [
            [rolls: [3, 4], expectedFrame: 2, expectedRoll: 1, expectedGameOver: false],
            [rolls: [10], expectedFrame: 2, expectedRoll: 1, expectedGameOver: false],
            [rolls: [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4], expectedFrame: 10, expectedRoll: 2, expectedGameOver: true]
        ]
    }

    // Test with nested data structures
    def "should handle frame analysis"(List<Map<String, Object>> frameData) {
        given:
        BowlingGame game = new BowlingGame()

        when:
        frameData.each { frame ->
            frame.rolls.each { game.roll(it) }
        }

        then:
        game.getFrames().size() == 10
        game.getFrames().get(0).getScore() == frameData[0].expectedScore

        where:
        frameData << [
            [[rolls: [3, 4], expectedScore: 7]],
            [[rolls: [5, 5], expectedScore: 10]],
            [[rolls: [10], expectedScore: 10]]
        ]
    }

    // Test with @Unroll and complex patterns
    @Unroll("#featureName[#iterationIndex] - #scenario: #rolls -> #expectedScore")
    def "complex scoring scenarios"() {
        given:
        BowlingGame game = new BowlingGame()

        when:
        rolls.each { game.roll(it) }

        then:
        game.score() == expectedScore

        where:
        scenario << [
            "perfect game",
            "gutter game",
            "spare game",
            "mixed game"
        ]
        rolls << [
            [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
            [3, 4, 10, 5, 5, 2, 3, 0, 0, 0, 0, 0]
        ]
        expectedScore << [300, 0, 150, 42]
    }

    // Test with multiple data sources
    def "should handle multiple data sources"(String name, int age, String expected) {
        expect:
        "${name} is ${age} years old" == expected

        where:
        name << ["Alice", "Bob", "Charlie"]
        age << [25, 30, 35]
        expected << ["Alice is 25 years old", "Bob is 30 years old", "Charlie is 35 years old"]
    }

    // Test with range data
    def "should handle range data"(int value) {
        expect:
        value >= 1 && value <= 10

        where:
        value << (1..10)
    }

    // Test with step range
    def "should handle step range"(int value) {
        expect:
        value % 2 == 0

        where:
        value << (2..20).step(2)
    }
}
