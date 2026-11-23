import Testing
@testable import Yebeyt

@MainActor
struct AIMeaningTests {
    @Test func theSparkleFollowsTheFlagOfTheMeaning() {
        #expect(Couplet(m1: "الف", m2: "ب", meaning: "معنی", ai: true).showsAIMark)
        #expect(!Couplet(m1: "الف", m2: "ب", meaning: "معنی", ai: false).showsAIMark)
        #expect(!Couplet(m1: "الف", m2: "ب", meaning: "معنی").showsAIMark)
        #expect(!Couplet(m1: "الف", m2: "ب", meaning: nil, ai: true).showsAIMark, "no meaning, nothing to mark")
    }

    @Test func aGameCoupletCarriesTheFlagFromItsCouplet() {
        func game(_ couplet: Couplet) -> GameCouplet {
            GameCouplet(poem: "/p/b/1", index: 0, couplet: couplet, poetSlug: "p", poetName: "شاعر", bookTitle: "کتاب")
        }
        #expect(game(Couplet(m1: "الف", m2: "ب", meaning: "معنی", ai: true)).showsAIMark)
        #expect(!game(Couplet(m1: "الف", m2: "ب", meaning: "معنی")).showsAIMark)
        #expect(!game(Couplet(m1: "الف", m2: "ب", ai: true)).showsAIMark)
        #expect(game(Couplet(m1: "الف", m2: "ب", meaning: "معنی")).poem == "/p/b/1")
    }

    @Test func theBundledDeckMarksJustTheAIMeanings() throws {
        let deck = try GameDeck(bundle: Fixtures.appBundle, poetNames: [:])
        let marked = deck.couplets.filter(\.showsAIMark).count
        #expect(marked > 0 && marked < deck.couplets.count)
        #expect(deck.couplets.allSatisfy { $0.meaningIsAI == $0.showsAIMark })
    }

    @Test func theWordsAreTheOwnersAndTheLabelIsForVoiceOver() {
        #expect(AIMeaning.toast == "این معنی با کمک هوش مصنوعی نوشته شده")
        #expect(AIMeaning.label == "با کمک هوش مصنوعی")
    }
}
