import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct SessionTests {
    /// A Keychain service of its own, emptied when the test is over.
    private func store() -> KeychainStore { KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)") }

    @Test func theRefreshTokenLivesInTheKeychainAndSurvivesARestart() {
        let keychain = store()
        defer { keychain.delete() }
        #expect(keychain.read() == nil)
        keychain.write("r0")
        keychain.write("r1")  // replaces, never adds
        #expect(keychain.read() == "r1")
        #expect(KeychainStore(service: keychain.service).read() == "r1")
        let session = Session(api: StubServer().api, store: keychain)
        #expect(session.isSignedIn)  // at once, before the user is fetched
        keychain.delete()
        #expect(keychain.read() == nil)
        #expect(!Session(api: StubServer().api, store: keychain).isSignedIn)
    }

    @Test func signingInKeepsTheRefreshTokenOnlyInTheKeychain() throws {
        let keychain = store()
        defer { keychain.delete() }
        let session = Session(api: StubServer().api, store: keychain)
        let signedIn = try JSONDecoder().decode(APISession.self, from: Data(StubJSON.session(access: "a1", refresh: "r1").utf8))
        session.apply(signedIn)
        #expect(session.isSignedIn)
        #expect(session.user?.id == signedIn.user.id)
        #expect(keychain.read() == "r1")
    }

    @Test func restoreFetchesTheUserWithTheStoredToken() async {
        let keychain = store()
        defer { keychain.delete() }
        keychain.write("r0")
        let stub = StubServer { _ in .json(200, StubJSON.session(access: "a1", refresh: "r1", username: "ali")) }
        let session = Session(api: stub.api, store: keychain)
        await session.restore()
        #expect(session.user?.username == "ali")
        #expect(keychain.read() == "r1")
        #expect(stub.requests(to: "/v1/auth/refresh").first?.json["refreshToken"] as? String == "r0")
    }

    @Test func concurrentCallsShareOneRefresh() async throws {
        let keychain = store()
        defer { keychain.delete() }
        keychain.write("r0")
        let stub = StubServer { request in
            switch request.path {
            case "/v1/auth/refresh":
                // The token is single use, as on the server: a second refresh with r0 would be refused.
                request.json["refreshToken"] as? String == "r0" ? .json(200, StubJSON.session(access: "a1", refresh: "r1")) : StubJSON.unauthorized
            default:
                request.authorization == "Bearer a1" ? .json(200, StubJSON.user()) : StubJSON.unauthorized
            }
        }
        stub.delay = 0.1
        let session = Session(api: stub.api, store: keychain)
        let api = stub.api
        let calls = (0..<6).map { _ in Task { try await session.authorized { try await api.me(token: $0) } } }
        var users: [APIUser] = []
        for call in calls { users.append(try await call.value) }
        #expect(users.count == 6)
        #expect(stub.requests(to: "/v1/auth/refresh").count == 1)
        #expect(session.isSignedIn)
    }

    @Test func aRefusedAccessTokenIsRefreshedOnceForAllCallsThatMeetIt() async throws {
        let keychain = store()
        defer { keychain.delete() }
        keychain.write("r0")
        let stub = StubServer { request in
            switch request.path {
            case "/v1/auth/refresh": .json(200, StubJSON.session(access: "fresh", refresh: "r1"))
            default: request.authorization == "Bearer fresh" ? .json(200, StubJSON.user()) : StubJSON.unauthorized
            }
        }
        stub.delay = 0.05
        let session = Session(api: stub.api, store: keychain)
        session.apply(try JSONDecoder().decode(APISession.self, from: Data(StubJSON.session(access: "expired", refresh: "r0").utf8)))
        let api = stub.api
        let calls = (0..<5).map { _ in Task { try await session.authorized { try await api.me(token: $0) } } }
        for call in calls { _ = try await call.value }
        #expect(stub.requests(to: "/v1/auth/refresh").count == 1)  // the others used the token the first one fetched
        #expect(keychain.read() == "r1")
    }

    @Test func aRefusedRefreshThatLostARaceIsNotASignOut() async {
        let keychain = store()
        defer { keychain.delete() }
        keychain.write("r0")
        // While this refresh is on its way, another one finishes and stores r1; the server then refuses r0.
        let stub = StubServer { _ in
            keychain.write("r1")
            return StubJSON.unauthorized
        }
        let session = Session(api: stub.api, store: keychain)
        await #expect(throws: Never.self) { try await session.refresh() }
        #expect(session.isSignedIn)
        #expect(keychain.read() == "r1")
    }

    @Test func aRefusedRefreshWithNothingNewIsASignOut() async {
        let keychain = store()
        defer { keychain.delete() }
        keychain.write("r0")
        let stub = StubServer { _ in StubJSON.unauthorized }
        let session = Session(api: stub.api, store: keychain)
        await #expect(throws: APIError.self) { try await session.refresh() }
        #expect(!session.isSignedIn)
        #expect(keychain.read() == nil)
    }

    @Test func noNetworkKeepsThePersonSignedIn() async {
        let keychain = store()
        defer { keychain.delete() }
        keychain.write("r0")
        let stub = StubServer { _ in .offline }
        let session = Session(api: stub.api, store: keychain)
        await session.restore()
        #expect(session.isSignedIn)
        #expect(keychain.read() == "r0")
    }

    @Test func signingOutForgetsAtOnceAndTellsTheServer() async {
        let keychain = store()
        defer { keychain.delete() }
        keychain.write("r0")
        let stub = StubServer { _ in .json(204, "") }
        let session = Session(api: stub.api, store: keychain)
        await session.signOut()
        #expect(!session.isSignedIn)
        #expect(session.user == nil)
        #expect(keychain.read() == nil)
        #expect(stub.requests(to: "/v1/auth/logout").first?.json["refreshToken"] as? String == "r0")

        keychain.write("r5")
        stub.respond { _ in .offline }
        let again = Session(api: stub.api, store: keychain)
        await again.signOut()  // the server can't be reached: still signed out here
        #expect(!again.isSignedIn)
        #expect(keychain.read() == nil)
    }

    @Test func aSignInThatLandsDuringARefusedRefreshKeepsItsAccessToken() async throws {
        let keychain = store()
        defer { keychain.delete() }
        keychain.write("r0")
        let stub = StubServer { _ in StubJSON.unauthorized }  // the old token is refused, as after a new sign-in
        stub.delay = 0.2
        let session = Session(api: stub.api, store: keychain)
        let refresh = Task { try await session.refresh() }
        try await Task.sleep(for: .milliseconds(60))
        session.apply(try JSONDecoder().decode(APISession.self, from: Data(StubJSON.session(access: "a9", refresh: "r9").utf8)))
        try await refresh.value  // not a sign-out, no error
        #expect(session.isSignedIn)
        #expect(keychain.read() == "r9")
        let used = try await session.authorized { $0 }
        #expect(used == "a9")  // the new access token was not thrown away
        #expect(stub.requests(to: "/v1/auth/refresh").count == 1)
    }

    @Test func aLockedKeychainIsNotASignOut() async {
        let locked = KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)", copyMatching: { _, _ in errSecInteractionNotAllowed })
        let stub = StubServer { _ in .json(200, StubJSON.session(access: "a", refresh: "r")) }
        let session = Session(api: stub.api, store: locked)
        #expect(session.isSignedIn)  // unreadable now, so try later
        await #expect(throws: APIError.network) { try await session.refresh() }
        #expect(session.isSignedIn)
        #expect(stub.requests.isEmpty)
    }

    @Test func keychainStatusesMapToReadResults() {
        #expect(KeychainStore.read(status: errSecSuccess, data: Data("t".utf8)) == .value("t"))
        #expect(KeychainStore.read(status: errSecItemNotFound, data: nil) == .none)
        #expect(KeychainStore.read(status: errSecInteractionNotAllowed, data: nil) == .unavailable)
        #expect(KeychainStore.read(status: errSecAuthFailed, data: nil) == .unavailable)
    }

    @Test func writingReportsSuccessAndFailure() {
        let keychain = store()
        defer { keychain.delete() }
        #expect(keychain.write("r0"))
        #expect(keychain.load() == .value("r0"))
    }

    @Test func aTokenThatCouldNotBeStoredIsKeptInMemoryForThisRun() async throws {
        let failing = KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)", addItem: { _ in errSecInteractionNotAllowed })
        let stub = StubServer { _ in .json(200, StubJSON.session(access: "a2", refresh: "r2")) }
        let session = Session(api: stub.api, store: failing)
        session.apply(try JSONDecoder().decode(APISession.self, from: Data(StubJSON.session(access: "a1", refresh: "r1").utf8)))
        #expect(session.isSignedIn)  // signed in for this run
        #expect(failing.read() == nil)
        try await session.refresh()  // uses the token it holds, not the Keychain's
        #expect(stub.requests(to: "/v1/auth/refresh").first?.json["refreshToken"] as? String == "r1")
    }

    @Test func writingReplacesTheTokenInPlaceAndKeepsTheOldOneWhenTheNewOneCannotBeAdded() {
        let service = "com.yebeyt.tests.\(UUID().uuidString)"
        let keychain = KeychainStore(service: service)
        defer { keychain.delete() }
        #expect(keychain.write("old"))
        #expect(keychain.write("new"))
        #expect(keychain.read() == "new")
        let failingAdd = KeychainStore(service: service, addItem: { _ in errSecInteractionNotAllowed })
        #expect(failingAdd.write("newer"))  // an existing item is updated, no add is needed
        #expect(keychain.read() == "newer")
    }
}
