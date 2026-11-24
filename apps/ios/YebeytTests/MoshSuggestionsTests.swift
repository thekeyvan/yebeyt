import Foundation
import Testing
@testable import Yebeyt

struct MoshSuggestionsTests {
    private func book(_ path: String, _ index: Int, _ m1: String, _ m2: String, popularity: Int = 0) -> CoupletEntry {
        CoupletEntry(
            path: path, index: index, couplet: Couplet(m1: m1, m2: m2), poet: "hafez", title: "غزل ۱", popularity: popularity,
            text: TextNormalizer.normalize("\(m1) \(m2)")
        )
    }

    private func divan(_ path: String, _ index: Int, _ m1: String, _ m2: String) -> DivanEntry {
        DivanEntry(key: "\(path)#\(index)", path: path, index: index, couplet: Couplet(m1: m1, m2: m2), poetSlug: "hafez", title: "غزل ۲", keptAt: 1)
    }

    private var books: [CoupletEntry] {
        [
            book("/hafez/ghazal/sh1", 0, "دلا نزد کسی بنشین که او از دل خبر دارد", "به زیر کلک نکته‌ها", popularity: 5),
            book("/hafez/ghazal/sh2", 0, "دل می‌رود ز دستم صاحب‌دلان خدا را", "دردا که راز پنهان خواهد شد آشکارا", popularity: 50),
            book("/hafez/ghazal/sh3", 0, "ألا یا ایها الساقی ادر کأسا و ناولها", "که عشق آسان نمود اول", popularity: 90),
            book("/hafez/ghazal/sh4", 0, "یاد باد آن که نهانت نظری با ما بود", "رقم مهر تو بر چهره پیدا بود", popularity: 80),
        ]
    }

    @Test func theLettersCoupletsArePickedFromTheDivanThenTheBooksByPopularity() {
        let mine = [divan("/hafez/ghazal/sh9", 2, "دوش دیدم که ملایک در میخانه زدند", "گل آدم بسرشتند")]
        let found = MoshSuggestions.suggestions(letter: "د", typed: "", divan: mine, books: books, used: [], limit: 10)
        #expect(found.map(\.key) == ["/hafez/ghazal/sh9#2", "/hafez/ghazal/sh2#0", "/hafez/ghazal/sh1#0"])
        #expect(found.map(\.inDivan) == [true, false, false])
    }

    @Test func aCoupletStartingWithAnotherLetterIsLeftOut() {
        let found = MoshSuggestions.suggestions(letter: "ی", typed: "", divan: [], books: books, used: [], limit: 10)
        #expect(found.map(\.key) == ["/hafez/ghazal/sh4#0"])
    }

    @Test func theLettersFoldLikeTheServers() {
        // «ألا» starts with ا for the server, as آ and أ do.
        let found = MoshSuggestions.suggestions(letter: "ا", typed: "", divan: [], books: books, used: [], limit: 10)
        #expect(found.map(\.key) == ["/hafez/ghazal/sh3#0"])
    }

    @Test func playedCoupletsAreNotOffered() {
        let found = MoshSuggestions.suggestions(letter: "د", typed: "", divan: [], books: books, used: ["/hafez/ghazal/sh2#0"], limit: 10)
        #expect(found.map(\.key) == ["/hafez/ghazal/sh1#0"])
    }

    @Test func aCoupletInTheDivanIsOfferedOnceAndTheLimitHolds() {
        let mine = [divan("/hafez/ghazal/sh2", 0, "دل می‌رود ز دستم صاحب‌دلان خدا را", "دردا که راز پنهان خواهد شد آشکارا")]
        let found = MoshSuggestions.suggestions(letter: "د", typed: "", divan: mine, books: books, used: [], limit: 2)
        #expect(found.map(\.key) == ["/hafez/ghazal/sh2#0", "/hafez/ghazal/sh1#0"])
        #expect(MoshSuggestions.suggestions(letter: "د", typed: "", divan: mine, books: books, used: [], limit: 1).count == 1)
    }

    @Test func typingNarrowsTheListToWhatStartsLikeTheText() {
        let found = MoshSuggestions.suggestions(letter: "د", typed: "دلا", divan: [], books: books, used: [], limit: 10)
        #expect(found.map(\.key) == ["/hafez/ghazal/sh1#0"])
    }

    @Test func theFirstCoupletOfAGameMayStartWithAnyLetter() {
        let found = MoshSuggestions.suggestions(letter: nil, typed: "", divan: [], books: books, used: [], limit: 10)
        #expect(found.count == 4)
        #expect(found.first?.key == "/hafez/ghazal/sh3#0")  // the most recited
    }

    // MARK: Typed text

    private let firstHemistich = "دل می‌رود ز دستم صاحب‌دلان خدا را"

    @Test func aWholeFirstHemistichFindsItsCouplet() {
        let match = MoshSuggestions.match("دل می رود ز دستم صاحب دلان خدا را", letter: "د", divan: [], books: books, used: [])
        guard case .found(let found) = match else { Issue.record("not found: \(match)"); return }
        #expect(found.key == "/hafez/ghazal/sh2#0")
    }

    @Test func aWholeCoupletAndDifferentSpellingsFindIt() {
        let typed = "دَلا نزد كسي بنشين كه او از دل خبر دارد، به زیر کلک نکته‌ها"
        guard case .found(let found) = MoshSuggestions.match(typed, letter: "د", divan: [], books: books, used: []) else { Issue.record("not found"); return }
        #expect(found.key == "/hafez/ghazal/sh1#0")
    }

    @Test func aTextThatOnlyBeginsTheHemistichIsNotACouplet() {
        #expect(MoshSuggestions.match("دل", letter: "د", divan: [], books: books, used: []) == .notFound)
        #expect(MoshSuggestions.match("دل می‌رود", letter: "د", divan: [], books: books, used: []) == .notFound)
    }

    @Test func aTextOfNoBookIsNotFound() {
        #expect(MoshSuggestions.match("دلم می‌خواد یه بیت بگم", letter: "د", divan: [], books: books, used: []) == .notFound)
        #expect(MoshSuggestions.match("   ", letter: "د", divan: [], books: books, used: []) == .notFound)
    }

    @Test func theDivanIsSearchedToo() {
        let mine = [divan("/x/y/sh1", 3, "درخت دوستی بنشان که کام دل به بار آرد", "نهال دشمنی برکن")]
        guard case .found(let found) = MoshSuggestions.match("درخت دوستی بنشان که کام دل به بار آرد", letter: "د", divan: mine, books: books, used: []) else { Issue.record("not found"); return }
        #expect(found.inDivan)
    }

    @Test func aFoundCoupletWithTheWrongLetterOrPlayedAlreadyIsSaid() {
        #expect(MoshSuggestions.match(firstHemistich, letter: "ب", divan: [], books: books, used: []) == .wrongLetter)
        #expect(MoshSuggestions.match(firstHemistich, letter: "د", divan: [], books: books, used: ["/hafez/ghazal/sh2#0"]) == .alreadyPlayed)
    }
}
