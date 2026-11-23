import Foundation
import Testing
@testable import Yebeyt

private func temporaryDirectory() -> URL {
    FileManager.default.temporaryDirectory.appendingPathComponent("yebeyt-tests-\(UUID().uuidString)")
}

enum MatchFixtures {
    static let couplet = GameCouplet(
        poem: "/hafez/ghazal/sh3", index: 1, m1: "بده ساقی مِیِ باقی که در جَنَّت نخواهی یافت", m2: "کنارِ آبِ رُکناباد و گُل‌گَشتِ مُصَلّا را",
        meaning: "معنی", poetSlug: "hafez", poetName: "حافظ", bookTitle: "دیوان حافظ"
    )

    static let entry = GlossaryEntry(path: "/hafez/ghazal/sh3", couplet: 1, words: [
        GlossaryWord(text: "ساقی", m: 1, gloss: "کسی که شراب می‌ریزه"),
        GlossaryWord(text: "می باقی", m: 1, gloss: "شرابی که مونده"),
        GlossaryWord(text: "جنت", m: 1, gloss: "بهشت"),
        GlossaryWord(text: "گل‌گشت", m: 2, gloss: "گردشگاه"),
        GlossaryWord(text: "مصلا", m: 2, gloss: "جای نماز"),
    ])

    static func question(seed: UInt64 = 1) -> MatchQuestion {
        var generator = SeededGenerator(seed: seed)
        return MatchQuestion(entry: entry, couplet: couplet, generator: &generator)!
    }
}

struct GlossMatchTests {
    @Test func aWordIsFoundIgnoringDiacriticsAndTwoWordsMakeOneRange() {
        let found = GlossMatch.locate(["ساقی", "می باقی", "جنت"], in: MatchFixtures.couplet.m1)
        #expect(found.tokens == ["بده", "ساقی", "مِیِ", "باقی", "که", "در", "جَنَّت", "نخواهی", "یافت"])
        #expect(found.ranges == [1..<2, 2..<4, 6..<7])
    }

    @Test func aHalfSpaceInsideAWordStaysOneToken() {
        let found = GlossMatch.locate(["گل‌گشت", "گلگشت", "مصلا"], in: MatchFixtures.couplet.m2)
        #expect(found.ranges == [4..<5, nil, 5..<6])
    }

    @Test func onlyWholeWordsMatch() {
        #expect(GlossMatch.locate(["ساق", "باقیی", "ی"], in: MatchFixtures.couplet.m1).ranges == [nil, nil, nil])
    }

    @Test func arabicLettersAndPunctuationAreFolded() {
        let found = GlossMatch.locate(["كاسا"], in: "ادر كأساً، و ناولها")
        #expect(found.ranges == [1..<2])
    }

    @Test func anEmptyTextMatchesNothing() {
        #expect(GlossMatch.locate(["", " "], in: "یک دو").ranges == [nil, nil])
    }
}

struct MatchQuestionTests {
    @Test func wordsComeInTheOrderTheyAreRead() {
        let question = MatchFixtures.question()
        #expect(question.words.map(\.text) == ["ساقی", "می باقی", "جنت", "گل‌گشت", "مصلا"])
        #expect(question.words.map(\.id) == [0, 1, 2, 3, 4])
        #expect(question.words[0].gloss == "کسی که شراب می‌ریزه")
    }

    @Test func theCoupletIsInTwoLinesWithTheGlossedWordsMarked() {
        let lines = MatchFixtures.question().lines
        #expect(lines.count == 2)
        #expect(lines[0].filter(\.glossed).map(\.text) == ["ساقی", "مِیِ", "باقی", "جَنَّت"])
        #expect(lines[1].filter(\.glossed).map(\.text) == ["گُل‌گَشتِ", "مُصَلّا"])
        #expect(lines[0].map(\.text).joined(separator: " ") == MatchFixtures.couplet.m1)
    }

    @Test func theMeaningsAreTheSameWordsInAnotherOrder() {
        let question = MatchFixtures.question()
        #expect(question.meanings.sorted() == [0, 1, 2, 3, 4])
        #expect(Set((1...20).map { MatchFixtures.question(seed: UInt64($0)).meanings }).count > 3)
        #expect(MatchFixtures.question(seed: 4) == MatchFixtures.question(seed: 4))
    }

    @Test func aWordThatIsNotInTheCoupletIsLeftOutAndTooFewWordsMakeNoQuestion() {
        var entry = MatchFixtures.entry
        entry.words[1].text = "ناپیدا"
        var generator = SeededGenerator(seed: 1)
        let question = MatchQuestion(entry: entry, couplet: MatchFixtures.couplet, generator: &generator)
        #expect(question?.words.map(\.text) == ["ساقی", "جنت", "گل‌گشت", "مصلا"])
        entry.words = [entry.words[0]]
        #expect(MatchQuestion(entry: entry, couplet: MatchFixtures.couplet, generator: &generator) == nil)
    }
}

struct MatchRoundTests {
    private func round(count: Int = 2) -> MatchRound {
        MatchRound(questions: (0..<count).map { MatchFixtures.question(seed: UInt64($0 + 1)) })!
    }

    /// Matches every word of the couplet in play, in order.
    private func solve(_ round: inout MatchRound) {
        for word in round.current.words {
            round.selectWord(word.id)
            let pick = round.pick(meaning: word.id)
            #expect(pick == .matched)
        }
    }

    @Test func aWordThenItsMeaningMakesAPairWorthTen() {
        var round = round()
        round.selectWord(2)
        #expect(round.selectedWord == 2)
        let pick = round.pick(meaning: 2)
        #expect(pick == .matched)
        #expect(round.matched == [2] && round.selectedWord == nil && round.points == 10)
    }

    @Test func aWrongMeaningOnlyShakesAndKeepsTheWord() {
        var round = round()
        round.selectWord(2)
        let wrong = round.pick(meaning: 3)
        #expect(wrong == .wrong)
        #expect(round.matched.isEmpty && round.points == 0 && round.selectedWord == 2)
        let right = round.pick(meaning: 2)
        #expect(right == .matched)
    }

    @Test func aMeaningWithNoWordInHandIsIgnored() {
        var round = round()
        let pick = round.pick(meaning: 1)
        #expect(pick == .ignored)
    }

    @Test func aMatchedWordOrMeaningCannotBePickedAgain() {
        var round = round()
        round.selectWord(1)
        _ = round.pick(meaning: 1)
        round.selectWord(1)
        #expect(round.selectedWord == nil)
        round.selectWord(0)
        let ignored = round.pick(meaning: 1)
        #expect(ignored == .ignored && round.selectedWord == 0)
    }

    @Test func tappingTheWordInHandAgainPutsItDown() {
        var round = round()
        round.selectWord(0); round.selectWord(0)
        #expect(round.selectedWord == nil)
    }

    @Test func theSheetOpensWhenEveryWordIsMatchedAndTheRoundEndsAfterTheLastCouplet() {
        var round = round()
        for word in round.current.words.dropLast() {
            round.selectWord(word.id)
            _ = round.pick(meaning: word.id)
        }
        #expect(!round.sheetOpen)
        round.selectWord(4)
        _ = round.pick(meaning: 4)
        #expect(round.sheetOpen && round.points == 50 && round.results == [true])
        round.next()
        #expect(round.index == 1 && round.matched.isEmpty && !round.sheetOpen && !round.isFinished)
        solve(&round)
        #expect(round.sheetOpen && round.isFinished && round.points == 100 && round.results == [true, true])
        round.next()
        #expect(round.index == 1)
    }

    @Test func nothingChangesWhileTheSheetIsOpen() {
        var round = round(count: 1)
        solve(&round)
        round.selectWord(0)
        #expect(round.selectedWord == nil)
    }

    @Test func aRoundIsMadeOfFiveCoupletsFromTheEntriesThatCanBeResolved() throws {
        let entries = (0..<8).map { GlossaryEntry(path: "/hafez/ghazal/sh\($0)", couplet: 1, words: MatchFixtures.entry.words) }
        var generator = SeededGenerator(seed: 3)
        let round = try #require(MatchRound.make(entries: entries, couplet: { entry in
            entry.path.hasSuffix("sh0") ? nil : MatchFixtures.couplet
        }, generator: &generator))
        #expect(round.questions.count == 5)
        var again = SeededGenerator(seed: 3)
        #expect(round == MatchRound.make(entries: entries, couplet: { $0.path.hasSuffix("sh0") ? nil : MatchFixtures.couplet }, generator: &again))
        #expect(MatchRound.make(entries: entries, couplet: { _ in nil }, generator: &generator) == nil)
        #expect(try #require(MatchRound.make(entries: Array(entries.prefix(2)), couplet: { _ in MatchFixtures.couplet }, generator: &generator)).questions.count == 2)
    }
}

@MainActor
struct MatchSessionTests {
    @Test func pairsAreAddedToThePhoneAsTheyComeAndTheBestWhenTheRoundEnds() {
        let stats = GameStats(defaults: GameFixtures.defaults())
        let session = MatchSession(round: MatchRound(questions: [MatchFixtures.question()])!, stats: stats)
        session.selectWord(0)
        #expect(session.pick(meaning: 1) == .wrong && stats.points == 0)
        for id in 0..<5 {
            if session.round.selectedWord != id { session.selectWord(id) }
            _ = session.pick(meaning: id)
        }
        #expect(stats.points == 50 && !session.finished)
        session.next()
        #expect(session.finished && stats.best(.match) == 50)
    }
}

@MainActor
struct GlossaryDataTests {
    @Test func theBundledGlossaryIsFoundWordForWordInTheBundledPoems() async throws {
        let glossary = try Glossary(bundle: Fixtures.appBundle)
        #expect(glossary.entries.count > 100)
        let store = try PoetryStore(bundle: Fixtures.appBundle, session: StubURLProtocol.session(), cacheDirectory: temporaryDirectory())
        for entry in glossary.entries {
            let poem = try await store.poem(path: entry.path)
            let couplet = try #require(poem.couplets.indices.contains(entry.couplet) ? poem.couplets[entry.couplet] : nil, "\(entry.path) #\(entry.couplet)")
            for word in entry.words {
                let found = GlossMatch.locate([word.text], in: word.m == 1 ? couplet.m1 : couplet.m2).ranges[0]
                #expect(found != nil, "\(word.text) in \(entry.path) #\(entry.couplet)")
            }
        }
    }

    @Test func everyEntryMakesAQuestion() async throws {
        let glossary = try Glossary(bundle: Fixtures.appBundle)
        let store = try PoetryStore(bundle: Fixtures.appBundle, session: StubURLProtocol.session(), cacheDirectory: temporaryDirectory())
        var generator = SeededGenerator(seed: 1)
        for entry in glossary.entries {
            let couplet = try await store.poem(path: entry.path).couplets[entry.couplet]
            let game = GameCouplet(poem: entry.path, index: entry.couplet, m1: couplet.m1, m2: couplet.m2, meaning: couplet.meaning, poetSlug: "", poetName: "", bookTitle: "")
            let question = try #require(MatchQuestion(entry: entry, couplet: game, generator: &generator))
            #expect(question.words.count == entry.words.count)
        }
    }
}
