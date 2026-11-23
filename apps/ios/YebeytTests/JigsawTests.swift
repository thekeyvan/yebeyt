import Foundation
import Testing
@testable import Yebeyt

struct JigsawQuestionTests {
    private func question(_ couplet: GameCouplet = GameFixtures.couplet(1), distractors: [String] = ["جان", "جوهرند", "دیگر"], seed: UInt64 = 1) -> JigsawQuestion {
        var generator = SeededGenerator(seed: seed)
        return JigsawQuestion(couplet: couplet, distractors: distractors, generator: &generator)!
    }

    @Test func halfTheWordsGoMissingAtLeastTwoAtMostSix() {
        #expect([3, 4, 5, 6, 7, 10, 12, 14].map { JigsawQuestion.missingCount(words: $0) } == [2, 2, 3, 3, 4, 5, 6, 6])
    }

    @Test func theSecondHemistichIsSplitIntoWords() {
        let question = question()
        #expect(question.words == ["که", "در", "آفرینش", "ز", "یک", "گوهرند"])
        #expect(question.missing.count == 3)
        #expect(question.missing == question.missing.sorted())
        #expect(Set(question.missing).isSubset(of: Set(question.words.indices)))
    }

    @Test func theSheetHoldsTheMissingWordsAndTwoOthers() {
        let question = question()
        let missingWords = question.missing.map { question.words[$0] }
        #expect(question.stickers.count == 5)
        #expect(Set(question.stickers.map(\.id)).count == 5)
        #expect(question.stickers.map(\.word).sorted() == (missingWords + ["جان", "جوهرند"]).sorted())
    }

    @Test func extraWordsNeverMatchAWordOfTheCoupletOnceDiacriticsAreIgnored() {
        let question = question(distractors: ["گُوهَرند", "که", "آفرینش", "زیبا", "زیبا", "دیگر"])
        let extras = question.stickers.map(\.word).filter { !question.words.contains($0) }
        #expect(extras.sorted() == ["دیگر", "زیبا"])
    }

    @Test func theSameSeedGivesTheSameQuestion() {
        #expect(question(seed: 9) == question(seed: 9))
    }

    @Test func fewerExtrasWhenThePoolIsSmall() {
        #expect(question(distractors: ["دیگر"]).stickers.count == 4)
    }

    @Test func coupletsThatCannotBePlayedAreRefused() {
        var generator = SeededGenerator(seed: 1)
        #expect(JigsawQuestion(couplet: GameFixtures.couplet(1, m2: ""), distractors: [], generator: &generator) == nil)
        #expect(JigsawQuestion(couplet: GameFixtures.couplet(1, m2: "یک دو"), distractors: [], generator: &generator) == nil)
        #expect(JigsawQuestion(couplet: GameFixtures.couplet(1, m1: " "), distractors: [], generator: &generator) == nil)
        #expect(JigsawQuestion(couplet: GameFixtures.couplet(1, m2: Array(repeating: "ک", count: 15).joined(separator: " ")), distractors: [], generator: &generator) == nil)
    }
}

struct JigsawBoardTests {
    private func board(seed: UInt64 = 1) -> JigsawBoard {
        var generator = SeededGenerator(seed: seed)
        return JigsawBoard(JigsawQuestion(couplet: GameFixtures.couplet(1), distractors: ["جان", "جوهرند"], generator: &generator)!)
    }

    private func sticker(_ word: String, in board: JigsawBoard) -> JigsawSticker {
        board.question.stickers.first { $0.word == word }!
    }

    /// Puts the right sticker in every empty slot.
    private func solve(_ board: inout JigsawBoard) {
        for position in board.question.missing {
            board.place(sticker(board.question.words[position], in: board), at: position)
        }
    }

    @Test func slotsStartEmptyExceptTheGivenWords() {
        let board = board()
        for position in board.question.words.indices {
            if board.question.missing.contains(position) {
                #expect(board.word(at: position) == nil && !board.isFilled(position))
            } else {
                #expect(board.word(at: position) == board.question.words[position] && board.isFilled(position))
            }
        }
        #expect(!board.isFull && board.onSheet.count == 5)
    }

    @Test func tappingAStickerThenASlotPlacesIt() throws {
        var board = board()
        let position = try #require(board.question.missing.first)
        let word = board.question.words[position]
        let sticker = sticker(word, in: board)
        board.select(sticker)
        #expect(board.selected == sticker)
        board.tapSlot(position)
        #expect(board.word(at: position) == word && board.selected == nil)
        #expect(!board.onSheet.contains(sticker))
    }

    @Test func tappingTheStickerInHandPutsItDown() {
        var board = board()
        let sticker = board.question.stickers[0]
        board.select(sticker); board.select(sticker)
        #expect(board.selected == nil)
    }

    @Test func tappingAFilledSlotWithNothingInHandTakesTheStickerBack() throws {
        var board = board()
        let position = try #require(board.question.missing.first)
        board.place(board.question.stickers[0], at: position)
        board.tapSlot(position)
        #expect(board.word(at: position) == nil && board.onSheet.count == 5)
    }

    @Test func placingOnAFilledSlotSendsTheOldStickerBackAndAMovedStickerLeavesItsOldSlot() throws {
        var board = board()
        let (a, b) = (board.question.missing[0], board.question.missing[1])
        let (first, second) = (board.question.stickers[0], board.question.stickers[1])
        board.place(first, at: a)
        board.place(second, at: a)
        #expect(board.placed[a] == second && board.onSheet.contains(first))
        board.place(second, at: b)
        #expect(board.placed[a] == nil && board.placed[b] == second)
    }

    @Test func givenWordsCannotBeReplaced() throws {
        var board = board()
        let given = try #require(board.question.words.indices.first { !board.question.missing.contains($0) })
        board.place(board.question.stickers[0], at: given)
        #expect(board.placed[given] == nil)
    }

    @Test func shufflingOnlyReordersTheSheet() {
        var board = board()
        var generator = SeededGenerator(seed: 3)
        board.shuffle(using: &generator)
        #expect(Set(board.onSheet) == Set(board.question.stickers) && board.onSheet.count == 5)
    }

    @Test func rightWordsInEverySlotAreRightAndEarn20Each() {
        var board = board()
        solve(&board)
        #expect(board.isFull)
        #expect(board.check() == JigsawBoard.Result(correctWords: 3, hints: 0, isRight: true, points: 60))
    }

    @Test func aWrongWordMakesTheCoupletWrongButTheRightOnesStillEarn() throws {
        var board = board()
        solve(&board)
        let position = try #require(board.question.missing.first)
        let extra = board.question.stickers.first { !board.question.words.contains($0.word) }!
        board.place(extra, at: position)
        #expect(board.check() == JigsawBoard.Result(correctWords: 2, hints: 0, isRight: false, points: 40))
    }

    @Test func twoStickersWithTheSameWordAreInterchangeable() {
        var generator = SeededGenerator(seed: 4)
        let couplet = GameFixtures.couplet(1, m2: "که در که آفرینش ز یک")
        var board = JigsawBoard(JigsawQuestion(couplet: couplet, distractors: [], generator: &generator)!)
        for position in board.question.missing {
            let word = board.question.words[position]
            board.place(board.onSheet.first { $0.word == word }!, at: position)
        }
        #expect(board.check().isRight)
    }

    @Test func theBulbPlacesAWordCostsTwentyAndEarnsNothingForThatWord() throws {
        var board = board()
        let canHint = board.canHint
        let gave = board.hint()
        #expect(canHint && gave)
        let position = try #require(board.hinted.first)
        #expect(board.word(at: position) == board.question.words[position])
        board.place(board.question.stickers[0], at: position)
        #expect(board.word(at: position) == board.question.words[position], "a hinted slot stays")
        board.remove(at: position)
        #expect(board.word(at: position) == board.question.words[position])
        solve(&board)
        #expect(board.check() == JigsawBoard.Result(correctWords: 2, hints: 1, isRight: true, points: 20))
    }

    @Test func theBulbReplacesAWrongStickerAndRunsOut() throws {
        var board = board()
        let position = try #require(board.question.missing.first)
        let extra = board.question.stickers.first { !board.question.words.contains($0.word) }!
        board.place(extra, at: position)
        board.hint()
        #expect(board.word(at: position) == board.question.words[position] && board.onSheet.contains(extra))
        while board.hint() {}
        #expect(!board.canHint && board.isFull && board.check().isRight)
        #expect(board.check().points == 0)
    }
}

@MainActor
struct JigsawRoundTests {
    private func round(seed: UInt64 = 1) -> JigsawRound {
        var generator = SeededGenerator(seed: seed)
        return JigsawRound.make(opening: [], deck: GameFixtures.deck(60), generator: &generator)!
    }

    private func answer(_ round: inout JigsawRound, right: Bool = true) {
        round.edit { board in
            for position in board.question.missing {
                let word = board.question.words[position]
                let sticker = right ? board.onSheet.first { $0.word == word }! : board.onSheet.first { $0.word != word }!
                board.place(sticker, at: position)
            }
        }
        round.check()
    }

    @Test func aRoundHasTenDifferentCoupletsFromTheDeck() {
        let round = round()
        #expect(round.questions.count == 10)
        #expect(Set(round.questions.map(\.couplet.id)).count == 10)
        #expect(round.timeLeft == 120 && round.points == 0 && round.index == 0)
    }

    @Test func theSameSeedMakesTheSameRound() {
        #expect(round(seed: 5) == round(seed: 5))
        #expect(round(seed: 5) != round(seed: 6))
    }

    @Test func theOpeningCoupletsComeFirstThenTheDeckFillsUp() {
        var generator = SeededGenerator(seed: 2)
        let mine = [GameFixtures.couplet(900), GameFixtures.couplet(901, m2: ""), GameFixtures.couplet(902)]
        let round = JigsawRound.make(opening: mine, deck: GameFixtures.deck(60), generator: &generator)!
        #expect(round.questions.count == 10)
        #expect(round.questions.prefix(2).map(\.couplet.id) == [mine[0].id, mine[2].id], "the unplayable one is skipped")
    }

    @Test func aPoemWithMoreThanTenCoupletsOnlyOpensWithTen() {
        var generator = SeededGenerator(seed: 2)
        let poem = (0..<14).map { GameFixtures.couplet(800 + $0) }
        let round = JigsawRound.make(opening: poem, deck: GameFixtures.deck(60), generator: &generator)!
        #expect(round.questions.map(\.couplet.id) == poem.prefix(10).map(\.id))
    }

    @Test func aSmallDeckGivesAShorterRound() {
        var generator = SeededGenerator(seed: 2)
        #expect(JigsawRound.make(opening: [], deck: GameFixtures.deck(4), generator: &generator)!.questions.count == 4)
        #expect(JigsawRound.make(opening: [], deck: GameFixtures.deck(0), generator: &generator) == nil)
    }

    @Test func checkingNeedsEverySlotFilled() {
        var round = round()
        let early = round.check()
        #expect(early == nil && round.answers.isEmpty)
        answer(&round)
        #expect(round.answers.count == 1 && round.sheetOpen)
    }

    @Test func theClockRunsWhileAnsweringAndStopsWhileTheSheetIsOpen() {
        var round = round()
        round.tick(); round.tick(); round.tick()
        #expect(round.timeLeft == 117 && round.secondsOnCurrent == 3)
        answer(&round)
        #expect(round.lastAnswer?.seconds == 3)
        round.tick()
        #expect(round.timeLeft == 117)
        round.next()
        #expect(round.index == 1 && round.secondsOnCurrent == 0 && !round.sheetOpen)
        round.tick()
        #expect(round.timeLeft == 116)
    }

    @Test func theBoardCannotBeChangedWhileTheSheetIsOpen() {
        var round = round()
        answer(&round)
        round.edit { $0.remove(at: $0.question.missing[0]) }
        #expect(round.board.placed.count == round.board.question.missing.count)
    }

    @Test func threeRightInARowShowTheComboAndAWrongOneEndsIt() {
        var round = round()
        for _ in 0..<2 { answer(&round); round.next() }
        #expect(round.combo == 2)
        answer(&round)
        #expect(round.combo == JigsawRound.comboLength)
        round.next()
        answer(&round, right: false)
        #expect(round.combo == 0 && round.rightCount == 3)
    }

    @Test func afterTenAnswersTheRoundIsFinishedAndTheSecondsLeftCount() {
        var round = round()
        for _ in 0..<10 {
            round.tick()
            answer(&round)
            if !round.isFinished { round.next() }
        }
        #expect(round.isFinished && round.isOver)
        #expect(round.timeLeft == 110 && round.timeBonus == 110)
        #expect(round.points == 10 * 60 && round.totalPoints == 710)
        #expect(round.elapsed == 10 && round.rightCount == 10)
        round.next()
        #expect(round.index == 9, "there is no eleventh couplet")
    }

    @Test func whenTheTimeRunsOutTheRoundIsOverWithoutABonus() {
        var round = round()
        answer(&round); round.next()
        for _ in 0..<120 { round.tick() }
        #expect(round.timeLeft == 0 && round.isOver && !round.isFinished)
        #expect(round.timeBonus == 0 && round.totalPoints == 60)
        let late = round.check()
        #expect(late == nil)
        round.tick()
        #expect(round.timeLeft == 0)
    }

    @Test func theSinglePoetIsNamedOnlyWhenThereIsOne() {
        #expect(round().singlePoet == "سعدی")
        var generator = SeededGenerator(seed: 2)
        let mixed = JigsawRound.make(opening: [GameFixtures.couplet(1, poet: "hafez")], deck: GameFixtures.deck(60), generator: &generator)!
        #expect(mixed.singlePoet == nil)
    }
}

@MainActor
struct JigsawSessionTests {
    private func session(_ stats: GameStats) -> JigsawSession {
        var generator = SeededGenerator(seed: 1)
        let round = JigsawRound.make(opening: [], deck: GameFixtures.deck(60), generator: &generator)!
        return JigsawSession(round: round, stats: stats, seed: 3)
    }

    private func fill(_ session: JigsawSession) {
        session.edit { board in
            for position in board.question.missing {
                let word = board.question.words[position]
                board.place(board.onSheet.first { $0.word == word }!, at: position)
            }
        }
    }

    @Test func pointsAreAddedAsCoupletsAreAnsweredAndTheSecondsLeftAtTheEnd() {
        let stats = GameStats(defaults: GameFixtures.defaults())
        let session = session(stats)
        for _ in 0..<10 {
            fill(session)
            session.check()
            #expect(session.sheetShown)
            session.next()
        }
        #expect(session.finished)
        #expect(stats.points == 600 + 120)
        #expect(stats.best(.jigsaw) == 720)
        session.next()
        #expect(stats.points == 720, "finishing twice adds nothing")
    }

    @Test func aTimeoutEndsTheRoundOnceAndKeepsWhatWasEarned() {
        let stats = GameStats(defaults: GameFixtures.defaults())
        let session = session(stats)
        fill(session); session.check(); session.next()
        for _ in 0..<130 { session.tick() }
        #expect(session.finished && session.round.timeLeft == 0)
        #expect(stats.points == 60 && stats.best(.jigsaw) == 60)
    }

    @Test func theClockWaitsWhileTheAppIsNotInFront() {
        let session = session(GameStats(defaults: GameFixtures.defaults()))
        session.tick()
        session.isPaused = true
        for _ in 0..<30 { session.tick() }
        #expect(session.round.timeLeft == 119)
        session.isPaused = false
        session.tick()
        #expect(session.round.timeLeft == 118)
    }

    @Test func theTimerReadsLikeTheBoard() {
        let session = session(GameStats(defaults: GameFixtures.defaults()))
        #expect(session.timeText == "۲:۰۰")
        for _ in 0..<78 { session.tick() }
        #expect(session.timeText == "۰:۴۲")
    }
}
