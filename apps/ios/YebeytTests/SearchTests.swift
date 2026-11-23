import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct SearchTests {
    private func poem(_ path: String, _ couplets: [(String, String)]) -> BundledPoem {
        BundledPoem(
            slug: path.split(separator: "/")[0].description,
            poem: Poem(id: 1, title: "t", path: path, summary: nil, rhythm: nil, couplets: couplets.map { Couplet(m1: $0.0, m2: $0.1) })
        )
    }

    private var corpus: CoupletCorpus {
        CoupletCorpus(poems: [
            poem("/a/g/sh1", [("به مِی سجّاده رنگین کن", "که سالک بی‌خبر نبود"), ("ز عشق ناتمام ما", "جمال یار مستغنی‌ست")]),
            poem("/a/g/sh2", [("دلبر و عاشق و معشوق", "همه یک نور"), ("بهار آمد", "سبزه نو شد")]),
        ], popularity: ["/a/g/sh2": 5, "/a/g/sh1": 1])
    }

    @Test func aCoupletIsFoundByAWordOfEitherHemistichIgnoringDiacritics() {
        #expect(corpus.search("سجاده", limit: 10).map(\.id) == ["/a/g/sh1#0"])
        #expect(corpus.search("نور", limit: 10).map(\.id) == ["/a/g/sh2#0"])
    }

    @Test func resultsPutTheMostRecitedPoemsFirstAndRespectTheLimit() {
        #expect(corpus.search("و", limit: 10).map(\.id) == ["/a/g/sh2#0", "/a/g/sh2#1", "/a/g/sh1#0"])
        #expect(corpus.search("ما", limit: 1).count == 1)
        #expect(corpus.search("  ", limit: 10).isEmpty)
    }

    @Test func aMoodMatchesCoupletsWithAnyOfItsWordsOnNormalisedText() {
        let love = Mood(key: "love", title: "عشق", words: ["عشق", "عاشق", "دلبر"])
        #expect(corpus.matching(love, limit: 10).map(\.id) == ["/a/g/sh2#0", "/a/g/sh1#1"])
        let spring = Mood(key: "spring", title: "بهار", words: ["بهار"])
        #expect(corpus.matching(spring, limit: 10).map(\.id) == ["/a/g/sh2#1"])
        #expect(corpus.matching(Mood(key: "x", title: "x", words: ["هیچ‌چیز"]), limit: 10).isEmpty)
    }

    @Test func theBundledCorpusHasMatchesForEveryMood() async throws {
        let poetry = try PoetryStore(bundle: Fixtures.appBundle)
        let library = try Library(bundle: Fixtures.appBundle)
        let corpus = try #require(await CorpusStore().corpus(poetry: poetry, library: library))
        #expect(corpus.entries.count > 5000)
        for mood in library.moods {
            #expect(corpus.matching(mood, limit: 20).count == 20, "\(mood.title)")
        }
        #expect(corpus.search("الا یا ایها الساقی", limit: 5).first?.poet == "hafez")
    }

    @Test func namesAreFoundAsPoetsAndBooks() throws {
        let library = try Library(bundle: Fixtures.appBundle)
        let found = library.find("حافظ")
        #expect(found.poets.map(\.slug) == ["hafez"])
        #expect(found.books.contains { $0.path == "/hafez" })
        #expect(library.find("گلستان").books.map(\.path) == ["/saadi/golestan"])
        #expect(library.find("").isEmpty)
        #expect(library.find("zzzz").isEmpty)
    }

    @Test func searchAddsCoupletsFromTheCorpus() throws {
        let library = try Library(bundle: Fixtures.appBundle)
        let results = library.search("عاشق", corpus: corpus)
        #expect(results.couplets.map(\.id) == ["/a/g/sh2#0"])
        #expect(library.search("عاشق", corpus: nil).couplets.isEmpty)
    }
}
