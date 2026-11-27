import Foundation
import Testing
@testable import Yebeyt

private func userJSON(email: String?, newsOptIn: Bool) -> String {
    let email = email.map { "\"\($0)\"" } ?? "null"
    return #"{"id":"00000000-0000-0000-0000-000000000009","username":"niloofar","displayName":null,"usernameChangedAt":null,"createdAt":"2026-11-23T08:00:00.000Z","providers":["google"],"email":\#(email),"newsOptIn":\#(newsOptIn)}"#
}

@MainActor
struct NewsChoiceTests {

    private func signedIn(_ respond: @escaping @Sendable (StubServer.Request) -> StubServer.Response) -> (Session, StubServer, KeychainStore) {
        let keychain = KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)")
        keychain.write("r0")
        let stub = StubServer(respond)
        let session = Session(api: stub.api, store: keychain)
        session.apply(APISession(accessToken: "a1", refreshToken: "r1", user: APIUser(
            id: "u", username: "niloofar", displayName: nil, usernameChangedAt: nil, createdAt: "2026-11-23T08:00:00.000Z",
            providers: [.google], email: "niloofar@example.com", newsOptIn: false
        )))
        return (session, stub, keychain)
    }

    @Test func theUserDecodesTheEmailAndTheChoiceAndTakesTheirAbsence() throws {
        let full = try JSONDecoder().decode(APIUser.self, from: Data(userJSON(email: "a@gmail.com", newsOptIn: true).utf8))
        #expect(full.email == "a@gmail.com")
        #expect(full.newsOptIn == true)
        let none = try JSONDecoder().decode(APIUser.self, from: Data(userJSON(email: nil, newsOptIn: false).utf8))
        #expect(none.email == nil)
        #expect(none.newsOptIn == false)
        let old = try JSONDecoder().decode(APIUser.self, from: Data(StubJSON.user(username: "a").utf8))
        #expect(old.email == nil)
        #expect(old.newsOptIn == nil)
    }

    @Test func theRequestFollowsTheContract() async throws {
        let stub = StubServer { _ in .json(200, userJSON(email: "a@gmail.com", newsOptIn: true)) }
        let user = try await stub.api.setNews(true, token: "tok")
        #expect(user.newsOptIn == true)
        let put = try #require(stub.requests(to: "/v1/me/news").first)
        #expect(put.method == "PUT")
        #expect(put.authorization == "Bearer tok")
        #expect(put.json as? [String: Bool] == ["optIn": true])
    }

    @Test func theSwitchChangesAtOnceAndKeepsTheServersAnswer() async throws {
        let (session, stub, keychain) = signedIn { _ in .json(200, userJSON(email: "niloofar@example.com", newsOptIn: true)) }
        defer { keychain.delete() }
        let saving = Task { await NewsChoice.set(true, session: session) }
        await Task.yield()
        #expect(session.user?.newsOptIn == true)  // before the answer is in
        #expect(await saving.value == nil)
        #expect(session.user?.newsOptIn == true)
        #expect(stub.requests(to: "/v1/me/news").first?.json as? [String: Bool] == ["optIn": true])
    }

    @Test func aFailureFlipsTheSwitchBack() async {
        let (session, _, keychain) = signedIn { _ in .json(500, #"{"error":"internal_error"}"#) }
        defer { keychain.delete() }
        #expect(await NewsChoice.set(true, session: session) == .server(status: 500, code: .internalError, allowedAt: nil))
        #expect(session.user?.newsOptIn == false)
        #expect(session.user?.email == "niloofar@example.com")
    }

    @Test func goingOfflineFlipsItBackToo() async {
        let (session, stub, keychain) = signedIn { _ in .json(200, userJSON(email: "niloofar@example.com", newsOptIn: true)) }
        defer { keychain.delete() }
        #expect(await NewsChoice.set(true, session: session) == nil)
        stub.respond { _ in .offline }
        #expect(await NewsChoice.set(false, session: session) == .network)
        #expect(session.user?.newsOptIn == true)  // back to what it was
    }

    @Test func theEmailRowShowsTheAddressAndHidesAppleRelayAddresses() {
        #expect(NewsChoice.emailLine("niloofar@example.com") == "niloofar@example.com")
        #expect(NewsChoice.emailLine("x7k2@privaterelay.appleid.com") == "مخفی (اپل)")
        #expect(NewsChoice.emailLine("X7K2@PrivateRelay.AppleID.com") == "مخفی (اپل)")
        #expect(NewsChoice.emailLine("a@notprivaterelay.appleid.com.example.com") == "a@notprivaterelay.appleid.com.example.com")
        #expect(NewsChoice.emailLine(nil) == nil)
        #expect(NewsChoice.emailLine("") == nil)
    }
}
