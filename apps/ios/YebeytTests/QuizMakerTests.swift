import Foundation
import Testing
@testable import Yebeyt

/// Poets, books and couplets for the quiz games, built in code so the rules are tested on known data.
enum QuizFixtures {
    static let poets: [LibraryPoet] = [
        ("saadi", "سعدی", "قرن هفتم"), ("moulavi", "مولانا", "قرن هفتم"), ("eraghi", "عراقی", "قرن هفتم"), ("khosro", "امیرخسرو", "قرن هفتم"),
        ("hafez", "حافظ", "قرن هشتم"), ("khayyam", "خیام", "قرن پنجم"), ("attar", "عطار", "قرن ششم"), ("nezami", "نظامی", "قرن ششم"),
    ].enumerated().map { index, item in
        LibraryPoet(id: index, slug: item.0, name: item.1, tag: "", city: nil, century: item.2, color: .lapis, bio: "")
    }

    static func book(_ path: String, poet: String) -> LibraryBook {
        LibraryBook(
            id: path.hashValue, path: path, title: "کتاب " + path, poet: poet, type: .divan, color: .fire, blurb: "", century: nil,
            count: 1, recited: false, unit: "غزل", sections: nil, poems: nil
        )
    }

    static let ends = ["ند", "ار", "ان", "ید", "را", "ست"]

    /// The couplets of one poet: the second hemistichs have different last letters in turn.
    static func couplets(poet: String, count: Int, book: String = "") -> [GameCouplet] {
        (0..<count).map { number in
            GameCouplet(
                poem: "/\(poet)/p\(number / 3)", index: number % 3, m1: "مصراع اول \(poet) \(number)", m2: "مصراع دوم \(number) گوهر\(ends[number % ends.count])",
                meaning: "معنی", poetSlug: poet, poetName: poets.first { $0.slug == poet }?.name ?? poet, bookTitle: "", bookPath: book
            )
        }
    }

    static func deck() -> GameDeck {
        GameDeck(couplets: poets.flatMap { couplets(poet: $0.slug, count: 24) })
    }

    static func question(
        _ kind: GameKind = .poet, correct: Int = 1, options: Int = 4, couplet: GameCouplet = couplets(poet: "saadi", count: 1)[0]
    ) -> QuizQuestion {
        QuizQuestion(
            kind: kind, couplet: couplet, options: (0..<options).map { QuizOption(id: "o\($0)", title: "گزینه \($0)") }, correct: correct
        )
    }
}

struct PoetQuestionTests {
    private func make(_ couplet: GameCouplet, seed: UInt64 = 1, poets: [LibraryPoet] = QuizFixtures.poets) -> QuizQuestion? {
        var generator = SeededGenerator(seed: seed)
        return QuizMaker.poet(couplet, poets: poets, generator: &generator)
    }

    @Test func fourDifferentPoetsAndTheRightOneIsAmongThem() throws {
        let couplet = QuizFixtures.couplets(poet: "hafez", count: 1)[0]
        let question = try #require(make(couplet))
        #expect(question.options.count == 4)
        #expect(Set(question.options.map(\.id)).count == 4 && Set(question.options.map(\.title)).count == 4)
        #expect(question.options[question.correct].id == "hafez")
        #expect(question.options[question.correct].title == "حافظ")
    }

    @Test func theSameSeedGivesTheSameQuestionAndOtherSeedsMoveTheRightAnswer() throws {
        let couplet = QuizFixtures.couplets(poet: "hafez", count: 1)[0]
        #expect(make(couplet, seed: 5) == make(couplet, seed: 5))
        let places = Set((1...30).compactMap { make(couplet, seed: UInt64($0))?.correct })
        #expect(places == [0, 1, 2, 3])
    }

    @Test func distractorsComeFromTheSameCenturyFirst() throws {
        let couplet = QuizFixtures.couplets(poet: "saadi", count: 1)[0]
        for seed in 1...10 {
            let question = try #require(make(couplet, seed: UInt64(seed)))
            #expect(Set(question.options.map(\.id)) == ["saadi", "moulavi", "eraghi", "khosro"])
        }
    }

    @Test func otherCenturiesFillTheRestWhenTheCenturyIsTooSmall() throws {
        let couplet = QuizFixtures.couplets(poet: "attar", count: 1)[0]  // only nezami shares قرن ششم
        for seed in 1...10 {
            let ids = try #require(make(couplet, seed: UInt64(seed))).options.map(\.id)
            #expect(ids.contains("attar") && ids.contains("nezami") && Set(ids).count == 4)
        }
    }

    @Test func aPoetWithNoCenturyGetsRandomDistractors() throws {
        var poets = QuizFixtures.poets
        poets[0].century = nil
        let question = try #require(make(QuizFixtures.couplets(poet: "saadi", count: 1)[0], poets: poets))
        #expect(question.options.count == 4 && question.options[question.correct].id == "saadi")
    }

    @Test func aPoetWeCannotShowMakesNoQuestion() {
        #expect(make(QuizFixtures.couplets(poet: "nobody", count: 1)[0]) == nil)
        #expect(make(QuizFixtures.couplets(poet: "saadi", count: 1)[0], poets: Array(QuizFixtures.poets.prefix(3))) == nil)
    }

    @Test func theSheetNamesThePoet() throws {
        let question = try #require(make(QuizFixtures.couplets(poet: "hafez", count: 1)[0]))
        #expect(question.verdict(right: true) == "آره، حافظ!")
        #expect(question.verdict(right: false) == "نه، حافظ بود")
    }
}

struct SecondQuestionTests {
    private let deck = QuizFixtures.deck()

    private func make(_ couplet: GameCouplet, seed: UInt64 = 1, pool: [GameCouplet]? = nil) -> QuizQuestion? {
        var generator = SeededGenerator(seed: seed)
        return QuizMaker.second(couplet, pool: pool ?? deck.couplets, generator: &generator)
    }

    @Test func endingsAreTheLastTwoLettersOfTheNormalisedText() {
        #expect(QuizMaker.ending(of: "که در آفرینش ز یک گوهرند") == "ند")
        #expect(QuizMaker.ending(of: "که در آفرینش ز یک گُوهَرَنْد") == "ند")
        #expect(QuizMaker.ending(of: "می‌کند،") == "ند")
        #expect(QuizMaker.ending(of: "ا") == "ا")
    }

    @Test func threeSecondHemistichsOfTheSamePoetAndTheRightOneIsAmongThem() throws {
        let couplet = deck.couplets[3]
        let question = try #require(make(couplet))
        #expect(question.options.count == 3)
        #expect(question.options[question.correct].title == TextNormalizer.plain(couplet.m2))
        let others = question.options.enumerated().filter { $0.offset != question.correct }.map(\.element)
        for option in others {
            let source = try #require(deck.couplets.first { $0.id == option.id })
            #expect(source.poetSlug == couplet.poetSlug && source.id != couplet.id)
        }
        #expect(Set(question.options.map(\.title)).count == 3)
    }

    @Test func optionsWithTheSameEndingComeFirst() throws {
        let couplet = deck.couplets[0]  // ends in «ند»; the poet has four couplets with that ending
        for seed in 1...10 {
            let question = try #require(make(couplet, seed: UInt64(seed)))
            #expect(question.options.allSatisfy { QuizMaker.ending(of: $0.title) == "ند" })
        }
    }

    @Test func otherEndingsFillInWhenTooFewShareTheEnding() throws {
        var pool = QuizFixtures.couplets(poet: "saadi", count: 4)  // endings ند ار ان ید
        pool += QuizFixtures.couplets(poet: "hafez", count: 6)
        let question = try #require(make(pool[0], pool: pool))
        #expect(question.options.count == 3 && question.options[question.correct].title.hasSuffix("ند"))
        #expect(question.options.allSatisfy { option in pool.contains { $0.id == option.id && $0.poetSlug == "saadi" } || option.id == pool[0].id })
    }

    @Test func aDuplicateHemistichIsNotUsedTwice() throws {
        var pool = QuizFixtures.couplets(poet: "saadi", count: 3)
        pool.append(GameCouplet(poem: "/saadi/x", index: 0, m1: "الف", m2: TextNormalizer.plain(pool[0].m2), meaning: nil, poetSlug: "saadi", poetName: "سعدی", bookTitle: ""))
        #expect(make(pool[0], pool: pool) != nil)
        let question = try #require(make(pool[0], pool: pool))
        #expect(Set(question.options.map { TextNormalizer.normalize($0.title) }).count == 3)
        #expect(make(pool[0], pool: Array(pool.prefix(1)) + [pool[3]]) == nil, "a copy of the right one is no other option")
    }

    @Test func aPoetWithTooFewCoupletsMakesNoQuestion() {
        #expect(make(deck.couplets[0], pool: QuizFixtures.couplets(poet: "saadi", count: 2)) == nil)
    }

    @Test func theSameSeedGivesTheSameQuestionAndTheOptionsAreInRandomOrder() throws {
        let couplet = deck.couplets[0]
        #expect(make(couplet, seed: 7) == make(couplet, seed: 7))
        let places = Set((1...30).compactMap { make(couplet, seed: UInt64($0))?.correct })
        #expect(places == [0, 1, 2])
    }

    @Test func theSheetSaysItIsTheOne() throws {
        let question = try #require(make(deck.couplets[0]))
        #expect(question.verdict(right: true) == "آره، همینه!")
        #expect(question.verdict(right: false) == "نه، این بود")
    }
}

struct BookQuestionTests {
    private let books = [
        QuizFixtures.book("/moulavi/masnavi", poet: "moulavi"), QuizFixtures.book("/moulavi/shams", poet: "moulavi"),
        QuizFixtures.book("/moulavi/fhmfh", poet: "moulavi"), QuizFixtures.book("/moulavi/other", poet: "moulavi"),
        QuizFixtures.book("/hafez", poet: "hafez"), QuizFixtures.book("/khayyam/robaee", poet: "khayyam"), QuizFixtures.book("/khayyam/tarane", poet: "khayyam"),
    ]

    private func couplet(_ poet: String, book: String) -> GameCouplet {
        QuizFixtures.couplets(poet: poet, count: 1, book: book)[0]
    }

    private func make(_ couplet: GameCouplet, seed: UInt64 = 1) -> QuizQuestion? {
        var generator = SeededGenerator(seed: seed)
        return QuizMaker.book(couplet, books: books, generator: &generator)
    }

    @Test func threeBooksOfThePoetAndTheRightOneIsAmongThem() throws {
        let question = try #require(make(couplet("moulavi", book: "/moulavi/masnavi")))
        #expect(question.options.count == 3 && Set(question.options.map(\.id)).count == 3)
        #expect(question.options[question.correct].id == "/moulavi/masnavi")
        #expect(question.options[question.correct].title == "کتاب /moulavi/masnavi")
        #expect(question.options.allSatisfy { $0.id.hasPrefix("/moulavi/") })
    }

    @Test func aPoetWithTwoBooksGetsTwoOptions() throws {
        let question = try #require(make(couplet("khayyam", book: "/khayyam/tarane")))
        #expect(Set(question.options.map(\.id)) == ["/khayyam/robaee", "/khayyam/tarane"])
    }

    @Test func aPoetWithOneBookOrAnUnknownBookMakesNoQuestion() {
        #expect(make(couplet("hafez", book: "/hafez")) == nil)
        #expect(make(couplet("moulavi", book: "/moulavi/unknown")) == nil)
        #expect(make(couplet("moulavi", book: "")) == nil)
    }

    @Test func theOtherBooksVaryWithTheSeedAndNeverRepeat() throws {
        let couplet = couplet("moulavi", book: "/moulavi/masnavi")
        #expect(make(couplet, seed: 3) == make(couplet, seed: 3))
        let seen = Set((1...30).compactMap { make(couplet, seed: UInt64($0)) }.flatMap(\.options).map(\.id))
        #expect(seen.count == 4)
    }

    @Test func theSheetNamesTheBook() throws {
        let question = try #require(make(couplet("moulavi", book: "/moulavi/masnavi")))
        #expect(question.verdict(right: true) == "آره، از کتاب /moulavi/masnavi بود!")
        #expect(question.verdict(right: false) == "نه، از کتاب /moulavi/masnavi بود")
    }
}

struct QuizRoundMakingTests {
    private let deck = QuizFixtures.deck()

    @Test func aPoetRoundHasTenQuestionsOnTenDifferentCouplets() throws {
        var generator = SeededGenerator(seed: 1)
        let round = try #require(QuizRound.poet(deck: deck, poets: QuizFixtures.poets, generator: &generator))
        #expect(round.kind == .poet && round.questions.count == 10)
        #expect(Set(round.questions.map(\.couplet.id)).count == 10)
        #expect(round.questions.allSatisfy { $0.kind == .poet && $0.options.count == 4 })
    }

    @Test func aRoundIsTheSameForTheSameSeed() throws {
        var first = SeededGenerator(seed: 4), second = SeededGenerator(seed: 4)
        #expect(QuizRound.second(deck: deck, only: nil, generator: &first) == QuizRound.second(deck: deck, only: nil, generator: &second))
    }

    @Test func aSecondHemistichRoundOfOnePoetHasOnlyThatPoetsCouplets() throws {
        var generator = SeededGenerator(seed: 2)
        let round = try #require(QuizRound.second(deck: deck, only: "hafez", generator: &generator))
        #expect(round.questions.count == 10)
        #expect(round.questions.allSatisfy { $0.couplet.poetSlug == "hafez" && $0.kind == .misra })
        #expect(round.questions.flatMap(\.options).allSatisfy { option in deck.couplets.first { $0.id == option.id }?.poetSlug == "hafez" })
    }

    @Test func aPoetWithFewCoupletsGetsAShorterRound() throws {
        let small = GameDeck(couplets: QuizFixtures.couplets(poet: "hafez", count: 4) + QuizFixtures.couplets(poet: "saadi", count: 30))
        var generator = SeededGenerator(seed: 2)
        #expect(try #require(QuizRound.second(deck: small, only: "hafez", generator: &generator)).questions.count == 4)
        #expect(QuizRound.second(deck: GameDeck(couplets: QuizFixtures.couplets(poet: "hafez", count: 2)), only: "hafez", generator: &generator) == nil)
        #expect(QuizRound.second(deck: small, only: "nobody", generator: &generator) == nil)
    }

    @Test func aBookRoundUsesOnlyPoetsWithTwoOrMoreBooks() throws {
        let books = [
            QuizFixtures.book("/saadi/a", poet: "saadi"), QuizFixtures.book("/saadi/b", poet: "saadi"), QuizFixtures.book("/hafez", poet: "hafez"),
        ]
        let couplets = QuizFixtures.couplets(poet: "saadi", count: 8, book: "/saadi/a") + QuizFixtures.couplets(poet: "hafez", count: 8, book: "/hafez")
        var generator = SeededGenerator(seed: 1)
        let round = try #require(QuizRound.book(deck: GameDeck(couplets: couplets), books: books, generator: &generator))
        #expect(round.questions.count == 8 && round.questions.allSatisfy { $0.couplet.poetSlug == "saadi" })
        #expect(QuizRound.book(deck: GameDeck(couplets: Array(couplets.suffix(8))), books: books, generator: &generator) == nil)
    }

    @Test func eachGameHasItsClock() throws {
        #expect(QuizRound(kind: .poet, questions: [QuizFixtures.question()])?.clock == .perQuestion(12))
        #expect(QuizRound(kind: .book, questions: [QuizFixtures.question(.book)])?.clock == .perQuestion(12))
        #expect(QuizRound(kind: .misra, questions: [QuizFixtures.question(.misra)])?.clock == .round(120))
        let listenClock = QuizRound(kind: .listen, questions: [QuizFixtures.question(.listen)])?.clock
        #expect(listenClock == QuizRound.Clock.none)
        #expect(QuizRound(kind: .poet, questions: []) == nil)
    }
}
