import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct DivanMergeTests {
    private let defaults = UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!

    private func marks(now: Int64 = 1_000_000) -> ReaderMarks {
        ReaderMarks(defaults: defaults, now: { Date(timeIntervalSince1970: Double(now) / 1000) })
    }

    @Test func keepingStampsTheTimeAndUnkeepingStampsTheRemoval() {
        var clock: Int64 = 1_000
        let marks = ReaderMarks(defaults: defaults, now: { Date(timeIntervalSince1970: Double(clock) / 1000) })
        marks.toggle(.kept, poemPath: "/a/b/c", couplet: 1)
        #expect(marks.divanItems == [DivanItem(key: "/a/b/c#1", keptAt: 1_000, removedAt: nil)])
        clock = 5_000
        marks.toggle(.kept, poemPath: "/a/b/c", couplet: 1)
        #expect(marks.divanItems == [DivanItem(key: "/a/b/c#1", keptAt: 1_000, removedAt: 5_000)])
        #expect(!marks.contains(.kept, poemPath: "/a/b/c", couplet: 1))
        clock = 9_000
        marks.toggle(.kept, poemPath: "/a/b/c", couplet: 1)
        #expect(marks.divanItems == [DivanItem(key: "/a/b/c#1", keptAt: 9_000, removedAt: 5_000)])
        #expect(marks.contains(.kept, poemPath: "/a/b/c", couplet: 1))
    }

    @Test func aCoupletIsKeptWhenKeptAtIsAfterRemovedAt() {
        #expect(DivanItem(key: "k", keptAt: 2, removedAt: 1).isKept)
        #expect(DivanItem(key: "k", keptAt: 2, removedAt: nil).isKept)
        #expect(!DivanItem(key: "k", keptAt: 2, removedAt: 2).isKept)
        #expect(!DivanItem(key: "k", keptAt: 1, removedAt: 2).isKept)
        #expect(!DivanItem(key: "k", keptAt: nil, removedAt: 2).isKept)
        #expect(!DivanItem(key: "k", keptAt: nil, removedAt: nil).isKept)
    }

    @Test func mergingTakesTheLaterOfEachTimeLikeTheServer() {
        let marks = marks()
        marks.apply([DivanItem(key: "/a/b/c#0", keptAt: 10, removedAt: 5), DivanItem(key: "/a/b/c#1", keptAt: 3, removedAt: nil)])
        marks.apply([
            DivanItem(key: "/a/b/c#0", keptAt: 8, removedAt: 20),  // removed later elsewhere
            DivanItem(key: "/a/b/c#1", keptAt: nil, removedAt: 2),  // an older removal changes nothing
            DivanItem(key: "/a/b/c#2", keptAt: 7, removedAt: nil),
        ])
        #expect(marks.divanItems == [
            DivanItem(key: "/a/b/c#0", keptAt: 10, removedAt: 20),
            DivanItem(key: "/a/b/c#1", keptAt: 3, removedAt: 2),
            DivanItem(key: "/a/b/c#2", keptAt: 7, removedAt: nil),
        ])
        #expect(marks.keys(.kept) == ["/a/b/c#1", "/a/b/c#2"])
    }

    @Test func keptItemsComeNewestFirst() {
        let marks = marks()
        marks.apply([DivanItem(key: "/a/b/c#0", keptAt: 1, removedAt: nil), DivanItem(key: "/a/b/c#1", keptAt: 9, removedAt: nil), DivanItem(key: "/a/b/c#2", keptAt: 5, removedAt: 6)])
        #expect(marks.keptItems.map(\.key) == ["/a/b/c#1", "/a/b/c#0"])
    }

    @Test func theDivanSurvivesARestartWithItsTimes() {
        let first = marks(now: 4_000)
        first.toggle(.kept, poemPath: "/a/b/c", couplet: 0)
        first.toggle(.kept, poemPath: "/a/b/c", couplet: 3)
        first.toggle(.kept, poemPath: "/a/b/c", couplet: 3)
        let reopened = marks()
        #expect(reopened.divanItems == [DivanItem(key: "/a/b/c#0", keptAt: 4_000, removedAt: nil), DivanItem(key: "/a/b/c#3", keptAt: 4_000, removedAt: 4_000)])
    }

    @Test func coupletsKeptBeforeTimestampsExistedAreMigratedWithNow() throws {
        let old = try JSONEncoder().encode([ReaderMarks.Mark.kept: Set(["/a/b/c#0", "/a/b/c#2"]), .liked: Set(["/a/b/c#5"])])
        defaults.set(old, forKey: ReaderMarks.defaultsKey)
        let marks = marks(now: 7_000)
        #expect(marks.keys(.kept) == ["/a/b/c#0", "/a/b/c#2"])
        #expect(marks.divanItems.allSatisfy { $0.keptAt == 7_000 && $0.removedAt == nil })
        #expect(marks.contains(.liked, poemPath: "/a/b/c", couplet: 5))
        // It happens once: the old record no longer holds them, and a later restart keeps the first stamp.
        let again = ReaderMarks(defaults: defaults, now: { Date(timeIntervalSince1970: 99) })
        #expect(again.divanItems.allSatisfy { $0.keptAt == 7_000 })
        #expect(again.keys(.kept).count == 2)
    }

    @Test func timesAreWrittenAsIsoStringsWithMilliseconds() throws {
        let item = DivanItem(key: "/hafez/ghazal/sh3#0", keptAt: 1_700_000_000_123, removedAt: nil)
        let json = try #require(String(data: JSONEncoder().encode(item), encoding: .utf8))
        #expect(json.contains("\"keptAt\":\"2023-11-14T22:13:20.123Z\""))
        #expect(!json.contains("removedAt"))
        let back = try JSONDecoder().decode(DivanItem.self, from: Data(#"{"key":"k","keptAt":"2023-11-14T22:13:20.123Z","removedAt":null}"#.utf8))
        #expect(back == DivanItem(key: "k", keptAt: 1_700_000_000_123, removedAt: nil))
        let plain = try JSONDecoder().decode(DivanItem.self, from: Data(#"{"key":"k","keptAt":"2023-11-14T22:13:20Z","removedAt":null}"#.utf8))
        #expect(plain.keptAt == 1_700_000_000_000)
    }
}

@MainActor
struct DivanSyncTests {
    private struct Fixture {
        var marks: ReaderMarks
        var sync: DivanSync
        var stub: StubServer
        var keychain: KeychainStore
    }

    /// A server that holds one divan and merges every PUT into it, as the real one does.
    private final class FakeDivan: @unchecked Sendable {
        private let lock = NSLock()
        private var items: [String: (kept: String?, removed: String?)] = [:]

        init(_ start: [(String, String?, String?)] = []) {
            for item in start { items[item.0] = (item.1, item.2) }
        }

        func handle(_ request: StubServer.Request) -> StubServer.Response {
            guard request.path == "/v1/me/divan" else { return .json(404, "{}") }
            lock.lock()
            defer { lock.unlock() }
            if request.method == "PUT" {
                for raw in request.json["items"] as? [[String: Any]] ?? [] {
                    guard let key = raw["key"] as? String else { continue }
                    let old = items[key] ?? (nil, nil)
                    items[key] = (Self.later(old.kept, raw["keptAt"] as? String), Self.later(old.removed, raw["removedAt"] as? String))
                }
            }
            let list = items.sorted { $0.key < $1.key }.map { key, value in
                #"{"key":"\#(key)","keptAt":\#(value.kept.map { "\"\($0)\"" } ?? "null"),"removedAt":\#(value.removed.map { "\"\($0)\"" } ?? "null")}"#
            }
            return .json(200, #"{"items":[\#(list.joined(separator: ","))]}"#)
        }

        private static func later(_ a: String?, _ b: String?) -> String? {
            switch (a, b) {
            case (let a?, let b?): max(a, b)
            default: a ?? b
            }
        }
    }

    private func fixture(server: FakeDivan = FakeDivan(), signedIn: Bool = true, debounce: Duration = .milliseconds(30)) -> Fixture {
        let keychain = KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)")
        if signedIn { keychain.write("r0") }
        let stub = StubServer { server.handle($0) }
        let session = Session(api: stub.api, store: keychain)
        let defaults = UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!
        let marks = ReaderMarks(defaults: defaults, now: { Date(timeIntervalSince1970: 2) })  // 2000 ms
        let sync = DivanSync(marks: marks, session: session, debounce: debounce)
        return Fixture(marks: marks, sync: sync, stub: stub, keychain: keychain)
    }

    private func signInAnswers(_ f: Fixture, server: FakeDivan) {
        f.stub.respond { request in
            if request.path == "/v1/auth/refresh" { return .json(200, StubJSON.session(access: "a1", refresh: "r1", username: "niloofar")) }
            return server.handle(request)
        }
    }

    @Test func aGuestNeverTouchesTheServer() async {
        let f = fixture(signedIn: false)
        defer { f.keychain.delete() }
        f.marks.toggle(.kept, poemPath: "/a/b/c", couplet: 0)
        await f.sync.syncNow()
        #expect(f.stub.requests.isEmpty)
        #expect(f.marks.keys(.kept) == ["/a/b/c#0"])
    }

    @Test func signingInPullsTheServersDivanAndPushesWhatTheServerLacks() async {
        let server = FakeDivan([("/hafez/ghazal/sh1#0", "2026-11-20T10:00:00.000Z", nil)])
        let f = fixture(server: server)
        defer { f.keychain.delete() }
        signInAnswers(f, server: server)
        f.marks.toggle(.kept, poemPath: "/saadi/g/sh2", couplet: 1)  // kept as a guest at 2000 ms
        await f.sync.syncNow()

        #expect(f.marks.keys(.kept) == ["/hafez/ghazal/sh1#0", "/saadi/g/sh2#1"])
        let puts = f.stub.requests.filter { $0.method == "PUT" }
        #expect(puts.count == 1)
        let sent = puts[0].json["items"] as? [[String: Any]]
        #expect(sent?.count == 1)  // only what the server lacked
        #expect(sent?.first?["key"] as? String == "/saadi/g/sh2#1")
        #expect(sent?.first?["keptAt"] as? String == "1970-01-01T00:00:02.000Z")
        #expect(sent?.first?["removedAt"] == nil)
        #expect(f.stub.requests.first { $0.path == "/v1/me/divan" }?.method == "GET")
    }

    @Test func nothingIsPushedWhenThePhoneAndTheServerAgree() async {
        let server = FakeDivan([("/a/b/c#0", "1970-01-01T00:00:02.000Z", nil)])
        let f = fixture(server: server)
        defer { f.keychain.delete() }
        signInAnswers(f, server: server)
        f.marks.toggle(.kept, poemPath: "/a/b/c", couplet: 0)
        await f.sync.syncNow()
        #expect(f.stub.requests.filter { $0.method == "PUT" }.isEmpty)
    }

    @Test func aRemovalElsewhereWinsWhenItIsLater() async {
        let server = FakeDivan([("/a/b/c#0", "1970-01-01T00:00:01.000Z", "2026-11-22T00:00:00.000Z")])
        let f = fixture(server: server)
        defer { f.keychain.delete() }
        signInAnswers(f, server: server)
        f.marks.apply([DivanItem(key: "/a/b/c#0", keptAt: 2_000, removedAt: nil)])
        await f.sync.syncNow()
        #expect(f.marks.keys(.kept).isEmpty)
        #expect(f.marks.divanItems.first?.removedAt != nil)
    }

    @Test func aBigDivanIsPushedInBatchesOfTwoThousand() async {
        let server = FakeDivan()
        let f = fixture(server: server)
        defer { f.keychain.delete() }
        signInAnswers(f, server: server)
        f.marks.apply((0..<4_500).map { DivanItem(key: "/a/b/c#\($0)", keptAt: 2_000, removedAt: nil) })
        await f.sync.syncNow()
        let puts = f.stub.requests.filter { $0.method == "PUT" }
        #expect(puts.map { ($0.json["items"] as? [Any])?.count } == [2_000, 2_000, 500])
    }

    @Test func aFailedSyncKeepsTheLocalDivan() async {
        let f = fixture()
        defer { f.keychain.delete() }
        f.stub.respond { request in
            request.path == "/v1/auth/refresh" ? .json(200, StubJSON.session(access: "a1", refresh: "r1")) : .offline
        }
        f.marks.toggle(.kept, poemPath: "/a/b/c", couplet: 0)
        await f.sync.syncNow()
        #expect(f.marks.keys(.kept) == ["/a/b/c#0"])
    }

    @Test func changesAreSyncedOnceAfterTheDebounce() async throws {
        let server = FakeDivan()
        let f = fixture(server: server)
        defer { f.keychain.delete() }
        signInAnswers(f, server: server)
        f.marks.toggle(.kept, poemPath: "/a/b/c", couplet: 0)
        f.sync.scheduleSync()
        f.sync.scheduleSync()
        f.sync.scheduleSync()
        #expect(f.stub.requests.filter { $0.path == "/v1/me/divan" }.isEmpty)  // not at once
        try await Task.sleep(for: .milliseconds(600))
        #expect(f.stub.requests.filter { $0.path == "/v1/me/divan" && $0.method == "GET" }.count == 1)
        #expect(f.stub.requests.filter { $0.method == "PUT" }.count == 1)
    }

    @Test func keepingACoupletSchedulesASync() async throws {
        let server = FakeDivan()
        let f = fixture(server: server)
        defer { f.keychain.delete() }
        signInAnswers(f, server: server)
        f.marks.toggle(.kept, poemPath: "/a/b/c", couplet: 4)
        try await Task.sleep(for: .milliseconds(600))
        #expect(f.stub.requests.contains { $0.method == "PUT" })
    }
}
