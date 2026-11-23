import CryptoKit
import Foundation
import Testing
@testable import Yebeyt

/// A provider that answers at once (or says no), for the sign-in flow.
private struct FakeCredentials: CredentialSource {
    var result: Result<ProviderSignIn, SignInError>
    func signIn(with provider: AuthProvider) async throws -> ProviderSignIn { try result.get() }

    static func google(name: String? = "Niloofar") -> FakeCredentials {
        FakeCredentials(result: .success(ProviderSignIn(credential: .google(idToken: "google-id-token"), name: name)))
    }

    static let apple = FakeCredentials(result: .success(ProviderSignIn(credential: .apple(identityToken: "apple-id-token", authorizationCode: "code-1", nonce: "raw"), name: nil)))
    static let canceled = FakeCredentials(result: .failure(.canceled))
}

struct NonceTests {
    @Test func theNonceIsRandomAndLongEnough() {
        let nonces = (0..<20).map { _ in AppleNonce.random() }
        #expect(Set(nonces).count == 20)
        #expect(nonces.allSatisfy { $0.count == 32 })
        #expect(AppleNonce.random(length: 64).count == 64)
    }

    @Test func appleGetsTheHashAndTheServerTheRawValue() {
        // SHA-256 of «abc» is a well-known value, lower-case hex like the server's.
        #expect(AppleNonce.sha256("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        let raw = AppleNonce.random()
        #expect(AppleNonce.sha256(raw) == SHA256.hash(data: Data(raw.utf8)).map { String(format: "%02x", $0) }.joined())
        #expect(AppleNonce.sha256(raw) != raw)
        #expect(AppleNonce.sha256(raw).count == 64)
    }
}

@MainActor
struct AccountModelTests {
    private struct Fixture {
        var account: AccountModel
        var session: Session
        var stub: StubServer
        var stats: GameStats
        var keychain: KeychainStore
    }

    private func fixture(credentials: FakeCredentials, signedIn: Bool = false, username: String? = nil, stats: GameStats? = nil) -> Fixture {
        let keychain = KeychainStore(service: "com.yebeyt.tests.\(UUID().uuidString)")
        if signedIn { keychain.write("r0") }
        let stub = StubServer { request in
            switch request.path {
            case "/v1/auth/google", "/v1/auth/apple": .json(200, StubJSON.session(access: "a1", refresh: "r1", username: username))
            case "/v1/me/username": .json(200, StubJSON.user(username: request.json["username"] as? String))
            case "/v1/me/profile": .json(200, StubJSON.user(username: "niloofar", displayName: request.json["displayName"] as? String))
            case "/v1/me/progress": .json(200, #"{"points":0,"streakDays":0,"streakLastDate":null,"bestByGame":{}}"#)
            default: .json(404, "{}")
            }
        }
        let stats = stats ?? GameStats(defaults: GameFixtures.defaults())
        let session = Session(api: stub.api, store: keychain)
        return Fixture(account: AccountModel(session: session, stats: stats, credentials: credentials), session: session, stub: stub, stats: stats, keychain: keychain)
    }

    // MARK: Gate triggers

    @Test func aGuestIsStoppedByTheGateAndTheActionWaits() {
        let f = fixture(credentials: .google())
        defer { f.keychain.delete() }
        var ran = 0
        f.account.require(.likes) { ran += 1 }
        #expect(ran == 0)
        #expect(f.account.prompt == .gate(.likes))
    }

    @Test func aSignedInPersonGoesStraightThrough() {
        let f = fixture(credentials: .google(), signedIn: true)
        defer { f.keychain.delete() }
        var ran = 0
        f.account.require(.messages) { ran += 1 }
        #expect(ran == 1)
        #expect(f.account.prompt == nil)
    }

    @Test func laterDropsTheActionAndClosesTheGate() {
        let f = fixture(credentials: .google())
        defer { f.keychain.delete() }
        var ran = 0
        f.account.require(.likes) { ran += 1 }
        f.account.dismissPrompt()
        #expect(f.account.prompt == nil)
        f.account.finishPrompt()
        #expect(ran == 0)
    }

    @Test func theGateTitlesFitTheCopy() {
        #expect("برای \(AccountFeature.likes.title) یه حساب لازمه" == "برای پسند و بازنشر یه حساب لازمه")
        #expect("برای \(AccountFeature.messages.title) یه حساب لازمه" == "برای پیام دادن به دوستات یه حساب لازمه")
    }

    @Test func afterSigningInFromTheGateTheActionGoesAheadWhenThereIsAUsername() async {
        let f = fixture(credentials: .google(), username: "niloofar")
        defer { f.keychain.delete() }
        var ran = 0
        f.account.require(.likes) { ran += 1 }
        let error = await f.account.signInFromGate(with: .google)
        #expect(error == nil)
        #expect(ran == 1)
        #expect(f.account.prompt == nil)
        #expect(f.session.isSignedIn)
        #expect(f.keychain.read() == "r1")
    }

    @Test func aNewAccountGoesThroughTheUsernameBeforeTheActionRuns() async {
        let f = fixture(credentials: .google())
        defer { f.keychain.delete() }
        var ran = 0
        f.account.require(.messages) { ran += 1 }
        _ = await f.account.signInFromGate(with: .google)
        #expect(f.account.prompt == .username)
        #expect(ran == 0)
        let error = await f.account.saveProfile(displayName: " Niloofar ", username: "niloofar")
        #expect(error == nil)
        f.account.finishPrompt()
        #expect(ran == 1)
        #expect(f.account.prompt == nil)
    }

    @Test func aCanceledSheetChangesNothingAndAFailureShowsAPersianLine() async {
        let canceled = fixture(credentials: .canceled)
        defer { canceled.keychain.delete() }
        canceled.account.require(.likes) {}
        #expect(await canceled.account.signInFromGate(with: .apple) == nil)
        #expect(canceled.account.prompt == .gate(.likes))
        #expect(!canceled.session.isSignedIn)

        let failing = fixture(credentials: .google())
        defer { failing.keychain.delete() }
        failing.stub.respond { _ in .json(401, #"{"error":"invalid_token"}"#) }
        failing.account.require(.likes) {}
        let message = await failing.account.signInFromGate(with: .google)
        #expect(message == APIError.server(status: 401, code: .invalidToken, allowedAt: nil).persianMessage)
        #expect(failing.account.prompt == .gate(.likes))
    }

    // MARK: Sign-in requests

    @Test func appleSendsTheIdentityTokenTheCodeAndTheRawNonce() async {
        let f = fixture(credentials: .apple, username: "ali")
        defer { f.keychain.delete() }
        let outcome = await f.account.signIn(with: .apple)
        #expect(outcome == .signedIn(needsUsername: false))
        let request = f.stub.requests(to: "/v1/auth/apple").first
        #expect(request?.json["identityToken"] as? String == "apple-id-token")
        #expect(request?.json["authorizationCode"] as? String == "code-1")
        #expect(request?.json["nonce"] as? String == "raw")
        #expect(f.account.provider == .apple)
    }

    @Test func theProvidersNameOnlyFillsTheNameField() async {
        let f = fixture(credentials: .google(name: "Niloofar Sh"))
        defer { f.keychain.delete() }
        _ = await f.account.signIn(with: .google)
        #expect(f.account.providerName == "Niloofar Sh")
        #expect(f.stub.requests.allSatisfy { !String(decoding: $0.body, as: UTF8.self).contains("Niloofar") })  // never sent by sign-in
        _ = await f.account.saveProfile(displayName: "Niloofar Sh", username: "niloofar")
        #expect(f.stub.requests(to: "/v1/me/profile").first?.json["displayName"] as? String == "Niloofar Sh")
        #expect(f.account.providerName == nil)
    }

    @Test func savingSendsTheUsernameAndTheTrimmedName() async {
        let f = fixture(credentials: .google(), signedIn: true)
        defer { f.keychain.delete() }
        f.stub.respond { request in
            switch request.path {
            case "/v1/auth/refresh": .json(200, StubJSON.session(access: "a1", refresh: "r1"))
            default: .json(200, StubJSON.user(username: "ali", displayName: "علی"))
            }
        }
        #expect(await f.account.saveProfile(displayName: "  علی ", username: "ali") == nil)
        #expect(f.stub.requests(to: "/v1/me/username").first?.json["username"] as? String == "ali")
        #expect(f.stub.requests(to: "/v1/me/profile").first?.json["displayName"] as? String == "علی")
        #expect(f.session.user?.displayName == "علی")
    }

    @Test func aTakenUsernameComesBackAsPersianCopy() async {
        let f = fixture(credentials: .google(), signedIn: true)
        defer { f.keychain.delete() }
        f.stub.respond { request in
            request.path == "/v1/auth/refresh" ? .json(200, StubJSON.session(access: "a1", refresh: "r1")) : .json(409, #"{"error":"username_taken"}"#)
        }
        #expect(await f.account.saveProfile(displayName: "", username: "ali") == "قبلاً گرفته شده")
    }

    // MARK: Guest progress

    @Test func guestProgressGoesToTheAccountRightAfterSignIn() async throws {
        let stats = GameStats(defaults: GameFixtures.defaults(), now: { GameFixtures.tehran("2026-11-23T10:00:00Z") })
        stats.record(DailyRecord(tries: ["مصام"], outcome: .solved, points: 100), on: stats.today)
        stats.award(40)
        stats.raiseBest(.jigsaw, to: 215)
        let f = fixture(credentials: .google(), username: "ali", stats: stats)
        defer { f.keychain.delete() }
        _ = await f.account.signIn(with: .google)
        let sent = try #require(f.stub.requests(to: "/v1/me/progress").first)
        #expect(sent.method == "PUT")
        #expect(sent.authorization == "Bearer a1")
        #expect(sent.json["points"] as? Int == 140)
        #expect(sent.json["streakDays"] as? Int == 1)
        #expect(sent.json["streakLastDate"] as? String == "2026-11-23")
        #expect(sent.json["bestByGame"] as? [String: Int] == ["daily": 100, "jigsaw": 215])
    }

    @Test func aGuestWithNothingSendsNothing() async {
        let f = fixture(credentials: .google(), username: "ali")
        defer { f.keychain.delete() }
        _ = await f.account.signIn(with: .google)
        #expect(f.stub.requests(to: "/v1/me/progress").isEmpty)
    }

    @Test func theStreaksLastDayIsYesterdayWhenTodaysPuzzleIsNotSolvedYet() {
        let stats = GameStats(defaults: GameFixtures.defaults(), now: { GameFixtures.tehran("2026-11-23T10:00:00Z") })
        stats.record(DailyRecord(tries: ["م"], outcome: .solved, points: 100), on: stats.today.previous)
        let payload = ProgressPayload(stats: stats)
        #expect(payload.streakDays == 1)
        #expect(payload.streakLastDate == "2026-11-22")
        #expect(ProgressPayload(stats: GameStats(defaults: GameFixtures.defaults())).streakLastDate == nil)
    }

    // MARK: Username required, name limit, order

    @Test func signedInWithoutAUsernameTheActionWaitsForTheUsernameStep() async {
        let f = fixture(credentials: .google(), username: nil)
        defer { f.keychain.delete() }
        _ = await f.account.signIn(with: .google)  // signed in, no username
        var ran = 0
        f.account.require(.likes) { ran += 1 }
        #expect(ran == 0)
        #expect(f.account.prompt == .username)
        _ = await f.account.saveProfile(displayName: "", username: "niloofar")
        f.account.finishPrompt()
        #expect(ran == 1)
        f.account.require(.likes) { ran += 1 }  // now there is a username: straight through
        #expect(ran == 2)
    }

    @Test func takingBackALikeNeedsNoAccount() {
        let f = fixture(credentials: .google())
        defer { f.keychain.delete() }
        var ran = 0
        f.account.require(.likes, needed: false) { ran += 1 }
        #expect(ran == 1)
        #expect(f.account.prompt == nil)
    }

    @Test func theNameIsLimitedToThirtyCharactersOnThePhoneToo() async {
        #expect(DisplayNameRules.problem(String(repeating: "ن", count: 30)) == nil)
        #expect(DisplayNameRules.problem(String(repeating: "ن", count: 31)) == .tooLong)
        #expect(DisplayNameRules.Problem.tooLong.message == "حداکثر ۳۰ حرف")
        #expect(DisplayNameRules.problem("a\nb") == .controlChars)
        #expect(DisplayNameRules.problem("") == nil)
        let f = fixture(credentials: .google(), signedIn: true)
        defer { f.keychain.delete() }
        let message = await f.account.saveProfile(displayName: String(repeating: "ن", count: 31), username: "niloofar")
        #expect(message == "حداکثر ۳۰ حرف")
        #expect(f.stub.requests.isEmpty)  // nothing was sent
    }

    @Test func aFailedNameLeavesTheUsernameUntouched() async {
        let f = fixture(credentials: .google(), signedIn: true)
        defer { f.keychain.delete() }
        f.stub.respond { request in
            switch request.path {
            case "/v1/auth/refresh": .json(200, StubJSON.session(access: "a1", refresh: "r1"))
            case "/v1/me/profile": .json(400, #"{"error":"invalid_request"}"#)
            default: .json(200, StubJSON.user(username: "niloofar"))
            }
        }
        let message = await f.account.saveProfile(displayName: "نیلوفر", username: "niloofar")
        #expect(message != nil)
        #expect(f.stub.requests(to: "/v1/me/username").isEmpty)  // not half done
    }

    @Test func theNameIsSavedBeforeTheUsername() async {
        let f = fixture(credentials: .google(), signedIn: true)
        defer { f.keychain.delete() }
        f.stub.respond { request in
            request.path == "/v1/auth/refresh" ? .json(200, StubJSON.session(access: "a1", refresh: "r1")) : .json(200, StubJSON.user(username: "ali", displayName: "علی"))
        }
        _ = await f.account.saveProfile(displayName: "علی", username: "ali")
        let order = f.stub.requests.map(\.path).filter { $0.hasPrefix("/v1/me/") }
        #expect(order == ["/v1/me/profile", "/v1/me/username"])
    }
}
