import Foundation
import Testing
@testable import Yebeyt

struct QuizScoringTests {
    @Test func aRightAnswerIsTwentyAndTwoPerSecondLeft() {
        #expect(Scoring.quiz(secondsLeft: 12, hints: 0) == 44)
        #expect(Scoring.quiz(secondsLeft: 5, hints: 0) == 30)
        #expect(Scoring.quiz(secondsLeft: 0, hints: 0) == 20)
        #expect(Scoring.quiz(secondsLeft: -3, hints: 0) == 20)
    }

    @Test func eachHintCostsTwentyButNeverBelowZero() {
        #expect(Scoring.quiz(secondsLeft: 5, hints: 1) == 10)
        #expect(Scoring.quiz(secondsLeft: 0, hints: 1) == 0)
        #expect(Scoring.quiz(secondsLeft: 0, hints: 2) == 0)
    }

    @Test func aPairOfMatchIsTen() {
        #expect(Scoring.matchPair == 10)
    }
}

struct QuizRoundTests {
    private func round(_ kind: GameKind = .poet, count: Int = 10, options: Int = 4) -> QuizRound {
        QuizRound(kind: kind, questions: (0..<count).map { QuizFixtures.question(kind, correct: $0 % options, options: options) })!
    }

    /// Picks the right option and confirms.
    @discardableResult
    private func answer(_ round: inout QuizRound, right: Bool = true, seconds: Int = 0) -> QuizRound.Answer? {
        for _ in 0..<seconds { round.tick() }
        let correct = round.current.correct
        round.select(right ? correct : (correct + 1) % round.current.options.count)
        return round.confirm()
    }

    @Test func nothingIsAnsweredUntilAnOptionIsChosenAndConfirmed() {
        var round = round()
        let answer = round.confirm()
        #expect(answer == nil && round.answers.isEmpty)
        round.select(2)
        #expect(round.selected == 2 && !round.sheetOpen)
        round.select(2)
        #expect(round.selected == nil, "tapping the chosen option again lets it go")
        round.select(9)
        #expect(round.selected == nil, "an option that does not exist is ignored")
    }

    @Test func aRightAnswerEarnsTwentyAndTwoPerSecondLeft() throws {
        var round = round()
        let answer = try #require(answer(&round, seconds: 7))
        #expect(answer == QuizRound.Answer(chosen: round.questions[0].correct, right: true, points: 30, seconds: 7))
        #expect(round.points == 30 && round.rightCount == 1 && round.sheetOpen && round.lastAnswer == answer)
    }

    @Test func aWrongAnswerEarnsNothing() throws {
        var round = round()
        let answer = try #require(answer(&round, right: false, seconds: 3))
        #expect(!answer.right && answer.points == 0 && round.points == 0)
    }

    @Test func theClockStopsWhileTheSheetIsOpenAndTheNextQuestionStartsFresh() {
        var round = round()
        answer(&round, seconds: 2)
        round.tick(); round.tick()
        #expect(round.secondsOnCurrent == 2)
        round.next()
        #expect(round.index == 1 && round.selected == nil && round.secondsOnCurrent == 0 && !round.sheetOpen)
        #expect(round.timeLeft == 12)
    }

    @Test func aPerQuestionClockCountsDownAndTimeOutIsAWrongAnswer() throws {
        var round = round()
        for _ in 0..<11 { round.tick() }
        #expect(round.timeLeft == 1 && !round.sheetOpen)
        round.select(0)
        round.tick()
        let timedOut = try #require(round.lastAnswer)
        #expect(round.sheetOpen && !timedOut.right && timedOut.chosen == nil && timedOut.points == 0 && timedOut.seconds == 12)
        round.tick()
        #expect(round.secondsOnCurrent == 12, "the clock waits for the next question")
    }

    @Test func theRoundEndsAfterTheLastAnswerAndTheSheetIsStillThere() {
        var round = round(count: 2)
        answer(&round); round.next()
        #expect(!round.isFinished)
        answer(&round, right: false)
        #expect(round.isFinished && round.isOver && round.sheetOpen)
        round.next()
        #expect(round.index == 1, "nothing after the last one")
    }

    @Test func theSecondHemistichRoundClockRunsForTheWholeRoundAndEndsIt() {
        var round = round(.misra, options: 3)
        #expect(round.timeLeft == 120)
        for _ in 0..<5 { round.tick() }
        answer(&round, seconds: 2)
        #expect(round.timeLeft == 113)
        round.next()
        for _ in 0..<113 { round.tick() }
        #expect(round.timeLeft == 0 && round.isOver && !round.isFinished && !round.sheetOpen)
        #expect(round.answers.count == 1)
        round.select(0)
        let late = round.confirm()
        #expect(late == nil, "nothing after the time is up")
    }

    @Test func theSecondHemistichBonusIsTwoPerSecondOfTwelveForTheQuestion() throws {
        var round = round(.misra, options: 3)
        let answer = try #require(answer(&round, seconds: 4))
        #expect(answer.points == 20 + 2 * 8)
        round.next()
        let slow = try #require(self.answer(&round, seconds: 30))
        #expect(slow.points == 20)
    }

    @Test func listenHasNoClockAndAlwaysEarnsTwenty() throws {
        var round = round(.listen, count: 5, options: 3)
        #expect(round.timeLeft == nil)
        for _ in 0..<50 { round.tick() }
        let answer = try #require(answer(&round))
        #expect(answer.points == 20 && answer.seconds == 0 && round.timeLeft == nil)
    }

    @Test func fiftyFiftyTakesAwayHalfTheWrongOptionsOnceAndCostsTwenty() throws {
        var round = round(.poet)
        var generator = SeededGenerator(seed: 1)
        #expect(round.canFifty)
        round.fifty(using: &generator)
        #expect(round.removed.count == 2 && !round.removed.contains(round.current.correct) && !round.canFifty)
        round.fifty(using: &generator)
        #expect(round.removed.count == 2)
        let gone = try #require(round.removed.first)
        round.select(gone)
        #expect(round.selected == nil, "a removed option can't be chosen")
        #expect(round.hints == 1)
        let answer = try #require(answer(&round, seconds: 4))
        #expect(answer.points == 20 + 2 * 8 - 20)
    }

    @Test func fiftyFiftyOnThreeOptionsRemovesOneAndDropsAChosenOptionThatWentAway() {
        var round = round(.misra, options: 3)
        let wrong = (round.current.correct + 1) % 3
        round.select(wrong)
        var generator = SeededGenerator(seed: 2)
        round.fifty(using: &generator)
        #expect(round.removed.count == 1 && !round.removed.contains(round.current.correct))
        if round.removed.contains(wrong) { #expect(round.selected == nil) } else { #expect(round.selected == wrong) }
    }

    @Test func fiftyFiftyIsForOneQuestionOnly() throws {
        var round = round(.poet)
        var generator = SeededGenerator(seed: 1)
        round.fifty(using: &generator)
        answer(&round)
        #expect(!round.canFifty, "not while the sheet is open")
        round.next()
        #expect(round.removed.isEmpty && round.canFifty && round.hints == 0)
    }

    @Test func listenCannotUseFiftyFiftyButCanShowOneWordForTwenty() throws {
        var round = round(.listen, count: 5, options: 3)
        #expect(!round.canFifty && round.canShowWord)
        round.showWord()
        #expect(round.wordShown && !round.canShowWord && round.hints == 1)
        let answer = try #require(answer(&round))
        #expect(answer.points == 0, "20 for the answer, 20 for the word")
        round.next()
        #expect(!round.wordShown && round.canShowWord)
    }

    @Test func otherGamesHaveNoWordHint() {
        #expect(!round(.poet).canShowWord)
    }

    @Test func oneReplayForEachListenQuestion() {
        var round = round(.listen, count: 5, options: 3)
        #expect(round.replaysLeft == 1)
        let first = round.useReplay()
        #expect(first)
        let second = round.useReplay()
        #expect(round.replaysLeft == 0 && !second)
        answer(&round)
        round.next()
        #expect(round.replaysLeft == 1)
    }

    @Test func theDotsAreRightOrWrongInOrder() {
        var round = round(count: 3)
        answer(&round); round.next()
        answer(&round, right: false); round.next()
        #expect(round.results == [true, false])
    }

    @Test func skippingEarnsNothingAnswersNothingAndMovesOn() {
        var round = round(count: 3)
        round.tick(); round.select(1)
        #expect(round.canSkip)
        round.skip()
        #expect(round.points == 0 && round.answers.isEmpty && round.lastAnswer == nil)
        #expect(!round.sheetOpen && round.index == 1 && round.selected == nil && round.secondsOnCurrent == 0 && !round.isFinished)
        #expect(round.results == [nil])
        answer(&round); round.next()
        #expect(round.results == [nil, true] && round.rightCount == 1 && round.answers.count == 1)
    }

    @Test func skippingTheLastQuestionEndsTheRound() {
        var round = round(count: 2)
        round.skip()
        round.skip()
        #expect(round.isFinished && round.isOver && !round.sheetOpen && round.index == 1)
        #expect(!round.canSkip)
        round.skip()
        #expect(round.results == [nil, nil], "nothing after the end")
    }

    @Test func skipIsOnlyForPoetAndSecondHemistichAndNotWhileTheSheetIsOpen() {
        #expect(round(.poet).canSkip && round(.misra, options: 3).canSkip)
        #expect(!round(.book, options: 3).canSkip && !round(.listen, count: 5, options: 3).canSkip)
        var open = round(.poet)
        answer(&open)
        #expect(!open.canSkip)
        open.skip()
        #expect(open.index == 0 && open.sheetOpen)
    }

    @Test func skippingKeepsTheRoundClockOfSecondHemistichRunning() {
        var round = round(.misra, options: 3)
        for _ in 0..<7 { round.tick() }
        round.skip()
        #expect(round.timeLeft == 113 && round.secondsOnCurrent == 0)
    }

    @Test func aSkippedQuestionIsNotInTheSummaryAsAnAnswer() {
        var round = round(count: 3)
        round.skip()
        answer(&round); round.next()
        answer(&round, right: false)
        let summary = round.summary
        #expect(summary.rows.map(\.result) == [nil, true, false] as [Bool?])
        #expect(summary.right == 1 && summary.total == 3)
    }

    @Test func theBookGameHasNoFiftyFifty() {
        var book = round(.book, options: 3)
        var generator = SeededGenerator(seed: 1)
        #expect(!book.canFifty)
        book.fifty(using: &generator)
        #expect(book.removed.isEmpty && book.hints == 0)
        #expect(round(.poet).canFifty && round(.misra, options: 3).canFifty)
    }
}

@MainActor
struct QuizSessionTests {
    private func session(_ kind: GameKind = .poet, count: Int = 3, options: Int = 4, stats: GameStats? = nil) -> (QuizSession, GameStats) {
        let stats = stats ?? GameStats(defaults: GameFixtures.defaults())
        let round = QuizRound(kind: kind, questions: (0..<count).map { QuizFixtures.question(kind, correct: $0 % options, options: options) })!
        return (QuizSession(round: round, stats: stats), stats)
    }

    private func answer(_ session: QuizSession, right: Bool = true) {
        let correct = session.round.current.correct
        session.select(right ? correct : (correct + 1) % session.round.current.options.count)
        session.confirm()
    }

    @Test func pointsAreAddedToThePhoneAsTheyComeAndABestIsKeptWhenTheRoundEnds() {
        let (session, stats) = session()
        for _ in 0..<3 { session.tick() }
        answer(session)
        #expect(stats.points == 20 + 2 * 9 && !session.finished)
        session.next()
        answer(session, right: false)
        session.next()
        answer(session)
        #expect(stats.points == 38 + 44)
        session.next()
        #expect(session.finished)
        #expect(stats.best(.poet) == session.round.points)
    }

    @Test func aPausedSessionDoesNotTick() {
        let (session, _) = session()
        session.isPaused = true
        session.tick()
        #expect(session.round.secondsOnCurrent == 0)
        session.isPaused = false
        session.tick()
        #expect(session.round.secondsOnCurrent == 1)
    }

    @Test func theRoundClockRunningOutEndsTheSessionOnce() {
        let (session, stats) = session(.misra, count: 3, options: 3)
        answer(session)
        session.next()
        for _ in 0..<130 { session.tick() }
        #expect(session.finished)
        #expect(stats.best(.misra) == 20 + 2 * 12)
        let points = stats.points
        session.next()
        #expect(stats.points == points)
    }

    @Test func aTimedOutQuestionIsOnlyAWrongAnswer() {
        let (session, stats) = session()
        for _ in 0..<12 { session.tick() }
        #expect(session.round.sheetOpen && stats.points == 0 && !session.finished)
    }

    @Test func skippingTheLastQuestionEndsTheSessionAndKeepsTheBest() {
        let (session, stats) = session(count: 2)
        answer(session)
        session.next()
        session.skip()
        #expect(session.finished && stats.best(.poet) == session.round.points && stats.points == session.round.points)
    }

    @Test func skippingInTheMiddleOnlyMovesOn() {
        let (session, stats) = session(count: 3)
        session.skip()
        #expect(!session.finished && session.round.index == 1 && stats.points == 0)
    }

    @Test func fiftyFiftyAndTheWordHintGoThroughTheSession() {
        let (poet, _) = session()
        poet.fifty()
        #expect(poet.round.removed.count == 2)
        let (listen, _) = session(.listen, count: 5, options: 3)
        listen.showWord()
        #expect(listen.round.wordShown)
    }
}
