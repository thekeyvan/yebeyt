import Foundation
import Testing
@testable import Yebeyt

/// A server that keeps likes and reposts.
private final class ReactionServer: @unchecked Sendable {
    private let lock = NSLock()
    private var stored: [String: String] = [:]  // "like|key" → time
    var pageSize = 200

    func add(_ kind: String, _ key: String, at time: String = "2026-11-20T08:00:00.000Z") { lock.withLock { stored["\(kind)|\(key)"] = time } }
    func has(_ kind: String, _ key: String) -> Bool { lock.withLock { stored["\(kind)|\(key)"] != nil } }

    func handle(_ request: StubServer.Request) -> StubServer.Response {
        switch (request.method, request.path) {
        case ("PUT", let path) where path.hasPrefix("/v1/reactions/"), ("DELETE", let path) where path.hasPrefix("/v1/reactions/"):
            let kind = String(path.dropFirst("/v1/reactions/".count))
            let key = request.query.replacingOccurrences(of: "key=", with: "").replacingOccurrences(of: "%23", with: "#")
            lock.withLock { if request.method == "PUT" { stored["\(kind)|\(key)"] = "2026-11-21T08:00:00.000Z" } else { stored["\(kind)|\(key)"] = nil } }
            return .json(200, #"{"likes":1,"reposts":0,"likedByMe":true,"repostedByMe":false}"#)
        case ("GET", "/v1/me/reactions"):
            return lock.withLock {
                let all = stored.sorted { $0.key < $1.key }
                let start = request.query.hasPrefix("cursor=") ? Int(request.query.dropFirst("cursor=".count)) ?? 0 : 0
                let page = all.dropFirst(start).prefix(pageSize)
                let items = page.map { entry -> String in
                    let parts = entry.key.split(separator: "|", maxSplits: 1).map(String.init)
                    return #"{"key":"\#(parts[1])","kind":"\#(parts[0])","at":"\#(entry.value)"}"#
                }
                let next = start + pageSize < all.count ? "\"\(start + pageSize)\"" : "null"
                return .json(200, #"{"items":[\#(items.joined(separator: ","))],"nextCursor":\#(next)}"#)
            }
        default: return .json(404, "{}")
        }
    }
}

@MainActor
struct ReactionsSyncTests {
    private struct Fixture {
        var env: SignedInStub
        var server: ReactionServer
        var marks: ReaderMarks
        var sync: ReactionsSync
    }

    private func fixture(signedIn: Bool = true) -> Fixture {
        let server = ReactionServer()
        let env = SignedInStub(signedIn: signedIn) { server.handle($0) }
        let marks = ReaderMarks(defaults: env.defaults)
        return Fixture(env: env, server: server, marks: marks, sync: ReactionsSync(marks: marks, session: env.session, defaults: env.defaults))
    }

    @Test func aLikeIsSentWithItsKeyPercentEncoded() async throws {
        let f = fixture()
        defer { f.env.cleanUp() }
        f.marks.toggle(.liked, poemPath: "/hafez/ghazal/sh3", couplet: 0)
        await f.sync.syncNow()
        let call = try #require(f.env.stub.requests(to: "/v1/reactions/like").first)
        #expect(call.method == "PUT")
        #expect(call.query == "key=/hafez/ghazal/sh3%230")
        #expect(call.authorization == "Bearer a1")
        #expect(!f.sync.hasUnsent)
    }

    @Test func takingBackARepostSendsADelete() async throws {
        let f = fixture()
        defer { f.env.cleanUp() }
        f.server.add("repost", "/a/b#1")
        f.marks.toggle(.reposted, poemPath: "/a", couplet: 1)  // not the same key: a new repost
        await f.sync.syncNow()
        f.marks.toggle(.reposted, poemPath: "/a", couplet: 1)
        await f.sync.syncNow()
        #expect(f.env.stub.requests(to: "/v1/reactions/repost").map(\.method) == ["PUT", "DELETE"])
    }

    @Test func offlineChangesWaitOnDiskAndTheLastStateOfACoupletWins() async throws {
        let f = fixture()
        defer { f.env.cleanUp() }
        f.env.respond { _ in .offline }
        f.marks.toggle(.liked, poemPath: "/a/b", couplet: 0)
        f.marks.toggle(.liked, poemPath: "/a/b", couplet: 0)  // on, then off again
        f.marks.toggle(.liked, poemPath: "/a/b", couplet: 1)
        await f.sync.flush()
        #expect(f.sync.hasUnsent)
        // A restart finds them.
        let reopened = ReactionsSync(marks: ReaderMarks(defaults: f.env.defaults), session: f.env.session, defaults: f.env.defaults)
        #expect(reopened.unsent.count == 2)
        f.env.respond { [server = f.server] in server.handle($0) }
        await f.sync.flush()
        #expect(!f.sync.hasUnsent)
        let sent = f.env.stub.requests(to: "/v1/reactions/like").suffix(2)
        #expect(sent.map(\.method) == ["DELETE", "PUT"])
        #expect(sent.map(\.query) == ["key=/a/b%230", "key=/a/b%231"])
    }

    @Test func aGuestsToggleIsNotQueued() async {
        let f = fixture(signedIn: false)
        defer { f.env.cleanUp() }
        f.marks.toggle(.liked, poemPath: "/a/b", couplet: 0)
        await f.sync.syncNow()
        #expect(!f.sync.hasUnsent)
        #expect(f.env.stub.requests.isEmpty)
    }

    @Test func aRefusedChangeIsDroppedButAFailedOneKeptForARetry() async {
        let f = fixture()
        defer { f.env.cleanUp() }
        f.env.respond { _ in .json(503, #"{"error":"unavailable"}"#) }
        f.marks.toggle(.liked, poemPath: "/a/b", couplet: 0)
        await f.sync.flush()
        #expect(f.sync.hasUnsent)
        f.env.respond { _ in .json(400, #"{"error":"invalid_request"}"#) }
        await f.sync.flush()
        #expect(!f.sync.hasUnsent)
    }

    // MARK: Pull

    @Test func signingInPullsTheServersReactionsAndTheServerWins() async {
        let f = fixture()
        defer { f.env.cleanUp() }
        f.server.add("like", "/hafez/ghazal/sh3#0")
        f.server.add("repost", "/hafez/ghazal/sh3#0")
        f.server.add("like", "/saadi/ghazal/sh1#4")
        // A like already on the phone that this account never made is not uploaded and goes.
        let phone = UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!
        let marks = ReaderMarks(defaults: phone)
        marks.toggle(.liked, poemPath: "/stale/like", couplet: 3)
        let sync = ReactionsSync(marks: marks, session: f.env.session, defaults: phone)
        let ok = await sync.syncNow()
        #expect(ok)
        #expect(marks.keys(.liked) == ["/hafez/ghazal/sh3#0", "/saadi/ghazal/sh1#4"])
        #expect(marks.keys(.reposted) == ["/hafez/ghazal/sh3#0"])
        #expect(f.env.stub.requests.filter { $0.method != "GET" && $0.path.hasPrefix("/v1/reactions") }.isEmpty)
    }

    @Test func aChangeStillUnsentSurvivesThePull() async {
        let f = fixture()
        defer { f.env.cleanUp() }
        f.server.add("like", "/a/b#0")  // liked on another phone
        f.server.add("like", "/a/b#1")
        await f.sync.syncNow()
        #expect(f.marks.keys(.liked) == ["/a/b#0", "/a/b#1"])
        f.env.respond { [server = f.server] request in request.method == "GET" ? server.handle(request) : .offline }
        f.marks.toggle(.liked, poemPath: "/a/b", couplet: 1)  // #1 is on the server, so this turns it off here…
        f.marks.toggle(.liked, poemPath: "/a/b", couplet: 2)  // …and #2 is liked here; neither could be sent
        let ok = await f.sync.syncNow()
        #expect(!ok)  // unsent changes are left
        #expect(f.marks.keys(.liked) == ["/a/b#0", "/a/b#2"])
    }

    @Test func thePullReadsEveryPage() async {
        let f = fixture()
        defer { f.env.cleanUp() }
        f.server.pageSize = 2
        for index in 0..<5 { f.server.add("like", "/a/b#\(index)") }
        await f.sync.syncNow()
        #expect(f.marks.keys(.liked).count == 5)
        #expect(f.env.stub.requests(to: "/v1/me/reactions").count == 3)
    }

    // MARK: Signing out

    @Test func clearingForgetsTheUnsentChanges() async {
        let f = fixture()
        defer { f.env.cleanUp() }
        f.env.respond { _ in .offline }
        f.marks.toggle(.liked, poemPath: "/a/b", couplet: 0)
        await f.sync.flush()
        f.sync.clear()
        #expect(!f.sync.hasUnsent)
        #expect(!ReactionsSync(marks: ReaderMarks(defaults: f.env.defaults), session: f.env.session, defaults: f.env.defaults).hasUnsent)
    }
}
