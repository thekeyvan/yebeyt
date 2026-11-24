import Foundation
import Testing
@testable import Yebeyt

/// A server for the leaving tests: it keeps a divan, a privacy patch and a face, and answers deleting and signing out.
private final class LeavingServer: @unchecked Sendable {
    private let lock = NSLock()
    private var divan: [String: String] = [:]  // key → keptAt
    var deleteAnswer: StubServer.Response = .data(Data())

    /// Another account: nothing is stored for it.
    func newAccount() {
        lock.withLock { divan = [:] }
    }

    func handle(_ request: StubServer.Request) -> StubServer.Response {
        switch (request.method, request.path) {
        case (_, "/v1/auth/refresh"): return .json(200, StubJSON.session(access: "a1", refresh: "r1", username: "niloofar"))
        case ("DELETE", "/v1/me"): return deleteAnswer
        case (_, "/v1/me/divan"):
            return lock.withLock {
                for raw in request.json["items"] as? [[String: Any]] ?? [] {
                    if let key = raw["key"] as? String, let kept = raw["keptAt"] as? String { divan[key] = kept }
                }
                let list = divan.sorted { $0.key < $1.key }.map { #"{"key":"\#($0.key)","keptAt":"\#($0.value)","removedAt":null}"# }
                return .json(200, #"{"items":[\#(list.joined(separator: ","))]}"#)
            }
        case (_, "/v1/me/privacy"): return .json(200, #"{"keptVisibility":"friends","dailyVisibility":"friends","showOnline":true,"inGlobalLeaderboard":false,"messagesFrom":"friends","gameInvitesFrom":"all","allowReposts":true}"#)
        case ("PUT", "/v1/me/avatar"): return .json(200, StubJSON.user(username: "niloofar"))
        case (_, "/v1/auth/logout"): return .json(204, "")
        default: return .json(404, "{}")
        }
    }
}

@MainActor
struct AccountLeavingTests {
    @MainActor private struct Fixture {
        var data: LocalAccountData
        var deletion: AccountDeletion
        var signOut: AccountSignOut
        var sync: DivanSync
        var session: Session
        var stub: StubServer
        var server: LeavingServer
        var keychain: KeychainStore
        var marks: ReaderMarks { data.marks }
        var privacy: PrivacyStore { data.privacy }
        var avatar: AvatarStore { data.avatar }
        var defaults: UserDefaults
    }

    private func fixture(deleteAnswer: StubServer.Response = .data(Data())) -> Fixture {
        let keychain = KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)")
        keychain.write("r0")
        let server = LeavingServer()
        server.deleteAnswer = deleteAnswer
        let stub = StubServer { server.handle($0) }
        let session = Session(api: stub.api, store: keychain)
        let defaults = UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!
        let marks = ReaderMarks(defaults: defaults, now: { Date(timeIntervalSince1970: 5) })
        let data = LocalAccountData(marks: marks, privacy: PrivacyStore(session: session, defaults: defaults), avatar: AvatarStore(session: session, defaults: defaults))
        let sync = DivanSync(marks: marks, session: session, debounce: .seconds(600))
        return Fixture(
            data: data, deletion: AccountDeletion(session: session, data: data),
            signOut: AccountSignOut(session: session, data: data, divanSync: sync),
            sync: sync, session: session, stub: stub, server: server, keychain: keychain, defaults: defaults
        )
    }

    private func fill(_ f: Fixture) async {
        f.marks.toggle(.kept, poemPath: "/a/b/c", couplet: 0)
        f.marks.toggle(.liked, poemPath: "/a/b/c", couplet: 1)
        f.marks.toggle(.reposted, poemPath: "/a/b/c", couplet: 2)
        f.privacy.set(\.keptVisibility, to: .me)
        await f.privacy.flush()
        var face = AvatarParts.standard
        face.hair = "fire"
        f.avatar.save(face)
        await f.avatar.flush()
    }

    private func expectNothingLeft(_ f: Fixture) {
        #expect(f.marks.divanItems.isEmpty)
        #expect(f.marks.keys(.kept).isEmpty && f.marks.keys(.liked).isEmpty && f.marks.keys(.reposted).isEmpty)
        #expect(f.privacy.settings == PrivacySettings() && !f.privacy.hasUnsentChanges)
        #expect(f.avatar.parts == .standard && !f.avatar.isUnsent)
        // A restart finds the same: nothing is stored on the phone.
        let reopened = ReaderMarks(defaults: f.defaults)
        #expect(reopened.divanItems.isEmpty && reopened.keys(.liked).isEmpty && reopened.keys(.reposted).isEmpty)
        #expect(PrivacyStore(session: f.session, defaults: f.defaults).settings == PrivacySettings())
        #expect(AvatarStore(session: f.session, defaults: f.defaults).parts == .standard)
    }

    // MARK: Deleting

    @Test func deletingSendsTheCallSignsOutAndForgetsTheAccountsData() async throws {
        let f = fixture()
        defer { f.keychain.delete() }
        await fill(f)
        #expect(f.session.isSignedIn)

        let problem = await f.deletion.delete()

        #expect(problem == nil)
        let call = try #require(f.stub.requests(to: "/v1/me").first)
        #expect(call.method == "DELETE")
        #expect(call.authorization == "Bearer a1")
        #expect(!f.session.isSignedIn)
        #expect(f.keychain.load() == .none)
        expectNothingLeft(f)
        // The server was not asked to log out a token that no longer exists.
        #expect(f.stub.requests(to: "/v1/auth/logout").isEmpty)
    }

    @Test func whenAppleCannotBeReachedTheAccountAndTheDataStay() async {
        let f = fixture(deleteAnswer: .json(502, #"{"error":"apple_revoke_failed"}"#))
        defer { f.keychain.delete() }
        await fill(f)

        let problem = await f.deletion.delete()

        #expect(problem == "الان نشد، یه کم دیگه دوباره امتحان کن")
        #expect(f.session.isSignedIn)
        #expect(f.marks.keys(.kept) == ["/a/b/c#0"])
        #expect(f.marks.keys(.liked) == ["/a/b/c#1"])
        #expect(f.privacy.settings.keptVisibility == .me)
        #expect(f.avatar.parts.hair == "fire")
    }

    @Test func noNetworkSaysSoAndChangesNothing() async {
        let f = fixture(deleteAnswer: .offline)
        defer { f.keychain.delete() }
        f.marks.toggle(.kept, poemPath: "/a/b/c", couplet: 0)
        let problem = await f.deletion.delete()
        #expect(problem == APIError.network.persianMessage)
        #expect(f.session.isSignedIn)
        #expect(f.marks.keys(.kept).count == 1)
    }

    // MARK: Signing out

    @Test func signingOutSyncsOnceMoreThenForgetsTheAccountsData() async throws {
        let f = fixture()
        defer { f.keychain.delete() }
        f.marks.toggle(.kept, poemPath: "/a/b/c", couplet: 0)  // not synced yet
        f.marks.toggle(.liked, poemPath: "/a/b/c", couplet: 1)
        f.privacy.set(\.allowReposts, to: false)
        var face = AvatarParts.standard
        face.mouth = "grin"
        f.avatar.save(face)

        await f.signOut.signOut()

        // Everything made on this phone reached the account before it was left.
        let divanPut = try #require(f.stub.requests(to: "/v1/me/divan").first { $0.method == "PUT" })
        #expect((divanPut.json["items"] as? [[String: Any]])?.first?["key"] as? String == "/a/b/c#0")
        #expect(f.stub.requests(to: "/v1/me/privacy").contains { $0.method == "PUT" && $0.json["allowReposts"] as? Bool == false })
        #expect(f.stub.requests(to: "/v1/me/avatar").contains { $0.method == "PUT" })
        #expect(!f.session.isSignedIn)
        #expect(f.stub.requests(to: "/v1/auth/logout").count == 1)
        expectNothingLeft(f)
    }

    @Test func ifTheLastSyncFailsSigningOutWaitsAndNothingIsLost() async {
        let f = fixture()
        defer { f.keychain.delete() }
        f.marks.toggle(.kept, poemPath: "/a/b/c", couplet: 0)
        f.stub.respond { request in request.path == "/v1/auth/refresh" ? f.server.handle(request) : .offline }

        let outcome = await f.signOut.signOut()

        #expect(outcome == .unsynced)
        #expect(f.session.isSignedIn)
        #expect(f.marks.keys(.kept) == ["/a/b/c#0"])
        #expect(f.stub.requests(to: "/v1/auth/logout").isEmpty)
    }

    @Test func insistingSignsOutEvenThoughTheSyncFailed() async {
        let f = fixture()
        defer { f.keychain.delete() }
        f.marks.toggle(.kept, poemPath: "/a/b/c", couplet: 0)
        f.marks.toggle(.liked, poemPath: "/a/b/c", couplet: 1)
        f.stub.respond { request in request.path == "/v1/auth/refresh" ? f.server.handle(request) : .offline }
        #expect(await f.signOut.signOut() == .unsynced)

        let outcome = await f.signOut.signOut(force: true)

        #expect(outcome == .done)
        #expect(!f.session.isSignedIn)
        expectNothingLeft(f)
    }

    @Test func unsentPrivacyOrFaceAlsoHoldsBackSigningOut() async {
        let f = fixture()
        defer { f.keychain.delete() }
        f.stub.respond { request in request.path == "/v1/auth/refresh" ? f.server.handle(request) : request.path == "/v1/me/divan" ? f.server.handle(request) : .offline }
        f.privacy.set(\.showOnline, to: false)  // the server cannot be reached for it
        #expect(await f.signOut.signOut() == .unsynced)
        #expect(f.session.isSignedIn)
        #expect(f.privacy.hasUnsentChanges)
    }

    @Test func anotherPersonSigningInAfterwardsGetsNothingOfTheFirstOnes() async {
        let f = fixture()
        defer { f.keychain.delete() }
        await fill(f)
        await f.signOut.signOut()
        f.server.newAccount()  // the next sign-in is a different account
        let putsBefore = f.stub.requests.filter { $0.method == "PUT" }.count

        f.session.apply(APISession(accessToken: "a2", refreshToken: "r2", user: APIUser(
            id: "00000000-0000-0000-0000-000000000002", username: "second", displayName: nil, usernameChangedAt: nil,
            createdAt: "2026-11-23T08:00:00.000Z", providers: [.google]
        )))
        await f.sync.syncNow()
        await f.data.privacy.refresh()
        await f.data.avatar.reconcile(with: f.session.user)

        #expect(f.stub.requests.filter { $0.method == "PUT" }.count == putsBefore)  // nothing of the first account is sent
        expectNothingLeft(f)
        f.keychain.delete()
    }
}
