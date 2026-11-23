import Foundation
import Testing
@testable import Yebeyt

@MainActor
struct AccountDeletionTests {
    private struct Fixture {
        var deletion: AccountDeletion
        var session: Session
        var stub: StubServer
        var keychain: KeychainStore
        var marks: ReaderMarks
        var privacy: PrivacyStore
        var avatar: AvatarStore
        var defaults: UserDefaults
    }

    private func fixture(answer: StubServer.Response) -> Fixture {
        let keychain = KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)")
        keychain.write("r0")
        let stub = StubServer { request in
            switch (request.method, request.path) {
            case (_, "/v1/auth/refresh"): .json(200, StubJSON.session(access: "a1", refresh: "r1", username: "niloofar"))
            case ("DELETE", "/v1/me"): answer
            default: .json(404, "{}")
            }
        }
        let session = Session(api: stub.api, store: keychain)
        let defaults = UserDefaults(suiteName: "yebeyt-tests-\(UUID().uuidString)")!
        let marks = ReaderMarks(defaults: defaults)
        let privacy = PrivacyStore(session: session, defaults: defaults)
        let avatar = AvatarStore(session: session, defaults: defaults)
        return Fixture(
            deletion: AccountDeletion(session: session, marks: marks, privacy: privacy, avatar: avatar),
            session: session, stub: stub, keychain: keychain, marks: marks, privacy: privacy, avatar: avatar, defaults: defaults
        )
    }

    private func fill(_ f: Fixture) async {
        f.marks.toggle(.kept, poemPath: "/a/b/c", couplet: 0)
        f.marks.toggle(.liked, poemPath: "/a/b/c", couplet: 1)
        f.privacy.set(\.keptVisibility, to: .me)
        await f.privacy.waitForPushes()
        var face = AvatarParts.standard
        face.hair = "fire"
        await f.avatar.save(face)
    }

    @Test func deletingSendsTheCallSignsOutAndForgetsTheAccountsData() async throws {
        let f = fixture(answer: .data(Data()))
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
        #expect(f.marks.divanItems.isEmpty)
        #expect(f.marks.keys(.kept).isEmpty)
        #expect(f.privacy.settings == PrivacySettings())
        #expect(f.avatar.parts == .standard)
        // Nothing is left on the phone to come back: a restart finds the defaults.
        #expect(ReaderMarks(defaults: f.defaults).divanItems.isEmpty)
        #expect(PrivacyStore(session: f.session, defaults: f.defaults).settings == PrivacySettings())
        #expect(AvatarStore(session: f.session, defaults: f.defaults).parts == .standard)
        // The server was not asked to log out a token that no longer exists.
        #expect(f.stub.requests(to: "/v1/auth/logout").isEmpty)
    }

    @Test func whenAppleCannotBeReachedTheAccountAndTheDataStay() async {
        let f = fixture(answer: .json(502, #"{"error":"apple_revoke_failed"}"#))
        defer { f.keychain.delete() }
        await fill(f)

        let problem = await f.deletion.delete()

        #expect(problem == "الان نشد، یه کم دیگه دوباره امتحان کن")
        #expect(f.session.isSignedIn)
        #expect(f.marks.keys(.kept) == ["/a/b/c#0"])
        #expect(f.privacy.settings.keptVisibility == .me)
        #expect(f.avatar.parts.hair == "fire")
    }

    @Test func noNetworkSaysSoAndChangesNothing() async {
        let f = fixture(answer: .offline)
        defer { f.keychain.delete() }
        f.marks.toggle(.kept, poemPath: "/a/b/c", couplet: 0)
        let problem = await f.deletion.delete()
        #expect(problem == APIError.network.persianMessage)
        #expect(f.session.isSignedIn)
        #expect(f.marks.keys(.kept).count == 1)
    }
}
