import Foundation
import Testing
@testable import Yebeyt

@MainActor @Suite(.serialized)
struct ReaderModelTests {
    private static let recitationsURL = "https://api.ganjoor.net/api/ganjoor/poem/2132/recitations"
    private let cache = FileManager.default.temporaryDirectory.appendingPathComponent("yebeyt-reader-tests-\(UUID().uuidString)")

    private func makeStore() throws -> PoetryStore {
        try PoetryStore(bundle: Fixtures.appBundle, session: StubURLProtocol.session(), cacheDirectory: cache)
    }

    private func loaded(_ route: ReaderRoute, recitations: Bool = true) async throws -> ReaderModel {
        StubURLProtocol.reset(recitations ? [Self.recitationsURL: (200, try Fixtures.data("recitations"))] : [:])
        let model = ReaderModel(route: route)
        await model.load(using: try makeStore())
        return model
    }

    private func ghetePoemURL(_ store: PoetryStore) -> String {
        "https://raw.githubusercontent.com/ganjoor/ganjoor-data/\(store.sha)/poets/hafez/ghete/sh1.json"
    }

    /// The non-bundled fixture poem, with the meaning of its second couplet taken out.
    private func serveGhete(secondMeaning: Bool) throws {
        let store = try makeStore()
        var json = try #require(JSONSerialization.jsonObject(with: Fixtures.data("raw-poem-ghete1")) as? [String: Any])
        var verses = try #require(json["Verses"] as? [[String: Any]])
        if !secondMeaning { verses[2]["CoupletSummary"] = NSNull() }
        json["Verses"] = verses
        StubURLProtocol.reset([ghetePoemURL(store): (200, try JSONSerialization.data(withJSONObject: json))])
    }

    @Test func loadsAPoemWithItsPoetAndBook() async throws {
        let model = try await loaded(ReaderRoute(path: "/hafez/ghazal/sh3", couplet: 1))
        #expect(model.phase == .loaded)
        #expect(model.content?.title == "غزل ۳")
        #expect(model.content?.subtitle == "حافظ · غزلیات")
        #expect(model.couplets.count == 9)
        #expect(model.index == 1)
    }

    @Test func aCoupletPastTheEndOpensOnTheLastOne() async throws {
        let model = try await loaded(ReaderRoute(path: "/hafez/ghazal/sh3", couplet: 99))
        #expect(model.index == 8)
    }

    @Test func aFailedLoadIsFailedAndCanBeRetried() async throws {
        StubURLProtocol.reset()
        let model = ReaderModel(route: ReaderRoute(path: "/hafez/ghete/sh1"))
        await model.load(using: try makeStore())
        #expect(model.phase == .failed)
        #expect(model.content == nil)

        try serveGhete(secondMeaning: true)
        await model.load(using: try makeStore())
        #expect(model.phase == .loaded)
    }

    @Test func eachModeStartsWhereTheOtherOneWas() async throws {
        let model = try await loaded(ReaderRoute(path: "/hafez/ghazal/sh3"))
        model.go(to: 3)
        model.setMode(.scroll)
        #expect(model.mode == .scroll)
        #expect(model.topIndex == 3)

        model.topIndex = 5  // the list was scrolled
        model.setMode(.couplet)
        #expect(model.mode == .couplet)
        #expect(model.index == 5)
    }

    @Test func switchingModeClosesTheMeaning() async throws {
        let model = try await loaded(ReaderRoute(path: "/hafez/ghazal/sh3", meaning: true))
        #expect(model.meaningOpen)
        model.setMode(.scroll)
        #expect(!model.meaningOpen)
    }

    @Test func theActionsActOnTheCoupletOnThePageOrAtTheTopOfTheList() async throws {
        let model = try await loaded(ReaderRoute(path: "/hafez/ghazal/sh3", couplet: 2))
        #expect(model.actionIndex == 2)
        model.setMode(.scroll)
        model.topIndex = 4
        #expect(model.actionIndex == 4)
    }

    @Test func aTappedCoupletOpensCoupletModeAtItWithItsMeaningWhenAsked() async throws {
        let model = try await loaded(ReaderRoute(path: "/hafez/ghazal/sh3", mode: .scroll, hold: 1))
        #expect(model.holdIndex == 1)
        model.openCouplet(4, withMeaning: true)
        #expect(model.mode == .couplet && model.index == 4 && model.meaningOpen)
        #expect(model.holdIndex == nil)
        model.openCouplet(5)
        #expect(model.index == 5 && !model.meaningOpen)
    }

    @Test func aMeaningOpensOnlyWhereOneExists() async throws {
        try serveGhete(secondMeaning: false)
        let model = ReaderModel(route: ReaderRoute(path: "/hafez/ghete/sh1", couplet: 1, meaning: true))
        await model.load(using: try makeStore())
        #expect(model.phase == .loaded)
        #expect(model.hasMeaning(0) && !model.hasMeaning(1))
        #expect(!model.meaningOpen)  // -beytMeaning on a couplet without one
        model.openMeaning()
        #expect(!model.meaningOpen)
        model.openCouplet(1, withMeaning: true)
        #expect(!model.meaningOpen)
        model.openCouplet(0, withMeaning: true)
        #expect(model.meaningOpen)
    }

    @Test func aHoldOnACoupletThatDoesNotExistIsIgnored() async throws {
        let model = try await loaded(ReaderRoute(path: "/hafez/ghazal/sh3", hold: 40))
        #expect(model.holdIndex == nil)
    }

    @Test func recitationsAreAvailableWhenGanjoorHasThem() async throws {
        let model = try await loaded(ReaderRoute(path: "/hafez/ghazal/sh3"))
        #expect(model.player?.isAvailable == true)
    }

    @Test func aRecitationThatFailsShowsTheToast() async throws {
        let model = try await loaded(ReaderRoute(path: "/hafez/ghazal/sh3"), recitations: false)
        #expect(model.player?.isAvailable == true)  // unknown, not absent: the button stays
        model.player?.toggle()
        for _ in 0..<200 where model.toast == nil { try await Task.sleep(for: .milliseconds(10)) }
        #expect(model.toast == "خوانش باز نشد")
        #expect(model.player?.state == .idle)
    }
}
