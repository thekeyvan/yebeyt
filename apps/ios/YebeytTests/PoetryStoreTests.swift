import Foundation
import Testing
@testable import Yebeyt

@MainActor @Suite(.serialized)
struct PoetryStoreTests {
    private let sha: String
    private let cache = temporaryDirectory()

    init() throws {
        StubURLProtocol.reset()
        sha = try PoetryStore(bundle: Fixtures.appBundle, session: StubURLProtocol.session(), cacheDirectory: cache).sha
    }

    private func makeStore() throws -> PoetryStore {
        try PoetryStore(bundle: Fixtures.appBundle, session: StubURLProtocol.session(), cacheDirectory: cache)
    }

    @Test func loadsPoetsWithHafezAndHisBooks() throws {
        let store = try makeStore()
        let hafez = try #require(store.poets.first { $0.nickname == "حافظ" })
        #expect(hafez.slug == "hafez")
        #expect(hafez.birthYear == 726)
        #expect(hafez.books.map(\.title) == ["غزلیات", "قطعات", "رباعیات", "قصاید", "اشعار منتسب"])
        #expect(hafez.books.first?.isBundled == true)
        #expect(store.poets.count > 200)
    }

    @Test func theDataCommitIsReadFromThePoetsFile() throws {
        let store = try makeStore()
        #expect(store.sha.count == 40)
    }

    @Test func aBundledBookLoadsWithoutTheNetwork() async throws {
        let store = try makeStore()
        let book = try await store.book(id: 24)
        #expect(book.title == "غزلیات")
        #expect(book.path == "/hafez/ghazal")
        #expect(book.poems.count == 495)
        #expect(StubURLProtocol.requests.isEmpty)
    }

    @Test func aBundledPoemLoadsWithoutTheNetwork() async throws {
        let store = try makeStore()
        let poem = try await store.poem(path: "/hafez/ghazal/sh3")
        #expect(poem.id == 2132)
        #expect(poem.couplets[1].m1 == "بده ساقی مِیِ باقی که در جَنَّت نخواهی یافت")
        #expect(poem.couplets[1].m2 == "کنارِ آبِ رُکناباد و گُل‌گَشتِ مُصَلّا را")
        #expect(StubURLProtocol.requests.isEmpty)
    }

    @Test func otherBundledBooksAreThere() async throws {
        let store = try makeStore()
        #expect(try await store.book(id: 31).poems.count == 178)
        #expect(try await store.book(id: 316).poems.count == 366)
    }

    private func raw(_ path: String) -> String {
        "https://raw.githubusercontent.com/ganjoor/ganjoor-data/\(sha)/poets\(path)"
    }

    private func serveGhete() throws {
        StubURLProtocol.reset([
            raw("/hafez/ghete/sh1.json"): (200, try Fixtures.data("raw-poem-ghete1")),
            raw("/hafez/ghete/_cat.json"): (200, try Fixtures.data("raw-category-ghete")),
        ])
    }

    @Test func aPoemThatIsNotBundledComesFromTheNetworkAtThePinnedCommit() async throws {
        try serveGhete()
        let poem = try await makeStore().poem(path: "/hafez/ghete/sh1")
        #expect(poem.id == 2093)
        #expect(poem.couplets.count == 2)
        #expect(poem.couplets[0].m2 == "چرا بایدت دیگری محتسب")
        #expect(StubURLProtocol.requests.map(\.absoluteString) == [raw("/hafez/ghete/sh1.json")])
    }

    @Test func aSecondLoadIsServedFromTheCache() async throws {
        try serveGhete()
        let store = try makeStore()
        let first = try await store.poem(path: "/hafez/ghete/sh1")
        let second = try await store.poem(path: "/hafez/ghete/sh1")
        #expect(first == second)
        #expect(StubURLProtocol.requests.count == 1)
    }

    @Test func theCacheSurvivesARestartAndWorksOffline() async throws {
        try serveGhete()
        let poem = try await makeStore().poem(path: "/hafez/ghete/sh1")
        StubURLProtocol.reset()
        let again = try await makeStore().poem(path: "/hafez/ghete/sh1")
        #expect(again == poem)
        #expect(StubURLProtocol.requests.isEmpty)
    }

    @Test func aBookThatIsNotBundledComesFromTheNetworkAndIsCached() async throws {
        try serveGhete()
        let store = try makeStore()
        let book = try await store.book(id: 25)
        #expect(book.title == "قطعات")
        #expect(book.poems.map(\.path) == ["/hafez/ghete/sh1", "/hafez/ghete/sh2"])
        #expect(book.children.map(\.path) == ["/hafez/ghete/zir"])
        StubURLProtocol.reset()
        #expect(try await makeStore().book(path: "/hafez/ghete") == book)
        #expect(StubURLProtocol.requests.isEmpty)
    }

    @Test func networkErrorsAreThrown() async throws {
        StubURLProtocol.reset()
        await #expect(throws: URLError.self) { try await makeStore().poem(path: "/hafez/ghete/sh1") }
        StubURLProtocol.reset([raw("/hafez/ghete/sh1.json"): (404, Data())])
        await #expect(throws: PoetryError.self) { try await makeStore().poem(path: "/hafez/ghete/sh1") }
    }

    @Test func aBrokenPoemFileIsAnErrorAndIsNotCached() async throws {
        StubURLProtocol.reset([raw("/hafez/ghete/sh1.json"): (200, Data("not json".utf8))])
        await #expect(throws: DecodingError.self) { try await makeStore().poem(path: "/hafez/ghete/sh1") }
        try serveGhete()
        #expect(try await makeStore().poem(path: "/hafez/ghete/sh1").id == 2093)
    }

    @Test func anUnknownBookIdIsAnError() async throws {
        await #expect(throws: PoetryError.self) { try await makeStore().book(id: 123_456_789) }
    }

    @Test func recitationsAreOrderedByAudioOrder() async throws {
        StubURLProtocol.reset(["https://api.ganjoor.net/api/ganjoor/poem/2132/recitations": (200, try Fixtures.data("recitations"))])
        let list = try await makeStore().recitations(poemId: 2132)
        #expect(list.map(\.audioOrder) == [1, 2, 3])
        #expect(list.map(\.id) == [2842, 3344, 5000])
    }

    @Test func recitationsFailWithAnErrorWhenOffline() async throws {
        StubURLProtocol.reset()
        await #expect(throws: URLError.self) { try await makeStore().recitations(poemId: 2132) }
    }
}

private func temporaryDirectory() -> URL {
    FileManager.default.temporaryDirectory.appendingPathComponent("yebeyt-tests-\(UUID().uuidString)")
}
