import Foundation
import Testing
@testable import Yebeyt

struct GameDeckTests {
    @Test func theBundledDeckLoadsWithGoodCouplets() throws {
        let deck = try GameDeck(bundle: Fixtures.appBundle, poetNames: ["hafez": "حافظ"])
        #expect(deck.couplets.count > 1000)
        for couplet in deck.couplets {
            #expect((5...14).contains(couplet.m1.split(whereSeparator: \.isWhitespace).count), "\(couplet.id)")
            #expect((5...14).contains(couplet.m2.split(whereSeparator: \.isWhitespace).count), "\(couplet.id)")
            #expect(couplet.meaning?.isEmpty == false)
            #expect(!couplet.bookTitle.isEmpty && couplet.poem.hasPrefix("/\(couplet.poetSlug)/"))
        }
        #expect(deck.couplets.filter { $0.poetSlug == "hafez" }.allSatisfy { $0.poetName == "حافظ" })
        #expect(deck.couplets.reduce(into: [String: Int]()) { $0[$1.poetSlug, default: 0] += 1 }.values.max()! <= 200)
    }

    @Test func aCoupletIsFoundByPoemAndIndex() throws {
        let deck = try GameDeck(bundle: Fixtures.appBundle, poetNames: [:])
        let first = try #require(deck.couplets.first)
        #expect(deck.couplet(poem: first.poem, index: first.index) == first)
        #expect(deck.couplet(poem: "/nobody/nothing", index: 0) == nil)
    }

    @Test func aBundleWithoutTheDeckThrows() {
        #expect(throws: PoetryError.self) { try GameDeck(bundle: Bundle(for: NSObject.self), poetNames: [:]) }
    }

    @Test func theSourceLineAndShareText() {
        let couplet = GameFixtures.couplet(1)
        #expect(couplet.source == "سعدی · گلستان")
        #expect(couplet.share == "بنی آدم اعضای یکدیگرند\nکه در آفرینش ز یک گوهرند\n— سعدی · گلستان\nyebeyt.com")
    }
}

struct DailyPuzzleTests {
    private let deck = try! GameDeck(bundle: Fixtures.appBundle, poetNames: [:])

    @Test func theSameDayGivesTheSamePuzzleAndOtherDaysUsuallyDiffer() throws {
        let day = try #require(TehranDay(key: "2026-11-23"))
        let first = try #require(DailyPuzzle.pick(day: day, from: deck))
        #expect(DailyPuzzle.pick(day: day, from: deck) == first)
        let week = (0..<7).compactMap { DailyPuzzle.pick(day: TehranDay(number: day.number + $0), from: deck)?.couplet.id }
        #expect(Set(week).count == 7)
    }

    @Test func theWordHas3To6LettersIsNotAStopWordAndIsInTheCouplet() {
        for number in 20_000..<20_200 {
            let puzzle = DailyPuzzle.pick(day: TehranDay(number: number), from: deck)!
            #expect(DailyPuzzle.letterRange.contains(puzzle.letters.count))
            #expect(!DailyPuzzle.stopWords.contains(String(puzzle.letters)))
            #expect(puzzle.hemistich.contains(puzzle.word))
            #expect(puzzle.inSecondHemistich, "a fitting word in the second hemistich is preferred")
        }
    }

    @Test func theWordIsHiddenWhereItIsAndTheRestAroundIt() throws {
        let couplet = GameFixtures.couplet(1, m2: "کنار آب رکن آباد و گلگشت مصلا را")
        let puzzle = try #require(DailyPuzzle.pick(day: TehranDay(number: 5), from: GameDeck(couplets: [couplet])))
        let around = puzzle.around
        #expect([around.before, puzzle.word, around.after].filter { !$0.isEmpty }.joined(separator: " ") == couplet.m2)
        #expect(puzzle.couplet == couplet)
    }

    @Test func theFirstHemistichIsUsedOnlyWhenTheSecondHasNoFittingWord() throws {
        let couplet = GameFixtures.couplet(1, m1: "کنار آب رکن آباد و", m2: "که از در تا به او")
        let puzzle = try #require(DailyPuzzle.pick(day: TehranDay(number: 5), from: GameDeck(couplets: [couplet])))
        #expect(!puzzle.inSecondHemistich)
        #expect(couplet.m1.contains(puzzle.word))
    }

    @Test func aDeckWithNoFittingWordGivesNoPuzzle() {
        let couplet = GameFixtures.couplet(1, m1: "که از در تا به او", m2: "این آن هم هر که")
        #expect(DailyPuzzle.pick(day: TehranDay(number: 5), from: GameDeck(couplets: [couplet])) == nil)
        #expect(DailyPuzzle.pick(day: TehranDay(number: 5), from: GameDeck(couplets: [])) == nil)
    }

    @Test func stopWordsAreTestedAsLetters() {
        #expect(DailyPuzzle.candidates(in: "که این اگر همه").isEmpty)
        #expect(DailyPuzzle.candidates(in: "آن اینَک عشق").map(\.word) == ["اینَک", "عشق"])
        #expect(DailyPuzzle.candidates(in: "بسیار دل می‌رود").map(\.word) == ["بسیار"])  // 5 letters; «دل» too short; half-space words skipped
        #expect(DailyPuzzle.candidates(in: "عاشقانه").isEmpty)  // 7 letters
    }

    @Test func theKeyboardHasTheWordsLettersAndDistractorsAndIsTheSameForTheDay() throws {
        for number in 20_000..<20_100 {
            let puzzle = DailyPuzzle.pick(day: TehranDay(number: number), from: deck)!
            #expect(puzzle.keys.count == DailyPuzzle.keyCount)
            #expect(Set(puzzle.keys).count == puzzle.keys.count)
            #expect(Set(puzzle.letters).isSubset(of: Set(puzzle.keys)))
            #expect(Set(puzzle.keys).isSubset(of: Set(PersianLetters.alphabet)))
        }
        let a = DailyPuzzle.pick(day: TehranDay(number: 20_001), from: deck)
        #expect(a?.keys == DailyPuzzle.pick(day: TehranDay(number: 20_001), from: deck)?.keys)
    }
}

struct PersianLettersTests {
    @Test func diacriticsAndArabicFormsFold() {
        #expect(PersianLetters.letters(of: "عِشْقٌ") == Array("عشق"))
        #expect(PersianLetters.letters(of: "كتاب") == Array("کتاب"))
        #expect(PersianLetters.letters(of: "يار") == Array("یار"))
        #expect(PersianLetters.letters(of: "مُصَلّا") == Array("مصلا"))
    }

    @Test func aleefWithMaddaStaysItsOwnLetter() {
        #expect(PersianLetters.letters(of: "آب") == Array("آب"))
        #expect(PersianLetters.letters(of: "آب") != PersianLetters.letters(of: "اب"))
    }

    @Test func punctuationAroundTheWordIsIgnoredButInsideItRefuses() {
        #expect(PersianLetters.letters(of: "«عشق»،") == Array("عشق"))
        #expect(PersianLetters.letters(of: "می\u{200C}رود") == nil)
        #expect(PersianLetters.letters(of: "عشق۲") == nil)
        #expect(PersianLetters.letters(of: "—") == nil)
    }

    @Test func theShuffleIsFixedForASeed() {
        var a = SeededGenerator(seed: 7), b = SeededGenerator(seed: 7)
        #expect(a.shuffled(Array(0..<20)) == b.shuffled(Array(0..<20)))
        var c = SeededGenerator(seed: 7)
        #expect(c.shuffled(Array(0..<20)).sorted() == Array(0..<20))
    }
}
