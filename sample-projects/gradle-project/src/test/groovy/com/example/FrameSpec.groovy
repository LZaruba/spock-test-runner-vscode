package com.example

import spock.lang.Specification
import spock.lang.Unroll

class FrameSpec extends Specification {

    def "should create empty frame"() {
        when:
        Frame frame = new Frame()

        then:
        frame.getRolls().isEmpty()
        frame.getPinsRemaining() == 10
        !frame.isStrike()
        !frame.isSpare()
        !frame.isComplete()
        frame.getScore() == 0
    }

    def "should handle single roll"(int pins, int expectedPinsRemaining, int expectedScore) {
        given:
        Frame frame = new Frame()

        when:
        frame.addRoll(pins)

        then:
        frame.getPinsRemaining() == expectedPinsRemaining
        frame.getScore() == expectedScore
        frame.isStrike() == (pins == 10)
        !frame.isSpare()
        frame.isComplete() == (pins == 10)

        where:
        pins | expectedPinsRemaining | expectedScore
        0    | 10                    | 0
        5    | 5                     | 5
        10   | 0                     | 10
    }

    def "should handle two rolls"(int roll1, int roll2, boolean isStrike, boolean isSpare, boolean isComplete) {
        given:
        Frame frame = new Frame()

        when:
        frame.addRoll(roll1)
        frame.addRoll(roll2)

        then:
        frame.isStrike() == isStrike
        frame.isSpare() == isSpare
        frame.isComplete() == isComplete
        frame.getScore() == roll1 + roll2

        where:
        roll1 | roll2 | isStrike | isSpare | isComplete
        3     | 4     | false    | false   | true
        5     | 5     | false    | true    | true
        10    | 0     | true     | false   | true
        0     | 10    | false    | true    | true
    }

    def "should handle last frame with strike"(int roll1, int roll2, int roll3, int expectedScore) {
        given:
        Frame frame = new Frame(true) // Last frame

        when:
        frame.addRoll(roll1)
        if (roll2 >= 0) frame.addRoll(roll2)
        if (roll3 >= 0) frame.addRoll(roll3)

        then:
        frame.getScore() == expectedScore
        frame.isComplete() == (roll3 >= 0)

        where:
        roll1 | roll2 | roll3 | expectedScore
        10    | 5     | 5     | 20
        10    | 10    | 10    | 30
        10    | 0     | 0     | 10
    }

    def "should validate roll constraints - valid rolls"(int pins) {
        when:
        Frame frame = new Frame()
        frame.addRoll(5) // First roll
        frame.addRoll(pins)

        then:
        noExceptionThrown()

        where:
        pins << [3, 5]
    }

    def "should validate roll constraints - invalid rolls"(int pins) {
        when:
        Frame frame = new Frame()
        frame.addRoll(5) // First roll
        frame.addRoll(pins)

        then:
        IllegalArgumentException e = thrown()

        where:
        pins << [6, 10]
    }

    def "should handle frame equality"(int roll1, int roll2, boolean isLastFrame, boolean shouldEqual) {
        given:
        Frame frame1 = new Frame(isLastFrame)
        Frame frame2 = new Frame(isLastFrame)

        when:
        frame1.addRoll(roll1)
        frame1.addRoll(roll2)
        frame2.addRoll(roll1)
        frame2.addRoll(roll2)

        then:
        (frame1.equals(frame2)) == shouldEqual
        (frame1.hashCode() == frame2.hashCode()) == shouldEqual

        where:
        roll1 | roll2 | isLastFrame | shouldEqual
        3     | 4     | false       | true
        5     | 5     | false       | true
        10    | 0     | true        | true
    }

    def "should display frame correctly"(int roll1, int roll2, String expectedDisplay) {
        given:
        Frame frame = new Frame()

        when:
        frame.addRoll(roll1)
        if (roll2 >= 0) frame.addRoll(roll2)

        then:
        frame.toString() == expectedDisplay

        where:
        roll1 | roll2 | expectedDisplay
        3     | 4     | "[3, 4]"
        5     | 5     | "[5, /]"
        10    | -1    | "[X]"
        0     | 10    | "[0, /]"
    }
}
