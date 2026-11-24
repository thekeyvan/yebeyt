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

    private func loaded(_ route: ReaderRoute, recitations: Bool = true, engines: FakeEngines? = nil) async throws -> ReaderModel {
        StubURLProtocol.reset(recitations ? [Self.recitationsURL: (200, try Fixtures.data("recitations"))] : [:])
        let timing = try Fixtures.data("timing-2130-ff", extension: "xml")
        let model = engines.map { ReaderModel(route: route, makeEngine: $0.make, fetchTiming: { _ in timing }) } ?? ReaderModel(route: route)
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

    // MARK: Playing follows the couplet

    private func settle(until done: () -> Bool) async throws {
        for _ in 0..<200 where !done() { try await Task.sleep(for: .milliseconds(10)) }
    }

    /// Presses play and lets the audio become ready; the engine it plays through.
    private func play(_ model: ReaderModel, _ engines: FakeEngines) async throws -> FakeEngine {
        model.togglePlayback()
        try await settle { engines.last != nil }
        let engine = try #require(engines.last)
        engine.events.ready()
        try await settle { engine.isPlaying }
        return engine
    }

    @Test func playStartsAtTheCoupletOnThePage() async throws {
        let engines = FakeEngines()
        let model = try await loaded(ReaderRoute(path: "/hafez/ghazal/sh3", couplet: 2), engines: engines)
        let engine = try await play(model, engines)
        #expect(engine.seeks == [29.886])
    }

    @Test func playInTheWholePoemStartsAtTheCoupletAtTheTop() async throws {
        let engines = FakeEngines()
        let model = try await loaded(ReaderRoute(path: "/hafez/ghazal/sh3", mode: .scroll), engines: engines)
        model.topIndex = 1
        let engine = try await play(model, engines)
        #expect(engine.seeks == [15.486])
    }

    @Test func pagingToAnotherCoupletSeeksTheAudioAndKeepsItPlaying() async throws {
        let engines = FakeEngines()
        let model = try await loaded(ReaderRoute(path: "/hafez/ghazal/sh3"), engines: engines)
        let engine = try await play(model, engines)
        model.go(to: 2)
        try await settle { engine.seeks == [29.886] }
        #expect(engine.seeks == [29.886])
        #expect(engine.isPlaying)
        #expect(model.index == 2)
    }

    @Test func pagingWhilePausedSeeksAndStaysPaused() async throws {
        let engines = FakeEngines()
        let model = try await loaded(ReaderRoute(path: "/hafez/ghazal/sh3"), engines: engines)
        let engine = try await play(model, engines)
        model.player?.toggle()
        model.go(to: 1)
        try await settle { engine.seeks == [15.486] }
        #expect(engine.seeks == [15.486])
        #expect(!engine.isPlaying)
        #expect(model.player?.state == .paused)
    }

    @Test func tappingACoupletInTheWholePoemSeeksToIt() async throws {
        let engines = FakeEngines()
        let model = try await loaded(ReaderRoute(path: "/hafez/ghazal/sh3", mode: .scroll), engines: engines)
        let engine = try await play(model, engines)
        model.openCouplet(2)
        try await settle { engine.seeks == [29.886] }
        #expect(engine.seeks == [29.886])
        #expect(model.mode == .couplet)
    }

    @Test func scrollingTheWholePoemDoesNotSeek() async throws {
        let engines = FakeEngines()
        let model = try await loaded(ReaderRoute(path: "/hafez/ghazal/sh3", mode: .scroll), engines: engines)
        let engine = try await play(model, engines)
        model.topIndex = 2
        model.setMode(.couplet)
        try await Task.sleep(for: .milliseconds(50))
        #expect(engine.seeks.isEmpty)
        #expect(model.index == 2)
    }

    @Test func theReaderFollowingTheAudioDoesNotSeek() async throws {
        let engines = FakeEngines()
        let model = try await loaded(ReaderRoute(path: "/hafez/ghazal/sh3"), engines: engines)
        let engine = try await play(model, engines)
        engine.events.tick(16)  // the audio reaches the second couplet
        #expect(model.player?.activeCouplet == 1)
        model.follow(1)
        #expect(model.index == 1)
        try await Task.sleep(for: .milliseconds(50))
        #expect(engine.seeks.isEmpty, "a seek here would send the audio back to the start of the couplet it is in")
        #expect(engine.isPlaying)
    }
}
