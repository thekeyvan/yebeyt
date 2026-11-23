import Foundation
import Testing
@testable import Yebeyt

struct LetterFeedbackTests {
    private func marks(_ guess: String, _ answer: String) -> [LetterMark] {
        LetterFeedback.marks(guess: Array(guess), answer: Array(answer))
    }

    @Test func greenForTheRightPlaceYellowForElsewhereGreyForNone() {
        #expect(marks("مقام", "مرام") == [.green, .grey, .green, .green])
        #expect(marks("ابرو", "مرام") == [.yellow, .grey, .yellow, .grey])
        #expect(marks("بابا", "مرام") == [.grey, .yellow, .grey, .grey])
    }

    @Test func aRepeatedLetterIsYellowOnlyAsManyTimesAsTheWordHasIt() {
        // the word has one «م»: the guess has two, so only one of them can be marked
        #expect(marks("ممنا", "نامه") == [.yellow, .grey, .yellow, .yellow])
        #expect(marks("مممم", "ناره") == [.grey, .grey, .grey, .grey])
        #expect(marks("ااب", "ابا") == [.green, .yellow, .yellow])
    }

    @Test func aGreenTakesTheLetterBeforeAnEarlierYellow() {
        // «ا» is typed first (wrong place) and third (right place): the third is green, the first has none left
        #expect(marks("ابا", "ببا") == [.grey, .green, .green])
        #expect(marks("اببا", "بباا") == [.yellow, .green, .yellow, .green])
    }

    @Test func theWholeWordIsGreen() {
        #expect(marks("عشق", "عشق") == [.green, .green, .green])
    }
}

struct DailyGameTests {
    private func game(_ word: String = "مرام", record: DailyRecord = DailyRecord()) -> DailyGame {
        DailyGame(answer: Array(word), record: record)
    }

    private func play(_ game: inout DailyGame, _ guess: String) {
        for letter in guess { game.type(letter) }
        game.submit()
    }

    @Test func lettersFillTheRowInOrderAndEraseTakesThemBack() {
        var game = game()
        game.type("م"); game.type("ق")
        #expect(game.entry == ["م", "ق", nil, nil])
        #expect(game.cursor == 2)
        game.erase()
        #expect(game.entry == ["م", nil, nil, nil])
        game.erase(); game.erase()
        #expect(game.entry == [nil, nil, nil, nil])
    }

    @Test func aFullRowIsRequiredToSubmitAndTooManyLettersAreIgnored() {
        var game = game()
        game.type("م")
        let early = game.submit()
        #expect(!early && game.tries.isEmpty)
        for letter in "قام" { game.type(letter) }
        game.type("ز")
        #expect(game.entry == ["م", "ق", "ا", "م"])
        let full = game.submit()
        #expect(full)
        #expect(game.tries == [Array("مقام")] && game.entry == [nil, nil, nil, nil])
    }

    @Test func solvingOnTheSecondTryEarns70() {
        var game = game()
        play(&game, "مقام")
        #expect(game.outcome == .playing && game.points == 0)
        play(&game, "مرام")
        #expect(game.outcome == .solved && game.solvedOnTry == 2 && game.points == 70)
    }

    @Test func threeWrongTriesFail() {
        var game = game()
        play(&game, "مقام"); play(&game, "مصام"); play(&game, "ممام")
        #expect(game.outcome == .failed && game.points == 0)
        game.type("م")
        let afterTheLast = game.submit()
        #expect(game.entry == [nil, nil, nil, nil], "nothing can be typed after the last try")
        #expect(!afterTheLast)
    }

    @Test func theKeysTakeTheBestMarkOfEachLetter() {
        var game = game()
        play(&game, "مقام")  // م green, ق grey, ا green, م green
        #expect(game.keyMarks["م"] == .green)
        #expect(game.keyMarks["ق"] == .grey)
        play(&game, "رمام")  // ر yellow
        #expect(game.keyMarks["ر"] == .yellow)
        #expect(game.keyMarks["ب"] == nil)
    }

    @Test func theBulbGivesTheFirstLetterNotFoundYetAndCosts20() {
        var game = game()
        let canHint = game.canHint
        let gave = game.hint()
        #expect(canHint && gave)
        #expect(game.entry == ["م", nil, nil, nil] && game.hinted == [0])
        game.type("ق"); game.type("ا"); game.type("م")
        game.submit()
        #expect(game.tries == [Array("مقام")])
        #expect(game.entry == ["م", nil, nil, nil], "the given letter is there for the next row too")
        game.erase()
        #expect(game.entry == ["م", nil, nil, nil], "the given letter can't be erased")
        for letter in "رام" { game.type(letter) }
        game.submit()
        #expect(game.outcome == .solved && game.points == 70 - 20)
    }

    @Test func theBulbSkipsLettersAlreadyGreenAndRunsOut() {
        var game = game()
        play(&game, "مقام")  // positions 0, 2, 3 are green
        let gave = game.hint()
        #expect(gave)
        #expect(game.hinted == [1])
        let more = game.hint()
        #expect(!game.canHint && !more)
        #expect(game.hinted == [1])
    }

    @Test func aRecordRestoresTheGame() {
        var first = game()
        play(&first, "مقام")
        first.hint()
        let restored = game(record: first.record)
        #expect(restored == first)
        #expect(restored.record.tries == ["مقام"] && restored.record.hinted == [1] && restored.record.outcome == .playing)
        var won = restored
        for letter in "مام" { won.type(letter) }
        #expect(won.entry == ["م", "ر", "ا", "م"])
        won.submit()
        #expect(won.record.outcome == .solved && won.record.points == 50)
    }
}
